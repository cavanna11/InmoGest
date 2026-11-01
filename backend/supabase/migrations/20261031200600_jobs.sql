-- =============================================================================
-- Operación: cola de jobs en Postgres (ARCHITECTURE "Escalabilidad"), rate limiting y health.
-- Las RPC de jobs y rate limiting solo las ejecuta service_role (worker, servidor).
-- =============================================================================

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  -- Inmobiliaria a la que pertenece el trabajo (null = tarea de plataforma). El worker usa la clave
  -- secreta, así que toda consulta del handler filtra explícitamente por este valor.
  organization_id uuid references public.organizations (id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and char_length(type) <= 100),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 1 and 200),
  status public.job_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  -- Código o mensaje técnico, sin datos personales (docs/OBSERVABILITY.md).
  last_error text check (last_error is null or char_length(last_error) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'running') = (locked_at is not null))
);

-- Un mismo evento no se encola dos veces mientras esté pendiente o en curso.
create unique index jobs_idempotency_open on public.jobs (idempotency_key)
  where idempotency_key is not null and status in ('pending', 'running');
create index jobs_status_run_after on public.jobs (status, run_after);
create index jobs_organization on public.jobs (organization_id) where organization_id is not null;

create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function app.set_updated_at();

alter table public.jobs enable row level security;
alter table public.jobs force row level security;
-- Sin políticas: authenticated y anon no tienen acceso; service_role saltea RLS.
revoke all on public.jobs from anon, authenticated;
grant all on public.jobs to service_role;

-- -----------------------------------------------------------------------------
-- Encolar (idempotente por idempotency_key). Devuelve el id del job nuevo o del existente.
-- -----------------------------------------------------------------------------
create function public.enqueue_job(
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_organization_id uuid default null,
  p_idempotency_key text default null,
  p_run_after timestamptz default null,
  p_max_attempts integer default 3
) returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.jobs (type, payload, organization_id, idempotency_key, run_after, max_attempts)
  values (p_type, coalesce(p_payload, '{}'::jsonb), p_organization_id, p_idempotency_key,
          coalesce(p_run_after, now()), p_max_attempts)
  on conflict (idempotency_key) where idempotency_key is not null and status in ('pending', 'running')
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.jobs
    where idempotency_key = p_idempotency_key and status in ('pending', 'running');
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tomar jobs: FOR UPDATE SKIP LOCKED permite varios workers sin tomar dos veces el mismo.
-- Un job "running" cuyo lock venció (worker caído) se vuelve a tomar; si ya agotó sus intentos,
-- se marca fallido.
-- -----------------------------------------------------------------------------
create function public.claim_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lock_timeout_seconds integer default 600
) returns table (
  id uuid,
  type text,
  payload jsonb,
  organization_id uuid,
  attempts integer,
  max_attempts integer
)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid worker id';
  end if;

  update public.jobs j
  set status = 'failed', locked_by = null, locked_at = null, last_error = 'lock_timeout'
  where j.status = 'running'
    and j.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
    and j.attempts >= j.max_attempts;

  return query
  with picked as (
    select j.id
    from public.jobs j
    where (j.status = 'pending' and j.run_after <= now())
       or (j.status = 'running' and j.locked_at < now() - make_interval(secs => p_lock_timeout_seconds))
    order by j.run_after, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.jobs j
  set status = 'running', locked_by = p_worker_id, locked_at = now(), attempts = j.attempts + 1
  from picked
  where j.id = picked.id
  returning j.id, j.type, j.payload, j.organization_id, j.attempts, j.max_attempts;
end;
$$;

-- Marca un job como terminado. Solo el worker que lo tomó puede cerrarlo.
create function public.complete_job(p_job_id uuid, p_worker_id text) returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  update public.jobs
  set status = 'succeeded', completed_at = now(), locked_by = null, locked_at = null, last_error = null
  where id = p_job_id and status = 'running' and locked_by = p_worker_id;
  return found;
end;
$$;

-- Registra un fallo. Si quedan intentos, se reprograma con espera exponencial (30 s, 60 s, 120 s…,
-- máximo 1 h) o la indicada; si no, queda "failed". Devuelve el estado resultante (null si no aplica).
create function public.fail_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_delay_seconds integer default null
) returns public.job_status
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status public.job_status;
begin
  update public.jobs
  set status = case when attempts < max_attempts then 'pending'::public.job_status else 'failed'::public.job_status end,
      run_after = case
        when attempts < max_attempts then now() + make_interval(
          secs => coalesce(p_retry_delay_seconds, least(3600, 30 * power(2, greatest(attempts - 1, 0)))::integer))
        else run_after
      end,
      last_error = left(coalesce(p_error, 'error'), 500),
      locked_by = null,
      locked_at = null
  where id = p_job_id and status = 'running' and locked_by = p_worker_id
  returning status into v_status;
  return v_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting de ventana fija. Devuelve true si el pedido entra en el límite.
-- -----------------------------------------------------------------------------
create function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer) returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds <= 0 or p_max < 0 then
    raise exception using errcode = '22023', message = 'invalid rate limit';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function
  public.enqueue_job(text, jsonb, uuid, text, timestamptz, integer),
  public.claim_jobs(text, integer, integer),
  public.complete_job(uuid, text),
  public.fail_job(uuid, text, text, integer),
  public.hit_rate_limit(text, integer, integer)
from public, anon, authenticated;

grant execute on function
  public.enqueue_job(text, jsonb, uuid, text, timestamptz, integer),
  public.claim_jobs(text, integer, integer),
  public.complete_job(uuid, text),
  public.fail_job(uuid, text, text, integer),
  public.hit_rate_limit(text, integer, integer)
to service_role;

-- -----------------------------------------------------------------------------
-- Health check (GET /api/health): confirma que la app llega a la base. No expone datos.
-- -----------------------------------------------------------------------------
create function public.health() returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'time', now());
$$;

revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated, service_role;
