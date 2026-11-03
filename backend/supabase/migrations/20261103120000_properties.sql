-- =============================================================================
-- Incremento 1.3: propiedades y página pública (F-08, F-09, F-10, límite de propiedades del plan).
-- - Código interno por inmobiliaria (PRO-000123) y slug estable para la URL pública
--   /p/<slug-inmobiliaria>/<slug-propiedad>: el slug no cambia aunque cambie el título.
-- - Precio con moneda explícita (ADR 0006); historial de precio y estado (property_changes).
-- - Propietarios: contactos de la misma inmobiliaria (claves compuestas); al vincularlos quedan
--   marcados como propietarios.
-- - Posibles duplicados: misma dirección, o mismos propietario, operación y tipo. Se avisa, no se
--   impide guardar. Solo el dueño fusiona (merge_properties).
-- - Fotos en el bucket público "property-images", rutas "<organization_id>/<property_id>/<archivo>".
-- - Página pública: public_property() devuelve solo campos publicables, nunca borradores ni pausadas;
--   la dirección exacta solo si la inmobiliaria lo eligió.
-- Código de error propio: IG014 fusión de propiedades no válida. El límite del plan usa IG001.
-- =============================================================================

create type public.property_operation as enum ('sale', 'rent', 'temporary_rent');
create type public.property_type as enum (
  'apartment', 'house', 'ph', 'land', 'office', 'commercial', 'garage', 'warehouse', 'farm'
);
create type public.property_status as enum ('draft', 'available', 'reserved', 'sold', 'rented', 'paused');

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Número correlativo por inmobiliaria; lo asigna properties_before_insert.
  seq integer not null default 0 check (seq > 0),
  code text generated always as ('PRO-' || lpad(seq::text, 6, '0')) stored,
  slug text not null default '' check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 8000),
  operation public.property_operation not null,
  property_type public.property_type not null,
  status public.property_status not null default 'draft',
  price numeric(14,2) check (price is null or price > 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD')),
  expenses numeric(14,2) check (expenses is null or expenses >= 0),
  expenses_currency text not null default 'ARS' check (expenses_currency in ('ARS', 'USD')),
  province text not null default '' check (char_length(province) <= 80),
  city text not null default '' check (char_length(city) <= 80),
  neighborhood text not null default '' check (char_length(neighborhood) <= 80),
  address text not null default '' check (char_length(address) <= 160),
  show_address boolean not null default false,
  rooms smallint check (rooms is null or rooms between 0 and 99),
  bedrooms smallint check (bedrooms is null or bedrooms between 0 and 99),
  bathrooms smallint check (bathrooms is null or bathrooms between 0 and 99),
  covered_area_m2 numeric(10,2) check (covered_area_m2 is null or covered_area_m2 > 0),
  total_area_m2 numeric(10,2) check (total_area_m2 is null or total_area_m2 > 0),
  -- Características (cochera, balcón, pileta…): claves de un catálogo de la app.
  features text[] not null default '{}' check (cardinality(features) <= 40),
  assigned_user_id uuid,
  merged_into_id uuid,
  merged_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, seq),
  unique (organization_id, slug),
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id),
  foreign key (organization_id, merged_into_id) references public.properties (organization_id, id),
  check ((merged_into_id is null) = (merged_at is null)),
  check (merged_into_id is distinct from id),
  -- Para publicar hace falta precio.
  check (status in ('draft', 'paused') or price is not null)
);

create index properties_org_updated on public.properties (organization_id, updated_at desc) where merged_into_id is null;
create index properties_org_status on public.properties (organization_id, status, operation, property_type) where merged_into_id is null;
create index properties_title_trgm on public.properties using gin (lower(title) extensions.gin_trgm_ops);

create table public.property_owners (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (property_id, contact_id),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade
);

create index property_owners_contact on public.property_owners (contact_id);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  storage_path text not null check (char_length(storage_path) <= 300),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (storage_path),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  -- La ruta tiene que estar dentro de la carpeta de la inmobiliaria (al fusionar, las fotos cambian
  -- de propiedad pero conservan su ruta).
  check (storage_path like organization_id::text || '/%')
);

create index property_images_property on public.property_images (property_id, position);

-- Historial de precio y estado (PRD §6). Lo escribe la base.
create table public.property_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  field text not null check (field in ('created', 'price', 'status', 'merged')),
  old_value jsonb,
  new_value jsonb,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade
);

create index property_changes_property on public.property_changes (organization_id, property_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger properties_set_updated_at before update on public.properties
  for each row execute function app.set_updated_at();
create trigger properties_prevent_key_change before update on public.properties
  for each row execute function app.prevent_tenant_key_change();
create trigger property_owners_prevent_key_change before update on public.property_owners
  for each row execute function app.prevent_tenant_key_change();
create trigger property_images_prevent_key_change before update on public.property_images
  for each row execute function app.prevent_tenant_key_change();
create trigger property_changes_prevent_key_change before update on public.property_changes
  for each row execute function app.prevent_tenant_key_change();

-- Alta: límite de propiedades del plan (IG001), número correlativo y slug "<base>-<número>".
create function app.properties_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_base text;
begin
  -- Serializa altas concurrentes de la misma inmobiliaria (límite y correlativo).
  perform 1 from public.organizations where id = new.organization_id for update;

  if not app.has_support_access(new.organization_id) then
    v_limit := app.plan_limit(new.organization_id, 'properties');
    if (select count(*) from public.properties
        where organization_id = new.organization_id and merged_into_id is null) >= v_limit then
      perform app.raise_plan_limit(new.organization_id, 'properties', v_limit);
    end if;
  end if;

  new.seq := coalesce((select max(seq) from public.properties where organization_id = new.organization_id), 0) + 1;
  -- La app manda un slug base ya normalizado (@inmogest/shared slugify); si no, "propiedad".
  v_base := left(coalesce(nullif(new.slug, ''), 'propiedad'), 70);
  if v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    v_base := 'propiedad';
  end if;
  new.slug := v_base || '-' || new.seq::text;
  new.merged_into_id := null;
  new.merged_at := null;
  new.published_at := case when new.status in ('draft', 'paused') then null else now() end;
  return new;
end;
$$;

create trigger properties_before_insert before insert on public.properties
  for each row execute function app.properties_before_insert();

-- Edición: el correlativo y el slug no cambian (los links compartidos siguen funcionando). La
-- asignación sigue la misma regla que en contactos (IG012). Registra cuándo se publicó.
create function app.properties_before_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.seq := old.seq;
  new.slug := old.slug;
  if new.status not in ('draft', 'paused') and old.status in ('draft', 'paused') then
    new.published_at := now();
  end if;

  if new.assigned_user_id is distinct from old.assigned_user_id and new.assigned_user_id is not null then
    perform 1 from public.memberships
    where organization_id = new.organization_id and user_id = new.assigned_user_id and status = 'active';
    if not found then
      raise exception using errcode = '23503', message = 'assignee_not_active_member';
    end if;
  end if;
  if new.assigned_user_id is distinct from old.assigned_user_id
     and auth.uid() is not null
     and not app.is_owner(new.organization_id)
     and not (old.assigned_user_id is null and new.assigned_user_id = auth.uid())
     and not exists (select 1 from public.organizations where id = new.organization_id and agents_can_reassign) then
    raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
  end if;
  return new;
end;
$$;

create trigger properties_before_update before update on public.properties
  for each row execute function app.properties_before_update();

-- Asignación al crear: miembro activo; un agente sin la capacidad solo puede asignarse a sí mismo.
create function app.properties_check_assignee() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_user_id is null then
    return new;
  end if;
  perform 1 from public.memberships
  where organization_id = new.organization_id and user_id = new.assigned_user_id and status = 'active';
  if not found then
    raise exception using errcode = '23503', message = 'assignee_not_active_member';
  end if;
  if auth.uid() is not null and new.assigned_user_id <> auth.uid() and not app.is_owner(new.organization_id)
     and not exists (select 1 from public.organizations where id = new.organization_id and agents_can_reassign) then
    raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
  end if;
  return new;
end;
$$;

create trigger properties_check_assignee before insert on public.properties
  for each row execute function app.properties_check_assignee();

create function app.properties_log_changes() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.property_changes (organization_id, property_id, field, new_value, author_id)
    values (new.organization_id, new.id, 'created',
            jsonb_build_object('status', new.status, 'price', new.price, 'currency', new.currency), auth.uid());
    return new;
  end if;
  if new.price is distinct from old.price or new.currency is distinct from old.currency then
    insert into public.property_changes (organization_id, property_id, field, old_value, new_value, author_id)
    values (new.organization_id, new.id, 'price',
            jsonb_build_object('price', old.price, 'currency', old.currency),
            jsonb_build_object('price', new.price, 'currency', new.currency), auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into public.property_changes (organization_id, property_id, field, old_value, new_value, author_id)
    values (new.organization_id, new.id, 'status', to_jsonb(old.status), to_jsonb(new.status), auth.uid());
  end if;
  return new;
end;
$$;

create trigger properties_log_changes after insert or update on public.properties
  for each row execute function app.properties_log_changes();

-- Un contacto vinculado como propietario queda marcado como tal (PRD §6: interesado, propietario o ambos).
create function app.property_owners_mark_contact() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contacts set is_owner = true
  where organization_id = new.organization_id and id = new.contact_id and not is_owner and merged_into_id is null;
  return new;
end;
$$;

create trigger property_owners_mark_contact after insert on public.property_owners
  for each row execute function app.property_owners_mark_contact();

-- -----------------------------------------------------------------------------
-- Posibles duplicados (F-09): misma dirección (sin importar mayúsculas ni espacios), o mismos
-- propietario, operación y tipo. SECURITY INVOKER: solo ve lo que el usuario puede ver.
-- -----------------------------------------------------------------------------
create function public.property_duplicate_candidates(
  p_organization_id uuid,
  p_address text,
  p_operation public.property_operation,
  p_property_type public.property_type,
  p_owner_ids uuid[] default '{}',
  p_exclude_id uuid default null
) returns table (id uuid, code text, title text, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.code, p.title,
    case
      when nullif(btrim(p_address), '') is not null
           and lower(regexp_replace(btrim(p.address), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_address), '\s+', ' ', 'g'))
        then 'same_address'
      else 'same_owner'
    end
  from public.properties p
  where p.organization_id = p_organization_id
    and p.merged_into_id is null
    and (p_exclude_id is null or p.id <> p_exclude_id)
    and (
      (nullif(btrim(p_address), '') is not null
        and lower(regexp_replace(btrim(p.address), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_address), '\s+', ' ', 'g')))
      or (p.operation = p_operation and p.property_type = p_property_type
          and exists (select 1 from public.property_owners o where o.property_id = p.id and o.contact_id = any (p_owner_ids)))
    )
  order by p.seq desc
  limit 10;
$$;

-- -----------------------------------------------------------------------------
-- Fusión (F-09): solo el dueño. La que queda conserva fotos, propietarios e historial de ambas;
-- la otra deja de listarse. Las coincidencias (1.4) se agregan acá en ese incremento.
-- -----------------------------------------------------------------------------
create function public.merge_properties(p_keep_id uuid, p_merge_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.properties;
  v_merge public.properties;
  v_next_position integer;
begin
  select * into v_keep from public.properties where id = p_keep_id for update;
  select * into v_merge from public.properties where id = p_merge_id for update;
  if v_keep.id is null or v_merge.id is null or v_keep.organization_id <> v_merge.organization_id
     or p_keep_id = p_merge_id or v_keep.merged_into_id is not null or v_merge.merged_into_id is not null then
    raise exception using errcode = 'IG014', message = 'invalid_merge';
  end if;
  if not (app.is_owner(v_keep.organization_id) and app.can_write(v_keep.organization_id)) then
    raise exception using errcode = '42501', message = 'only_owner_can_merge';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_position from public.property_images where property_id = p_keep_id;
  update public.property_images set property_id = p_keep_id, position = position + v_next_position
  where property_id = p_merge_id;
  insert into public.property_owners (organization_id, property_id, contact_id)
  select organization_id, p_keep_id, contact_id from public.property_owners where property_id = p_merge_id
  on conflict do nothing;
  delete from public.property_owners where property_id = p_merge_id;
  update public.property_changes set property_id = p_keep_id where property_id = p_merge_id;

  update public.properties set
    description = case when description = '' then v_merge.description else description end,
    features = array(select distinct unnest(features || v_merge.features))
  where id = p_keep_id;
  update public.properties set merged_into_id = p_keep_id, merged_at = now(), status = 'paused', assigned_user_id = null
  where id = p_merge_id;

  insert into public.property_changes (organization_id, property_id, field, new_value, author_id)
  values (v_keep.organization_id, p_keep_id, 'merged',
          jsonb_build_object('merged_id', p_merge_id, 'merged_code', v_merge.code), auth.uid());
  perform app.audit('organization', v_keep.organization_id, 'property.merged', 'property', p_keep_id::text,
                    jsonb_build_object('merged_id', p_merge_id));
  return p_keep_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Página pública (F-10). Anónima: solo campos publicables, sin propietarios ni datos internos.
-- -----------------------------------------------------------------------------
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
  images text[]
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
    array(select i.storage_path from public.property_images i where i.property_id = p.id order by i.position, i.created_at)
  from public.organizations o
  join public.properties p on p.organization_id = o.id
  where o.slug = p_organization_slug
    and p.slug = p_property_slug
    and p.merged_into_id is null
    and p.status not in ('draft', 'paused')
    and o.deleted_at is null
    and app.organization_state(o.id) not in ('blocked', 'pending_deletion');
$$;

-- -----------------------------------------------------------------------------
-- RLS. Todos los miembros ven y editan todas las propiedades (PRD §6); no se borran (se pausan).
-- -----------------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.properties force row level security;
alter table public.property_owners enable row level security;
alter table public.property_owners force row level security;
alter table public.property_images enable row level security;
alter table public.property_images force row level security;
alter table public.property_changes enable row level security;
alter table public.property_changes force row level security;

revoke all on public.properties, public.property_owners, public.property_images, public.property_changes
  from anon, authenticated;
grant select, insert, update on public.properties to authenticated;
grant select, insert, delete on public.property_owners to authenticated;
grant select, insert, update, delete on public.property_images to authenticated;
grant select on public.property_changes to authenticated;
grant all on public.properties, public.property_owners, public.property_images, public.property_changes to service_role;

create policy properties_select on public.properties for select to authenticated
  using (app.can_read(organization_id));
create policy properties_insert on public.properties for insert to authenticated
  with check (app.can_write(organization_id) and merged_into_id is null);
create policy properties_update on public.properties for update to authenticated
  using (app.can_write(organization_id) and merged_into_id is null)
  with check (app.can_write(organization_id) and merged_into_id is null);

create policy property_owners_select on public.property_owners for select to authenticated
  using (app.can_read(organization_id));
create policy property_owners_insert on public.property_owners for insert to authenticated
  with check (app.can_write(organization_id));
create policy property_owners_delete on public.property_owners for delete to authenticated
  using (app.can_write(organization_id));

create policy property_images_select on public.property_images for select to authenticated
  using (app.can_read(organization_id));
create policy property_images_write on public.property_images for all to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));

create policy property_changes_select on public.property_changes for select to authenticated
  using (app.can_read(organization_id));

-- -----------------------------------------------------------------------------
-- Storage: fotos públicas (las muestra la página pública); suben y borran los miembros con la
-- cuenta habilitada. Sin SVG (puede contener scripts).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy property_images_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'property-images' and app.can_read(app.storage_organization_id(name)));
create policy property_images_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images' and app.can_write(app.storage_organization_id(name)));
create policy property_images_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'property-images' and app.can_write(app.storage_organization_id(name)))
  with check (bucket_id = 'property-images' and app.can_write(app.storage_organization_id(name)));
create policy property_images_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'property-images' and app.can_write(app.storage_organization_id(name)));

revoke all on function app.properties_before_insert(), app.properties_before_update(), app.properties_check_assignee(),
  app.properties_log_changes(), app.property_owners_mark_contact() from public;
revoke all on function public.property_duplicate_candidates(uuid, text, public.property_operation, public.property_type, uuid[], uuid) from public, anon;
grant execute on function public.property_duplicate_candidates(uuid, text, public.property_operation, public.property_type, uuid[], uuid) to authenticated;
revoke all on function public.merge_properties(uuid, uuid) from public, anon;
grant execute on function public.merge_properties(uuid, uuid) to authenticated;
revoke all on function public.public_property(text, text) from public;
grant execute on function public.public_property(text, text) to anon, authenticated;
