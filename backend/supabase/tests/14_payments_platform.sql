-- Incremento 1.8: informe de pago y panel de superadministrador (F-26, F-28, F-29).
select no_plan();

select tests.create_user('a6000000-0000-4000-a000-000000000001', 'duena@pago.test');
select tests.create_user('a6000000-0000-4000-a000-000000000002', 'agente@pago.test');
select tests.create_user('a6000000-0000-4000-a000-000000000008', 'principal@pago.test');
select tests.create_user('a6000000-0000-4000-a000-000000000009', 'intruso@pago.test');
select tests.create_org('a6000000-0000-4000-b000-000000000001', 'pago-uno', 'initial', now() - interval '5 days');
select tests.create_org('a6000000-0000-4000-b000-000000000002', 'pago-dos');
select tests.add_member('a6000000-0000-4000-b000-000000000001', 'a6000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a6000000-0000-4000-b000-000000000001', 'a6000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a6000000-0000-4000-b000-000000000002', 'a6000000-0000-4000-a000-000000000009', 'owner');
select tests.make_principal('a6000000-0000-4000-a000-000000000008');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- =============================================================================
-- Informe de pago: el dueño, aunque la cuenta esté en solo lectura
-- =============================================================================
select tests.authenticate_as('a6000000-0000-4000-a000-000000000001');
select is(app.organization_state('a6000000-0000-4000-b000-000000000001')::text, 'read_only', 'la cuenta vencida está en solo lectura');
with c as (
  insert into public.payment_reports (organization_id, plan_code, months, amount, currency, reference, reported_by)
  values ('a6000000-0000-4000-b000-000000000001', 'professional', 2, 78, 'USD', 'Transferencia 123', auth.uid()) returning id
) insert into ids select 'pago', id from c;
select isnt((select id from ids where name = 'pago'), null, 'en solo lectura el dueño puede informar un pago');
select is(tests.error_of($$ insert into public.payment_reports (organization_id, plan_code, amount, status, reviewed_at, reported_by)
  values ('a6000000-0000-4000-b000-000000000001', 'enterprise', 1, 'approved', now(), auth.uid()) $$) ->> 'sqlstate',
  '42501', 'el dueño no puede informar un pago ya aprobado');
select is(tests.error_of($$ update public.payment_reports set status = 'approved', reviewed_at = now() $$) ->> 'sqlstate',
  '42501', 'el dueño no puede aprobar su pago');
select is(tests.error_of($$ select public.approve_payment((select id from ids where name = 'pago')) $$) ->> 'sqlstate',
  'IG004', 'solo la plataforma aprueba');
select is((select users_limit from public.organization_usage('a6000000-0000-4000-b000-000000000001')), 2, 'el dueño ve los límites de su plan');

select tests.authenticate_as('a6000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ insert into public.payment_reports (organization_id, plan_code, amount, reported_by)
  values ('a6000000-0000-4000-b000-000000000001', 'initial', 1, auth.uid()) $$) ->> 'sqlstate', '42501', 'un agente no informa pagos');
select is((select count(*)::int from public.payment_reports), 0, 'un agente no ve los pagos');

select tests.authenticate_as('a6000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.payment_reports where organization_id = 'a6000000-0000-4000-b000-000000000001'), 0, 'otra inmobiliaria no ve los pagos');
select is(tests.error_of($$ select public.platform_organizations() $$) ->> 'sqlstate', 'IG004', 'un usuario común no ve el panel de plataforma');
select is(tests.error_of($$ select * from public.organization_usage('a6000000-0000-4000-b000-000000000001') $$) ->> 'sqlstate', '42501', 'no ve el uso de otra inmobiliaria');

-- =============================================================================
-- Plataforma
-- =============================================================================
select tests.authenticate_as('a6000000-0000-4000-a000-000000000008');
select is((select pending_payments from public.platform_organizations() where id = 'a6000000-0000-4000-b000-000000000001'), 1, 'el panel muestra los pagos pendientes');
select is((select owner_email from public.platform_organizations() where id = 'a6000000-0000-4000-b000-000000000001'), 'duena@pago.test', 'el panel muestra al dueño');
select public.approve_payment((select id from ids where name = 'pago'), 'ok');
select is(app.organization_state('a6000000-0000-4000-b000-000000000001')::text, 'active', 'al aprobar, la cuenta vuelve a estar activa');
select is((select plan_code from public.organizations where id = 'a6000000-0000-4000-b000-000000000001'), 'professional', 'al aprobar se aplica el plan informado');
select ok((select paid_until > now() + interval '55 days' and paid_until < now() + interval '63 days' from public.organizations where id = 'a6000000-0000-4000-b000-000000000001'), 'suma los meses informados');
select is(tests.error_of($$ select public.approve_payment((select id from ids where name = 'pago')) $$) ->> 'sqlstate', '23514', 'un pago no se aprueba dos veces');
select ok(exists (select 1 from public.audit_logs where action = 'payment.approved'), 'la aprobación queda auditada');

-- Solo la plataforma cambia plan y estado.
select is(tests.affected($$ update public.plans set max_properties = 111 where code = 'initial' $$), 1::bigint, 'el principal cambia los límites de un plan');
select is(tests.affected($$ update public.platform_settings set payment_instructions = 'Alias: inmopanel' where id $$), 1::bigint, 'el principal carga los datos de pago');

select tests.authenticate_as('a6000000-0000-4000-a000-000000000001');
select is(public.payment_instructions(), 'Alias: inmopanel', 'el dueño ve los datos para transferir');
select is(tests.error_of($$ update public.organizations set plan_code = 'enterprise' where id = 'a6000000-0000-4000-b000-000000000001' $$) ->> 'sqlstate', 'IG004', 'el dueño no cambia su plan');
with c as (
  insert into public.payment_reports (organization_id, plan_code, amount, reported_by)
  values ('a6000000-0000-4000-b000-000000000001', 'professional', 39, auth.uid()) returning id
) insert into ids select 'rechazo', id from c;
select tests.authenticate_as('a6000000-0000-4000-a000-000000000008');
select public.reject_payment((select id from ids where name = 'rechazo'), 'No acreditada');
select is((select status::text from public.payment_reports where id = (select id from ids where name = 'rechazo')), 'rejected', 'la plataforma rechaza un pago');

-- Datos internos de la inmobiliaria: solo con «Ingresar como».
select is((select count(*)::int from public.contacts where organization_id = 'a6000000-0000-4000-b000-000000000001'), 0, 'sin «Ingresar como» la plataforma no ve el CRM');

select * from finish();
