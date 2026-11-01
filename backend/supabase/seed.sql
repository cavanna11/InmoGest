-- =============================================================================
-- Seed de DESARROLLO. Nunca se aplica en producción.
--
-- Datos ficticios: emails en el dominio reservado .test, sin datos personales reales.
-- Todos los usuarios tienen la contraseña de desarrollo:  InmoGest-dev-2026
-- (solo sirve en el proyecto de desarrollo; no reutilizarla en ningún otro ambiente).
--
--   superadmin@inmogest.test        superadministrador principal (sin membresías)
--   duena@demo.inmogest.test        dueña de "Inmobiliaria Demo" (plan Profesional, en prueba)
--   agente1@demo.inmogest.test      agente de Demo
--   agente2@demo.inmogest.test      agente de Demo
--   dueno@intrusa.inmogest.test     dueño de "Inmobiliaria Intrusa" (plan Inicial, en prueba),
--                                   la inmobiliaria "intrusa" de los tests de aislamiento
--
-- Idempotente: se puede volver a correr sin duplicar filas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usuarios (auth.users + auth.identities). El trigger on_auth_user_created crea los perfiles.
-- -----------------------------------------------------------------------------
with seed_users (id, email, full_name) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'superadmin@inmogest.test',    'Superadmin C&C'),
    ('00000000-0000-4000-a000-000000000011'::uuid, 'duena@demo.inmogest.test',    'Dueña Demo'),
    ('00000000-0000-4000-a000-000000000012'::uuid, 'agente1@demo.inmogest.test',  'Agente Uno'),
    ('00000000-0000-4000-a000-000000000013'::uuid, 'agente2@demo.inmogest.test',  'Agente Dos'),
    ('00000000-0000-4000-a000-000000000021'::uuid, 'dueno@intrusa.inmogest.test', 'Dueño Intrusa')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('InmoGest-dev-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name), now(), now(),
  '', '', '', '', '', '', '', ''
from seed_users
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  u.id, u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011',
  '00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000013',
  '00000000-0000-4000-a000-000000000021'
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Plataforma
-- -----------------------------------------------------------------------------
insert into public.platform_admins (user_id, is_principal)
values ('00000000-0000-4000-a000-000000000001', true)
on conflict (user_id) do nothing;

insert into public.legal_documents (kind, version, title, content, published_at)
values
  ('terms', 'dev-0', 'Términos y condiciones (borrador de desarrollo)',
   'Texto de prueba. No es el documento legal definitivo.', now()),
  ('privacy', 'dev-0', 'Política de privacidad (borrador de desarrollo)',
   'Texto de prueba. No es el documento legal definitivo.', now())
on conflict (kind, version) do nothing;

-- -----------------------------------------------------------------------------
-- Inmobiliarias y membresías
-- -----------------------------------------------------------------------------
insert into public.organizations (id, name, slug, plan_code, trial_ends_at, created_by, contact_email)
values
  ('00000000-0000-4000-b000-000000000001', 'Inmobiliaria Demo', 'demo', 'professional',
   now() + interval '14 days', '00000000-0000-4000-a000-000000000011', 'contacto@demo.inmogest.test'),
  ('00000000-0000-4000-b000-000000000002', 'Inmobiliaria Intrusa', 'intrusa', 'initial',
   now() + interval '14 days', '00000000-0000-4000-a000-000000000021', 'contacto@intrusa.inmogest.test')
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role)
values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000011', 'owner'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000012', 'agent'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000013', 'agent'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000021', 'owner')
on conflict (organization_id, user_id) do nothing;

insert into public.legal_acceptances (user_id, organization_id, legal_document_id)
select m.user_id, m.organization_id, d.id
from public.memberships m
cross join public.legal_documents d
where m.role = 'owner' and d.version = 'dev-0'
  and m.organization_id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002')
on conflict (user_id, legal_document_id) do nothing;
