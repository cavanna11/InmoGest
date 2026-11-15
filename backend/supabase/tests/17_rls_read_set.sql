-- RLS de lectura con conjunto (migración rls_readable_organization_ids): misma semántica que
-- app.can_read para miembros, estados de cuenta y sesión de soporte; y ninguna política SELECT
-- quedó evaluando app.can_read fila por fila.
select no_plan();

select tests.create_user('17000000-0000-4000-a000-000000000001', 'principal@rs.test');
select tests.create_user('17000000-0000-4000-a000-000000000002', 'owner@rs.test');
select tests.create_user('17000000-0000-4000-a000-000000000003', 'inactivo@rs.test');
select tests.create_user('17000000-0000-4000-a000-000000000004', 'nadie@rs.test');
select tests.make_principal('17000000-0000-4000-a000-000000000001');

-- Prueba, solo lectura, bloqueada, en baja, y una ajena.
select tests.create_org('17000000-0000-4000-b000-000000000001', 'rs-trial');
select tests.create_org('17000000-0000-4000-b000-000000000002', 'rs-ro', 'professional', now() - interval '3 days');
select tests.create_org('17000000-0000-4000-b000-000000000003', 'rs-blk', 'professional', now() - interval '60 days');
select tests.create_org('17000000-0000-4000-b000-000000000004', 'rs-del');
update public.organizations set deleted_at = now() where id = '17000000-0000-4000-b000-000000000004';
select tests.create_org('17000000-0000-4000-b000-000000000005', 'rs-ajena');

select tests.add_member(o, '17000000-0000-4000-a000-000000000002', 'owner')
from unnest(array['17000000-0000-4000-b000-000000000001', '17000000-0000-4000-b000-000000000002',
                  '17000000-0000-4000-b000-000000000003', '17000000-0000-4000-b000-000000000004']::uuid[]) o;
select tests.add_member('17000000-0000-4000-b000-000000000005', '17000000-0000-4000-a000-000000000003', 'owner');
select tests.add_member('17000000-0000-4000-b000-000000000001', '17000000-0000-4000-a000-000000000003', 'agent');
update public.memberships set status = 'deactivated', deactivated_at = now()
where organization_id = '17000000-0000-4000-b000-000000000001' and user_id = '17000000-0000-4000-a000-000000000003';

create temporary table rs_orgs as
select id from public.organizations where id::text like '17000000-%';
grant select on rs_orgs to authenticated;

-- Para cada usuario: el conjunto coincide con can_read en todas las inmobiliarias de prueba.
create function pg_temp.same_as_can_read() returns boolean
language sql
as $$
  select bool_and(app.can_read(o.id) = (o.id in (select app.readable_organization_ids())))
  from rs_orgs o;
$$;

select tests.authenticate_as('17000000-0000-4000-a000-000000000002');
select ok(pg_temp.same_as_can_read(), 'dueño de varias cuentas: igual que can_read');
select is((select array_agg(x order by x) from app.readable_organization_ids() x where x::text like '17000000-%'),
  array['17000000-0000-4000-b000-000000000001', '17000000-0000-4000-b000-000000000002']::uuid[],
  'lee prueba y solo lectura; no bloqueada ni en baja');

select tests.authenticate_as('17000000-0000-4000-a000-000000000003');
select ok(pg_temp.same_as_can_read(), 'membresía desactivada: igual que can_read');
select ok(not exists (select 1 from app.readable_organization_ids() x where x = '17000000-0000-4000-b000-000000000001'),
  'con la membresía desactivada no lee esa inmobiliaria');

select tests.authenticate_as('17000000-0000-4000-a000-000000000004');
select ok(pg_temp.same_as_can_read(), 'sin membresías: igual que can_read');
select is((select count(*)::int from app.readable_organization_ids()), 0, 'sin membresías no lee nada');

-- Sesión de soporte en una cuenta bloqueada: la lee (ignora el estado).
select tests.authenticate_as('17000000-0000-4000-a000-000000000001');
select public.start_support_session('17000000-0000-4000-b000-000000000003');
select ok(pg_temp.same_as_can_read(), 'sesión de soporte: igual que can_read');
select ok(exists (select 1 from app.readable_organization_ids() x where x = '17000000-0000-4000-b000-000000000003'),
  'con «Ingresar como» lee la cuenta bloqueada');
select public.end_support_session();

-- Las políticas efectivamente usan el conjunto.
select tests.clear_authentication();
select is((select count(*)::int from pg_policies where schemaname = 'public' and cmd = 'SELECT'
           and qual in ('app.can_read(organization_id)', 'app.can_read(id)')), 0,
  'ninguna política SELECT evalúa can_read fila por fila');
select ok((select count(*) from pg_policies where schemaname = 'public' and cmd = 'SELECT'
           and qual like '%readable_organization_ids()%') >= 20,
  'las políticas de lectura usan readable_organization_ids');

-- Y siguen aislando: el dueño ve sus contactos y no los de la ajena.
select tests.authenticate_as('17000000-0000-4000-a000-000000000003');
select public.create_contact('17000000-0000-4000-b000-000000000005', 'Contacto ajeno');
select tests.authenticate_as('17000000-0000-4000-a000-000000000002');
select public.create_contact('17000000-0000-4000-b000-000000000001', 'Contacto propio');
select is((select count(*)::int from public.contacts where organization_id::text like '17000000-%'), 1,
  'el dueño ve solo el contacto de su inmobiliaria');
select is((select count(*)::int from public.contacts where organization_id = '17000000-0000-4000-b000-000000000005'), 0,
  'y nada de la ajena');

select * from finish();
