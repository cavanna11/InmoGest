-- Estados de cuenta (PRD §6 Cuentas y estados, §8 F-27/F-28/F-29, F-04).
select no_plan();

-- ---------------------------------------------------------------------------
-- Cálculo del estado efectivo por fechas
-- ---------------------------------------------------------------------------
select tests.create_org('30000000-0000-4000-b000-000000000001', 'st-trial');
select tests.create_org('30000000-0000-4000-b000-000000000002', 'st-active', 'professional', now() - interval '20 days', now() + interval '30 days');
select tests.create_org('30000000-0000-4000-b000-000000000003', 'st-day15', 'professional', now() - interval '1 day');
select tests.create_org('30000000-0000-4000-b000-000000000004', 'st-ro-last', 'professional', now() - interval '30 days' + interval '1 minute');
select tests.create_org('30000000-0000-4000-b000-000000000005', 'st-day45', 'professional', now() - interval '30 days' - interval '1 minute');
select tests.create_org('30000000-0000-4000-b000-000000000006', 'st-blk-last', 'professional', now() - interval '120 days' + interval '1 minute');
select tests.create_org('30000000-0000-4000-b000-000000000007', 'st-day135', 'professional', now() - interval '120 days' - interval '1 minute');
select tests.create_org('30000000-0000-4000-b000-000000000008', 'st-paid-expired', 'professional', now() - interval '100 days', now() - interval '10 days');
select tests.create_org('30000000-0000-4000-b000-000000000009', 'st-boundary', 'professional', now());
select tests.create_org('30000000-0000-4000-b000-000000000010', 'st-suspended', 'professional', now() + interval '5 days', now() + interval '30 days');
update public.organizations set suspended_at = now() where id = '30000000-0000-4000-b000-000000000010';
select tests.create_org('30000000-0000-4000-b000-000000000011', 'st-deleted');
update public.organizations set deleted_at = now() where id = '30000000-0000-4000-b000-000000000011';

select is(app.organization_state('30000000-0000-4000-b000-000000000001'), 'trial', 'cuenta nueva: prueba');
select is(app.organization_state('30000000-0000-4000-b000-000000000002'), 'active', 'con pago vigente: activa');
select is(app.organization_state('30000000-0000-4000-b000-000000000003'), 'read_only', 'día 15: solo lectura');
select is(app.organization_state('30000000-0000-4000-b000-000000000004'), 'read_only', 'último minuto de los 30 días: solo lectura');
select is(app.organization_state('30000000-0000-4000-b000-000000000005'), 'blocked', 'pasados 30 días (día 45): bloqueada');
select is(app.organization_state('30000000-0000-4000-b000-000000000006'), 'blocked', 'último minuto de los 90 días de conservación: bloqueada');
select is(app.organization_state('30000000-0000-4000-b000-000000000007'), 'pending_deletion', 'día 135: para eliminar');
select is(app.organization_state('30000000-0000-4000-b000-000000000008'), 'read_only', 'pago vencido hace 10 días: solo lectura (cuenta desde el pago)');
select is(app.organization_state('30000000-0000-4000-b000-000000000009'), 'read_only', 'en el instante de vencimiento ya es solo lectura');
select is(app.organization_state('30000000-0000-4000-b000-000000000010'), 'blocked', 'suspendida por C&C: bloqueada aunque esté paga');
select is(app.organization_state('30000000-0000-4000-b000-000000000011'), 'pending_deletion', 'marcada como eliminada');
select is(app.organization_state('30000000-0000-4000-b000-0000000000ff'), null::public.account_state, 'inmobiliaria inexistente: null');

-- ---------------------------------------------------------------------------
-- Comportamiento por estado
-- ---------------------------------------------------------------------------
select tests.create_user('31000000-0000-4000-a000-000000000001', 'ro-owner@st.test');
select tests.create_user('31000000-0000-4000-a000-000000000002', 'blk-owner@st.test');
select tests.create_user('31000000-0000-4000-a000-000000000003', 'act-owner@st.test');
select tests.create_user('31000000-0000-4000-a000-000000000004', 'act-agent@st.test');
select tests.add_member('30000000-0000-4000-b000-000000000003', '31000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('30000000-0000-4000-b000-000000000005', '31000000-0000-4000-a000-000000000002', 'owner');
select tests.add_member('30000000-0000-4000-b000-000000000002', '31000000-0000-4000-a000-000000000003', 'owner');
select tests.add_member('30000000-0000-4000-b000-000000000002', '31000000-0000-4000-a000-000000000004', 'agent');

-- Solo lectura: lee, no escribe (F-27).
select tests.authenticate_as('31000000-0000-4000-a000-000000000001');
select isnt_empty($$ select 1 from public.organizations where id = '30000000-0000-4000-b000-000000000003' $$,
  'solo lectura: puede consultar');
select isnt_empty($$ select 1 from public.memberships where organization_id = '30000000-0000-4000-b000-000000000003' $$,
  'solo lectura: ve su equipo');
select is(tests.affected($$ update public.organizations set name = 'X' where id = '30000000-0000-4000-b000-000000000003' $$),
  0::bigint, 'solo lectura: no edita la configuración');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, token_hash)
     values ('30000000-0000-4000-b000-000000000003', 'n@st.test', extensions.digest('st1', 'sha256')) $$,
  '42501', null, 'solo lectura: no invita');
select results_eq($$ select state::text from public.my_organizations() $$, $$ values ('read_only') $$,
  'my_organizations informa el estado');

-- Activación por C&C: vuelve a escribir sin volver a iniciar sesión (F-28).
select tests.clear_authentication();
update public.organizations set paid_until = now() + interval '30 days' where id = '30000000-0000-4000-b000-000000000003';
select tests.authenticate_as('31000000-0000-4000-a000-000000000001');
select is(tests.affected($$ update public.organizations set name = 'Reactivada' where id = '30000000-0000-4000-b000-000000000003' $$),
  1::bigint, 'al activarse la suscripción vuelve a poder modificar');

-- Bloqueada: no lee nada de la inmobiliaria, pero sabe que existe y por qué no entra.
select tests.authenticate_as('31000000-0000-4000-a000-000000000002');
select is_empty($$ select 1 from public.organizations $$, 'bloqueada: no lee la inmobiliaria');
select results_eq($$ select organization_id from public.memberships $$,
  $$ values ('30000000-0000-4000-b000-000000000005'::uuid) $$, 'bloqueada: solo ve su propia membresía');
select results_eq($$ select state::text from public.my_organizations() $$, $$ values ('blocked') $$,
  'my_organizations informa que está bloqueada');

-- Suspensión por C&C: corta a partir del siguiente pedido (F-29).
select tests.authenticate_as('31000000-0000-4000-a000-000000000003');
select isnt_empty($$ select 1 from public.organizations where id = '30000000-0000-4000-b000-000000000002' $$,
  'activa: el dueño lee');
select tests.clear_authentication();
update public.organizations set suspended_at = now() where id = '30000000-0000-4000-b000-000000000002';
select tests.authenticate_as('31000000-0000-4000-a000-000000000003');
select is_empty($$ select 1 from public.organizations where id = '30000000-0000-4000-b000-000000000002' $$,
  'suspendida: el dueño ya no lee');
select tests.clear_authentication();
update public.organizations set suspended_at = null where id = '30000000-0000-4000-b000-000000000002';

-- Agente desactivado: sin acceso a partir del siguiente pedido (F-04).
select tests.authenticate_as('31000000-0000-4000-a000-000000000004');
select isnt_empty($$ select 1 from public.organizations $$, 'agente activo: lee');
select tests.authenticate_as('31000000-0000-4000-a000-000000000003');
select is(tests.affected($$ update public.memberships set status = 'deactivated', deactivated_at = now()
                            where user_id = '31000000-0000-4000-a000-000000000004' $$),
  1::bigint, 'el dueño desactiva al agente');
select tests.authenticate_as('31000000-0000-4000-a000-000000000004');
select is_empty($$ select 1 from public.organizations $$, 'agente desactivado: no lee la inmobiliaria');
select is_empty($$ select 1 from public.profiles where id <> '31000000-0000-4000-a000-000000000004' $$,
  'agente desactivado: no ve al equipo');
select is_empty($$ select 1 from public.my_organizations() $$, 'agente desactivado: sin inmobiliarias');

select tests.clear_authentication();
select * from finish();
