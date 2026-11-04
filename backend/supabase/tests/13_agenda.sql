-- Incremento 1.5: agenda, tareas y recordatorios (F-21, F-23).
select no_plan();

select tests.create_user('a5000000-0000-4000-a000-000000000001', 'duena@agenda.test');
select tests.create_user('a5000000-0000-4000-a000-000000000002', 'agente@agenda.test');
select tests.create_user('a5000000-0000-4000-a000-000000000003', 'agente2@agenda.test');
select tests.create_user('a5000000-0000-4000-a000-000000000009', 'intruso@agenda.test');
select tests.create_org('a5000000-0000-4000-b000-000000000001', 'agenda-uno');
select tests.create_org('a5000000-0000-4000-b000-000000000002', 'agenda-dos');
select tests.add_member('a5000000-0000-4000-b000-000000000001', 'a5000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a5000000-0000-4000-b000-000000000001', 'a5000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a5000000-0000-4000-b000-000000000001', 'a5000000-0000-4000-a000-000000000003', 'agent');
select tests.add_member('a5000000-0000-4000-b000-000000000002', 'a5000000-0000-4000-a000-000000000009', 'owner');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select tests.authenticate_as('a5000000-0000-4000-a000-000000000002');
insert into ids select 'ana', public.create_contact('a5000000-0000-4000-b000-000000000001', 'Ana G.');
with c as (
  insert into public.properties (organization_id, title, operation, property_type)
  values ('a5000000-0000-4000-b000-000000000001', 'Depto', 'sale', 'apartment') returning id
) insert into ids select 'depto', id from c;

-- =============================================================================
-- Visitas
-- =============================================================================
select is(tests.error_of($$ insert into public.appointments (organization_id, property_id, starts_at)
  values ('a5000000-0000-4000-b000-000000000001', (select id from ids where name = 'depto'), now()) $$) ->> 'sqlstate',
  '23502', 'una visita requiere cliente');
select is(tests.error_of($$ insert into public.appointments (organization_id, contact_id, starts_at)
  values ('a5000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana'), now()) $$) ->> 'sqlstate',
  '23502', 'una visita requiere propiedad');

with c as (
  insert into public.appointments (organization_id, contact_id, property_id, starts_at, assigned_user_id)
  values ('a5000000-0000-4000-b000-000000000001', (select id from ids where name = 'ana'), (select id from ids where name = 'depto'),
          now() + interval '2 hours', 'a5000000-0000-4000-a000-000000000002') returning id
) insert into ids select 'visita', id from c;
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'ana') and kind = 'appointment'),
  'la visita queda en el historial del contacto');

-- Otro agente ve y modifica la agenda ajena.
select tests.authenticate_as('a5000000-0000-4000-a000-000000000003');
select is((select count(*)::int from public.appointments where id = (select id from ids where name = 'visita')), 1, 'un agente ve la visita de otro');
select is(tests.affected($$ update public.appointments set notes = 'Llevar llaves' where id = (select id from ids where name = 'visita') $$), 1::bigint, 'un agente modifica la visita de otro');
select is(tests.error_of($$ update public.appointments set assigned_user_id = 'a5000000-0000-4000-a000-000000000003' where id = (select id from ids where name = 'visita') $$) ->> 'sqlstate',
  'IG012', 'sin la capacidad habilitada, un agente no reasigna');

-- =============================================================================
-- Tareas
-- =============================================================================
select tests.authenticate_as('a5000000-0000-4000-a000-000000000002');
with c as (
  insert into public.tasks (organization_id, title, due_at, assigned_user_id)
  values ('a5000000-0000-4000-b000-000000000001', 'Llamar al propietario', now() - interval '1 hour', 'a5000000-0000-4000-a000-000000000002') returning id
) insert into ids select 'tarea', id from c;
select isnt((select id from ids where name = 'tarea'), null, 'una tarea puede no tener contacto ni propiedad');

-- Recordatorios
select public.sync_my_reminders('a5000000-0000-4000-b000-000000000001');
select public.sync_my_reminders('a5000000-0000-4000-b000-000000000001');
select is((select count(*)::int from public.notifications where kind = 'task_overdue'), 1, 'la tarea vencida avisa una sola vez');
select is((select count(*)::int from public.notifications where kind = 'appointment'), 1, 'la visita próxima genera un recordatorio');

update public.tasks set status = 'done' where id = (select id from ids where name = 'tarea');
select isnt((select completed_at from public.tasks where id = (select id from ids where name = 'tarea')), null, 'completar registra la fecha');

-- =============================================================================
-- Aislamiento
-- =============================================================================
select tests.authenticate_as('a5000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.appointments where organization_id = 'a5000000-0000-4000-b000-000000000001'), 0, 'otra inmobiliaria no ve las visitas');
select is((select count(*)::int from public.tasks where organization_id = 'a5000000-0000-4000-b000-000000000001'), 0, 'otra inmobiliaria no ve las tareas');
select is(tests.error_of($$ insert into public.tasks (organization_id, title, due_at) values ('a5000000-0000-4000-b000-000000000001', 'x', now()) $$) ->> 'sqlstate',
  '42501', 'no se crean tareas en otra inmobiliaria');
select public.sync_my_reminders('a5000000-0000-4000-b000-000000000001');
select is((select count(*)::int from public.notifications), 0, 'los recordatorios no se generan para una inmobiliaria ajena');

-- =============================================================================
-- Desactivar a un miembro y unificar
-- =============================================================================
select tests.clear_authentication();
update public.tasks set status = 'pending' where id = (select id from ids where name = 'tarea');
select tests.authenticate_as('a5000000-0000-4000-a000-000000000001');
update public.memberships set status = 'deactivated', deactivated_at = now()
where organization_id = 'a5000000-0000-4000-b000-000000000001' and user_id = 'a5000000-0000-4000-a000-000000000002';
select is((select assigned_user_id from public.tasks where id = (select id from ids where name = 'tarea')), null,
  'al desactivar al agente, su tarea pendiente queda sin asignar');
select is((select assigned_user_id from public.appointments where id = (select id from ids where name = 'visita')), null,
  'al desactivar al agente, su visita queda sin asignar');

insert into ids select 'ana2', public.create_contact('a5000000-0000-4000-b000-000000000001', 'Ana bis');
select public.merge_contacts((select id from ids where name = 'ana2'), (select id from ids where name = 'ana'));
select is((select contact_id from public.appointments where id = (select id from ids where name = 'visita')),
  (select id from ids where name = 'ana2'), 'al unificar contactos, las visitas pasan al que queda');

select * from finish();
