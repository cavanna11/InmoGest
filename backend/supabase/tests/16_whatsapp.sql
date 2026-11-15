-- Incremento 1.7: WhatsApp (F-14 a F-19, F-23, F-32).
select no_plan();

select tests.create_user('a7000000-0000-4000-a000-000000000001', 'duena@wa.test');
select tests.create_user('a7000000-0000-4000-a000-000000000002', 'agente@wa.test');
select tests.create_user('a7000000-0000-4000-a000-000000000003', 'agente2@wa.test');
select tests.create_user('a7000000-0000-4000-a000-000000000009', 'intruso@wa.test');
select tests.create_org('a7000000-0000-4000-b000-000000000001', 'wa-uno');
select tests.create_org('a7000000-0000-4000-b000-000000000002', 'wa-dos');
select tests.add_member('a7000000-0000-4000-b000-000000000001', 'a7000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('a7000000-0000-4000-b000-000000000001', 'a7000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('a7000000-0000-4000-b000-000000000001', 'a7000000-0000-4000-a000-000000000003', 'agent');
select tests.add_member('a7000000-0000-4000-b000-000000000002', 'a7000000-0000-4000-a000-000000000009', 'owner');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, service_role;

-- =============================================================================
-- Conexión (F-14, F-15)
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
select is(tests.error_of($$ select public.create_whatsapp_connection('a7000000-0000-4000-b000-000000000001', repeat('a', 64), true) $$) ->> 'sqlstate',
  '42501', 'un agente no conecta números');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ select public.create_whatsapp_connection('a7000000-0000-4000-b000-000000000001', repeat('a', 64), false) $$) ->> 'sqlstate',
  '23514', 'sin aceptar las pautas no se conecta');
insert into ids select 'conn', id from public.create_whatsapp_connection('a7000000-0000-4000-b000-000000000001', repeat('a', 64), true);
select isnt((select id from ids where name = 'conn'), null, 'el dueño conecta un número aceptando las pautas');
select is((select guidelines_accepted_by from public.whatsapp_connections where id = (select id from ids where name = 'conn')),
  'a7000000-0000-4000-a000-000000000001'::uuid, 'queda registrado quién aceptó las pautas');
select is(tests.error_of($$ select public.create_whatsapp_connection('a7000000-0000-4000-b000-000000000001', repeat('b', 64), true) $$) ->> 'sqlstate',
  'IG001', 'el plan limita la cantidad de números');
select is(tests.error_of($$ select webhook_secret_hash from public.whatsapp_connections $$) ->> 'sqlstate',
  '42501', 'ningún usuario lee el hash del secreto');
select is(tests.error_of($$ update public.whatsapp_connections set status = 'connected' $$) ->> 'sqlstate',
  '42501', 'un usuario no cambia el estado de la conexión');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.whatsapp_connections where organization_id = 'a7000000-0000-4000-b000-000000000001'), 0,
  'otra inmobiliaria no ve la conexión');
select is(tests.error_of($$ select public.remove_whatsapp_connection((select id from ids where name = 'conn')) $$) ->> 'sqlstate',
  '42501', 'otra inmobiliaria no quita el número');

select tests.authenticate_as_anon();
select is(tests.error_of($$ select public.whatsapp_ingest_message(gen_random_uuid(), 'x', '+5491100000000', null, false, 'text', 'hola', null, null, now()) $$) ->> 'sqlstate',
  '42501', 'anon no ingresa mensajes');
select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select is(tests.error_of($$ select public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'x', '+5491100000000', null, false, 'text', 'hola', null, null, now()) $$) ->> 'sqlstate',
  '42501', 'un usuario no ingresa mensajes');
select is(tests.error_of($$ select * from public.claim_whatsapp_outbox(1) $$) ->> 'sqlstate',
  '42501', 'un usuario no toma envíos de la cola');
select is(tests.error_of($$ select * from public.whatsapp_outbox $$) ->> 'sqlstate',
  '42501', 'un usuario no lee la cola');

-- Sin conectar, no se puede iniciar una conversación.
select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
insert into ids select 'conocido', public.create_contact('a7000000-0000-4000-b000-000000000001', 'Ana G.', array['+5491155550001']);
select is(tests.error_of($$ select public.start_whatsapp_conversation((select id from ids where name = 'conocido')) $$) ->> 'sqlstate',
  'IG015', 'sin número conectado no se inicia una conversación');

select tests.authenticate_as_service();
select public.whatsapp_set_connection_state((select id from ids where name = 'conn'), 'connected', '+5491144440000');
select is((select status::text from public.whatsapp_connections where id = (select id from ids where name = 'conn')), 'connected', 'el servidor marca la conexión como conectada');

-- =============================================================================
-- Mensajes entrantes (F-16, F-17)
-- =============================================================================
select is(public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'in-1', '+5491155550002', 'Bruno', false, 'text', 'Hola, ¿sigue disponible?', null, null, now()) ->> 'status',
  'stored', 'se guarda el mensaje de un número nuevo');
insert into ids select 'bruno', contact_id from public.contact_phones where phone_e164 = '+5491155550002';
select is((select source::text from public.contacts where id = (select id from ids where name = 'bruno')), 'whatsapp', 'un número nuevo crea el contacto');
select is((select full_name from public.contacts where id = (select id from ids where name = 'bruno')), 'Bruno', 'el contacto toma el nombre de WhatsApp');
insert into ids select 'conv_bruno', id from public.conversations where contact_id = (select id from ids where name = 'bruno');
select is((select assigned_user_id from public.conversations where id = (select id from ids where name = 'conv_bruno')), null, 'la conversación entra sin asignar');
select is((select unread_count from public.conversations where id = (select id from ids where name = 'conv_bruno')), 1, 'cuenta como no leída');

select is(public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'in-1', '+5491155550002', 'Bruno', false, 'text', 'Hola, ¿sigue disponible?', null, null, now()) ->> 'status',
  'duplicate', 'el mismo evento no se guarda dos veces');
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv_bruno')), 1, 'queda un solo mensaje');

select public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'in-2', '+5491155550001', 'Otro nombre', false, 'image', '', 'image/jpeg', null, now());
select is((select contact_id from public.conversations where phone_e164 = '+5491155550001'), (select id from ids where name = 'conocido'), 'un número registrado se vincula a su contacto');
select is((select full_name from public.contacts where id = (select id from ids where name = 'conocido')), 'Ana G.', 'no pisa el nombre del contacto');
select is((select media_status::text from public.messages where external_id = 'in-2'), 'pending', 'un adjunto queda pendiente de descarga');
select is((select last_message_preview from public.conversations where phone_e164 = '+5491155550001'), 'Foto', 'la vista previa describe el adjunto');

select is(public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'me-1', '+5491199990000', null, true, 'text', 'Mensaje personal', null, null, now()) ->> 'status',
  'ignored', 'lo enviado desde el teléfono a un número desconocido no crea contacto');
select is((select count(*)::int from public.contact_phones where phone_e164 = '+5491199990000'), 0, 'no se creó el contacto');

-- Notificaciones (F-23)
select is((select count(*)::int from public.notifications where kind = 'new_message' and link like '%' || (select id::text from ids where name = 'conv_bruno')), 3,
  'sin asignar, se avisa a todo el equipo');

-- =============================================================================
-- Abrir y asignar (F-16)
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000009');
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv_bruno')), 0, 'otra inmobiliaria no ve los mensajes');
select is(tests.error_of($$ select public.open_whatsapp_conversation((select id from ids where name = 'conv_bruno')) $$) ->> 'sqlstate',
  'P0002', 'otra inmobiliaria no abre la conversación');
select is(tests.error_of($$ select public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), 'hola') $$) ->> 'sqlstate',
  'P0002', 'otra inmobiliaria no responde');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
select public.open_whatsapp_conversation((select id from ids where name = 'conv_bruno'));
select is((select assigned_user_id from public.conversations where id = (select id from ids where name = 'conv_bruno')),
  'a7000000-0000-4000-a000-000000000002'::uuid, 'el primero que abre queda asignado');
select is((select unread_count from public.conversations where id = (select id from ids where name = 'conv_bruno')), 0, 'abrir marca leído');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000003');
select public.open_whatsapp_conversation((select id from ids where name = 'conv_bruno'));
select is((select assigned_user_id from public.conversations where id = (select id from ids where name = 'conv_bruno')),
  'a7000000-0000-4000-a000-000000000002'::uuid, 'el segundo que abre no le saca la asignación');
select is(tests.error_of($$ select public.assign_whatsapp_conversation((select id from ids where name = 'conv_bruno'), 'a7000000-0000-4000-a000-000000000003') $$) ->> 'sqlstate',
  'IG012', 'sin la capacidad habilitada, un agente no reasigna');

-- =============================================================================
-- Respuestas y cola de salida
-- =============================================================================
-- Cualquier agente responde, y queda registrado quién.
insert into ids select 'msg', public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), 'Sí, sigue disponible');
select is((select author_user_id from public.messages where id = (select id from ids where name = 'msg')),
  'a7000000-0000-4000-a000-000000000003'::uuid, 'la respuesta registra qué agente la envió');
select is((select status::text from public.messages where id = (select id from ids where name = 'msg')), 'queued', 'la respuesta entra en cola');
select is(tests.error_of($$ select public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), '   ') $$) ->> 'sqlstate',
  '23514', 'no se envían mensajes vacíos');
select is(tests.error_of($$ select public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), '', 'image', 'a7000000-0000-4000-b000-000000000002/x.jpg') $$) ->> 'sqlstate',
  '42501', 'un adjunto no puede venir de la carpeta de otra inmobiliaria');

select tests.authenticate_as_service();
select is((select count(*)::int from public.claim_whatsapp_outbox(10) where message_id = (select id from ids where name = 'msg')), 1, 'el worker toma el envío');
select is((select count(*)::int from public.claim_whatsapp_outbox(10) where message_id = (select id from ids where name = 'msg')), 0, 'un envío no se toma dos veces');

-- Si el evento del proveedor llega antes que la confirmación, no queda duplicado.
select public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'out-1', '+5491155550002', null, true, 'text', 'Sí, sigue disponible', null, null, now());
select public.complete_whatsapp_outbox((select id from public.whatsapp_outbox where message_id = (select id from ids where name = 'msg')), 'out-1');
select is((select count(*)::int from public.messages where connection_id = (select id from ids where name = 'conn') and external_id = 'out-1'), 1, 'queda un solo mensaje enviado');
select is((select author_user_id from public.messages where external_id = 'out-1'), 'a7000000-0000-4000-a000-000000000003'::uuid, 'y conserva el autor');
select is((select status::text from public.messages where external_id = 'out-1'), 'sent', 'queda como enviado');
select is(public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'out-2', '+5491155550002', null, true, 'text', 'Desde el teléfono', null, null, now()) ->> 'status',
  'stored', 'lo enviado desde el teléfono a un contacto conocido se registra');
select is((select author_user_id from public.messages where external_id = 'out-2'), null, 'sin autor del panel');

-- Reintentos: 1 intento + 2 reintentos (PRD §6).
select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
insert into ids select 'msg2', public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), 'Va a fallar');
select tests.authenticate_as_service();
insert into ids select 'out2', id from public.whatsapp_outbox where message_id = (select id from ids where name = 'msg2');
select count(*) from public.claim_whatsapp_outbox(10);
select public.fail_whatsapp_outbox((select id from ids where name = 'out2'), 'provider_error', 1);
select is((select status::text from public.whatsapp_outbox where id = (select id from ids where name = 'out2')), 'queued', 'el primer error se reintenta');
update public.whatsapp_outbox set scheduled_for = now() - interval '1 second' where id = (select id from ids where name = 'out2');
select count(*) from public.claim_whatsapp_outbox(10);
select public.fail_whatsapp_outbox((select id from ids where name = 'out2'), 'provider_error', 1);
update public.whatsapp_outbox set scheduled_for = now() - interval '1 second' where id = (select id from ids where name = 'out2');
select count(*) from public.claim_whatsapp_outbox(10);
select public.fail_whatsapp_outbox((select id from ids where name = 'out2'), 'provider_error', 1);
select is((select status::text from public.whatsapp_outbox where id = (select id from ids where name = 'out2')), 'failed', 'al agotar los reintentos queda fallido');
select is((select error_code from public.messages where id = (select id from ids where name = 'msg2')), 'provider_error', 'el error queda registrado en el mensaje');

-- =============================================================================
-- Baja (F-19)
-- =============================================================================
select public.whatsapp_ingest_message((select id from ids where name = 'conn'), 'in-3', '+5491155550002', 'Bruno', false, 'text', ' baja ', null, null, now());
select is((select do_not_contact from public.contacts where id = (select id from ids where name = 'bruno')), true, 'escribir BAJA marca "no contactar"');
select tests.authenticate_as('a7000000-0000-4000-a000-000000000002');
select isnt(public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), 'Listo, te damos de baja'), null, 'si él escribió, se le puede seguir respondiendo');
insert into ids select 'carla', public.create_contact('a7000000-0000-4000-b000-000000000001', 'Carla', array['+5491155550003']);
update public.contacts set do_not_contact = true where id = (select id from ids where name = 'carla');
select is(tests.error_of($$ select public.start_whatsapp_conversation((select id from ids where name = 'carla')) $$) ->> 'sqlstate',
  'IG016', 'a quien pidió la baja no se le inicia una conversación');

-- =============================================================================
-- Ficha de propiedad (F-18)
-- =============================================================================
insert into ids select 'dani', public.create_contact('a7000000-0000-4000-b000-000000000001', 'Dani', array['+5491155550004']);
insert into ids select 'conv_dani', public.start_whatsapp_conversation((select id from ids where name = 'dani'));
select is((select assigned_user_id from public.conversations where id = (select id from ids where name = 'conv_dani')),
  'a7000000-0000-4000-a000-000000000002'::uuid, 'quien inicia la conversación queda asignado');
with c as (
  insert into public.properties (organization_id, title, operation, property_type, status, price, currency)
  values ('a7000000-0000-4000-b000-000000000001', 'Depto Palermo', 'sale', 'apartment', 'available', 100000, 'USD') returning id
) insert into ids select 'prop', id from c;
with c as (
  insert into public.properties (organization_id, title, operation, property_type)
  values ('a7000000-0000-4000-b000-000000000001', 'Borrador', 'sale', 'apartment') returning id
) insert into ids select 'borrador', id from c;
select is(tests.error_of($$ select public.send_property_whatsapp((select id from ids where name = 'conv_dani'), (select id from ids where name = 'borrador'), 'Mirá') $$) ->> 'sqlstate',
  'IG017', 'un borrador no se envía');
-- Fotos: solo URLs públicas de Storage de fotos registradas de ESA propiedad (sin SSRF hacia el VPS).
insert into public.property_images (organization_id, property_id, storage_path, position)
select 'a7000000-0000-4000-b000-000000000001', p.id, 'a7000000-0000-4000-b000-000000000001/' || p.id || '/' || n || '.jpg', n
from ids p cross join generate_series(1, 2) n where p.name = 'prop';
create temporary table photo_urls as
select 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/property-images/a7000000-0000-4000-b000-000000000001/'
  || (select id from ids where name = 'prop') || '/' || n || '.jpg' as url
from generate_series(1, 2) n;
select is(tests.error_of($$ select public.send_property_whatsapp((select id from ids where name = 'conv_dani'), (select id from ids where name = 'prop'), 'Mirá',
  array['http://169.254.169.254/latest/meta-data/']) $$) ->> 'sqlstate', '23514', 'una URL que no es de Storage se rechaza');
select is(tests.error_of($$ select public.send_property_whatsapp((select id from ids where name = 'conv_dani'), (select id from ids where name = 'prop'), 'Mirá',
  array[replace((select min(url) from photo_urls), 'abcdefghijklmnop.supabase.co', 'evolution-api:8080')]) $$) ->> 'sqlstate', '23514',
  'la ruta correcta con otro host se rechaza');
select is(tests.error_of($$ select public.send_property_whatsapp((select id from ids where name = 'conv_dani'), (select id from ids where name = 'prop'), 'Mirá',
  array['https://abcdefghijklmnop.supabase.co/storage/v1/object/public/property-images/a7000000-0000-4000-b000-000000000001/otra/9.jpg']) $$) ->> 'sqlstate', '23514',
  'una foto que no es de la propiedad se rechaza');
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv_dani') and type = 'image'), 0,
  'los rechazos no encolan nada');
select public.send_property_whatsapp((select id from ids where name = 'conv_dani'), (select id from ids where name = 'prop'), 'Depto Palermo https://x.test/p/a/b',
  (select array_agg(url order by url) from photo_urls));
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv_dani') and type = 'image'), 2, 'se encola una foto por mensaje');
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv_dani') and body like '%https://x.test/p/a/b'), 1, 'el link va una sola vez');
select ok(exists (select 1 from public.activities where contact_id = (select id from ids where name = 'dani') and kind = 'property_sent'
  and metadata ->> 'property_id' = (select id::text from ids where name = 'prop')), 'queda en el historial del contacto con la propiedad');

-- =============================================================================
-- Unificación de contactos y desactivación de miembros
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select public.merge_contacts((select id from ids where name = 'conocido'), (select id from ids where name = 'dani'));
select is((select contact_id from public.conversations where id = (select id from ids where name = 'conv_dani')), (select id from ids where name = 'conocido'),
  'al unificar, la conversación pasa al contacto que queda');

update public.memberships set status = 'deactivated', deactivated_at = now()
where organization_id = 'a7000000-0000-4000-b000-000000000001' and user_id = 'a7000000-0000-4000-a000-000000000002';
select is((select assigned_user_id from public.conversations where id = (select id from ids where name = 'conv_bruno')), null,
  'al desactivar a un miembro, su conversación queda sin asignar');

-- =============================================================================
-- Desconexión y baja (F-14, F-23)
-- =============================================================================
select tests.authenticate_as_service();
select public.whatsapp_set_connection_state((select id from ids where name = 'conn'), 'needs_qr', null, 'logged_out');
select is((select count(*)::int from public.notifications where kind = 'whatsapp_disconnected' and user_id = 'a7000000-0000-4000-a000-000000000001'), 1, 'la dueña recibe el aviso de desconexión');
select is((select count(*)::int from public.notifications where kind = 'whatsapp_disconnected' and user_id = 'a7000000-0000-4000-a000-000000000003'), 0, 'un agente no');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000003');
select is(tests.error_of($$ select public.send_whatsapp_message((select id from ids where name = 'conv_bruno'), 'hola') $$) ->> 'sqlstate',
  'IG015', 'con el número caído no se responde');

select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
select public.remove_whatsapp_connection((select id from ids where name = 'conn'));
select ok((select count(*) > 0 from public.messages where connection_id = (select id from ids where name = 'conn')), 'al quitar el número se conservan los mensajes');
select is((select count(*)::int from public.messages where connection_id = (select id from ids where name = 'conn') and status = 'queued'), 0, 'y se cancela lo que estaba en cola');
select isnt((select id from public.create_whatsapp_connection('a7000000-0000-4000-b000-000000000001', repeat('c', 64), true)), null, 'quitar el número libera el cupo del plan');

-- =============================================================================
-- API oficial (F-32)
-- =============================================================================
select tests.authenticate_as('a7000000-0000-4000-a000-000000000003');
select is(tests.error_of($$ select public.request_whatsapp_official_api('a7000000-0000-4000-b000-000000000001') $$) ->> 'sqlstate', '42501', 'un agente no pide la API oficial');
select tests.authenticate_as('a7000000-0000-4000-a000-000000000001');
insert into ids select 'pedido', public.request_whatsapp_official_api('a7000000-0000-4000-b000-000000000001', 'Queremos 2 números');
select is(public.request_whatsapp_official_api('a7000000-0000-4000-b000-000000000001'), (select id from ids where name = 'pedido'), 'no se duplica el pedido abierto');
select is(tests.error_of($$ select * from public.platform_whatsapp_api_requests() $$) ->> 'sqlstate', '42501', 'el dueño no ve la lista de la plataforma');

select * from finish();
