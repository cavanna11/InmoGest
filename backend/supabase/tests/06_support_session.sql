-- «Ingresar como» (ADR 0003, PRD §6 y §8 F-30): con sesión, sin sesión, en otra inmobiliaria,
-- cuenta en solo lectura y bloqueada, último dueño, y nadie más puede usarlo.
select no_plan();

select tests.create_user('60000000-0000-4000-a000-000000000001', 'principal@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000002', 'otro-admin@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000011', 'owner-a@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000012', 'agent-a@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000021', 'owner-b@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000031', 'owner-x@ss.test');
select tests.create_user('60000000-0000-4000-a000-000000000032', 'nuevo-x@ss.test');
select tests.make_principal('60000000-0000-4000-a000-000000000001');
select tests.make_principal('60000000-0000-4000-a000-000000000002', false);

select tests.create_org('60000000-0000-4000-b000-00000000000a', 'ss-a');
select tests.create_org('60000000-0000-4000-b000-00000000000b', 'ss-b');
-- R en solo lectura, X bloqueada.
select tests.create_org('60000000-0000-4000-b000-00000000000c', 'ss-r', 'professional', now() - interval '3 days');
select tests.create_org('60000000-0000-4000-b000-00000000000d', 'ss-x', 'professional', now() - interval '60 days');
select tests.add_member('60000000-0000-4000-b000-00000000000a', '60000000-0000-4000-a000-000000000011', 'owner');
select tests.add_member('60000000-0000-4000-b000-00000000000a', '60000000-0000-4000-a000-000000000012', 'agent');
select tests.add_member('60000000-0000-4000-b000-00000000000b', '60000000-0000-4000-a000-000000000021', 'owner');
select tests.add_member('60000000-0000-4000-b000-00000000000d', '60000000-0000-4000-a000-000000000031', 'owner');

-- ---------------------------------------------------------------------------
-- Sin sesión: el principal ve la lista de inmobiliarias (panel), pero no sus datos internos.
-- ---------------------------------------------------------------------------
select tests.authenticate_as('60000000-0000-4000-a000-000000000001');
select is(public.current_support_organization(), null::uuid, 'sin sesión de soporte abierta');
select isnt_empty($$ select 1 from public.organizations where id = '60000000-0000-4000-b000-00000000000a' $$,
  'el panel lista las inmobiliarias');
select is_empty($$ select 1 from public.memberships $$, 'sin sesión no ve miembros de ninguna inmobiliaria');
select ok(not app.is_member('60000000-0000-4000-b000-00000000000a'), 'sin sesión no es miembro');
select throws_ok($$ select public.start_support_session('60000000-0000-4000-b000-0000000000ff') $$,
  'P0002', null, 'no puede entrar a una inmobiliaria inexistente');

-- ---------------------------------------------------------------------------
-- Con sesión en A
-- ---------------------------------------------------------------------------
select isnt(public.start_support_session('60000000-0000-4000-b000-00000000000a'), null::uuid, 'entra a A');
select is(public.current_support_organization(), '60000000-0000-4000-b000-00000000000a'::uuid, 'la sesión apunta a A');
select ok(app.is_owner('60000000-0000-4000-b000-00000000000a'), 'opera en A con acceso de dueño');
select is((select count(*)::int from public.memberships), 2, 've los miembros de A');
select is_empty($$ select 1 from public.memberships where organization_id = '60000000-0000-4000-b000-00000000000b' $$,
  'no ve los de B');
select is(tests.affected($$ update public.organizations set name = 'A editada por soporte' where id = '60000000-0000-4000-b000-00000000000a' $$),
  1::bigint, 'edita la configuración de A');
select lives_ok($$ insert into public.invitations (organization_id, email, token_hash)
                   values ('60000000-0000-4000-b000-00000000000a', 'inv@ss.test', extensions.digest('ss1', 'sha256')) $$,
  'invita en A');
select is((select via_support_session from public.audit_logs
           where organization_id = '60000000-0000-4000-b000-00000000000a' and action = 'invitation.created'),
  true, 'la auditoría marca que fue en sesión de soporte');
select throws_ok($$ insert into public.invitations (organization_id, email, token_hash)
                    values ('60000000-0000-4000-b000-00000000000b', 'inv@ss.test', extensions.digest('ss2', 'sha256')) $$,
  '42501', null, 'con sesión en A no escribe en B');

-- ---------------------------------------------------------------------------
-- Cambio a B: una inmobiliaria por vez.
-- ---------------------------------------------------------------------------
select isnt(public.start_support_session('60000000-0000-4000-b000-00000000000b'), null::uuid, 'entra a B');
select is((select count(*)::int from public.support_sessions
           where user_id = '60000000-0000-4000-a000-000000000001' and ended_at is null), 1,
  'una sola sesión abierta');
select is_empty($$ select 1 from public.memberships where organization_id = '60000000-0000-4000-b000-00000000000a' $$,
  'al pasar a B deja de ver A');
select isnt_empty($$ select 1 from public.memberships where organization_id = '60000000-0000-4000-b000-00000000000b' $$,
  've B');

-- ---------------------------------------------------------------------------
-- Cuentas en solo lectura y bloqueada: sin restricciones de estado.
-- ---------------------------------------------------------------------------
select public.start_support_session('60000000-0000-4000-b000-00000000000c');
select is(tests.affected($$ update public.organizations set name = 'R por soporte' where id = '60000000-0000-4000-b000-00000000000c' $$),
  1::bigint, 'escribe en una cuenta en solo lectura');

select public.start_support_session('60000000-0000-4000-b000-00000000000d');
select isnt_empty($$ select 1 from public.organizations where id = '60000000-0000-4000-b000-00000000000d' $$,
  'lee una cuenta bloqueada');
select lives_ok($$ insert into public.memberships (organization_id, user_id, role)
                   values ('60000000-0000-4000-b000-00000000000d', '60000000-0000-4000-a000-000000000032', 'agent') $$,
  'agrega un miembro en una cuenta bloqueada');

-- Último dueño: también lo limita.
select is(tests.error_of($$ delete from public.memberships where user_id = '60000000-0000-4000-a000-000000000031' $$) ->> 'sqlstate',
  'IG003', 'no puede quitar al último dueño activo');
select is(tests.affected($$ update public.memberships set role = 'owner' where user_id = '60000000-0000-4000-a000-000000000032' $$),
  1::bigint, 'designa otro dueño');
select is(tests.affected($$ update public.memberships set status = 'deactivated', deactivated_at = now()
                            where user_id = '60000000-0000-4000-a000-000000000031' $$),
  1::bigint, 'y después quita al anterior');

-- ---------------------------------------------------------------------------
-- Salir
-- ---------------------------------------------------------------------------
select ok(public.end_support_session(), 'sale del contexto');
select is(public.current_support_organization(), null::uuid, 'sin sesión abierta');
select is_empty($$ select 1 from public.memberships $$, 'al salir ya no ve datos de la inmobiliaria');
select ok(not public.end_support_session(), 'salir sin sesión abierta devuelve false');

-- ---------------------------------------------------------------------------
-- Nadie más puede usarlo
-- ---------------------------------------------------------------------------
select tests.authenticate_as('60000000-0000-4000-a000-000000000002');
select throws_ok($$ select public.start_support_session('60000000-0000-4000-b000-00000000000a') $$,
  'IG004', null, 'otro usuario de C&C no puede «Ingresar como»');
select tests.authenticate_as('60000000-0000-4000-a000-000000000011');
select throws_ok($$ select public.start_support_session('60000000-0000-4000-b000-00000000000b') $$,
  'IG004', null, 'un dueño no puede «Ingresar como»');
select is_empty($$ select 1 from public.support_sessions $$, 'la inmobiliaria no ve las sesiones de soporte');
select throws_ok($$ insert into public.support_sessions (user_id, organization_id)
                    values ('60000000-0000-4000-a000-000000000011', '60000000-0000-4000-b000-00000000000b') $$,
  '42501', null, 'nadie crea sesiones a mano');

-- Una sesión abierta de un admin no principal (insertada por error) no da acceso.
select tests.clear_authentication();
insert into public.support_sessions (user_id, organization_id)
values ('60000000-0000-4000-a000-000000000002', '60000000-0000-4000-b000-00000000000a');
select tests.authenticate_as('60000000-0000-4000-a000-000000000002');
select ok(not app.is_member('60000000-0000-4000-b000-00000000000a'), 'solo cuenta la sesión del principal');

select tests.clear_authentication();
select * from finish();
