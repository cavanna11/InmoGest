-- =============================================================================
-- Incremento 1.7: WhatsApp por QR (F-14 a F-19, F-23, F-32).
-- - Conexiones, conversaciones, mensajes y cola de salida. Las escrituras pasan por RPC: el cliente
--   nunca escribe directo en estas tablas.
-- - Lo que llega del proveedor lo escribe el servidor con funciones solo para service_role, con la
--   conexión ya identificada por el secreto del webhook (nunca por un dato del payload).
-- - Solo envíos humanos: las automatizaciones (F-20) y los recordatorios (F-35) tienen sus propias
--   reglas (horario, topes, consentimiento) y se agregan en su incremento.
-- Códigos de error propios: IG015 número no conectado, IG016 contacto "no contactar" sin conversación
-- iniciada por él, IG017 propiedad sin página pública.
-- =============================================================================

create type public.whatsapp_connection_status as enum ('connecting', 'connected', 'disconnected', 'needs_qr');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_kind as enum ('human', 'automated', 'system');
create type public.message_type as enum ('text', 'image', 'audio', 'document', 'video', 'other');
create type public.message_status as enum ('received', 'queued', 'sending', 'sent', 'failed', 'cancelled');
create type public.message_media_status as enum ('none', 'pending', 'ready', 'failed');
create type public.whatsapp_outbox_status as enum ('queued', 'sending', 'sent', 'failed', 'cancelled');

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'evolution' check (provider in ('evolution', 'cloud_api')),
  instance_name text not null unique check (char_length(instance_name) between 1 and 80),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  status public.whatsapp_connection_status not null default 'connecting',
  status_reason text check (char_length(status_reason) <= 200),
  automations_paused_at timestamptz,
  automations_paused_reason text check (char_length(automations_paused_reason) <= 200),
  guidelines_accepted_by uuid references auth.users (id) on delete set null,
  guidelines_accepted_at timestamptz not null,
  -- SHA-256 del secreto del webhook. No se expone a los usuarios (ver grants por columna).
  webhook_secret_hash text not null unique check (webhook_secret_hash ~ '^[0-9a-f]{64}$'),
  connected_at timestamptz,
  -- Baja lógica: las conversaciones y mensajes se conservan aunque se quite el número (PRD §6).
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index whatsapp_connections_org on public.whatsapp_connections (organization_id) where removed_at is null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null,
  contact_id uuid not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  assigned_user_id uuid,
  assigned_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  -- El contacto escribió alguna vez. Lo van a exigir los mensajes automáticos (consentimiento).
  has_inbound boolean not null default false,
  last_message_at timestamptz,
  last_message_preview text not null default '' check (char_length(last_message_preview) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (connection_id, phone_e164),
  foreign key (organization_id, connection_id) references public.whatsapp_connections (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id)
);

create index conversations_org_last on public.conversations (organization_id, last_message_at desc nulls last);
create index conversations_contact on public.conversations (contact_id);
create index conversations_assigned on public.conversations (organization_id, assigned_user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  connection_id uuid not null,
  direction public.message_direction not null,
  kind public.message_kind not null default 'human',
  -- Quién respondió desde el panel. Null en los entrantes y en lo enviado desde el teléfono.
  author_user_id uuid references auth.users (id) on delete set null,
  type public.message_type not null default 'text',
  body text not null default '' check (char_length(body) <= 10000),
  -- Adjunto en el bucket privado "whatsapp-media", o foto pública de una propiedad.
  media_path text check (char_length(media_path) <= 500),
  media_url text check (media_url is null or media_url ~ '^https?://'),
  media_mime text check (char_length(media_mime) <= 120),
  media_name text check (char_length(media_name) <= 255),
  media_status public.message_media_status not null default 'none',
  external_id text check (char_length(external_id) <= 200),
  status public.message_status not null,
  error_code text check (char_length(error_code) <= 100),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade,
  foreign key (organization_id, connection_id) references public.whatsapp_connections (organization_id, id) on delete cascade,
  check (direction = 'outbound' or status = 'received')
);

create unique index messages_connection_external on public.messages (connection_id, external_id) where external_id is not null;
create index messages_conversation on public.messages (conversation_id, created_at);

create table public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null,
  conversation_id uuid not null,
  message_id uuid not null,
  kind public.message_kind not null default 'human',
  origin text not null check (origin in ('reply', 'property')),
  dedupe_key text check (char_length(dedupe_key) <= 200),
  scheduled_for timestamptz not null default now(),
  status public.whatsapp_outbox_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 200),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, connection_id) references public.whatsapp_connections (organization_id, id) on delete cascade,
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade,
  foreign key (organization_id, message_id) references public.messages (organization_id, id) on delete cascade
);

create unique index whatsapp_outbox_dedupe on public.whatsapp_outbox (organization_id, dedupe_key) where dedupe_key is not null;
create index whatsapp_outbox_pending on public.whatsapp_outbox (scheduled_for) where status in ('queued', 'sending');

-- Idempotencia de eventos del proveedor. Sin contenido de mensajes ni teléfonos.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (char_length(source) <= 50),
  external_id text not null check (char_length(external_id) <= 300),
  organization_id uuid references public.organizations (id) on delete cascade,
  event_type text not null check (char_length(event_type) <= 80),
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create table public.whatsapp_api_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'handled')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index whatsapp_api_requests_org on public.whatsapp_api_requests (organization_id, created_at desc);
create index whatsapp_api_requests_open on public.whatsapp_api_requests (created_at) where status = 'open';

-- Historial del contacto y de la propiedad (CU-08).
alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'note', 'call', 'contact_created', 'assigned', 'do_not_contact', 'contact_merged',
  'search_created', 'stage_changed', 'appointment', 'property_sent'
));
create index activities_property_sent on public.activities ((metadata ->> 'property_id')) where kind = 'property_sent';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger whatsapp_connections_set_updated_at before update on public.whatsapp_connections
  for each row execute function app.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function app.set_updated_at();
create trigger messages_set_updated_at before update on public.messages
  for each row execute function app.set_updated_at();
create trigger whatsapp_outbox_set_updated_at before update on public.whatsapp_outbox
  for each row execute function app.set_updated_at();
create trigger whatsapp_connections_prevent_key_change before update on public.whatsapp_connections
  for each row execute function app.prevent_tenant_key_change();
create trigger conversations_prevent_key_change before update on public.conversations
  for each row execute function app.prevent_tenant_key_change();
create trigger messages_prevent_key_change before update on public.messages
  for each row execute function app.prevent_tenant_key_change();
create trigger whatsapp_outbox_prevent_key_change before update on public.whatsapp_outbox
  for each row execute function app.prevent_tenant_key_change();

-- Al unificar contactos, sus conversaciones pasan al contacto que queda (F-34).
create function app.conversations_follow_contact_merge() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is not null and old.merged_into_id is null then
    update public.conversations set contact_id = new.merged_into_id
    where organization_id = new.organization_id and contact_id = new.id;
  end if;
  return new;
end;
$$;

create trigger contacts_merge_conversations after update of merged_into_id on public.contacts
  for each row execute function app.conversations_follow_contact_merge();

-- Al desactivar a un miembro, sus conversaciones quedan sin asignar (PRD §6).
create function app.unassign_conversations_of_deactivated_member() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    update public.conversations set assigned_user_id = null, assigned_at = null
    where organization_id = new.organization_id and assigned_user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger memberships_unassign_conversations after update of status on public.memberships
  for each row execute function app.unassign_conversations_of_deactivated_member();

-- -----------------------------------------------------------------------------
-- Auxiliares internas
-- -----------------------------------------------------------------------------
create function app.message_preview(p_type public.message_type, p_body text) returns text
language sql
immutable
set search_path = ''
as $$
  select left(coalesce(nullif(btrim(p_body), ''), case p_type
    when 'image' then 'Foto'
    when 'audio' then 'Audio'
    when 'document' then 'Documento'
    when 'video' then 'Video'
    else 'Mensaje'
  end), 200);
$$;

-- Crea el mensaje saliente y su entrada en la cola, y actualiza la conversación.
create function app.queue_outbound(
  p_conversation public.conversations,
  p_type public.message_type,
  p_body text,
  p_media_path text,
  p_media_url text,
  p_media_mime text,
  p_media_name text,
  p_origin text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.messages (
    organization_id, conversation_id, connection_id, direction, kind, author_user_id, type, body,
    media_path, media_url, media_mime, media_name, media_status, status
  ) values (
    p_conversation.organization_id, p_conversation.id, p_conversation.connection_id, 'outbound', 'human', auth.uid(),
    p_type, coalesce(p_body, ''), p_media_path, p_media_url, p_media_mime, p_media_name,
    case when p_media_path is not null or p_media_url is not null then 'ready' else 'none' end::public.message_media_status,
    'queued'
  ) returning id into v_id;

  insert into public.whatsapp_outbox (organization_id, connection_id, conversation_id, message_id, origin)
  values (p_conversation.organization_id, p_conversation.connection_id, p_conversation.id, v_id, p_origin);

  update public.conversations
  set last_message_at = now(), last_message_preview = app.message_preview(p_type, p_body)
  where id = p_conversation.id;
  return v_id;
end;
$$;

-- Trae la conversación para enviar: permiso de escritura y número conectado.
create function app.conversation_for_send(p_conversation_id uuid) returns public.conversations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if v_conversation.id is null or not app.can_read(v_conversation.organization_id) then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;
  if not app.can_write(v_conversation.organization_id) then
    raise exception using errcode = '42501', message = 'account_not_writable';
  end if;
  perform 1 from public.whatsapp_connections
  where id = v_conversation.connection_id and status = 'connected' and removed_at is null;
  if not found then
    raise exception using errcode = 'IG015', message = 'whatsapp_not_connected';
  end if;
  return v_conversation;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC del panel
-- -----------------------------------------------------------------------------

-- CU-03. Las pautas de uso responsable se aceptan al conectar. El secreto lo genera la app: acá solo
-- llega su hash.
create function public.create_whatsapp_connection(
  p_organization_id uuid,
  p_webhook_secret_hash text,
  p_guidelines_accepted boolean
) returns table (id uuid, instance_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_instance text := 'ip_' || replace(v_id::text, '-', '');
  v_limit integer;
begin
  if not (app.is_owner(p_organization_id) or app.has_support_access(p_organization_id))
     or not app.can_write(p_organization_id) then
    raise exception using errcode = '42501', message = 'only_owner_can_connect';
  end if;
  if not coalesce(p_guidelines_accepted, false) then
    raise exception using errcode = '23514', message = 'guidelines_not_accepted';
  end if;

  perform 1 from public.organizations o where o.id = p_organization_id for update;
  if not app.has_support_access(p_organization_id) then
    v_limit := app.plan_limit(p_organization_id, 'whatsapp_numbers');
    if (select count(*) from public.whatsapp_connections c
        where c.organization_id = p_organization_id and c.removed_at is null) >= v_limit then
      perform app.raise_plan_limit(p_organization_id, 'whatsapp_numbers', v_limit);
    end if;
  end if;

  insert into public.whatsapp_connections (
    id, organization_id, instance_name, webhook_secret_hash, guidelines_accepted_by, guidelines_accepted_at
  ) values (v_id, p_organization_id, v_instance, p_webhook_secret_hash, auth.uid(), now());

  perform app.audit('organization', p_organization_id, 'whatsapp.connection_created', 'whatsapp_connection', v_id::text);
  return query select v_id, v_instance;
end;
$$;

-- Quita el número: se conservan las conversaciones y se cancela lo que estaba en cola.
create function public.remove_whatsapp_connection(p_connection_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.whatsapp_connections where id = p_connection_id and removed_at is null;
  if v_org is null or not (app.is_owner(v_org) or app.has_support_access(v_org)) then
    raise exception using errcode = '42501', message = 'only_owner_can_disconnect';
  end if;

  update public.whatsapp_connections set removed_at = now(), status = 'disconnected' where id = p_connection_id;
  update public.messages m set status = 'cancelled'
  from public.whatsapp_outbox o
  where o.message_id = m.id and o.connection_id = p_connection_id and o.status = 'queued';
  update public.whatsapp_outbox set status = 'cancelled' where connection_id = p_connection_id and status = 'queued';

  perform app.audit('organization', v_org, 'whatsapp.connection_removed', 'whatsapp_connection', p_connection_id::text);
end;
$$;

-- F-16: abrir marca leído, y el primer agente que abre una conversación sin asignar queda asignado.
-- El soporte de C&C y las cuentas en solo lectura pueden abrir sin tomarla.
create function public.open_whatsapp_conversation(p_conversation_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
  v_is_member boolean;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id for update;
  if v_conversation.id is null or not app.can_read(v_conversation.organization_id) then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;
  v_is_member := exists (
    select 1 from public.memberships
    where organization_id = v_conversation.organization_id and user_id = auth.uid() and status = 'active'
  );
  if not app.can_write(v_conversation.organization_id) or not v_is_member then
    return;
  end if;

  update public.conversations set
    unread_count = 0,
    assigned_user_id = coalesce(assigned_user_id, auth.uid()),
    assigned_at = case when assigned_user_id is null then now() else assigned_at end
  where id = p_conversation_id;
end;
$$;

-- CU-04 paso 5: el dueño reasigna; los agentes, si el dueño habilitó ese permiso.
create function public.assign_whatsapp_conversation(p_conversation_id uuid, p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.conversations where id = p_conversation_id;
  if v_org is null or not app.can_read(v_org) then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;
  if not app.can_write(v_org) then
    raise exception using errcode = '42501', message = 'account_not_writable';
  end if;
  if not (app.is_owner(v_org) or app.has_support_access(v_org)
          or exists (select 1 from public.organizations where id = v_org and agents_can_reassign)) then
    raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
  end if;
  if p_user_id is not null then
    perform 1 from public.memberships
    where organization_id = v_org and user_id = p_user_id and status = 'active';
    if not found then
      raise exception using errcode = '23503', message = 'assignee_not_active_member';
    end if;
  end if;

  update public.conversations
  set assigned_user_id = p_user_id, assigned_at = case when p_user_id is null then null else now() end
  where id = p_conversation_id;
end;
$$;

-- Envío a un contacto desde su ficha. A quien pidió la baja no se le inicia una conversación; si él
-- escribió, se le sigue respondiendo (PRD §6).
create function public.start_whatsapp_conversation(p_contact_id uuid, p_connection_id uuid default null) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts;
  v_connection uuid;
  v_phone text;
  v_id uuid;
begin
  select * into v_contact from public.contacts where id = p_contact_id and merged_into_id is null;
  if v_contact.id is null or not app.can_read(v_contact.organization_id) then
    raise exception using errcode = 'P0002', message = 'contact_not_found';
  end if;
  if not app.can_write(v_contact.organization_id) then
    raise exception using errcode = '42501', message = 'account_not_writable';
  end if;

  select id into v_connection from public.whatsapp_connections
  where organization_id = v_contact.organization_id and status = 'connected' and removed_at is null
    and (p_connection_id is null or id = p_connection_id)
  order by connected_at limit 1;
  if v_connection is null then
    raise exception using errcode = 'IG015', message = 'whatsapp_not_connected';
  end if;

  -- Si ya hay conversación por ese número con este contacto, se reutiliza.
  select c.id into v_id from public.conversations c
  where c.connection_id = v_connection and c.contact_id = p_contact_id
  order by c.has_inbound desc, c.last_message_at desc nulls last limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if v_contact.do_not_contact then
    raise exception using errcode = 'IG016', message = 'contact_do_not_contact';
  end if;

  select phone_e164 into v_phone from public.contact_phones
  where organization_id = v_contact.organization_id and contact_id = p_contact_id and is_whatsapp
  order by created_at limit 1;
  if v_phone is null then
    raise exception using errcode = '23514', message = 'contact_without_whatsapp_phone';
  end if;

  insert into public.conversations (organization_id, connection_id, contact_id, phone_e164, assigned_user_id, assigned_at)
  values (v_contact.organization_id, v_connection, p_contact_id, v_phone, auth.uid(), now())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.send_whatsapp_message(
  p_conversation_id uuid,
  p_body text,
  p_type public.message_type default 'text',
  p_media_path text default null,
  p_media_mime text default null,
  p_media_name text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations := app.conversation_for_send(p_conversation_id);
begin
  if p_type = 'text' and coalesce(btrim(p_body), '') = '' then
    raise exception using errcode = '23514', message = 'empty_message';
  end if;
  if p_type <> 'text' and p_media_path is null then
    raise exception using errcode = '23514', message = 'media_required';
  end if;
  -- El adjunto tiene que estar en la carpeta de esta inmobiliaria.
  if p_media_path is not null
     and app.storage_organization_id(p_media_path) is distinct from v_conversation.organization_id then
    raise exception using errcode = '42501', message = 'media_outside_organization';
  end if;
  return app.queue_outbound(v_conversation, p_type, p_body, p_media_path, null, p_media_mime, p_media_name, 'reply');
end;
$$;

-- CU-08: ficha de la propiedad. El servidor arma el texto con el link público; es un envío humano,
-- no cuenta para los límites de automáticos. Queda en el historial del contacto y de la propiedad.
create function public.send_property_whatsapp(
  p_conversation_id uuid,
  p_property_id uuid,
  p_text text,
  p_photo_urls text[] default '{}'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations := app.conversation_for_send(p_conversation_id);
  v_property public.properties;
  v_url text;
  v_first boolean := true;
begin
  select * into v_property from public.properties
  where id = p_property_id and organization_id = v_conversation.organization_id and merged_into_id is null;
  if v_property.id is null or v_property.status in ('draft', 'paused') then
    raise exception using errcode = 'IG017', message = 'property_not_public';
  end if;
  if coalesce(btrim(p_text), '') = '' or coalesce(array_length(p_photo_urls, 1), 0) > 3 then
    raise exception using errcode = '23514', message = 'invalid_property_message';
  end if;

  if coalesce(array_length(p_photo_urls, 1), 0) = 0 then
    perform app.queue_outbound(v_conversation, 'text', p_text, null, null, null, null, 'property');
  else
    -- La primera foto lleva el texto y el link; las demás van sin epígrafe.
    foreach v_url in array p_photo_urls loop
      perform app.queue_outbound(v_conversation, 'image', case when v_first then p_text else '' end,
                                 null, v_url, 'image/jpeg', null, 'property');
      v_first := false;
    end loop;
  end if;

  insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
  values (v_conversation.organization_id, v_conversation.contact_id, 'property_sent',
          jsonb_build_object('property_id', p_property_id, 'property_title', v_property.title, 'conversation_id', p_conversation_id),
          auth.uid());
end;
$$;

-- F-32: pedido de API oficial a C&C.
create function public.request_whatsapp_official_api(p_organization_id uuid, p_notes text default '') returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (app.is_owner(p_organization_id) or app.has_support_access(p_organization_id))
     or not app.can_write(p_organization_id) then
    raise exception using errcode = '42501', message = 'only_owner_can_request';
  end if;
  select id into v_id from public.whatsapp_api_requests
  where organization_id = p_organization_id and status = 'open' limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.whatsapp_api_requests (organization_id, requested_by, notes)
  values (p_organization_id, auth.uid(), coalesce(p_notes, ''))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.platform_whatsapp_api_requests()
returns table (id uuid, organization_id uuid, organization_name text, notes text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_only';
  end if;
  return query
    select r.id, r.organization_id, o.name, r.notes, r.created_at
    from public.whatsapp_api_requests r
    join public.organizations o on o.id = r.organization_id
    where r.status = 'open'
    order by r.created_at;
end;
$$;

create function public.platform_resolve_whatsapp_api_request(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_only';
  end if;
  update public.whatsapp_api_requests
  set status = 'handled', handled_by = auth.uid(), handled_at = now()
  where id = p_id and status = 'open';
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC del servidor (webhook y worker): solo service_role. La conexión ya fue identificada por el
-- secreto del webhook o por la cola; nunca por un dato enviado por el proveedor.
-- -----------------------------------------------------------------------------

-- CU-04. Idempotente por id de mensaje. Lo enviado desde el teléfono de la inmobiliaria se registra
-- solo si ya existe ese contacto: un número nuevo únicamente crea contacto cuando escribe él.
create function public.whatsapp_ingest_message(
  p_connection_id uuid,
  p_external_id text,
  p_phone_e164 text,
  p_push_name text,
  p_from_me boolean,
  p_type public.message_type,
  p_body text,
  p_media_mime text,
  p_media_name text,
  p_sent_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.whatsapp_connections;
  v_conversation public.conversations;
  v_contact uuid;
  v_message uuid;
  v_has_media boolean := p_type in ('image', 'audio', 'document', 'video');
  v_preview text := app.message_preview(p_type, p_body);
  v_title text;
begin
  select * into v_connection from public.whatsapp_connections where id = p_connection_id and removed_at is null;
  if v_connection.id is null or app.organization_state(v_connection.organization_id) = 'pending_deletion' then
    return jsonb_build_object('status', 'ignored');
  end if;

  insert into public.webhook_events (source, external_id, organization_id, event_type)
  values ('evolution', p_connection_id::text || ':' || p_external_id, v_connection.organization_id, 'message')
  on conflict (source, external_id) do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- El envío del panel ya tiene su mensaje: el evento del proveedor no lo duplica.
  perform 1 from public.messages where connection_id = p_connection_id and external_id = p_external_id;
  if found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select * into v_conversation from public.conversations
  where connection_id = p_connection_id and phone_e164 = p_phone_e164 for update;

  if v_conversation.id is null then
    select contact_id into v_contact from public.contact_phones
    where organization_id = v_connection.organization_id and phone_e164 = p_phone_e164;

    if v_contact is null then
      if p_from_me then
        return jsonb_build_object('status', 'ignored');
      end if;
      insert into public.contacts (organization_id, full_name, source)
      values (v_connection.organization_id, left(coalesce(nullif(btrim(p_push_name), ''), p_phone_e164), 120), 'whatsapp')
      returning id into v_contact;
      insert into public.contact_phones (organization_id, contact_id, phone_e164)
      values (v_connection.organization_id, v_contact, p_phone_e164);
    end if;

    insert into public.conversations (organization_id, connection_id, contact_id, phone_e164)
    values (v_connection.organization_id, p_connection_id, v_contact, p_phone_e164)
    returning * into v_conversation;
  end if;

  insert into public.messages (
    organization_id, conversation_id, connection_id, direction, type, body, media_mime, media_name,
    media_status, external_id, status, sent_at
  ) values (
    v_connection.organization_id, v_conversation.id, p_connection_id,
    case when p_from_me then 'outbound' else 'inbound' end::public.message_direction,
    p_type, left(coalesce(p_body, ''), 10000), p_media_mime, p_media_name,
    case when v_has_media then 'pending' else 'none' end::public.message_media_status,
    p_external_id, case when p_from_me then 'sent' else 'received' end::public.message_status,
    coalesce(p_sent_at, now())
  ) returning id into v_message;

  update public.conversations set
    last_message_at = coalesce(p_sent_at, now()),
    last_message_preview = v_preview,
    unread_count = unread_count + case when p_from_me then 0 else 1 end,
    has_inbound = has_inbound or not p_from_me
  where id = v_conversation.id;

  if not p_from_me then
    -- Baja por palabra clave (PRD §6): deja de recibir automáticos; los agentes pueden seguir respondiendo.
    if upper(btrim(coalesce(p_body, ''))) = 'BAJA' then
      update public.contacts set do_not_contact = true
      where id = v_conversation.contact_id and not do_not_contact;
    end if;

    -- Se avisa al asignado; si no hay, a todo el equipo. Una notificación por conversación, que se
    -- reactiva con cada mensaje nuevo.
    select 'Mensaje de ' || full_name into v_title from public.contacts where id = v_conversation.contact_id;
    insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
    select v_connection.organization_id, m.user_id, 'new_message', left(v_title, 200), v_preview,
           '/panel/conversaciones?c=' || v_conversation.id::text,
           'new_message:' || v_conversation.id::text
    from public.memberships m
    where m.organization_id = v_connection.organization_id and m.status = 'active'
      and (v_conversation.assigned_user_id is null or m.user_id = v_conversation.assigned_user_id)
    on conflict (organization_id, user_id, dedupe_key) do update
      set title = excluded.title, body = excluded.body, read_at = null, created_at = now();
  end if;

  return jsonb_build_object(
    'status', 'stored',
    'message_id', v_message,
    'organization_id', v_connection.organization_id,
    'has_media', v_has_media
  );
end;
$$;

-- F-14 y F-23: estado de la conexión. Al caerse una conexión activa se avisa a los dueños.
create function public.whatsapp_set_connection_state(
  p_connection_id uuid,
  p_status public.whatsapp_connection_status,
  p_phone_e164 text default null,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.whatsapp_connections;
begin
  select * into v_connection from public.whatsapp_connections
  where id = p_connection_id and removed_at is null for update;
  if v_connection.id is null then
    return;
  end if;

  update public.whatsapp_connections set
    status = p_status,
    status_reason = left(p_reason, 200),
    phone_e164 = coalesce(p_phone_e164, phone_e164),
    connected_at = case when p_status = 'connected' then coalesce(connected_at, now()) else connected_at end
  where id = p_connection_id;

  if v_connection.status = 'connected' and p_status in ('disconnected', 'needs_qr') then
    insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
    select v_connection.organization_id, m.user_id, 'whatsapp_disconnected', 'WhatsApp se desconectó',
           'El número ' || coalesce(v_connection.phone_e164, 'conectado') || ' dejó de estar disponible. Volvé a conectarlo.',
           '/panel/whatsapp', 'whatsapp_disconnected:' || p_connection_id::text
    from public.memberships m
    where m.organization_id = v_connection.organization_id and m.status = 'active' and m.role = 'owner'
    on conflict (organization_id, user_id, dedupe_key) do update
      set read_at = null, created_at = now();
  end if;
end;
$$;

-- Toma los envíos listos. Lo que quedó "enviando" por una caída del worker vuelve a la cola, y lo que
-- lleva más de una hora sin número conectado se marca como fallido para que el agente lo vea.
create function public.claim_whatsapp_outbox(p_limit integer default 10)
returns table (
  id uuid, organization_id uuid, connection_id uuid, instance_name text, message_id uuid,
  phone_e164 text, type public.message_type, body text, media_path text, media_url text,
  media_mime text, media_name text, attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_outbox o set status = 'queued', locked_at = null
  where o.status = 'sending' and o.locked_at < now() - interval '5 minutes';

  with stale as (
    update public.whatsapp_outbox o set status = 'failed', last_error = 'connection_unavailable'
    from public.whatsapp_connections c
    where c.id = o.connection_id and o.status = 'queued' and c.status <> 'connected'
      and o.scheduled_for < now() - interval '1 hour'
    returning o.message_id
  )
  update public.messages m set status = 'failed', error_code = 'connection_unavailable'
  from stale where m.id = stale.message_id;

  return query
    with picked as (
      select o.id from public.whatsapp_outbox o
      join public.whatsapp_connections c on c.id = o.connection_id
      where o.status = 'queued' and o.kind = 'human' and o.scheduled_for <= now()
        and c.status = 'connected' and c.removed_at is null
      order by o.scheduled_for, o.created_at
      limit greatest(p_limit, 0)
      for update of o skip locked
    ), updated as (
      update public.whatsapp_outbox o
      set status = 'sending', locked_at = now(), attempts = o.attempts + 1
      from picked where o.id = picked.id
      returning o.*
    ), marked as (
      update public.messages m set status = 'sending'
      from updated u where m.id = u.message_id
      returning m.*
    )
    select u.id, u.organization_id, u.connection_id, c.instance_name, u.message_id,
           cv.phone_e164, m.type, m.body, m.media_path, m.media_url, m.media_mime, m.media_name, u.attempts
    from updated u
    join marked m on m.id = u.message_id
    join public.whatsapp_connections c on c.id = u.connection_id
    join public.conversations cv on cv.id = u.conversation_id
    order by u.scheduled_for, u.created_at;
end;
$$;

create function public.complete_whatsapp_outbox(p_id uuid, p_external_id text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox public.whatsapp_outbox;
begin
  select * into v_outbox from public.whatsapp_outbox where id = p_id and status = 'sending' for update;
  if v_outbox.id is null then
    return;
  end if;
  -- Si el evento del proveedor llegó antes que esta confirmación, queda solo el mensaje del panel,
  -- que tiene el autor.
  if p_external_id is not null then
    delete from public.messages
    where connection_id = v_outbox.connection_id and external_id = p_external_id and id <> v_outbox.message_id;
  end if;
  update public.messages
  set status = 'sent', external_id = p_external_id, sent_at = now(), error_code = null
  where id = v_outbox.message_id;
  update public.whatsapp_outbox set status = 'sent', locked_at = null, last_error = null where id = p_id;
end;
$$;

-- Reintentos según platform_settings.wa_max_retries (PRD §6: 2 reintentos).
create function public.fail_whatsapp_outbox(p_id uuid, p_error text, p_retry_seconds integer default 30) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox public.whatsapp_outbox;
  v_max integer;
begin
  select * into v_outbox from public.whatsapp_outbox where id = p_id and status = 'sending' for update;
  if v_outbox.id is null then
    return;
  end if;
  select wa_max_retries into v_max from public.platform_settings where id;

  if v_outbox.attempts <= coalesce(v_max, 2) then
    update public.whatsapp_outbox set
      status = 'queued', locked_at = null, last_error = left(p_error, 200),
      scheduled_for = now() + make_interval(secs => greatest(p_retry_seconds, 1))
    where id = p_id;
    update public.messages set status = 'queued' where id = v_outbox.message_id;
  else
    update public.whatsapp_outbox set status = 'failed', locked_at = null, last_error = left(p_error, 200) where id = p_id;
    update public.messages set status = 'failed', error_code = left(p_error, 100) where id = v_outbox.message_id;
  end if;
end;
$$;

create function public.whatsapp_set_message_media(
  p_message_id uuid,
  p_media_status public.message_media_status,
  p_media_path text default null,
  p_media_mime text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages
  set media_status = p_media_status,
      media_path = coalesce(p_media_path, media_path),
      media_mime = coalesce(p_media_mime, media_mime)
  where id = p_message_id;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_connections force row level security;
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.whatsapp_outbox enable row level security;
alter table public.whatsapp_outbox force row level security;
alter table public.webhook_events enable row level security;
alter table public.webhook_events force row level security;
alter table public.whatsapp_api_requests enable row level security;
alter table public.whatsapp_api_requests force row level security;

revoke all on public.whatsapp_connections, public.conversations, public.messages, public.whatsapp_outbox,
  public.webhook_events, public.whatsapp_api_requests from anon, authenticated;
grant all on public.whatsapp_connections, public.conversations, public.messages, public.whatsapp_outbox,
  public.webhook_events, public.whatsapp_api_requests to service_role;

-- Sin webhook_secret_hash: ningún usuario lee el hash del secreto.
grant select (id, organization_id, provider, instance_name, phone_e164, status, status_reason, automations_paused_at,
              automations_paused_reason, guidelines_accepted_by, guidelines_accepted_at, connected_at, removed_at,
              created_at, updated_at)
  on public.whatsapp_connections to authenticated;
grant select on public.conversations, public.messages, public.whatsapp_api_requests to authenticated;

create policy whatsapp_connections_select on public.whatsapp_connections for select to authenticated
  using (app.can_read(organization_id));
create policy conversations_select on public.conversations for select to authenticated
  using (app.can_read(organization_id));
create policy messages_select on public.messages for select to authenticated
  using (app.can_read(organization_id));
create policy whatsapp_api_requests_select on public.whatsapp_api_requests for select to authenticated
  using (app.can_read(organization_id));

revoke all on function
  app.conversations_follow_contact_merge(), app.unassign_conversations_of_deactivated_member(),
  app.message_preview(public.message_type, text),
  app.queue_outbound(public.conversations, public.message_type, text, text, text, text, text, text),
  app.conversation_for_send(uuid)
from public;

revoke all on function
  public.create_whatsapp_connection(uuid, text, boolean),
  public.remove_whatsapp_connection(uuid),
  public.open_whatsapp_conversation(uuid),
  public.assign_whatsapp_conversation(uuid, uuid),
  public.start_whatsapp_conversation(uuid, uuid),
  public.send_whatsapp_message(uuid, text, public.message_type, text, text, text),
  public.send_property_whatsapp(uuid, uuid, text, text[]),
  public.request_whatsapp_official_api(uuid, text),
  public.platform_whatsapp_api_requests(),
  public.platform_resolve_whatsapp_api_request(uuid),
  public.whatsapp_ingest_message(uuid, text, text, text, boolean, public.message_type, text, text, text, timestamptz),
  public.whatsapp_set_connection_state(uuid, public.whatsapp_connection_status, text, text),
  public.claim_whatsapp_outbox(integer),
  public.complete_whatsapp_outbox(uuid, text),
  public.fail_whatsapp_outbox(uuid, text, integer),
  public.whatsapp_set_message_media(uuid, public.message_media_status, text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.create_whatsapp_connection(uuid, text, boolean),
  public.remove_whatsapp_connection(uuid),
  public.open_whatsapp_conversation(uuid),
  public.assign_whatsapp_conversation(uuid, uuid),
  public.start_whatsapp_conversation(uuid, uuid),
  public.send_whatsapp_message(uuid, text, public.message_type, text, text, text),
  public.send_property_whatsapp(uuid, uuid, text, text[]),
  public.request_whatsapp_official_api(uuid, text),
  public.platform_whatsapp_api_requests(),
  public.platform_resolve_whatsapp_api_request(uuid)
to authenticated;

grant execute on function
  public.whatsapp_ingest_message(uuid, text, text, text, boolean, public.message_type, text, text, text, timestamptz),
  public.whatsapp_set_connection_state(uuid, public.whatsapp_connection_status, text, text),
  public.claim_whatsapp_outbox(integer),
  public.complete_whatsapp_outbox(uuid, text),
  public.fail_whatsapp_outbox(uuid, text, integer),
  public.whatsapp_set_message_media(uuid, public.message_media_status, text, text)
to service_role;

-- -----------------------------------------------------------------------------
-- Adjuntos: bucket privado con carpeta por inmobiliaria; se leen con URLs firmadas de corta duración.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('whatsapp-media', 'whatsapp-media', false, 16777216, array[
  'image/jpeg', 'image/png', 'image/webp',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr',
  'video/mp4',
  'application/pdf', 'application/msword', 'text/plain', 'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

create policy whatsapp_media_select on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp-media' and app.can_read(app.storage_organization_id(name)));
create policy whatsapp_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'whatsapp-media' and app.can_write(app.storage_organization_id(name)));

-- Bandeja en vivo (ARCHITECTURE): Realtime respeta las políticas de RLS de estas tablas.
alter publication supabase_realtime add table public.conversations, public.messages;
