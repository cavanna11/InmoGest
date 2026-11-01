-- Aislamiento entre inmobiliarias (PRD §8 Generales) y permisos dueño/agente.
select no_plan();

-- Fixtures: A (dueño a1, agente a2) y B, la intrusa (dueño b1).
select tests.create_user('aaaaaaaa-0000-4000-a000-000000000001', 'a1@iso.test');
select tests.create_user('aaaaaaaa-0000-4000-a000-000000000002', 'a2@iso.test');
select tests.create_user('bbbbbbbb-0000-4000-a000-000000000001', 'b1@iso.test');
select tests.create_org('aaaaaaaa-0000-4000-b000-00000000000a', 'iso-a');
select tests.create_org('bbbbbbbb-0000-4000-b000-00000000000b', 'iso-b');
select tests.add_member('aaaaaaaa-0000-4000-b000-00000000000a', 'aaaaaaaa-0000-4000-a000-000000000001', 'owner');
select tests.add_member('aaaaaaaa-0000-4000-b000-00000000000a', 'aaaaaaaa-0000-4000-a000-000000000002', 'agent');
select tests.add_member('bbbbbbbb-0000-4000-b000-00000000000b', 'bbbbbbbb-0000-4000-a000-000000000001', 'owner');
insert into public.invitations (organization_id, email, token_hash)
values ('bbbbbbbb-0000-4000-b000-00000000000b', 'pendiente@iso.test', extensions.digest('token-b', 'sha256'));
insert into public.legal_documents (kind, version, title, content, published_at)
values ('terms', 'test-1', 'Términos de prueba', '...', now());

-- ---------------------------------------------------------------------------
-- Agente de A
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-0000-4000-a000-000000000002');

select results_eq($$ select id from public.organizations $$,
  $$ values ('aaaaaaaa-0000-4000-b000-00000000000a'::uuid) $$, 'el agente solo ve su inmobiliaria');
select is((select count(*)::int from public.memberships), 2, 'el agente ve solo las membresías de A');
select is_empty($$ select 1 from public.memberships where organization_id = 'bbbbbbbb-0000-4000-b000-00000000000b' $$,
  'no ve membresías de B');
select isnt_empty($$ select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-a000-000000000001' $$,
  've el perfil de su compañero');
select is_empty($$ select 1 from public.profiles where id = 'bbbbbbbb-0000-4000-a000-000000000001' $$,
  'no ve perfiles de B');
select is_empty($$ select 1 from public.invitations $$, 'el agente no ve invitaciones (solo dueño)');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, token_hash)
     values ('aaaaaaaa-0000-4000-b000-00000000000a', 'nuevo@iso.test', extensions.digest('t1', 'sha256')) $$,
  '42501', null, 'el agente no puede invitar');
select is(tests.affected($$ update public.organizations set name = 'X' where id = 'aaaaaaaa-0000-4000-b000-00000000000a' $$),
  0::bigint, 'el agente no edita la configuración de la inmobiliaria');
select is(tests.affected($$ update public.memberships set role = 'owner' where user_id = 'aaaaaaaa-0000-4000-a000-000000000002' $$),
  0::bigint, 'el agente no se puede ascender a dueño');
select is_empty($$ select 1 from public.audit_logs $$, 'el agente no ve la auditoría');

-- ---------------------------------------------------------------------------
-- Dueño de A contra B
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-0000-4000-a000-000000000001');

select is(tests.affected($$ update public.organizations set name = 'Org A renombrada' where id = 'aaaaaaaa-0000-4000-b000-00000000000a' $$),
  1::bigint, 'el dueño edita su inmobiliaria');
select is(tests.affected($$ update public.organizations set name = 'hackeada' where id = 'bbbbbbbb-0000-4000-b000-00000000000b' $$),
  0::bigint, 'no puede modificar B');
select throws_ok(
  $$ insert into public.memberships (organization_id, user_id, role)
     values ('bbbbbbbb-0000-4000-b000-00000000000b', 'aaaaaaaa-0000-4000-a000-000000000001', 'owner') $$,
  '42501', null, 'no puede agregarse como miembro de B');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, token_hash)
     values ('bbbbbbbb-0000-4000-b000-00000000000b', 'x@iso.test', extensions.digest('t2', 'sha256')) $$,
  '42501', null, 'no puede invitar en B');
select is(tests.affected($$ delete from public.memberships where organization_id = 'bbbbbbbb-0000-4000-b000-00000000000b' $$),
  0::bigint, 'no puede borrar membresías de B');
select is(tests.affected($$ update public.invitations set revoked_at = now() where organization_id = 'bbbbbbbb-0000-4000-b000-00000000000b' $$),
  0::bigint, 'no puede revocar invitaciones de B');
select is_empty($$ select 1 from public.audit_logs where organization_id = 'bbbbbbbb-0000-4000-b000-00000000000b' $$,
  'no ve la auditoría de B');
select isnt_empty($$ select 1 from public.audit_logs where organization_id = 'aaaaaaaa-0000-4000-b000-00000000000a' and action = 'member.added' $$,
  've la auditoría de su inmobiliaria');
select lives_ok(
  $$ insert into public.invitations (organization_id, email, token_hash)
     values ('aaaaaaaa-0000-4000-b000-00000000000a', 'nuevo@iso.test', extensions.digest('t3', 'sha256')) $$,
  'el dueño invita en su inmobiliaria');

-- Plan y estado de cuenta: solo C&C.
select is(tests.error_of($$ update public.organizations set plan_code = 'enterprise' where id = 'aaaaaaaa-0000-4000-b000-00000000000a' $$) ->> 'sqlstate',
  'IG004', 'el dueño no puede cambiar su plan');
select is(tests.error_of($$ update public.organizations set paid_until = now() + interval '1 year' where id = 'aaaaaaaa-0000-4000-b000-00000000000a' $$) ->> 'sqlstate',
  'IG004', 'el dueño no puede extender su cuenta');
select is(tests.error_of($$ update public.organizations set suspended_at = null, trial_ends_at = now() + interval '1 year' where id = 'aaaaaaaa-0000-4000-b000-00000000000a' $$) ->> 'sqlstate',
  'IG004', 'el dueño no puede extender su prueba');

-- Plataforma
select is(tests.affected($$ update public.plans set max_users = 999 $$), 0::bigint, 'el dueño no edita planes');
select is(tests.affected($$ update public.platform_settings set wa_auto_daily_limit = 999 $$), 0::bigint,
  'el dueño no edita la configuración global');
select is_empty($$ select 1 from public.platform_settings $$, 'el dueño no ve la configuración global');
select is_empty($$ select 1 from public.support_sessions $$, 'el dueño no ve sesiones de soporte');
select throws_ok($$ select 1 from public.jobs $$, '42501', null, 'sin acceso a la cola de jobs');
select throws_ok($$ select 1 from public.rate_limits $$, '42501', null, 'sin acceso a rate_limits');
select throws_ok($$ select public.claim_jobs('intruso', 10, 600) $$, '42501', null, 'no puede tomar jobs');
select throws_ok($$ select public.enqueue_job('system.ping') $$, '42501', null, 'no puede encolar jobs');
select throws_ok($$ select public.hit_rate_limit('k', 60, 1) $$, '42501', null, 'no puede tocar rate limits');

-- Perfiles y términos
select is(tests.affected($$ update public.profiles set full_name = 'X' where id = 'aaaaaaaa-0000-4000-a000-000000000002' $$),
  0::bigint, 'no edita el perfil de otro');
select is(tests.affected($$ update public.profiles set full_name = 'Dueño A' where id = 'aaaaaaaa-0000-4000-a000-000000000001' $$),
  1::bigint, 'edita su propio perfil');
select throws_ok(
  $$ insert into public.legal_acceptances (user_id, legal_document_id)
     select 'aaaaaaaa-0000-4000-a000-000000000002', id from public.legal_documents where version = 'test-1' $$,
  '42501', null, 'no registra aceptaciones a nombre de otro');
select lives_ok(
  $$ insert into public.legal_acceptances (user_id, legal_document_id)
     select 'aaaaaaaa-0000-4000-a000-000000000001', id from public.legal_documents where version = 'test-1' $$,
  'registra su propia aceptación');

-- ---------------------------------------------------------------------------
-- Claves inmutables (también para procesos privilegiados)
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is(tests.error_of($$ update public.memberships set organization_id = 'bbbbbbbb-0000-4000-b000-00000000000b' where user_id = 'aaaaaaaa-0000-4000-a000-000000000002' $$) ->> 'sqlstate',
  '42501', 'una membresía no se puede mover de inmobiliaria');

-- ---------------------------------------------------------------------------
-- Anónimo
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok($$ select 1 from public.organizations $$, '42501', null, 'anon no lee inmobiliarias');
select throws_ok($$ select 1 from public.memberships $$, '42501', null, 'anon no lee membresías');
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon no lee perfiles');
select throws_ok($$ select public.start_support_session('aaaaaaaa-0000-4000-b000-00000000000a') $$,
  '42501', null, 'anon no puede usar «Ingresar como»');
select isnt_empty($$ select 1 from public.legal_documents where version = 'test-1' $$, 'anon lee documentos legales publicados');
select ok((public.health() ->> 'ok')::boolean, 'anon puede consultar health()');

select tests.clear_authentication();
select * from finish();
