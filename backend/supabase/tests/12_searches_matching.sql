-- Incremento 1.4: búsquedas, coincidencias, embudo y notificaciones (F-11, F-12, F-13, F-23, F-31).
select no_plan();

select tests.create_user('a4000000-0000-4000-a000-000000000001', 'duena@match.test');
select tests.create_user('a4000000-0000-4000-a000-000000000002', 'agente@match.test');
select tests.create_user('a4000000-0000-4000-a000-000000000009', 'intruso@match.test');
select tests.create_org('a4000000-0000-4000-b000-000000000001', 'match-uno');
select tests.create_org('a4000000-0000-4000-b000-000000000002', 'match-dos');
select tests.add_member('a4000000-0000-4000-b000-000000000001', 'a4000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a4000000-0000-4000-b000-000000000001', 'a4000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a4000000-0000-4000-b000-000000000002', 'a4000000-0000-4000-a000-000000000009', 'owner');

insert into public.pipeline_stages (id, organization_id, name, position, kind) values
  ('a4000000-0000-4000-c000-000000000001', 'a4000000-0000-4000-b000-000000000001', 'Nuevo', 0, 'open'),
  ('a4000000-0000-4000-c000-000000000002', 'a4000000-0000-4000-b000-000000000001', 'Ganado', 1, 'won'),
  ('a4000000-0000-4000-c000-000000000003', 'a4000000-0000-4000-b000-000000000001', 'Perdido', 2, 'lost'),
  ('a4000000-0000-4000-c000-000000000004', 'a4000000-0000-4000-b000-000000000001', 'Vieja', 3, 'open');
update public.pipeline_stages set is_active = false where id = 'a4000000-0000-4000-c000-000000000004';
insert into public.pipeline_stages (organization_id, name, position, kind) values
  ('a4000000-0000-4000-b000-000000000002', 'Nuevo', 0, 'open');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- Atajo: propiedad disponible en venta en Belgrano.
create function pg_temp.prop(p_name text, p_price numeric, p_currency text default 'USD', p_features text[] default '{}',
  p_neighborhood text default 'Belgrano', p_status public.property_status default 'available') returns void
language sql as $$
  with c as (
    insert into public.properties (organization_id, title, operation, property_type, status, price, currency, features, neighborhood, rooms)
    values ('a4000000-0000-4000-b000-000000000001', p_name, 'sale', 'apartment', p_status, p_price, p_currency, p_features, p_neighborhood, 3)
    returning id
  ) insert into ids select p_name, id from c;
$$;

select tests.authenticate_as('a4000000-0000-4000-a000-000000000002');
insert into ids select 'ana', public.create_contact('a4000000-0000-4000-b000-000000000001', 'Ana G.', array['+5491155550188']);

-- Búsqueda: venta, depto, Belgrano, hasta USD 100.000, mínimo 80.000, 3 deseables.
insert into ids select 'busqueda', public.save_client_search('a4000000-0000-4000-b000-000000000001', null, (select id from ids where name = 'ana'),
  'sale', array['apartment']::public.property_type[], 80000, 100000, 'USD', null, 2::smallint, null, '{}',
  array['garage', 'balcony', 'bright'], '', 'a4000000-0000-4000-a000-000000000002', array['belgrano']);

select is((select stage_id from public.client_searches where id = (select id from ids where name = 'busqueda')),
  'a4000000-0000-4000-c000-000000000001'::uuid, 'la búsqueda arranca en la primera etapa abierta activa');
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'ana') and kind = 'search_created'),
  'la búsqueda queda en el historial del contacto');

-- =============================================================================
-- Criterios de aceptación del PRD (F-12)
-- =============================================================================
select pg_temp.prop('dos-de-tres', 95000, 'USD', array['balcony', 'bright']);
select is((select score::int from public.match_results where property_id = (select id from ids where name = 'dos-de-tres')), 67,
  '3 deseables con 2 cumplidos muestra 67 %');
select is((select missing_features from public.match_results where property_id = (select id from ids where name = 'dos-de-tres')), array['garage'],
  'la coincidencia indica qué falta');
select is((select over_budget from public.match_results where property_id = (select id from ids where name = 'dos-de-tres')), false,
  'dentro del presupuesto no se marca');

select pg_temp.prop('tope', 100000);
select is((select over_budget from public.match_results where property_id = (select id from ids where name = 'tope')), false,
  'USD 100.000 coincide sin marca');
select pg_temp.prop('tolerancia', 110000);
select is((select over_budget from public.match_results where property_id = (select id from ids where name = 'tolerancia')), true,
  'USD 110.000 coincide marcada como superior al presupuesto');
select pg_temp.prop('excede', 110001);
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'excede')), 0,
  'USD 110.001 no coincide');
select pg_temp.prop('barata', 79999);
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'barata')), 0,
  'por debajo del mínimo no coincide');
select pg_temp.prop('otra-zona', 90000, 'USD', '{}', 'Palermo');
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'otra-zona')), 0,
  'si falla un obligatorio (zona) no hay coincidencia');
select pg_temp.prop('acento', 90000, 'USD', '{}', 'BELGRANÓ');
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'acento')), 1,
  'la zona se compara sin mayúsculas ni acentos');
select pg_temp.prop('borrador', 90000, 'USD', '{}', 'Belgrano', 'draft');
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'borrador')), 0,
  'una propiedad en borrador no genera coincidencias');

-- Sin deseables: 100 %.
insert into ids select 'sin-deseables', public.save_client_search('a4000000-0000-4000-b000-000000000001', null, (select id from ids where name = 'ana'),
  'sale', array['apartment']::public.property_type[], null, 100000, 'USD', null, null, null, '{}', '{}', '', null, '{}');
select is((select score::int from public.match_results where search_id = (select id from ids where name = 'sin-deseables') and property_id = (select id from ids where name = 'tope')), 100,
  'una búsqueda sin deseables muestra 100 %');

-- Cambiar la tolerancia recalcula.
select public.save_client_search('a4000000-0000-4000-b000-000000000001', (select id from ids where name = 'busqueda'), (select id from ids where name = 'ana'),
  'sale', array['apartment']::public.property_type[], 80000, 100000, 'USD', 20, 2::smallint, null, '{}',
  array['garage', 'balcony', 'bright'], '', 'a4000000-0000-4000-a000-000000000002', array['belgrano']);
select is((select count(*)::int from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'excede')), 1,
  'al cambiar la tolerancia las coincidencias se recalculan');

-- =============================================================================
-- Monedas (F-31)
-- =============================================================================
select pg_temp.prop('pesos', 95000000, 'ARS');
select is((select count(*)::int from public.match_results where property_id = (select id from ids where name = 'pesos')), 0,
  'con la cotización desactivada, USD no coincide con ARS');
select tests.authenticate_as('a4000000-0000-4000-a000-000000000001');
update public.organizations set usd_ars_rate = 1000, usd_ars_rate_enabled = true where id = 'a4000000-0000-4000-b000-000000000001';
select is((select exchange_rate::int from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'pesos')), 1000,
  'al habilitar la cotización se compara y se registra la usada');

-- =============================================================================
-- Notificaciones (F-23)
-- =============================================================================
select tests.authenticate_as('a4000000-0000-4000-a000-000000000002');
select ok((select count(*) from public.notifications where kind = 'new_match') > 0, 'el agente asignado recibe el aviso');
select is(tests.affected($$ update public.notifications set read_at = now() where kind = 'new_match' $$) > 0, true, 'marca sus avisos como leídos');
select is(tests.error_of($$ update public.notifications set title = 'x' $$) ->> 'sqlstate', '42501', 'no puede cambiar el contenido del aviso');
select is(tests.error_of($$ insert into public.notifications (organization_id, user_id, kind, title, dedupe_key)
  values ('a4000000-0000-4000-b000-000000000001', auth.uid(), 'new_match', 'x', 'y') $$) ->> 'sqlstate', '42501', 'no se crean avisos a mano');
select tests.authenticate_as('a4000000-0000-4000-a000-000000000001');
select is((select count(*)::int from public.notifications where user_id = 'a4000000-0000-4000-a000-000000000002'), 0,
  'nadie ve los avisos de otra persona');
select ok((select count(*) from public.notifications where kind = 'new_match') > 0, 'una búsqueda sin asignar avisa a los dueños');

-- =============================================================================
-- Embudo (F-13)
-- =============================================================================
select tests.authenticate_as('a4000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.move_search_stage((select id from ids where name = 'busqueda'), 'a4000000-0000-4000-c000-000000000004') $$) ->> 'sqlstate',
  '23503', 'no se mueve a una etapa desactivada');
select public.move_search_stage((select id from ids where name = 'busqueda'), 'a4000000-0000-4000-c000-000000000002');
select ok(exists (select 1 from public.stage_changes where search_id = (select id from ids where name = 'busqueda') and from_stage_id is not null),
  'el cambio de etapa queda en el historial');
select pg_temp.prop('tras-cierre', 90000);
select is((select count(*)::int from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'tras-cierre')), 0,
  'una búsqueda en etapa ganada no genera coincidencias nuevas');
select ok((select count(*) from public.match_results where search_id = (select id from ids where name = 'busqueda')) > 0,
  'las coincidencias anteriores se conservan');
select public.move_search_stage((select id from ids where name = 'busqueda'), 'a4000000-0000-4000-c000-000000000001');
select is((select count(*)::int from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'tras-cierre')), 1,
  'al reabrirla vuelve a calcular');

update public.properties set status = 'sold' where id = (select id from ids where name = 'tope');
select is((select stale from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'tope')), false,
  'una propiedad vendida conserva su coincidencia como historial');

-- Una propiedad que deja de cumplir queda marcada.
update public.properties set price = 500000 where id = (select id from ids where name = 'dos-de-tres');
select is((select stale from public.match_results where search_id = (select id from ids where name = 'busqueda') and property_id = (select id from ids where name = 'dos-de-tres')), true,
  'si deja de coincidir queda como historial');

select tests.authenticate_as('a4000000-0000-4000-a000-000000000001');
select ok((select sum(total) from public.pipeline_metrics('a4000000-0000-4000-b000-000000000001')) = 2, 'el dueño ve las búsquedas por etapa y agente');

-- =============================================================================
-- Aislamiento y permisos
-- =============================================================================
select tests.authenticate_as('a4000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.client_searches where organization_id = 'a4000000-0000-4000-b000-000000000001'), 0, 'otra inmobiliaria no ve las búsquedas');
select is((select count(*)::int from public.match_results where organization_id = 'a4000000-0000-4000-b000-000000000001'), 0, 'otra inmobiliaria no ve las coincidencias');
select is(tests.error_of($$ select public.move_search_stage((select id from ids where name = 'busqueda'), 'a4000000-0000-4000-c000-000000000002') $$) ->> 'sqlstate',
  '42501', 'no se mueve una búsqueda ajena');
select is(tests.error_of($$ select public.save_client_search('a4000000-0000-4000-b000-000000000001', null, (select id from ids where name = 'ana'),
  'sale', array['apartment']::public.property_type[], null, 1, 'USD', null, null, null, '{}', '{}', '', null, '{}') $$) ->> 'sqlstate',
  '42501', 'no se crean búsquedas en otra inmobiliaria');
select is(tests.error_of($$ select public.save_client_search('a4000000-0000-4000-b000-000000000002', null, (select id from ids where name = 'ana'),
  'sale', array['apartment']::public.property_type[], null, 1, 'USD', null, null, null, '{}', '{}', '', null, '{}') $$) ->> 'sqlstate',
  '23503', 'una búsqueda no puede apuntar a un contacto de otra inmobiliaria');

-- =============================================================================
-- Unificaciones
-- =============================================================================
select tests.authenticate_as('a4000000-0000-4000-a000-000000000001');
insert into ids select 'ana2', public.create_contact('a4000000-0000-4000-b000-000000000001', 'Ana bis');
select public.merge_contacts((select id from ids where name = 'ana2'), (select id from ids where name = 'ana'));
select is((select contact_id from public.client_searches where id = (select id from ids where name = 'busqueda')),
  (select id from ids where name = 'ana2'), 'al unificar contactos, las búsquedas pasan al que queda');
select public.merge_properties((select id from ids where name = 'tolerancia'), (select id from ids where name = 'acento'));
select ok(exists (select 1 from public.match_results where property_id = (select id from ids where name = 'tolerancia')),
  'al fusionar propiedades se conservan las coincidencias');

select * from finish();
