-- Incremento 1.3: propiedades, duplicados, fusión, página pública y límite del plan (F-08, F-09, F-10).
select no_plan();

select tests.create_user('a3000000-0000-4000-a000-000000000001', 'duena@prop.test');
select tests.create_user('a3000000-0000-4000-a000-000000000002', 'agente@prop.test');
select tests.create_user('a3000000-0000-4000-a000-000000000009', 'intruso@prop.test');
select tests.create_org('a3000000-0000-4000-b000-000000000001', 'prop-uno');
select tests.create_org('a3000000-0000-4000-b000-000000000002', 'prop-dos');
select tests.add_member('a3000000-0000-4000-b000-000000000001', 'a3000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a3000000-0000-4000-b000-000000000001', 'a3000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a3000000-0000-4000-b000-000000000002', 'a3000000-0000-4000-a000-000000000009', 'owner');

-- Plan con pocas propiedades para probar el límite (se revierte al terminar).
update public.plans set max_properties = 3 where code = 'professional';

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- =============================================================================
-- Alta: código correlativo, slug estable, historial (F-08)
-- =============================================================================
select tests.authenticate_as('a3000000-0000-4000-a000-000000000002');
insert into ids select 'jorge', public.create_contact('a3000000-0000-4000-b000-000000000001', 'Jorge P.', array['+5491155550123']);

with created as (
  insert into public.properties (organization_id, title, slug, operation, property_type, status, price, currency, address, city)
  values ('a3000000-0000-4000-b000-000000000001', 'Depto 3 amb. en Belgrano', 'depto-3-amb-en-belgrano', 'sale', 'apartment',
          'available', 98000, 'USD', 'Av. Cabildo 1234 4°B', 'CABA')
  returning id
)
insert into ids select 'depto', id from created;

select is((select code from public.properties where id = (select id from ids where name = 'depto')), 'PRO-000001',
  'la primera propiedad recibe el código PRO-000001');
select is((select slug from public.properties where id = (select id from ids where name = 'depto')), 'depto-3-amb-en-belgrano-1',
  'el slug termina con el número de la propiedad');
select isnt((select published_at from public.properties where id = (select id from ids where name = 'depto')), null,
  'una propiedad disponible queda publicada');
select ok(exists (select 1 from public.property_changes where property_id = (select id from ids where name = 'depto') and field = 'created'),
  'el alta queda en el historial');

update public.properties set title = 'Depto luminoso', slug = 'otro-slug', seq = 99 where id = (select id from ids where name = 'depto');
select is((select slug || ' ' || code from public.properties where id = (select id from ids where name = 'depto')), 'depto-3-amb-en-belgrano-1 PRO-000001',
  'el slug y el código no cambian al editar');

update public.properties set price = 95000 where id = (select id from ids where name = 'depto');
update public.properties set status = 'reserved' where id = (select id from ids where name = 'depto');
select is((select count(*)::int from public.property_changes where property_id = (select id from ids where name = 'depto') and field in ('price', 'status')), 2,
  'los cambios de precio y estado quedan en el historial');

select is(tests.error_of($$ insert into public.properties (organization_id, title, operation, property_type, status)
  values ('a3000000-0000-4000-b000-000000000001', 'Sin precio', 'sale', 'house', 'available') $$) ->> 'sqlstate',
  '23514', 'no se publica una propiedad sin precio');

-- Propietario (contacto de la misma inmobiliaria)
insert into public.property_owners (organization_id, property_id, contact_id)
values ('a3000000-0000-4000-b000-000000000001', (select id from ids where name = 'depto'), (select id from ids where name = 'jorge'));
select ok((select is_owner from public.contacts where id = (select id from ids where name = 'jorge')),
  'el contacto vinculado queda marcado como propietario');

-- =============================================================================
-- Duplicados (F-09): avisa, no impide
-- =============================================================================
select is((select reason from public.property_duplicate_candidates('a3000000-0000-4000-b000-000000000001', '  av. cabildo   1234 4°b ', 'rent', 'house')),
  'same_address', 'detecta la misma dirección sin importar mayúsculas ni espacios');
select is((select reason from public.property_duplicate_candidates('a3000000-0000-4000-b000-000000000001', '', 'sale', 'apartment',
  array[(select id from ids where name = 'jorge')])), 'same_owner', 'detecta mismo propietario, operación y tipo');
select is((select count(*)::int from public.property_duplicate_candidates('a3000000-0000-4000-b000-000000000001', '', 'rent', 'apartment',
  array[(select id from ids where name = 'jorge')])), 0, 'con otra operación no es duplicado');

with created as (
  insert into public.properties (organization_id, title, slug, operation, property_type, address)
  values ('a3000000-0000-4000-b000-000000000001', 'Depto Cabildo (repetido)', 'depto-cabildo', 'sale', 'apartment', 'Av. Cabildo 1234 4°B')
  returning id
)
insert into ids select 'repetido', id from created;
select is((select code from public.properties where id = (select id from ids where name = 'repetido')), 'PRO-000002',
  'un posible duplicado se puede guardar igual');
select is((select published_at from public.properties where id = (select id from ids where name = 'repetido')), null,
  'en borrador no queda publicada');

-- =============================================================================
-- Aislamiento
-- =============================================================================
select tests.authenticate_as('a3000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.properties where organization_id = 'a3000000-0000-4000-b000-000000000001'), 0,
  'otra inmobiliaria no ve las propiedades');
insert into ids select 'ajeno', public.create_contact('a3000000-0000-4000-b000-000000000002', 'Contacto ajeno');
select is(tests.error_of($$ insert into public.property_owners (organization_id, property_id, contact_id)
  values ('a3000000-0000-4000-b000-000000000002', (select id from ids where name = 'depto'), (select id from ids where name = 'ajeno')) $$) ->> 'sqlstate',
  '23503', 'no se vincula una propiedad de otra inmobiliaria');
select is((select count(*)::int from public.property_duplicate_candidates('a3000000-0000-4000-b000-000000000001', 'Av. Cabildo 1234 4°B', 'sale', 'apartment')), 0,
  'los duplicados no revelan propiedades de otra inmobiliaria');

-- =============================================================================
-- Fusión (F-09): solo el dueño
-- =============================================================================
select tests.authenticate_as('a3000000-0000-4000-a000-000000000002');
insert into public.property_images (organization_id, property_id, storage_path)
values ('a3000000-0000-4000-b000-000000000001', (select id from ids where name = 'repetido'),
        'a3000000-0000-4000-b000-000000000001/' || (select id from ids where name = 'repetido') || '/foto.jpg');
select is(tests.error_of($$ insert into public.property_images (organization_id, property_id, storage_path)
  values ('a3000000-0000-4000-b000-000000000001', (select id from ids where name = 'depto'), 'a3000000-0000-4000-b000-000000000002/x.jpg') $$) ->> 'sqlstate',
  '23514', 'una foto no puede apuntar a la carpeta de otra inmobiliaria');
select is(tests.error_of($$ select public.merge_properties((select id from ids where name = 'depto'), (select id from ids where name = 'repetido')) $$) ->> 'sqlstate',
  '42501', 'un agente no puede fusionar');

select tests.authenticate_as('a3000000-0000-4000-a000-000000000001');
select is(public.merge_properties((select id from ids where name = 'depto'), (select id from ids where name = 'repetido')),
  (select id from ids where name = 'depto'), 'el dueño fusiona');
select is((select count(*)::int from public.property_images where property_id = (select id from ids where name = 'depto')), 1,
  'la propiedad resultante conserva las fotos de ambas');
select is((select merged_into_id from public.properties where id = (select id from ids where name = 'repetido')),
  (select id from ids where name = 'depto'), 'la otra queda marcada como fusionada');
select ok(exists (select 1 from public.audit_logs where action = 'property.merged'), 'la fusión queda auditada');
select is(tests.error_of($$ select public.merge_properties((select id from ids where name = 'depto'), (select id from ids where name = 'repetido')) $$) ->> 'sqlstate',
  'IG014', 'no se fusiona una propiedad ya fusionada');

-- =============================================================================
-- Página pública (F-10)
-- =============================================================================
select tests.authenticate_as_anon();
select is((select code from public.public_property('prop-uno', 'depto-3-amb-en-belgrano-1')), 'PRO-000001',
  'la página pública de una propiedad reservada se abre sin sesión');
select is((select address from public.public_property('prop-uno', 'depto-3-amb-en-belgrano-1')), '',
  'la dirección exacta no se muestra si no se eligió');
select is((select count(*)::int from public.public_property('prop-uno', 'depto-cabildo-2')), 0,
  'una propiedad fusionada o en borrador no es pública');
select is(tests.error_of($$ select 1 from public.properties limit 1 $$) ->> 'sqlstate', '42501',
  'un anónimo no lee la tabla de propiedades');

select tests.authenticate_as('a3000000-0000-4000-a000-000000000001');
update public.properties set show_address = true where id = (select id from ids where name = 'depto');
update public.properties set status = 'paused' where id = (select id from ids where name = 'depto');
select tests.authenticate_as_anon();
select is((select count(*)::int from public.public_property('prop-uno', 'depto-3-amb-en-belgrano-1')), 0,
  'una propiedad pausada devuelve "no encontrada"');

-- =============================================================================
-- Límite de propiedades del plan (IG001). Las fusionadas no cuentan.
-- =============================================================================
select tests.authenticate_as('a3000000-0000-4000-a000-000000000002');
insert into public.properties (organization_id, title, operation, property_type)
values ('a3000000-0000-4000-b000-000000000001', 'Casa', 'sale', 'house'),
       ('a3000000-0000-4000-b000-000000000001', 'PH', 'sale', 'ph');
select is(tests.error_of($$ insert into public.properties (organization_id, title, operation, property_type)
  values ('a3000000-0000-4000-b000-000000000001', 'Una de más', 'rent', 'office') $$) ->> 'sqlstate',
  'IG001', 'al llegar al límite del plan no se cargan más propiedades');

select * from finish();
