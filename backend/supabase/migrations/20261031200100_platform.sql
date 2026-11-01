-- =============================================================================
-- Plataforma (C&C): planes, configuración global, administradores, documentos legales,
-- auditoría y rate limiting. docs/DATABASE.md (Plataforma), PRD §6 (Planes, WhatsApp).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Planes comerciales. Límites editables por el superadministrador sin desplegar (F-26, F-29).
-- -----------------------------------------------------------------------------
create table public.plans (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  reference_price_usd numeric(14,2) not null check (reference_price_usd >= 0),
  max_users integer not null check (max_users > 0),
  max_properties integer not null check (max_properties > 0),
  -- null = todavía sin definir (PRD: máximo del plan Empresa [A CONFIRMAR]); mientras tanto se permite 1.
  max_whatsapp_numbers integer check (max_whatsapp_numbers > 0),
  includes_automations boolean not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function app.set_updated_at();

-- Valores iniciales de PRD §6. Son datos de configuración (existen en todos los ambientes).
insert into public.plans
  (code, name, reference_price_usd, max_users, max_properties, max_whatsapp_numbers, includes_automations, sort_order)
values
  ('initial',      'Inicial',     19, 2,  100,  1,    false, 1),
  ('professional', 'Profesional', 39, 5,  500,  1,    true,  2),
  ('enterprise',   'Empresa',     69, 10, 1500, null, true,  3);

-- -----------------------------------------------------------------------------
-- Configuración global: una sola fila, versionada.
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  version integer not null default 1,
  -- Límites de mensajes automáticos de WhatsApp, por número conectado (PRD §6).
  wa_auto_daily_limit integer not null default 30 check (wa_auto_daily_limit >= 0),
  wa_auto_hourly_limit integer not null default 10 check (wa_auto_hourly_limit >= 0),
  wa_auto_min_interval_seconds integer not null default 15 check (wa_auto_min_interval_seconds >= 0),
  wa_max_retries integer not null default 2 check (wa_max_retries between 0 and 10),
  -- Horario permitido de automáticos, hora de Argentina. [A CONFIRMAR] (PRD, pregunta abierta 5):
  -- mientras sea null no se envían automáticos.
  wa_auto_window_start time,
  wa_auto_window_end time,
  -- Plan que rige durante la prueba gratis. [A CONFIRMAR] (PRD, pregunta abierta 3).
  trial_plan_code text not null default 'professional' references public.plans (code),
  -- Anti-abuso del registro (ARCHITECTURE flujo 2). [A CONFIRMAR valores].
  signup_max_organizations_per_user integer not null default 3 check (signup_max_organizations_per_user > 0),
  signup_window_hours integer not null default 24 check (signup_window_hours > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((wa_auto_window_start is null) = (wa_auto_window_end is null))
);

insert into public.platform_settings default values;

create function app.bump_platform_settings_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger platform_settings_bump_version before update on public.platform_settings
  for each row execute function app.bump_platform_settings_version();

-- -----------------------------------------------------------------------------
-- Administradores de la plataforma. is_principal marca al superadministrador principal (único).
-- Se gestionan por SQL (no hay alta desde la app en el MVP).
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_principal boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index platform_admins_single_principal on public.platform_admins (is_principal)
  where is_principal;

-- -----------------------------------------------------------------------------
-- Documentos legales versionados (términos y política de privacidad).
-- -----------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_document_kind not null,
  version text not null check (char_length(version) between 1 and 30),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

-- -----------------------------------------------------------------------------
-- Auditoría (docs/OBSERVABILITY.md). Solo se escribe desde funciones y triggers de la base.
-- scope = organization: acciones dentro de una inmobiliaria (visibles para su dueño).
-- scope = platform: acciones de C&C (visibles solo para la plataforma).
-- organization_id se completa en ambos casos cuando la acción afecta a una inmobiliaria; la tabla
-- organizations se crea en la migración siguiente, que agrega la clave foránea.
-- Nunca guardar datos personales de contactos en metadata: solo ids y valores de configuración.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  scope public.audit_scope not null,
  organization_id uuid,
  actor_user_id uuid references auth.users (id) on delete set null,
  via_support_session boolean not null default false,
  action text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (scope = 'platform' or organization_id is not null)
);

create index audit_logs_org_created on public.audit_logs (organization_id, created_at desc);
create index audit_logs_scope_created on public.audit_logs (scope, created_at desc);

-- -----------------------------------------------------------------------------
-- Rate limiting de ventana fija (registro, invitaciones, endpoints públicos, webhooks).
-- La clave no debe contener datos personales en claro: usar un hash (ej. "signup:email:<sha256>").
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
