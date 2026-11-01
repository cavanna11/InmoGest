-- Toda inmobiliaria conserva al menos un dueño activo (PRD §6). Aplica a todos los roles.
select no_plan();

select tests.create_user('40000000-0000-4000-a000-000000000001', 'owner1@lo.test');
select tests.create_user('40000000-0000-4000-a000-000000000002', 'agent@lo.test');
select tests.create_org('40000000-0000-4000-b000-000000000001', 'lo-org');
select tests.add_member('40000000-0000-4000-b000-000000000001', '40000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('40000000-0000-4000-b000-000000000001', '40000000-0000-4000-a000-000000000002', 'agent');

select tests.authenticate_as('40000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ update public.memberships set status = 'deactivated', deactivated_at = now()
                           where user_id = '40000000-0000-4000-a000-000000000001' $$) ->> 'sqlstate',
  'IG003', 'el único dueño no se puede desactivar');
select is(tests.error_of($$ update public.memberships set role = 'agent'
                           where user_id = '40000000-0000-4000-a000-000000000001' $$) ->> 'sqlstate',
  'IG003', 'el único dueño no puede pasar a agente');
select is(tests.error_of($$ delete from public.memberships
                           where user_id = '40000000-0000-4000-a000-000000000001' $$) ->> 'sqlstate',
  'IG003', 'el único dueño no se puede quitar');

-- Procesos privilegiados (worker, migraciones) también respetan la regla.
select tests.clear_authentication();
select is(tests.error_of($$ delete from public.memberships
                           where user_id = '40000000-0000-4000-a000-000000000001' $$) ->> 'sqlstate',
  'IG003', 'tampoco con permisos de servidor');
select is(tests.error_of($$ delete from auth.users where id = '40000000-0000-4000-a000-000000000001' $$) ->> 'sqlstate',
  'IG003', 'borrar el usuario del único dueño también se rechaza');

-- Designar otro dueño y después quitar al anterior: permitido.
select tests.authenticate_as('40000000-0000-4000-a000-000000000001');
select is(tests.affected($$ update public.memberships set role = 'owner' where user_id = '40000000-0000-4000-a000-000000000002' $$),
  1::bigint, 'el dueño designa a otro dueño');
select is(tests.affected($$ update public.memberships set status = 'deactivated', deactivated_at = now()
                            where user_id = '40000000-0000-4000-a000-000000000001' $$),
  1::bigint, 'con otro dueño activo, el anterior se puede desactivar');

select tests.authenticate_as('40000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ update public.memberships set role = 'agent'
                           where user_id = '40000000-0000-4000-a000-000000000002' $$) ->> 'sqlstate',
  'IG003', 'el nuevo único dueño tampoco puede dejar de serlo');
select is(tests.affected($$ update public.memberships set role = 'agent'
                            where user_id = '40000000-0000-4000-a000-000000000001' $$),
  1::bigint, 'cambiar el rol de un dueño desactivado no afecta la regla');

-- Borrar la inmobiliaria completa (job de retención) no queda bloqueado por la regla.
select tests.clear_authentication();
select lives_ok($$ delete from public.organizations where id = '40000000-0000-4000-b000-000000000001' $$,
  'la eliminación completa de la inmobiliaria funciona');
select is_empty($$ select 1 from public.memberships where organization_id = '40000000-0000-4000-b000-000000000001' $$,
  'y elimina sus membresías');

select * from finish();
