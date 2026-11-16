-- Publicaciones externas, Mercado Libre y API de propiedades (F-36, F-37, F-33; ADR 0012).
select no_plan();

select tests.create_user('a8000000-0000-4000-a000-000000000001', 'duena@pub.test');
select tests.create_user('a8000000-0000-4000-a000-000000000002', 'agente@pub.test');
select tests.create_user('a8000000-0000-4000-a000-000000000009', 'intruso@pub.test');
select tests.create_org('a8000000-0000-4000-b000-000000000001', 'pub-uno');
select tests.create_org('a8000000-0000-4000-b000-000000000002', 'pub-dos');
select tests.add_member('a8000000-0000-4000-b000-000000000001', 'a8000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a8000000-0000-4000-b000-000000000001', 'a8000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a8000000-0000-4000-b000-000000000002', 'a8000000-0000-4000-a000-000000000009', 'owner');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to anon, authenticated, service_role;

select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
with created as (
  insert into public.properties (organization_id, title, slug, operation, property_type, status, price, currency, address, city, show_address)
  values ('a8000000-0000-4000-b000-000000000001', 'Casa con jardín', 'casa-con-jardin', 'sale', 'house', 'available', 150000, 'USD',
          'Calle Falsa 123', 'Rosario', false)
  returning id
)
insert into ids select 'casa', id from created;
with created as (
  insert into public.properties (organization_id, title, slug, operation, property_type, status, price, currency)
  values ('a8000000-0000-4000-b000-000000000001', 'Borrador', 'borrador', 'rent', 'apartment', 'draft', null, 'ARS')
  returning id
)
insert into ids select 'borrador', id from created;

-- =============================================================================
-- Sitio web de la inmobiliaria
-- =============================================================================
select tests.authenticate_as('a8000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ update public.organizations set website_url = 'javascript:alert(1)' where id = 'a8000000-0000-4000-b000-000000000001' $$) ->> 'sqlstate',
  '23514', 'el sitio web tiene que ser una URL http(s)');
update public.organizations set website_url = 'https://inmobiliaria-uno.com.ar' where id = 'a8000000-0000-4000-b000-000000000001';

select tests.authenticate_as_anon();
select is((select organization_website from public.public_property('pub-uno', 'casa-con-jardin-1')),
  'https://inmobiliaria-uno.com.ar', 'la página pública muestra el sitio web de la inmobiliaria');

-- =============================================================================
-- Links manuales (F-36)
-- =============================================================================
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select public.set_property_listing_link((select id from ids where name = 'casa'), 'zonaprop', 'https://www.zonaprop.com.ar/propiedades/casa-123.html');
select public.set_property_listing_link((select id from ids where name = 'casa'), 'website', 'https://inmobiliaria-uno.com.ar/casa');
select is((select count(*)::int from public.property_listings where property_id = (select id from ids where name = 'casa')), 2,
  'un agente carga los links de la web y de Zonaprop');
select public.set_property_listing_link((select id from ids where name = 'casa'), 'website', 'https://inmobiliaria-uno.com.ar/casa-nueva');
select is((select url from public.property_listings where property_id = (select id from ids where name = 'casa') and channel = 'website'),
  'https://inmobiliaria-uno.com.ar/casa-nueva', 'volver a guardar reemplaza el link');
select public.set_property_listing_link((select id from ids where name = 'casa'), 'zonaprop', '  ');
select is((select count(*)::int from public.property_listings where property_id = (select id from ids where name = 'casa') and channel = 'zonaprop'), 0,
  'un link vacío quita el canal');
select is(tests.error_of($$ select public.set_property_listing_link((select id from ids where name = 'casa'), 'argenprop', 'ftp://algo') $$) ->> 'sqlstate',
  '23514', 'el link tiene que ser http(s)');
select is(tests.error_of($$ insert into public.property_listings (organization_id, property_id, channel, url)
  values ('a8000000-0000-4000-b000-000000000001', (select id from ids where name = 'casa'), 'argenprop', 'https://x.com') $$) ->> 'sqlstate',
  '42501', 'los links no se escriben directo en la tabla');

select tests.authenticate_as('a8000000-0000-4000-a000-000000000009');
select is(tests.error_of($$ select public.set_property_listing_link((select id from ids where name = 'casa'), 'argenprop', 'https://www.argenprop.com/x') $$) ->> 'sqlstate',
  '42501', 'otra inmobiliaria no carga links en una propiedad ajena');
select is((select count(*)::int from public.property_listings), 0, 'otra inmobiliaria no ve los links');

-- =============================================================================
-- Mercado Libre (F-37)
-- =============================================================================
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.prepare_mercadolibre_listing((select id from ids where name = 'casa'), '{}') $$) ->> 'sqlstate',
  'IG019', 'sin Mercado Libre conectado no se publica');
select is(tests.error_of($$ select public.mercadolibre_save_connection('a8000000-0000-4000-b000-000000000001', 'a8000000-0000-4000-a000-000000000002',
  1234, 'INMOUNO', 'v1.a.b', 'v1.c.d', now() + interval '6 hours') $$) ->> 'sqlstate',
  '42501', 'un usuario no guarda la conexión: lo hace el servidor');

select tests.authenticate_as_service();
select public.mercadolibre_save_connection('a8000000-0000-4000-b000-000000000001', 'a8000000-0000-4000-a000-000000000001',
  1234, 'INMOUNO', 'v1.access', 'v1.refresh', now() + interval '6 hours');
select is(tests.error_of($$ select public.mercadolibre_save_connection('a8000000-0000-4000-b000-000000000002', 'a8000000-0000-4000-a000-000000000009',
  1234, 'INMOUNO', 'v1.x', 'v1.y', now() + interval '6 hours') $$) ->> 'sqlstate',
  '23505', 'la misma cuenta de Mercado Libre no se conecta a dos inmobiliarias');

select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select is((select nickname from public.mercadolibre_connections), 'INMOUNO', 'los miembros ven que Mercado Libre está conectado');
select is(tests.error_of($$ select access_token_enc from public.mercadolibre_connections $$) ->> 'sqlstate',
  '42501', 'nadie lee los tokens cifrados');
select is(tests.error_of($$ select public.mercadolibre_token_lease('a8000000-0000-4000-b000-000000000001') $$) ->> 'sqlstate',
  '42501', 'un usuario no pide los tokens');

-- Tokens: sin vencer no hace falta renovar; vencidos, la renovación la reserva uno solo.
select tests.authenticate_as_service();
select is((select needs_refresh::text || leased::text from public.mercadolibre_token_lease('a8000000-0000-4000-b000-000000000001')),
  'falsefalse', 'con el token vigente no se renueva');
update public.mercadolibre_connections set expires_at = now() + interval '1 minute' where ml_user_id = 1234;
select is((select leased from public.mercadolibre_token_lease('a8000000-0000-4000-b000-000000000001')), true,
  'el primero que pide un token por vencer reserva la renovación');
select is((select leased from public.mercadolibre_token_lease('a8000000-0000-4000-b000-000000000001')), false,
  'mientras dura la reserva, nadie más renueva');
select public.mercadolibre_save_tokens('a8000000-0000-4000-b000-000000000001', 'v1.access2', 'v1.refresh2', now() + interval '6 hours');
select is((select access_token_enc || ' ' || coalesce(refresh_lock_until::text, 'libre') from public.mercadolibre_connections where ml_user_id = 1234),
  'v1.access2 libre', 'guardar los tokens nuevos libera la reserva');

-- Publicar
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select public.set_property_listing_link((select id from ids where name = 'casa'), 'mercadolibre', 'https://casa.mercadolibre.com.ar/MLA-1-manual');
insert into ids select 'ml', public.prepare_mercadolibre_listing((select id from ids where name = 'casa'),
  '{"category_id": "MLA401685", "listing_type_id": "silver"}');
select is((select managed::text || ' ' || sync_status::text || ' ' || coalesce(url, 'sin-url') from public.property_listings where id = (select id from ids where name = 'ml')),
  'true publishing sin-url', 'pedir la publicación convierte el link manual en una publicación gestionada');
select is(tests.error_of($$ select public.set_property_listing_link((select id from ids where name = 'casa'), 'mercadolibre', 'https://otro.com') $$) ->> 'sqlstate',
  'IG018', 'una publicación gestionada no se edita a mano');
select is(tests.error_of($$ select public.mercadolibre_listing_result((select id from ids where name = 'ml'), 'active', 'MLA1', 'https://x', null) $$) ->> 'sqlstate',
  '42501', 'un usuario no registra el resultado: lo hace el servidor');

select tests.authenticate_as_service();
select public.mercadolibre_listing_result((select id from ids where name = 'ml'), 'active', 'MLA3879350706', 'https://casa.mercadolibre.com.ar/MLA-3879350706', null);
select is((select external_id || ' ' || sync_status::text from public.property_listings where id = (select id from ids where name = 'ml')),
  'MLA3879350706 active', 'el resultado guarda el ID y el link de Mercado Libre');
select public.mercadolibre_listing_result((select id from ids where name = 'ml'), 'error', null, null, 'Falta el atributo FURNISHED');
select is((select external_id || ' ' || sync_status::text || ' ' || last_error from public.property_listings where id = (select id from ids where name = 'ml')),
  'MLA3879350706 error Falta el atributo FURNISHED', 'un error conserva el ID y guarda el motivo');

select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select public.prepare_mercadolibre_listing((select id from ids where name = 'casa'));
select is((select settings ->> 'listing_type_id' from public.property_listings where id = (select id from ids where name = 'ml')),
  'silver', 'sin configuración nueva se conserva la anterior');
select is(tests.error_of($$ select public.unlink_mercadolibre_listing((select id from ids where name = 'casa')) $$) ->> 'sqlstate',
  'IG018', 'una publicación activa no se desvincula: primero hay que finalizarla');
select tests.authenticate_as_service();
select public.mercadolibre_listing_result((select id from ids where name = 'ml'), 'closed');
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select public.unlink_mercadolibre_listing((select id from ids where name = 'casa'));
select is((select count(*)::int from public.property_listings where channel = 'mercadolibre'), 0, 'una publicación finalizada se desvincula');

-- Desconectar: solo el dueño
select is(tests.error_of($$ select public.remove_mercadolibre_connection('a8000000-0000-4000-b000-000000000001') $$) ->> 'sqlstate',
  '42501', 'un agente no desconecta Mercado Libre');
select tests.authenticate_as('a8000000-0000-4000-a000-000000000001');
select public.remove_mercadolibre_connection('a8000000-0000-4000-b000-000000000001');
select is((select count(*)::int from public.mercadolibre_connections), 0, 'el dueño desconecta Mercado Libre');

-- =============================================================================
-- API de propiedades (F-33)
-- =============================================================================
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.create_api_token('a8000000-0000-4000-b000-000000000001', 'Web', repeat('b', 64), 'ipk_abcd') $$) ->> 'sqlstate',
  '42501', 'un agente no crea tokens de la API');
select tests.authenticate_as('a8000000-0000-4000-a000-000000000001');
insert into ids select 'token', public.create_api_token('a8000000-0000-4000-b000-000000000001', 'Web de la inmobiliaria', repeat('b', 64), 'ipk_abcd');
select is((select name from public.api_tokens), 'Web de la inmobiliaria', 'el dueño crea un token y lo ve en la lista');
select is(tests.error_of($$ select token_hash from public.api_tokens $$) ->> 'sqlstate', '42501', 'nadie lee el hash del token');
select tests.authenticate_as('a8000000-0000-4000-a000-000000000002');
select is((select count(*)::int from public.api_tokens), 0, 'un agente no ve los tokens');
select is(tests.error_of($$ select public.api_feed_properties(repeat('b', 64)) $$) ->> 'sqlstate', '42501', 'la API se consulta solo desde el servidor');

select tests.authenticate_as_service();
select is(public.api_feed_properties(repeat('c', 64)), null, 'un token desconocido no devuelve nada');
select is((public.api_feed_properties(repeat('b', 64)) ->> 'total')::int, 1, 'la API devuelve solo las propiedades publicadas');
select is(public.api_feed_properties(repeat('b', 64)) -> 'properties' -> 0 ->> 'address', '',
  'la API no muestra la dirección si la inmobiliaria no lo eligió');
select is(public.api_feed_properties(repeat('b', 64)) -> 'organization' ->> 'website_url', 'https://inmobiliaria-uno.com.ar',
  'la API devuelve los datos de la inmobiliaria');
select isnt((select last_used_at from public.api_tokens where id = (select id from ids where name = 'token')), null, 'se registra el uso del token');

update public.properties set status = 'paused' where id = (select id from ids where name = 'casa');
select is(public.api_feed_properties(repeat('b', 64), now() - interval '1 minute') -> 'removed',
  to_jsonb(array[(select code from public.properties where id = (select id from ids where name = 'casa'))]),
  'con desde, lo que se pausó figura como retirado');
select is((public.api_feed_properties(repeat('b', 64), now() - interval '1 minute') ->> 'total')::int, 0,
  'lo pausado no aparece entre las propiedades');

select tests.authenticate_as('a8000000-0000-4000-a000-000000000001');
select public.revoke_api_token((select id from ids where name = 'token'));
select tests.authenticate_as_service();
select is(public.api_feed_properties(repeat('b', 64)), null, 'un token revocado deja de funcionar');

select * from finish();
