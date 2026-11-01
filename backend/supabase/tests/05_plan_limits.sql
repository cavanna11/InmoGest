-- Límites de plan (PRD §6 Planes, §8 F-26 y F-29). Usuarios = membresías activas + invitaciones abiertas.
select no_plan();

select tests.create_user('50000000-0000-4000-a000-000000000001', 'owner@pl.test');
select tests.create_user('50000000-0000-4000-a000-000000000002', 'agent@pl.test');
select tests.create_user('50000000-0000-4000-a000-000000000003', 'extra@pl.test');
select tests.create_user('50000000-0000-4000-a000-000000000009', 'principal@pl.test');
select tests.make_principal('50000000-0000-4000-a000-000000000009');
-- Plan Inicial: 2 usuarios.
select tests.create_org('50000000-0000-4000-b000-000000000001', 'pl-initial', 'initial');
select tests.add_member('50000000-0000-4000-b000-000000000001', '50000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('50000000-0000-4000-b000-000000000001', '50000000-0000-4000-a000-000000000002', 'agent');

select is(app.plan_limit('50000000-0000-4000-b000-000000000001', 'users'), 2, 'Inicial: 2 usuarios');
select is(app.plan_limit('50000000-0000-4000-b000-000000000001', 'properties'), 100, 'Inicial: 100 propiedades');
select is(app.user_slots_used('50000000-0000-4000-b000-000000000001'), 2, 'usa 2 lugares');

select tests.authenticate_as('50000000-0000-4000-a000-000000000001');
select is(
  tests.error_of($$ insert into public.invitations (organization_id, email, token_hash)
                    values ('50000000-0000-4000-b000-000000000001', 'tercero@pl.test', extensions.digest('pl1', 'sha256')) $$),
  jsonb_build_object('sqlstate', 'IG001', 'detail', '{"plan": "Inicial", "limit": 2, "resource": "users"}'),
  'con el límite alcanzado, la invitación se rechaza indicando límite y plan'
);
select is(
  tests.error_of($$ insert into public.memberships (organization_id, user_id, role)
                    values ('50000000-0000-4000-b000-000000000001', '50000000-0000-4000-a000-000000000003', 'agent') $$) ->> 'sqlstate',
  'IG001', 'y el alta directa de un miembro también');
select is((select count(*)::int from public.memberships where organization_id = '50000000-0000-4000-b000-000000000001'), 2,
  'los existentes no cambian');

-- Un miembro desactivado libera su lugar; una invitación abierta lo ocupa.
select is(tests.affected($$ update public.memberships set status = 'deactivated', deactivated_at = now()
                            where user_id = '50000000-0000-4000-a000-000000000002' $$), 1::bigint, 'desactiva al agente');
select lives_ok($$ insert into public.invitations (organization_id, email, token_hash)
                   values ('50000000-0000-4000-b000-000000000001', 'tercero@pl.test', extensions.digest('pl2', 'sha256')) $$,
  'con un lugar libre puede invitar');
select is(tests.error_of($$ update public.memberships set status = 'active', deactivated_at = null
                           where user_id = '50000000-0000-4000-a000-000000000002' $$) ->> 'sqlstate',
  'IG001', 'la invitación abierta cuenta: no puede reactivar al agente');

-- Invitaciones revocadas o vencidas no cuentan.
select is(tests.affected($$ update public.invitations set revoked_at = now() where email = 'tercero@pl.test' $$), 1::bigint,
  'revoca la invitación');
select is(tests.affected($$ update public.memberships set status = 'active', deactivated_at = null
                            where user_id = '50000000-0000-4000-a000-000000000002' $$), 1::bigint,
  'con la invitación revocada puede reactivar');
select tests.clear_authentication();
update public.memberships set status = 'deactivated', deactivated_at = now() where user_id = '50000000-0000-4000-a000-000000000002';
insert into public.invitations (organization_id, email, token_hash, expires_at)
values ('50000000-0000-4000-b000-000000000001', 'vencida@pl.test', extensions.digest('pl3', 'sha256'), now() - interval '1 second');
select is(app.user_slots_used('50000000-0000-4000-b000-000000000001'), 1, 'una invitación vencida no ocupa lugar');

-- Procesos del servidor (importaciones) también respetan el límite.
update public.memberships set status = 'active', deactivated_at = null where user_id = '50000000-0000-4000-a000-000000000002';
select is(tests.error_of($$ insert into public.memberships (organization_id, user_id, role)
                           values ('50000000-0000-4000-b000-000000000001', '50000000-0000-4000-a000-000000000003', 'agent') $$) ->> 'sqlstate',
  'IG001', 'el límite aplica también a procesos privilegiados');

-- El dueño no puede subir su límite; C&C sí, y aplica sin desplegar (F-29).
select tests.authenticate_as('50000000-0000-4000-a000-000000000001');
select is(tests.affected($$ update public.plans set max_users = 3 where code = 'initial' $$), 0::bigint,
  'el dueño no cambia los límites del plan');
select tests.authenticate_as('50000000-0000-4000-a000-000000000009');
select is(tests.affected($$ update public.plans set max_users = 3 where code = 'initial' $$), 1::bigint,
  'el superadministrador principal cambia el límite');
select isnt_empty($$ select 1 from public.audit_logs where scope = 'platform' and action = 'plans.updated' and entity_id = 'initial' $$,
  'el cambio queda en la auditoría de plataforma');
select tests.authenticate_as('50000000-0000-4000-a000-000000000001');
select lives_ok($$ insert into public.invitations (organization_id, email, token_hash)
                   values ('50000000-0000-4000-b000-000000000001', 'tercero@pl.test', extensions.digest('pl4', 'sha256')) $$,
  'con el nuevo límite, la inmobiliaria puede invitar de inmediato');

-- Números de WhatsApp: sin máximo definido se permite 1 (docs/DATABASE.md).
select tests.clear_authentication();
select tests.create_org('50000000-0000-4000-b000-000000000002', 'pl-enterprise', 'enterprise');
select is(app.plan_limit('50000000-0000-4000-b000-000000000002', 'whatsapp_numbers'), 1,
  'Empresa sin máximo de números definido: 1');
update public.plans set max_whatsapp_numbers = 3 where code = 'enterprise';
select is(app.plan_limit('50000000-0000-4000-b000-000000000002', 'whatsapp_numbers'), 3,
  'Empresa con máximo configurado');

-- «Ingresar como»: sin restricciones de plan (PRD §6).
select tests.authenticate_as('50000000-0000-4000-a000-000000000009');
select public.start_support_session('50000000-0000-4000-b000-000000000001');
select lives_ok($$ insert into public.memberships (organization_id, user_id, role)
                   values ('50000000-0000-4000-b000-000000000001', '50000000-0000-4000-a000-000000000003', 'agent') $$,
  'en sesión de soporte se puede superar el límite');

select tests.clear_authentication();
select * from finish();
