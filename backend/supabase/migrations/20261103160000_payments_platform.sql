-- =============================================================================
-- Incremento 1.8: planes, informe de pago, panel de superadministrador (F-26, F-28, F-29, F-30).
-- - payment_reports: el dueño informa la transferencia (también en solo lectura); C&C la revisa.
-- - Comprobantes en el bucket privado "payment-receipts", rutas "<organization_id>/<archivo>".
-- - Activar, rechazar y listar inmobiliarias: RPC que verifican el rol de plataforma. Los datos del
--   CRM de cada inmobiliaria siguen fuera del panel: solo con «Ingresar como» (ADR 0003).
-- - payment_instructions: datos para transferir, los carga C&C. Vacío: se coordinan por WhatsApp.
-- La eliminación al cumplirse la retención no se ejecuta sola: necesita el worker (ADR 0011).
-- =============================================================================

alter table public.platform_settings
  add column payment_instructions text not null default '' check (char_length(payment_instructions) <= 2000);

create type public.payment_report_status as enum ('pending', 'approved', 'rejected');

create table public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_code text not null references public.plans (code),
  months smallint not null default 1 check (months between 1 and 24),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  reference text not null default '' check (char_length(reference) <= 200),
  receipt_path text check (receipt_path is null or (char_length(receipt_path) <= 300 and receipt_path like organization_id::text || '/%')),
  status public.payment_report_status not null default 'pending',
  review_note text not null default '' check (char_length(review_note) <= 500),
  reported_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null))
);

create index payment_reports_org on public.payment_reports (organization_id, created_at desc);
create index payment_reports_pending on public.payment_reports (created_at) where status = 'pending';

create trigger payment_reports_prevent_key_change before update on public.payment_reports
  for each row execute function app.prevent_tenant_key_change();

alter table public.payment_reports enable row level security;
alter table public.payment_reports force row level security;
revoke all on public.payment_reports from anon, authenticated;
grant select, insert on public.payment_reports to authenticated;
grant all on public.payment_reports to service_role;

-- El dueño informa y ve los de su inmobiliaria, aunque la cuenta esté vencida. La plataforma ve todos.
create policy payment_reports_select_owner on public.payment_reports for select to authenticated
  using (app.is_owner(organization_id));
create policy payment_reports_select_platform on public.payment_reports for select to authenticated
  using ((select app.is_platform_admin()));
create policy payment_reports_insert on public.payment_reports for insert to authenticated
  with check (app.is_owner(organization_id) and status = 'pending' and reported_by = auth.uid()
              and reviewed_at is null and reviewed_by is null);

-- Comprobantes: privados. Sube y ve el dueño; ve la plataforma.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy payment_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and app.is_owner(app.storage_organization_id(name)));
create policy payment_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and (app.is_owner(app.storage_organization_id(name)) or (select app.is_platform_admin())));

-- -----------------------------------------------------------------------------
-- Para la inmobiliaria
-- -----------------------------------------------------------------------------
create function public.payment_instructions() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select payment_instructions from public.platform_settings where id;
$$;

-- Uso y límites del plan (F-26).
create function public.organization_usage(p_organization_id uuid)
returns table (users_used integer, users_limit integer, properties_used integer, properties_limit integer, whatsapp_limit integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_member(p_organization_id) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  return query select
    app.user_slots_used(p_organization_id),
    app.plan_limit(p_organization_id, 'users'),
    (select count(*)::integer from public.properties where organization_id = p_organization_id and merged_into_id is null),
    app.plan_limit(p_organization_id, 'properties'),
    app.plan_limit(p_organization_id, 'whatsapp_numbers');
end;
$$;

-- -----------------------------------------------------------------------------
-- Para la plataforma (CU-15)
-- -----------------------------------------------------------------------------
create function public.platform_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  plan_code text,
  state public.account_state,
  trial_ends_at timestamptz,
  paid_until timestamptz,
  suspended_at timestamptz,
  created_at timestamptz,
  owner_email text,
  users_count integer,
  properties_count integer,
  contacts_count integer,
  pending_payments integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return query
  select o.id, o.name, o.slug, o.plan_code, app.organization_state(o.id), o.trial_ends_at, o.paid_until, o.suspended_at, o.created_at,
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
     where m.organization_id = o.id and m.role = 'owner' and m.status = 'active' order by m.created_at limit 1),
    (select count(*)::integer from public.memberships m where m.organization_id = o.id and m.status = 'active'),
    (select count(*)::integer from public.properties p where p.organization_id = o.id and p.merged_into_id is null),
    (select count(*)::integer from public.contacts c where c.organization_id = o.id and c.merged_into_id is null),
    (select count(*)::integer from public.payment_reports r where r.organization_id = o.id and r.status = 'pending')
  from public.organizations o
  where o.deleted_at is null
  order by o.created_at desc
  limit 500;
end;
$$;

-- Aprobar: activa la suscripción por los meses informados, con el plan informado (CU-13). Se suma a
-- lo ya pagado; una cuenta vencida vuelve a funcionar con sus datos (CU-14).
create function public.approve_payment(p_report_id uuid, p_note text default '') returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.payment_reports;
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  select * into v_report from public.payment_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception using errcode = 'P0002', message = 'not_found';
  end if;
  if v_report.status <> 'pending' then
    raise exception using errcode = '23514', message = 'already_reviewed';
  end if;

  update public.organizations
  set plan_code = v_report.plan_code,
      paid_until = greatest(now(), coalesce(paid_until, now())) + make_interval(months => v_report.months::integer)
  where id = v_report.organization_id;

  update public.payment_reports
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = coalesce(p_note, '')
  where id = p_report_id;
  perform app.audit('platform', v_report.organization_id, 'payment.approved', 'payment_report', p_report_id::text,
                    jsonb_build_object('months', v_report.months, 'plan', v_report.plan_code));
end;
$$;

create function public.reject_payment(p_report_id uuid, p_note text default '') returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.payment_reports;
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  select * into v_report from public.payment_reports where id = p_report_id for update;
  if v_report.id is null or v_report.status <> 'pending' then
    raise exception using errcode = '23514', message = 'already_reviewed';
  end if;
  update public.payment_reports
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = coalesce(p_note, '')
  where id = p_report_id;
  perform app.audit('platform', v_report.organization_id, 'payment.rejected', 'payment_report', p_report_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.payment_instructions() from public, anon;
grant execute on function public.payment_instructions() to authenticated;
revoke all on function public.organization_usage(uuid) from public, anon;
grant execute on function public.organization_usage(uuid) to authenticated;
revoke all on function public.platform_organizations() from public, anon;
grant execute on function public.platform_organizations() to authenticated;
revoke all on function public.approve_payment(uuid, text) from public, anon;
grant execute on function public.approve_payment(uuid, text) to authenticated;
revoke all on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;
