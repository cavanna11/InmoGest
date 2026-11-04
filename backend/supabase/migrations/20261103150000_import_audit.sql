-- =============================================================================
-- Incremento 1.6: auditoría de importaciones (docs/DATABASE.md). La validación y el alta usan las
-- mismas reglas que la carga manual (create_contact, triggers de propiedades).
-- =============================================================================
create function public.log_import(p_organization_id uuid, p_kind text, p_imported integer, p_rejected integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (app.is_owner(p_organization_id) and app.can_write(p_organization_id)) then
    raise exception using errcode = '42501', message = 'only_owner_can_import';
  end if;
  if p_kind not in ('contactos', 'propiedades') then
    raise exception using errcode = '22023', message = 'invalid_kind';
  end if;
  perform app.audit('organization', p_organization_id, 'import.applied', 'import', p_kind,
                    jsonb_build_object('imported', p_imported, 'rejected', p_rejected));
end;
$$;

revoke all on function public.log_import(uuid, text, integer, integer) from public, anon;
grant execute on function public.log_import(uuid, text, integer, integer) to authenticated;
