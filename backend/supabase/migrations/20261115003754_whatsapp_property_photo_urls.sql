-- =============================================================================
-- send_property_whatsapp: las fotos solo pueden ser fotos de ESA propiedad.
-- Antes la RPC aceptaba cualquier URL en p_photo_urls (la Server Action las armaba bien, pero la RPC
-- se puede llamar directo desde el navegador): Evolution descargaría la URL desde el VPS (SSRF hacia
-- su red interna o el endpoint de metadatos de la nube).
-- Ahora cada URL tiene que ser exactamente la URL pública de Storage de una foto de la propiedad:
--   https://<ref>.supabase.co/storage/v1/object/public/property-images/<storage_path>
--   http://127.0.0.1:54321/... o http://localhost:54321/... (Supabase local)
-- El host queda limitado a Supabase; la ruta, a una foto registrada de esa propiedad e inmobiliaria.
-- Si algún día se usa un dominio propio para Supabase (docs/DEPLOYMENT.md), agregarlo acá.
-- Misma firma: create or replace conserva los permisos (solo authenticated).
-- =============================================================================

create or replace function public.send_property_whatsapp(
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
  v_path text;
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

  -- Cada foto: host de Supabase y ruta de una foto registrada de esta propiedad.
  foreach v_url in array coalesce(p_photo_urls, '{}') loop
    v_path := substring(
      v_url from '^(?:https://[a-z0-9-]+\.supabase\.co|http://(?:127\.0\.0\.1|localhost):54321)/storage/v1/object/public/property-images/([A-Za-z0-9_./-]+)$'
    );
    if v_path is null or v_path like '%..%' or not exists (
      select 1 from public.property_images i
      where i.organization_id = v_conversation.organization_id
        and i.property_id = p_property_id
        and i.storage_path = v_path
    ) then
      raise exception using errcode = '23514', message = 'invalid_property_photo';
    end if;
  end loop;

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
