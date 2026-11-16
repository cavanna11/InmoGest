-- =============================================================================
-- Publicaciones externas, Mercado Libre y API de propiedades (F-36, F-37, F-33; ADR 0012).
-- - organizations.website_url: sitio web propio, visible en la página pública.
-- - property_listings: dónde está publicada cada propiedad. Manual (link que pega el agente) o
--   gestionada (Mercado Libre por API). Una gestionada no se edita a mano.
-- - mercadolibre_connections: una cuenta de Mercado Libre por inmobiliaria. Los tokens llegan
--   cifrados por la app (AES-256-GCM) y ningún usuario los puede leer (grants por columna).
-- - api_tokens: tokens de la API de propiedades para webs propias, guardados como hash SHA-256.
-- Códigos de error propios: IG018 la publicación la gestiona una integración, IG019 Mercado Libre
-- no conectado.
-- =============================================================================

alter table public.organizations
  add column website_url text check (
    website_url is null or (website_url ~ '^https?://[^\s/$.?#][^\s]*$' and char_length(website_url) <= 300)
  );

create type public.listing_channel as enum ('website', 'mercadolibre', 'zonaprop', 'argenprop');
create type public.listing_sync_status as enum ('manual', 'publishing', 'active', 'paused', 'closed', 'error');

create table public.property_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  channel public.listing_channel not null,
  url text check (url is null or (url ~ '^https?://[^\s/$.?#][^\s]*$' and char_length(url) <= 500)),
  -- Gestionada: la publicó InmoPanel por API (solo Mercado Libre) y se sincroniza sola.
  managed boolean not null default false,
  external_id text check (external_id is null or char_length(external_id) <= 60),
  sync_status public.listing_sync_status not null default 'manual',
  last_error text check (last_error is null or char_length(last_error) <= 500),
  -- Mercado Libre: categoría, tipo de publicación, ubicación y atributos elegidos por el agente.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 20000),
  synced_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (property_id, channel),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  check (channel = 'mercadolibre' or not managed),
  check (managed or (url is not null and external_id is null and sync_status = 'manual')),
  check (not managed or sync_status <> 'manual')
);

create index property_listings_org on public.property_listings (organization_id, channel);

create table public.mercadolibre_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  ml_user_id bigint not null unique,
  nickname text not null default '' check (char_length(nickname) <= 120),
  status text not null default 'connected' check (status in ('connected', 'needs_reauth')),
  -- Cifrados por la app; no se exponen a los usuarios (ver grants por columna).
  access_token_enc text not null check (char_length(access_token_enc) <= 2000),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 2000),
  expires_at timestamptz not null,
  -- Reserva para renovar: el refresh token de Mercado Libre es de un solo uso.
  refresh_lock_until timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- SHA-256 del token. Se muestra una sola vez al crearlo.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Primeros caracteres, para reconocerlo en la lista.
  token_prefix text not null check (token_prefix ~ '^[A-Za-z0-9_-]{4,16}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (organization_id, id)
);

create index api_tokens_org on public.api_tokens (organization_id) where revoked_at is null;

create trigger property_listings_set_updated_at before update on public.property_listings
  for each row execute function app.set_updated_at();
create trigger mercadolibre_connections_set_updated_at before update on public.mercadolibre_connections
  for each row execute function app.set_updated_at();
create trigger property_listings_prevent_key_change before update on public.property_listings
  for each row execute function app.prevent_tenant_key_change();
create trigger mercadolibre_connections_prevent_key_change before update on public.mercadolibre_connections
  for each row execute function app.prevent_tenant_key_change();
create trigger api_tokens_prevent_key_change before update on public.api_tokens
  for each row execute function app.prevent_tenant_key_change();

-- -----------------------------------------------------------------------------
-- Página pública: suma el sitio web de la inmobiliaria. Cambia el tipo de retorno, así que se recrea.
-- -----------------------------------------------------------------------------
drop function public.public_property(text, text);

create function public.public_property(p_organization_slug text, p_property_slug text)
returns table (
  organization_name text,
  organization_logo_path text,
  organization_phone text,
  organization_email text,
  code text,
  title text,
  description text,
  operation public.property_operation,
  property_type public.property_type,
  status public.property_status,
  price numeric,
  currency text,
  expenses numeric,
  expenses_currency text,
  province text,
  city text,
  neighborhood text,
  address text,
  rooms smallint,
  bedrooms smallint,
  bathrooms smallint,
  covered_area_m2 numeric,
  total_area_m2 numeric,
  features text[],
  images text[],
  organization_website text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, o.logo_path, o.contact_phone, o.contact_email::text,
    p.code, p.title, p.description, p.operation, p.property_type, p.status, p.price, p.currency,
    p.expenses, p.expenses_currency, p.province, p.city, p.neighborhood,
    case when p.show_address then p.address else '' end,
    p.rooms, p.bedrooms, p.bathrooms, p.covered_area_m2, p.total_area_m2, p.features,
    array(select i.storage_path from public.property_images i where i.property_id = p.id order by i.position, i.created_at),
    o.website_url
  from public.organizations o
  join public.properties p on p.organization_id = o.id
  where o.slug = p_organization_slug
    and p.slug = p_property_slug
    and p.merged_into_id is null
    and p.status not in ('draft', 'paused')
    and o.deleted_at is null
    and app.organization_state(o.id) not in ('blocked', 'pending_deletion');
$$;

revoke all on function public.public_property(text, text) from public;
grant execute on function public.public_property(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Links manuales (F-36)
-- -----------------------------------------------------------------------------

-- Guarda o quita (link vacío) el link de un canal. No toca una publicación gestionada por API.
create function public.set_property_listing_link(p_property_id uuid, p_channel public.listing_channel, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  select organization_id into v_org from public.properties where id = p_property_id and merged_into_id is null;
  if v_org is null or not app.can_write(v_org) then
    raise exception using errcode = '42501', message = 'cannot_edit_property';
  end if;
  if exists (select 1 from public.property_listings
             where property_id = p_property_id and channel = p_channel and managed) then
    raise exception using errcode = 'IG018', message = 'listing_managed';
  end if;

  if v_url is null then
    delete from public.property_listings where property_id = p_property_id and channel = p_channel;
  else
    insert into public.property_listings (organization_id, property_id, channel, url, created_by)
    values (v_org, p_property_id, p_channel, v_url, auth.uid())
    on conflict (property_id, channel) do update set url = excluded.url;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mercado Libre (F-37)
-- -----------------------------------------------------------------------------

-- La guarda el servidor después del OAuth, una vez que verificó con la sesión que el usuario es dueño.
create function public.mercadolibre_save_connection(
  p_organization_id uuid,
  p_connected_by uuid,
  p_ml_user_id bigint,
  p_nickname text,
  p_access_token_enc text,
  p_refresh_token_enc text,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mercadolibre_connections (
    organization_id, ml_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, connected_by
  ) values (
    p_organization_id, p_ml_user_id, left(coalesce(p_nickname, ''), 120), p_access_token_enc, p_refresh_token_enc,
    p_expires_at, p_connected_by
  )
  on conflict (organization_id) do update set
    ml_user_id = excluded.ml_user_id,
    nickname = excluded.nickname,
    access_token_enc = excluded.access_token_enc,
    refresh_token_enc = excluded.refresh_token_enc,
    expires_at = excluded.expires_at,
    connected_by = excluded.connected_by,
    connected_at = now(),
    status = 'connected',
    refresh_lock_until = null;

  insert into public.audit_logs (scope, organization_id, actor_user_id, action, entity_type, entity_id)
  values ('organization', p_organization_id, p_connected_by, 'mercadolibre.connected', 'mercadolibre_connection', p_ml_user_id::text);
end;
$$;

create function public.remove_mercadolibre_connection(p_organization_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (app.is_owner(p_organization_id) or app.has_support_access(p_organization_id))
     or not app.can_write(p_organization_id) then
    raise exception using errcode = '42501', message = 'only_owner_can_disconnect';
  end if;
  delete from public.mercadolibre_connections where organization_id = p_organization_id;
  perform app.audit('organization', p_organization_id, 'mercadolibre.disconnected', 'mercadolibre_connection', p_organization_id::text);
end;
$$;

-- Devuelve los tokens cifrados. Si el access token vence en menos de 5 minutos intenta reservar la
-- renovación: leased = true solo para quien la obtuvo; los demás esperan y vuelven a leer.
create function public.mercadolibre_token_lease(p_organization_id uuid)
returns table (
  ml_user_id bigint,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  needs_refresh boolean,
  leased boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.mercadolibre_connections;
  v_leased boolean := false;
begin
  select * into v_row from public.mercadolibre_connections c
  where c.organization_id = p_organization_id and c.status = 'connected';
  if v_row.id is null then
    raise exception using errcode = 'IG019', message = 'mercadolibre_not_connected';
  end if;

  if v_row.expires_at <= now() + interval '5 minutes' then
    update public.mercadolibre_connections c set refresh_lock_until = now() + interval '30 seconds'
    where c.id = v_row.id and (c.refresh_lock_until is null or c.refresh_lock_until < now());
    v_leased := found;
  end if;

  return query select v_row.ml_user_id, v_row.access_token_enc, v_row.refresh_token_enc, v_row.expires_at,
    v_row.expires_at <= now() + interval '5 minutes', v_leased;
end;
$$;

create function public.mercadolibre_save_tokens(
  p_organization_id uuid,
  p_access_token_enc text,
  p_refresh_token_enc text,
  p_expires_at timestamptz
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.mercadolibre_connections set
    access_token_enc = p_access_token_enc,
    refresh_token_enc = p_refresh_token_enc,
    expires_at = p_expires_at,
    refresh_lock_until = null,
    status = 'connected'
  where organization_id = p_organization_id;
$$;

-- Mercado Libre rechazó la renovación (permiso revocado, contraseña cambiada): hay que volver a conectar.
create function public.mercadolibre_mark_reauth(p_organization_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.mercadolibre_connections set status = 'needs_reauth', refresh_lock_until = null
  where organization_id = p_organization_id;
$$;

-- El agente pide publicar o actualizar en Mercado Libre. Deja la fila como gestionada y "publicando";
-- el servidor hace la llamada y registra el resultado con mercadolibre_listing_result.
create function public.prepare_mercadolibre_listing(p_property_id uuid, p_settings jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_id uuid;
begin
  select * into v_property from public.properties where id = p_property_id and merged_into_id is null;
  if v_property.id is null or not app.can_write(v_property.organization_id) then
    raise exception using errcode = '42501', message = 'cannot_edit_property';
  end if;
  if not exists (select 1 from public.mercadolibre_connections
                 where organization_id = v_property.organization_id and status = 'connected') then
    raise exception using errcode = 'IG019', message = 'mercadolibre_not_connected';
  end if;
  if p_settings is not null and jsonb_typeof(p_settings) <> 'object' then
    raise exception using errcode = '23514', message = 'invalid_settings';
  end if;

  insert into public.property_listings (
    organization_id, property_id, channel, managed, sync_status, settings, created_by
  ) values (
    v_property.organization_id, p_property_id, 'mercadolibre', true, 'publishing', coalesce(p_settings, '{}'::jsonb), auth.uid()
  )
  on conflict (property_id, channel) do update set
    managed = true,
    -- Un link manual previo no es de esta publicación.
    url = case when public.property_listings.managed then public.property_listings.url else null end,
    sync_status = 'publishing',
    settings = coalesce(p_settings, public.property_listings.settings),
    last_error = null
  returning id into v_id;
  return v_id;
end;
$$;

create function public.mercadolibre_listing_result(
  p_listing_id uuid,
  p_status public.listing_sync_status,
  p_external_id text default null,
  p_url text default null,
  p_error text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.property_listings set
    sync_status = p_status,
    external_id = case when p_status = 'error' then external_id else coalesce(p_external_id, external_id) end,
    url = case when p_status = 'error' then url else coalesce(p_url, url) end,
    last_error = case when p_status = 'error' then left(coalesce(p_error, 'unknown'), 500) else null end,
    synced_at = case when p_status = 'error' then synced_at else now() end
  where id = p_listing_id and managed;
$$;

-- Deja de gestionar la publicación (después de finalizarla, o si nunca llegó a publicarse).
create function public.unlink_mercadolibre_listing(p_property_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.property_listings;
begin
  select * into v_row from public.property_listings where property_id = p_property_id and channel = 'mercadolibre';
  if v_row.id is null or not app.can_write(v_row.organization_id) then
    raise exception using errcode = '42501', message = 'cannot_edit_property';
  end if;
  if v_row.managed and v_row.external_id is not null and v_row.sync_status not in ('closed', 'error') then
    raise exception using errcode = 'IG018', message = 'listing_managed';
  end if;
  delete from public.property_listings where id = v_row.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- API de propiedades para webs propias (F-33)
-- -----------------------------------------------------------------------------

create function public.create_api_token(p_organization_id uuid, p_name text, p_token_hash text, p_token_prefix text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (app.is_owner(p_organization_id) or app.has_support_access(p_organization_id))
     or not app.can_write(p_organization_id) then
    raise exception using errcode = '42501', message = 'only_owner_can_manage_tokens';
  end if;
  perform 1 from public.organizations where id = p_organization_id for update;
  if (select count(*) from public.api_tokens where organization_id = p_organization_id and revoked_at is null) >= 5 then
    raise exception using errcode = '23514', message = 'too_many_tokens';
  end if;
  insert into public.api_tokens (organization_id, name, token_hash, token_prefix, created_by)
  values (p_organization_id, btrim(p_name), p_token_hash, p_token_prefix, auth.uid())
  returning id into v_id;
  perform app.audit('organization', p_organization_id, 'api_token.created', 'api_token', v_id::text);
  return v_id;
end;
$$;

create function public.revoke_api_token(p_token_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.api_tokens where id = p_token_id and revoked_at is null;
  if v_org is null or not (app.is_owner(v_org) or app.has_support_access(v_org)) then
    raise exception using errcode = '42501', message = 'only_owner_can_manage_tokens';
  end if;
  update public.api_tokens set revoked_at = now() where id = p_token_id;
  perform app.audit('organization', v_org, 'api_token.revoked', 'api_token', p_token_id::text);
end;
$$;

-- Propiedades publicables de la inmobiliaria del token. Solo campos de la página pública. Con p_since
-- devuelve lo cambiado desde esa fecha y los códigos que dejaron de publicarse. Null si el token no
-- existe, está revocado o la cuenta no está habilitada.
create function public.api_feed_properties(
  p_token_hash text,
  p_since timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.api_tokens;
  v_org public.organizations;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb;
  v_total integer;
  v_removed jsonb := '[]'::jsonb;
begin
  select * into v_token from public.api_tokens where token_hash = p_token_hash and revoked_at is null;
  if v_token.id is null then
    return null;
  end if;
  select * into v_org from public.organizations where id = v_token.organization_id and deleted_at is null;
  if v_org.id is null or app.organization_state(v_org.id) in ('blocked', 'pending_deletion') then
    return null;
  end if;

  -- Uso aproximado: se escribe a lo sumo una vez por minuto.
  update public.api_tokens set last_used_at = now()
  where id = v_token.id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  with publishable as (
    select p.*, greatest(p.updated_at, coalesce((select max(i.created_at) from public.property_images i where i.property_id = p.id), p.updated_at)) as changed_at
    from public.properties p
    where p.organization_id = v_org.id
      and p.merged_into_id is null
      and p.status not in ('draft', 'paused')
  ), filtered as (
    select * from publishable where p_since is null or changed_at > p_since
  )
  select
    (select count(*) from filtered),
    coalesce((
      select jsonb_agg(item order by changed_at, id)
      from (
        select f.changed_at, f.id, jsonb_build_object(
          'code', f.code,
          'slug', f.slug,
          'title', f.title,
          'description', f.description,
          'operation', f.operation,
          'property_type', f.property_type,
          'status', f.status,
          'price', f.price,
          'currency', f.currency,
          'expenses', f.expenses,
          'expenses_currency', f.expenses_currency,
          'province', f.province,
          'city', f.city,
          'neighborhood', f.neighborhood,
          'address', case when f.show_address then f.address else '' end,
          'rooms', f.rooms,
          'bedrooms', f.bedrooms,
          'bathrooms', f.bathrooms,
          'covered_area_m2', f.covered_area_m2,
          'total_area_m2', f.total_area_m2,
          'features', to_jsonb(f.features),
          'images', to_jsonb(array(select i.storage_path from public.property_images i where i.property_id = f.id order by i.position, i.created_at)),
          'published_at', f.published_at,
          'updated_at', f.changed_at
        ) as item
        from filtered f
        order by f.changed_at, f.id
        limit v_limit offset v_offset
      ) page
    ), '[]'::jsonb)
  into v_total, v_items;

  if p_since is not null then
    select coalesce(jsonb_agg(p.code order by p.code), '[]'::jsonb) into v_removed
    from public.properties p
    where p.organization_id = v_org.id
      and p.updated_at > p_since
      -- Solo las que alguna vez se publicaron: un borrador nuevo nunca estuvo en la web.
      and p.published_at is not null
      and (p.merged_into_id is not null or p.status in ('draft', 'paused'));
  end if;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'name', v_org.name,
      'slug', v_org.slug,
      'website_url', v_org.website_url,
      'phone', v_org.contact_phone,
      'email', v_org.contact_email::text
    ),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'properties', v_items,
    'removed', v_removed
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y permisos
-- -----------------------------------------------------------------------------
alter table public.property_listings enable row level security;
alter table public.property_listings force row level security;
alter table public.mercadolibre_connections enable row level security;
alter table public.mercadolibre_connections force row level security;
alter table public.api_tokens enable row level security;
alter table public.api_tokens force row level security;

revoke all on public.property_listings, public.mercadolibre_connections, public.api_tokens from anon, authenticated;
grant all on public.property_listings, public.mercadolibre_connections, public.api_tokens to service_role;

grant select on public.property_listings to authenticated;
-- Sin tokens cifrados ni la reserva de renovación.
grant select (id, organization_id, ml_user_id, nickname, status, expires_at, connected_by, connected_at, created_at, updated_at)
  on public.mercadolibre_connections to authenticated;
-- Sin el hash del token.
grant select (id, organization_id, name, token_prefix, created_by, created_at, last_used_at, revoked_at)
  on public.api_tokens to authenticated;

-- Conjunto de inmobiliarias legibles calculado una vez por consulta (migración 20261115003857).
create policy property_listings_select on public.property_listings for select to authenticated
  using (organization_id in (select app.readable_organization_ids()));
create policy mercadolibre_connections_select on public.mercadolibre_connections for select to authenticated
  using (organization_id in (select app.readable_organization_ids()));
-- Los tokens de la API los ve solo el dueño (o el soporte de C&C).
create policy api_tokens_select on public.api_tokens for select to authenticated
  using (organization_id in (select app.readable_organization_ids())
         and (app.is_owner(organization_id) or app.has_support_access(organization_id)));

revoke all on function
  public.set_property_listing_link(uuid, public.listing_channel, text),
  public.mercadolibre_save_connection(uuid, uuid, bigint, text, text, text, timestamptz),
  public.remove_mercadolibre_connection(uuid),
  public.mercadolibre_token_lease(uuid),
  public.mercadolibre_save_tokens(uuid, text, text, timestamptz),
  public.mercadolibre_mark_reauth(uuid),
  public.prepare_mercadolibre_listing(uuid, jsonb),
  public.mercadolibre_listing_result(uuid, public.listing_sync_status, text, text, text),
  public.unlink_mercadolibre_listing(uuid),
  public.create_api_token(uuid, text, text, text),
  public.revoke_api_token(uuid),
  public.api_feed_properties(text, timestamptz, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.set_property_listing_link(uuid, public.listing_channel, text),
  public.remove_mercadolibre_connection(uuid),
  public.prepare_mercadolibre_listing(uuid, jsonb),
  public.unlink_mercadolibre_listing(uuid),
  public.create_api_token(uuid, text, text, text),
  public.revoke_api_token(uuid)
to authenticated;

grant execute on function
  public.mercadolibre_save_connection(uuid, uuid, bigint, text, text, text, timestamptz),
  public.mercadolibre_token_lease(uuid),
  public.mercadolibre_save_tokens(uuid, text, text, timestamptz),
  public.mercadolibre_mark_reauth(uuid),
  public.mercadolibre_listing_result(uuid, public.listing_sync_status, text, text, text),
  public.api_feed_properties(text, timestamptz, integer, integer)
to service_role;
