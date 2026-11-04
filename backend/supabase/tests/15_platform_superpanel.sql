-- Súper panel de C&C: alta, baja, eliminación, actividad y equipo de plataforma.
select no_plan();

select tests.create_user('a7000000-0000-4000-a000-000000000001', 'duena@super.test');
select tests.create_user('a7000000-0000-4000-a000-000000000002', 'admin@super.test');
select tests.create_user('a7000000-0000-4000-a000-000000000008', 'principal@super.test');
select tests.create_user('a7000000-0000-4000-a000-000000000009', 'comun@super.test');
select tests.make_principal('a7000000-0000-4000-a000-000000000008');
insert into public.platform_admins (user_id) values ('a7000000-0000-4000-a000-000000000002');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- =============================================================================
-- Permisos: solo el principal escribe
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000009');
select is(tests.error_of($$ select public.platform_create_organization('X', 'x', 'a7000000-0000-4000-a000-000000000009', 'initial') $$) ->> 'sqlstate', 'IG004', 'un usuario común no crea inmobiliarias desde la plataforma');
select is(tests.error_of($$ select public.platform_find_user('duena@super.test') $$) ->> 'sqlstate', 'IG004', 'un usuario común no busca usuarios');
select is(tests.error_of($$ select * from public.platform_activity() $$) ->> 'sqlstate', 'IG004', 'un usuario común no ve la actividad');
select is(tests.error_of($$ select * from public.platform_team() $$) ->> 'sqlstate', 'IG004', 'un usuario común no ve el equipo');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.platform_create_organization('X', 'x', 'a7000000-0000-4000-a000-000000000002', 'initial') $$) ->> 'sqlstate', 'IG004', 'un administrador no principal no crea');
select ok((select count(*) from public.platform_team()) >= 2, 'un administrador ve el equipo');

-- =============================================================================
-- Alta
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000008');
select is(public.platform_find_user('DUENA@super.test'), 'a7000000-0000-4000-a000-000000000001'::uuid, 'encuentra al usuario por email, sin importar mayúsculas');
select is(public.platform_find_user('nadie@super.test'), null, 'un email sin cuenta devuelve null');
insert into ids select 'org', public.platform_create_organization('Inmo Súper', 'inmo-super', 'a7000000-0000-4000-a000-000000000001', 'enterprise', 30);
select is((select plan_code from public.organizations where id = (select id from ids where name = 'org')), 'enterprise', 'aplica el plan elegido');
select ok((select trial_ends_at > now() + interval '29 days' from public.organizations where id = (select id from ids where name = 'org')), 'aplica los días de prueba');
-- El CRM de la inmobiliaria no se ve desde la plataforma: estos datos los comprueba el dueño.
select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select is((select role::text from public.memberships where organization_id = (select id from ids where name = 'org')), 'owner', 'el dueño queda como dueño');
select is((select count(*)::int from public.pipeline_stages where organization_id = (select id from ids where name = 'org')), 7, 'crea el embudo predefinido');
select is((select count(*)::int from public.onboarding_progress where organization_id = (select id from ids where name = 'org')), 4, 'crea el asistente');
select tests.authenticate_as('a7000000-0000-4000-a000-000000000008');
select is((select count(*)::int from public.legal_acceptances where organization_id = (select id from ids where name = 'org')), 0, 'C&C no acepta los términos en nombre del dueño');
select is((select count(*)::int from public.memberships where organization_id = (select id from ids where name = 'org') and user_id = auth.uid()), 0, 'el superadministrador no queda como miembro');
select is((select email from public.platform_organization_owner((select id from ids where name = 'org'))), 'duena@super.test', 'identifica al dueño');
select is(tests.error_of($$ select public.platform_create_organization('   ', 'y', 'a7000000-0000-4000-a000-000000000001', 'initial') $$) ->> 'sqlstate', '22023', 'valida el nombre');

-- El dueño opera su inmobiliaria.
select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select isnt(public.create_contact((select id from ids where name = 'org'), 'Ana'), null, 'el dueño ya puede operar');
select is((select count(*)::int from public.my_organizations()), 1, 'el dueño ve su inmobiliaria');

-- =============================================================================
-- Baja, restauración y eliminación definitiva
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.platform_set_deleted((select id from ids where name = 'org'), true) $$) ->> 'sqlstate', 'IG004', 'un administrador no principal no da de baja');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000008');
select is(tests.error_of($$ select * from public.platform_delete_organization((select id from ids where name = 'org'), 'Inmo Súper') $$) ->> 'sqlstate', '23514', 'no se elimina sin dar de baja primero');
select public.platform_set_deleted((select id from ids where name = 'org'), true);
select is(app.organization_state((select id from ids where name = 'org'))::text, 'pending_deletion', 'la baja deja la cuenta sin acceso');
select isnt((select deleted_at from public.platform_organizations() where id = (select id from ids where name = 'org')), null, 'el panel sigue mostrando la cuenta dada de baja');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ select public.create_contact((select id from ids where name = 'org'), 'Beto') $$) ->> 'sqlstate', '42501', 'una cuenta dada de baja no opera');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000008');
select public.platform_set_deleted((select id from ids where name = 'org'), false);
select isnt(app.organization_state((select id from ids where name = 'org'))::text, 'pending_deletion', 'se puede restaurar');

select public.platform_set_deleted((select id from ids where name = 'org'), true);
select is(tests.error_of($$ select * from public.platform_delete_organization((select id from ids where name = 'org'), 'otro nombre') $$) ->> 'sqlstate', '22023', 'hay que confirmar el nombre exacto');
select * from public.platform_delete_organization((select id from ids where name = 'org'), 'Inmo Súper');
select is((select count(*)::int from public.organizations where id = (select id from ids where name = 'org')), 0, 'la eliminación definitiva borra la inmobiliaria');
select ok(exists (select 1 from public.platform_activity() where action = 'organization.deleted_permanently'), 'queda en la actividad de la plataforma');

-- =============================================================================
-- Equipo
-- =============================================================================
select public.platform_add_admin('a7000000-0000-4000-a000-000000000009');
select ok(exists (select 1 from public.platform_team() where user_id = 'a7000000-0000-4000-a000-000000000009'), 'el principal suma administradores');
select public.platform_remove_admin('a7000000-0000-4000-a000-000000000009');
select ok(not exists (select 1 from public.platform_team() where user_id = 'a7000000-0000-4000-a000-000000000009'), 'el principal quita administradores');
select is(tests.error_of($$ select public.platform_remove_admin('a7000000-0000-4000-a000-000000000008') $$) ->> 'sqlstate', 'IG004', 'el principal no se puede quitar');

select * from finish();
