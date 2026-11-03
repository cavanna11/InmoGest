-- Incremento 1.1: alta de inmobiliaria (CU-01), embudo predefinido, asistente, invitaciones (CU-02,
-- ADR 0007) y logos en Storage (F-05).
select no_plan();

-- Documentos legales propios del test (independiente del seed).
insert into public.legal_documents (id, kind, version, title, content, published_at, is_draft) values
  ('90000000-0000-4000-c000-000000000001', 'terms', 't-reg', 'Términos', 'texto', now(), false),
  ('90000000-0000-4000-c000-000000000002', 'privacy', 't-reg', 'Privacidad', 'texto', now(), false);
update public.platform_settings
set allow_draft_legal_documents = false,
    current_terms_id = '90000000-0000-4000-c000-000000000001',
    current_privacy_id = '90000000-0000-4000-c000-000000000002',
    signup_max_organizations_per_user = 2,
    signup_window_hours = 24
where id;

select tests.create_user('91000000-0000-4000-a000-000000000001', 'duena@reg.test');
select tests.create_user('91000000-0000-4000-a000-000000000002', 'sinconfirmar@reg.test');
update auth.users set email_confirmed_at = null where id = '91000000-0000-4000-a000-000000000002';
select tests.create_user('91000000-0000-4000-a000-000000000003', 'nuevo@reg.test');
select tests.create_user('91000000-0000-4000-a000-000000000004', 'otro@reg.test');

-- Tabla temporal para guardar el id creado (la crea postgres y la puede usar authenticated).
create temp table created (id uuid) on commit drop;
create temp table created_second (id uuid) on commit drop;
grant all on created, created_second to authenticated;

-- =============================================================================
-- create_organization
-- =============================================================================
select tests.authenticate_as('91000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.create_organization('Inmo', 'inmo', array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]) $$) ->> 'sqlstate',
  'IG007', 'sin email confirmado no se crea la inmobiliaria');

select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ select public.create_organization('Inmo', 'inmo', array['90000000-0000-4000-c000-000000000001']::uuid[]) $$) ->> 'sqlstate',
  'IG006', 'hay que aceptar términos y privacidad vigentes');
select is(tests.error_of($$ select public.create_organization('Inmo', 'Inmo Mal', array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]) $$) ->> 'sqlstate',
  '22023', 'el slug base tiene que venir normalizado');
select is(tests.error_of($$ select public.create_organization('   ', 'inmo', array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]) $$) ->> 'sqlstate',
  '22023', 'el nombre es obligatorio');

insert into created select public.create_organization('Inmobiliaria Registro', 'inmobiliaria-registro',
  array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]);
select isnt((select id from created), null::uuid, 'crea la inmobiliaria');

select tests.clear_authentication();
select results_eq(
  $$ select o.slug, o.plan_code, app.organization_state(o.id)::text,
            o.trial_ends_at between now() + interval '14 days' - interval '1 minute' and now() + interval '14 days' + interval '1 minute'
     from public.organizations o where o.id = (select id from created) $$,
  $$ values ('inmobiliaria-registro', (select trial_plan_code from public.platform_settings where id), 'trial', true) $$,
  'en prueba de 14 días con el plan de prueba configurado');
select results_eq(
  $$ select role::text, status::text from public.memberships
     where organization_id = (select id from created) $$,
  $$ values ('owner', 'active') $$, 'quien la crea queda como dueño');
select results_eq(
  $$ select name, kind::text from public.pipeline_stages where organization_id = (select id from created) order by position $$,
  $$ values ('Nuevo contacto', 'open'), ('Primer contacto', 'open'), ('Calificado', 'open'), ('Visita coordinada', 'open'),
            ('Negociación', 'open'), ('Cerrado ganado', 'won'), ('Cerrado perdido', 'lost') $$,
  'con el embudo predefinido del PRD');
select is((select count(*)::int from public.onboarding_progress where organization_id = (select id from created)), 4,
  'con los 4 pasos del asistente');
select is((select count(*)::int from public.legal_acceptances
           where organization_id = (select id from created) and not document_is_draft), 2,
  'registra la aceptación de términos y privacidad');
select isnt_empty($$ select 1 from public.audit_logs where action = 'organization.created'
                    and organization_id = (select id from created) $$, 'queda auditada');

-- Slug ocupado → sufijo. Anti-abuso: máximo 2 por ventana.
select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
insert into created_second select public.create_organization('Otra', 'inmobiliaria-registro',
  array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]);
select is((select slug from public.organizations where id = (select id from created_second)),
  'inmobiliaria-registro-2', 'si el slug está en uso recibe sufijo');
select is(tests.error_of($$ select public.create_organization('Tercera', 'tercera', array['90000000-0000-4000-c000-000000000001', '90000000-0000-4000-c000-000000000002']::uuid[]) $$) ->> 'sqlstate',
  'IG008', 'el límite anti-abuso de la plataforma frena la tercera');

select tests.clear_authentication();
update public.platform_settings set current_privacy_id = null where id;
select tests.authenticate_as('91000000-0000-4000-a000-000000000003');
select is(tests.error_of($$ select public.create_organization('Cerrado', 'cerrado', array['90000000-0000-4000-c000-000000000001']::uuid[]) $$) ->> 'sqlstate',
  'IG006', 'sin documentos vigentes publicados el registro está cerrado');
select tests.clear_authentication();
update public.platform_settings set current_privacy_id = '90000000-0000-4000-c000-000000000002' where id;

select tests.authenticate_as_anon();
select throws_ok($$ select public.create_organization('Anon', 'anon', '{}'::uuid[]) $$, '42501', null,
  'anon no crea inmobiliarias');
select tests.clear_authentication();

-- =============================================================================
-- Embudo y asistente
-- =============================================================================
select tests.add_member((select id from created), '91000000-0000-4000-a000-000000000004', 'agent');

select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ update public.pipeline_stages set is_active = false
                           where organization_id = (select id from created) and kind = 'won' $$) ->> 'sqlstate',
  'IG010', 'no se puede desactivar la única etapa ganada');
select is(tests.error_of($$ delete from public.pipeline_stages
                           where organization_id = (select id from created) and kind = 'lost' $$) ->> 'sqlstate',
  'IG010', 'ni borrar la única perdida');
select lives_ok($$ insert into public.pipeline_stages (organization_id, name, position, kind)
                   values ((select id from created), 'Ganada por referido', 7, 'won') $$, 'el dueño agrega una etapa');
select is(tests.affected($$ update public.pipeline_stages set is_active = false
                            where organization_id = (select id from created) and name = 'Cerrado ganado' $$),
  1::bigint, 'con otra ganada activa, la original se puede desactivar');
select is(tests.affected($$ update public.onboarding_progress set completed_at = now()
                            where organization_id = (select id from created) and step = 'organization' $$),
  1::bigint, 'el dueño avanza el asistente');

select tests.authenticate_as('91000000-0000-4000-a000-000000000004');
select isnt_empty($$ select 1 from public.pipeline_stages where organization_id = (select id from created) $$,
  'el agente ve el embudo');
select throws_ok($$ insert into public.pipeline_stages (organization_id, name, position, kind)
                    values ((select id from created), 'Del agente', 9, 'open') $$, '42501', null,
  'el agente no configura el embudo');
select is(tests.affected($$ update public.onboarding_progress set skipped_at = now()
                            where organization_id = (select id from created) $$),
  0::bigint, 'el agente no modifica el asistente');

-- =============================================================================
-- Invitaciones
-- =============================================================================
select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
insert into public.invitations (organization_id, email, role, token_hash) values
  ((select id from created), 'nuevo@reg.test', 'agent',
   extensions.digest(convert_to('token-valido-0123456789abcdef', 'UTF8'), 'sha256')),
  ((select id from created), 'vencida@reg.test', 'agent',
   extensions.digest(convert_to('token-vencido-0123456789abcdef', 'UTF8'), 'sha256')),
  ((select id from created), 'revocada@reg.test', 'agent',
   extensions.digest(convert_to('token-revocado-0123456789abcdef', 'UTF8'), 'sha256'));
select tests.clear_authentication();
update public.invitations set expires_at = now() - interval '1 second' where email = 'vencida@reg.test';
update public.invitations set revoked_at = now() where email = 'revocada@reg.test';

select tests.authenticate_as_anon();
select results_eq(
  $$ select organization_name, role::text, email::text, status from public.invitation_preview('token-valido-0123456789abcdef') $$,
  $$ values ('Inmobiliaria Registro', 'agent', 'nuevo@reg.test', 'pending') $$,
  'quien tiene el enlace ve a qué inmobiliaria lo invitan');
select is_empty($$ select * from public.invitation_preview('token-inexistente-0123456789abc') $$,
  'un token inexistente no muestra nada');
select results_eq($$ select status from public.invitation_preview('token-vencido-0123456789abcdef') $$,
  $$ values ('expired') $$, 'informa invitaciones vencidas');
select throws_ok($$ select public.accept_invitation('token-valido-0123456789abcdef') $$, '42501', null,
  'anon no acepta invitaciones');

select tests.authenticate_as('91000000-0000-4000-a000-000000000004');
select is(tests.error_of($$ select public.accept_invitation('token-valido-0123456789abcdef') $$),
  jsonb_build_object('sqlstate', 'IG009', 'detail', 'email_mismatch'),
  'otro usuario no puede usar la invitación');

select tests.authenticate_as('91000000-0000-4000-a000-000000000003');
select is(tests.error_of($$ select public.accept_invitation('token-vencido-0123456789abcdef') $$) ->> 'detail',
  'expired', 'una invitación vencida no se acepta');
select is(tests.error_of($$ select public.accept_invitation('token-revocado-0123456789abcdef') $$) ->> 'detail',
  'revoked', 'una revocada tampoco');
select is(public.accept_invitation('token-valido-0123456789abcdef'), (select id from created),
  'el invitado acepta con su email');
select results_eq($$ select role::text, status::text from public.memberships
                     where user_id = '91000000-0000-4000-a000-000000000003' $$,
  $$ values ('agent', 'active') $$, 'queda como agente activo');
select is(tests.error_of($$ select public.accept_invitation('token-valido-0123456789abcdef') $$) ->> 'detail',
  'accepted', 'el enlace no sirve dos veces');

-- Reinvitar a un agente desactivado lo reactiva.
select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
update public.memberships set status = 'deactivated', deactivated_at = now()
where user_id = '91000000-0000-4000-a000-000000000004';
insert into public.invitations (organization_id, email, role, token_hash) values
  ((select id from created), 'otro@reg.test', 'agent',
   extensions.digest(convert_to('token-reactivar-0123456789abcdef', 'UTF8'), 'sha256'));
select tests.authenticate_as('91000000-0000-4000-a000-000000000004');
select lives_ok($$ select public.accept_invitation('token-reactivar-0123456789abcdef') $$, 'el agente desactivado acepta');
select results_eq($$ select status::text from public.memberships where user_id = '91000000-0000-4000-a000-000000000004' $$,
  $$ values ('active') $$, 'y queda reactivado');

-- Con la cuenta en solo lectura no se suman miembros.
select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
insert into public.invitations (organization_id, email, role, token_hash) values
  ((select id from created), 'tarde@reg.test', 'agent',
   extensions.digest(convert_to('token-solo-lectura-0123456789abc', 'UTF8'), 'sha256'));
select tests.clear_authentication();
select tests.create_user('91000000-0000-4000-a000-000000000005', 'tarde@reg.test');
update public.organizations set trial_ends_at = now() - interval '1 day' where id = (select id from created);
select tests.authenticate_as('91000000-0000-4000-a000-000000000005');
select is(tests.error_of($$ select public.accept_invitation('token-solo-lectura-0123456789abc') $$) ->> 'detail',
  'organization_unavailable', 'con la cuenta en solo lectura no se acepta');
select tests.clear_authentication();
update public.organizations set trial_ends_at = now() + interval '14 days' where id = (select id from created);

-- =============================================================================
-- Lista de miembros con email: solo para el dueño
-- =============================================================================
select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
select results_eq(
  $$ select email, role::text, status::text from public.organization_members((select id from created)) order by email $$,
  $$ values ('duena@reg.test', 'owner', 'active'), ('nuevo@reg.test', 'agent', 'active'), ('otro@reg.test', 'agent', 'active') $$,
  'el dueño ve a su equipo con email, rol y estado');
select tests.authenticate_as('91000000-0000-4000-a000-000000000003');
select is_empty($$ select * from public.organization_members((select id from created)) $$,
  'un agente no obtiene la lista con emails');
select tests.create_user('93000000-0000-4000-a000-000000000001', 'ajeno@reg.test');
select tests.authenticate_as('93000000-0000-4000-a000-000000000001');
select is_empty($$ select * from public.organization_members((select id from created)) $$,
  'alguien de afuera tampoco');
select tests.clear_authentication();

-- =============================================================================
-- Logos en Storage
-- =============================================================================
select tests.create_org('92000000-0000-4000-b000-00000000000b', 'logo-ajena');

select tests.authenticate_as('91000000-0000-4000-a000-000000000001');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('logos', '%s/logo.png') $$, (select id from created)),
  'el dueño sube el logo de su inmobiliaria');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('logos', '92000000-0000-4000-b000-00000000000b/logo.png') $$,
  '42501', null, 'no puede subir en la carpeta de otra inmobiliaria');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('logos', 'sin-carpeta.png') $$,
  '42501', null, 'ni fuera de una carpeta de inmobiliaria');

select tests.authenticate_as('91000000-0000-4000-a000-000000000004');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('logos', '%s/otro.png') $$, (select id from created)),
  '42501', null, 'un agente no cambia el logo');

select tests.clear_authentication();
select * from finish();
