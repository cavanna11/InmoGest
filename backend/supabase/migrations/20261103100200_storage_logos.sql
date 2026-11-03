-- =============================================================================
-- Incremento 1.1: logos de inmobiliarias en Storage (F-05).
-- Bucket público (los logos se muestran en páginas públicas), rutas "<organization_id>/<archivo>".
-- Solo el dueño de esa inmobiliaria, con la cuenta habilitada, sube, reemplaza o borra.
-- Sin SVG: puede contener scripts.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Inmobiliaria dueña de un objeto según su ruta; null si la ruta no empieza con un uuid válido.
create function app.storage_organization_id(p_name text) returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_first ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_first::uuid;
  end if;
  return null;
end;
$$;

revoke all on function app.storage_organization_id(text) from public;
grant execute on function app.storage_organization_id(text) to authenticated, service_role;

create policy logos_select on storage.objects for select to authenticated
  using (bucket_id = 'logos' and app.can_read(app.storage_organization_id(name)));
create policy logos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and app.is_owner(app.storage_organization_id(name))
    and app.can_write(app.storage_organization_id(name))
  );
create policy logos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and app.is_owner(app.storage_organization_id(name))
    and app.can_write(app.storage_organization_id(name))
  )
  with check (
    bucket_id = 'logos'
    and app.is_owner(app.storage_organization_id(name))
    and app.can_write(app.storage_organization_id(name))
  );
create policy logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and app.is_owner(app.storage_organization_id(name))
    and app.can_write(app.storage_organization_id(name))
  );
