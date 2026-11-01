-- =============================================================================
-- Tenancy: inmobiliarias, perfiles, membresías, invitaciones, aceptación de términos y
-- sesiones de soporte («Ingresar como», ADR 0003). docs/DATABASE.md, docs/SECURITY.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Inmobiliarias
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  logo_path text,
  contact_email extensions.citext check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  default_currency text not null default 'ARS' check (default_currency in ('ARS', 'USD')),
  -- Cotización manual USD/ARS para matching entre monedas (F-31, desactivada por defecto).
  usd_ars_rate_enabled boolean not null default false,
  usd_ars_rate numeric(14,2) check (usd_ars_rate is null or usd_ars_rate > 0),
  -- Si los agentes pueden reasignar (PRD §6, Asignación).
  agents_can_reassign boolean not null default false,
  -- Plan y estado de cuenta: solo los cambia C&C (trigger organizations_protect_platform_columns).
  plan_code text not null references public.plans (code),
  trial_ends_at timestamptz not null,
  paid_until timestamptz,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not usd_ars_rate_enabled or usd_ars_rate is not null)
);

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function app.set_updated_at();

alter table public.audit_logs
  add constraint audit_logs_organization_fk
  foreign key (organization_id) references public.organizations (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Perfiles: 1 a 1 con auth.users, creados por trigger al registrarse.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create function app.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- -----------------------------------------------------------------------------
-- Membresías: usuario ↔ inmobiliaria con rol y estado.
-- unique (organization_id, user_id) es el destino de las claves foráneas compuestas de
-- assigned_user_id / author_user_id (Fase 1): no se puede asignar a alguien de otra inmobiliaria.
-- -----------------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  status public.membership_status not null default 'active',
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  -- Roles reservados sin uso en el MVP.
  check (role in ('owner', 'agent')),
  check ((status = 'deactivated') = (deactivated_at is not null))
);

create index memberships_user on public.memberships (user_id) where status = 'active';

create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Invitaciones por email. El token se guarda como hash SHA-256 (docs/SECURITY.md); vence a los 7 días.
-- -----------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email extensions.citext not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  role public.member_role not null default 'agent' check (role in ('owner', 'agent')),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

-- Una sola invitación abierta por email e inmobiliaria.
create unique index invitations_one_open_per_email on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Aceptación de términos y política de privacidad (CU-01).
-- organization_id es opcional: el usuario acepta al registrarse, antes de que exista la inmobiliaria.
-- -----------------------------------------------------------------------------
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents (id),
  accepted_at timestamptz not null default now(),
  unique (user_id, legal_document_id)
);

-- -----------------------------------------------------------------------------
-- Sesiones de soporte («Ingresar como», ADR 0003). Registro técnico, no visible para la inmobiliaria.
-- -----------------------------------------------------------------------------
create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_admins (user_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

create unique index support_sessions_one_open_per_user on public.support_sessions (user_id)
  where ended_at is null;
