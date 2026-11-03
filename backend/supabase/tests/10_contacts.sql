-- Incremento 1.2: contactos (F-06, F-07, F-19, F-22, F-34).
select no_plan();

select tests.create_user('a2000000-0000-4000-a000-000000000001', 'duena@cto.test');
select tests.create_user('a2000000-0000-4000-a000-000000000002', 'agente@cto.test');
select tests.create_user('a2000000-0000-4000-a000-000000000003', 'agente2@cto.test');
select tests.create_user('a2000000-0000-4000-a000-000000000009', 'intruso@cto.test');
select tests.create_org('a2000000-0000-4000-b000-000000000001', 'cto-uno');
select tests.create_org('a2000000-0000-4000-b000-000000000002', 'cto-dos');
select tests.add_member('a2000000-0000-4000-b000-000000000001', 'a2000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a2000000-0000-4000-b000-000000000001', 'a2000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a2000000-0000-4000-b000-000000000001', 'a2000000-0000-4000-a000-000000000003', 'agent');
select tests.add_member('a2000000-0000-4000-b000-000000000002', 'a2000000-0000-4000-a000-000000000009', 'owner');

-- Ids creados durante el test (la tabla la crea postgres y la usa authenticated).
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- =============================================================================
-- Alta y duplicados (F-06)
-- =============================================================================
select tests.authenticate_as('a2000000-0000-4000-a000-000000000002');
insert into ids select 'ana', public.create_contact('a2000000-0000-4000-b000-000000000001', 'Ana G.',
  array['+5491155550188'], array['ana@cliente.test'], 'Busca 3 ambientes', true, false,
  'a2000000-0000-4000-a000-000000000002');
select isnt((select id from ids where name = 'ana'), null, 'un agente crea un contacto con teléfono y email');
select is((select count(*)::int from public.contact_phones where contact_id = (select id from ids where name = 'ana')), 1,
  'guarda el teléfono');
select is((select kind from public.activities where contact_id = (select id from ids where name = 'ana')), 'contact_created',
  'el alta queda en el historial');

select is(tests.error_of($$ select public.create_contact('a2000000-0000-4000-b000-000000000001', 'Ana Otra', array['+5491155550188']) $$) ->> 'sqlstate',
  'IG011', 'un teléfono ya registrado no crea otro contacto');
select is(tests.error_of($$ select public.create_contact('a2000000-0000-4000-b000-000000000001', 'Ana Otra', '{}', array['ANA@cliente.test']) $$) ->> 'detail',
  (select id::text from ids where name = 'ana'), 'un email ya registrado (sin importar mayúsculas) devuelve el contacto existente');

insert into ids select 'ana2', public.create_contact('a2000000-0000-4000-b000-000000000001', 'Ana G.', array['+5491155550199']);
select isnt((select id from ids where name = 'ana2'), (select id from ids where name = 'ana'),
  'mismo nombre con distinto teléfono es otro contacto (no se fusiona)');
select is(tests.error_of($$ insert into public.contact_phones (organization_id, contact_id, phone_e164)
  values ('a2000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana2'), '+5491155550188') $$) ->> 'sqlstate',
  '23505', 'agregar a otro contacto un teléfono existente falla');

-- Mismo teléfono en otra inmobiliaria: permitido.
select tests.authenticate_as('a2000000-0000-4000-a000-000000000009');
select isnt(public.create_contact('a2000000-0000-4000-b000-000000000002', 'Ana en otra inmo', array['+5491155550188']), null,
  'el mismo teléfono puede existir en otra inmobiliaria');
select is((select count(*)::int from public.contacts where organization_id = 'a2000000-0000-4000-b000-000000000001'), 0,
  'otra inmobiliaria no ve los contactos');
select is(tests.error_of($$ select public.create_contact('a2000000-0000-4000-b000-000000000001', 'Intruso') $$) ->> 'sqlstate',
  '42501', 'no se crean contactos en una inmobiliaria ajena');

-- =============================================================================
-- Asignación (F-07)
-- =============================================================================
select tests.authenticate_as('a2000000-0000-4000-a000-000000000003');
select is((select count(*)::int from public.contacts where id = (select id from ids where name = 'ana')), 1,
  'un agente ve un contacto asignado a otro');
select is(tests.affected($$ update public.contacts set notes = 'Editado por otro agente' where id = (select id from ids where name = 'ana') $$), 1::bigint,
  'un agente edita un contacto asignado a otro');
select is(tests.error_of($$ update public.contacts set assigned_user_id = 'a2000000-0000-4000-a000-000000000003' where id = (select id from ids where name = 'ana') $$) ->> 'sqlstate',
  'IG012', 'sin la capacidad habilitada, un agente no reasigna');
select is(tests.affected($$ update public.contacts set assigned_user_id = 'a2000000-0000-4000-a000-000000000003' where id = (select id from ids where name = 'ana2') $$), 1::bigint,
  'un agente puede tomar un contacto sin asignar');

select tests.authenticate_as('a2000000-0000-4000-a000-000000000001');
update public.organizations set agents_can_reassign = true where id = 'a2000000-0000-4000-b000-000000000001';
select tests.authenticate_as('a2000000-0000-4000-a000-000000000003');
select is(tests.affected($$ update public.contacts set assigned_user_id = 'a2000000-0000-4000-a000-000000000003' where id = (select id from ids where name = 'ana') $$), 1::bigint,
  'con la capacidad habilitada, un agente reasigna');
select is(tests.error_of($$ update public.contacts set assigned_user_id = 'a2000000-0000-4000-a000-000000000009' where id = (select id from ids where name = 'ana') $$) ->> 'sqlstate',
  '23503', 'solo se asigna a miembros activos de la inmobiliaria');
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'ana') and kind = 'assigned'),
  'el cambio de asignación queda en el historial');

-- =============================================================================
-- No contactar (F-19), notas (F-22)
-- =============================================================================
update public.contacts set do_not_contact = true where id = (select id from ids where name = 'ana');
select isnt((select do_not_contact_at from public.contacts where id = (select id from ids where name = 'ana')), null,
  'la baja registra la fecha');
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'ana') and kind = 'do_not_contact'),
  'la baja queda en el historial');
select is(tests.affected($$ insert into public.activities (organization_id, contact_id, kind, body, author_id)
  values ('a2000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana'), 'note', 'Llamó por la visita', auth.uid()) $$), 1::bigint,
  'un agente agrega una nota');
select is(tests.error_of($$ insert into public.activities (organization_id, contact_id, kind, author_id)
  values ('a2000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana'), 'contact_merged', auth.uid()) $$) ->> 'sqlstate',
  '42501', 'los tipos automáticos del historial no se cargan a mano');

-- =============================================================================
-- Duplicados y unificación (F-34)
-- =============================================================================
insert into public.duplicate_reports (organization_id, contact_a_id, contact_b_id, reason, reported_by)
values ('a2000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana'), (select id from ids where name = 'ana2'),
        'Misma persona', auth.uid());
select is(tests.error_of($$ insert into public.duplicate_reports (organization_id, contact_a_id, contact_b_id, reported_by)
  values ('a2000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana2'), (select id from ids where name = 'ana'), auth.uid()) $$) ->> 'sqlstate',
  '23505', 'un par se reporta una sola vez mientras esté abierto');
select is(tests.error_of($$ select public.merge_contacts((select id from ids where name = 'ana'), (select id from ids where name = 'ana2')) $$) ->> 'sqlstate',
  '42501', 'un agente no puede unificar');
select is(tests.error_of($$ update public.contacts set merged_into_id = (select id from ids where name = 'ana'), merged_at = now()
  where id = (select id from ids where name = 'ana2') $$) ->> 'sqlstate',
  '42501', 'la unificación no se puede marcar con un update directo');

select tests.authenticate_as('a2000000-0000-4000-a000-000000000001');
select is(public.merge_contacts((select id from ids where name = 'ana'), (select id from ids where name = 'ana2')),
  (select id from ids where name = 'ana'), 'el dueño unifica');
select is((select count(*)::int from public.contact_phones where contact_id = (select id from ids where name = 'ana')), 2,
  'el contacto resultante conserva los teléfonos de ambos');
select is((select merged_into_id from public.contacts where id = (select id from ids where name = 'ana2')),
  (select id from ids where name = 'ana'), 'el otro queda marcado como unificado');
select is((select status::text from public.duplicate_reports where contact_a_id = (select id from ids where name = 'ana')), 'merged',
  'el reporte queda resuelto');
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'ana') and kind = 'contact_merged'),
  'la unificación queda en el historial');
select ok(exists (select 1 from public.audit_logs where action = 'contact.merged'), 'la unificación queda auditada');
select is(tests.error_of($$ select public.merge_contacts((select id from ids where name = 'ana'), (select id from ids where name = 'ana2')) $$) ->> 'sqlstate',
  'IG013', 'no se unifica un contacto ya unificado');
select is(tests.affected($$ update public.contacts set notes = 'x' where id = (select id from ids where name = 'ana2') $$), 0::bigint,
  'un contacto unificado no se edita');

-- =============================================================================
-- Desactivar a un agente deja sus contactos sin asignar (PRD §6)
-- =============================================================================
update public.memberships set status = 'deactivated', deactivated_at = now()
where organization_id = 'a2000000-0000-4000-b000-000000000001' and user_id = 'a2000000-0000-4000-a000-000000000003';
select is((select assigned_user_id from public.contacts where id = (select id from ids where name = 'ana')), null,
  'al desactivar al agente, su contacto queda sin asignar');

-- =============================================================================
-- Solo lectura: se ven los contactos pero no se crean
-- =============================================================================
select tests.clear_authentication();
update public.organizations set trial_ends_at = now() - interval '1 day' where id = 'a2000000-0000-4000-b000-000000000001';
select tests.authenticate_as('a2000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ select public.create_contact('a2000000-0000-4000-b000-000000000001', 'En solo lectura') $$) ->> 'sqlstate',
  '42501', 'en solo lectura no se crean contactos');
select is((select count(*)::int from public.contacts where id = (select id from ids where name = 'ana')), 1,
  'en solo lectura los contactos se siguen viendo');

select * from finish();
