-- =============================================================================
-- Incremento 1.1: etapas del embudo (las crea create_organization; la pantalla de configuración
-- llega en el 1.4) y progreso del asistente de configuración (F-03).
-- Código de error propio: IG010 última etapa activa de tipo ganada o perdida.
-- =============================================================================

create type public.stage_kind as enum ('open', 'won', 'lost');

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null check (position >= 0),
  kind public.stage_kind not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index pipeline_stages_org_position on public.pipeline_stages (organization_id, position);

create trigger pipeline_stages_set_updated_at before update on public.pipeline_stages
  for each row execute function app.set_updated_at();
create trigger pipeline_stages_prevent_key_change before update on public.pipeline_stages
  for each row execute function app.prevent_tenant_key_change();

-- Siempre tiene que quedar al menos una etapa activa de tipo ganada y una de tipo perdida (PRD §6).
create function app.enforce_terminal_stages() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'open' or not old.is_active then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.is_active and new.kind = old.kind then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then
    return old;
  end if;

  perform 1 from public.pipeline_stages
  where organization_id = old.organization_id and id <> old.id and kind = old.kind and is_active
  for update;
  if not found then
    raise exception using errcode = 'IG010', message = 'last_terminal_stage', detail = old.kind::text;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pipeline_stages_enforce_terminal
  before update or delete on public.pipeline_stages
  for each row execute function app.enforce_terminal_stages();

-- -----------------------------------------------------------------------------
-- Progreso del asistente (CU-01 paso 5): datos y logo → equipo → WhatsApp → importar o cargar.
-- -----------------------------------------------------------------------------
create table public.onboarding_progress (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  step text not null check (step in ('organization', 'team', 'whatsapp', 'data')),
  completed_at timestamptz,
  skipped_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, step)
);

create trigger onboarding_progress_set_updated_at before update on public.onboarding_progress
  for each row execute function app.set_updated_at();
create trigger onboarding_progress_prevent_key_change before update on public.onboarding_progress
  for each row execute function app.prevent_tenant_key_change();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.pipeline_stages enable row level security;
alter table public.pipeline_stages force row level security;
alter table public.onboarding_progress enable row level security;
alter table public.onboarding_progress force row level security;

revoke all on public.pipeline_stages, public.onboarding_progress from anon, authenticated;
grant select, insert, update, delete on public.pipeline_stages to authenticated;
grant select, update on public.onboarding_progress to authenticated;
grant all on public.pipeline_stages, public.onboarding_progress to service_role;

-- Etapas: todos los miembros las leen; solo el dueño las configura (PRD §3).
create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (app.can_read(organization_id));
create policy pipeline_stages_insert on public.pipeline_stages for insert to authenticated
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy pipeline_stages_update on public.pipeline_stages for update to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id))
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy pipeline_stages_delete on public.pipeline_stages for delete to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id));

-- Asistente: lo ven los miembros; lo avanza el dueño. Las filas las crea create_organization.
create policy onboarding_progress_select on public.onboarding_progress for select to authenticated
  using (app.can_read(organization_id));
create policy onboarding_progress_update on public.onboarding_progress for update to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id))
  with check (app.is_owner(organization_id) and app.can_write(organization_id));

revoke all on function app.enforce_terminal_stages() from public;
