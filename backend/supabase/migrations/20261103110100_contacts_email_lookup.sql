-- =============================================================================
-- Corrección de create_contact: con search_path vacío, "=" entre citext no resuelve el operador
-- de la extensión y compara como texto (sensible a mayúsculas). El chequeo de email existente
-- compara en minúsculas. La unicidad de la tabla ya era insensible (índice citext).
-- =============================================================================

create or replace function public.create_contact(
  p_organization_id uuid,
  p_full_name text,
  p_phones text[] default '{}',
  p_emails text[] default '{}',
  p_notes text default '',
  p_is_prospect boolean default true,
  p_is_owner boolean default false,
  p_assigned_user_id uuid default null,
  p_source public.contact_source default 'manual'
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing uuid;
  v_id uuid;
begin
  select contact_id into v_existing from public.contact_phones
  where organization_id = p_organization_id and phone_e164 = any (p_phones) limit 1;
  if v_existing is null then
    select contact_id into v_existing from public.contact_emails
    where organization_id = p_organization_id
      and lower(email::text) = any (select lower(e) from unnest(p_emails) as e) limit 1;
  end if;
  if v_existing is not null then
    raise exception using errcode = 'IG011', message = 'contact_exists', detail = v_existing::text;
  end if;

  insert into public.contacts (organization_id, full_name, notes, is_prospect, is_owner, assigned_user_id, source, created_by)
  values (p_organization_id, btrim(p_full_name), coalesce(p_notes, ''), p_is_prospect, p_is_owner,
          p_assigned_user_id, p_source, auth.uid())
  returning id into v_id;

  insert into public.contact_phones (organization_id, contact_id, phone_e164)
  select p_organization_id, v_id, phone from unnest(p_phones) as phone group by phone;
  insert into public.contact_emails (organization_id, contact_id, email)
  select p_organization_id, v_id, email from unnest(p_emails::extensions.citext[]) as email group by email;
  return v_id;
end;
$$;
