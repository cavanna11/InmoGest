-- =============================================================================
-- Incremento 1.1: lista de miembros para la pantalla de equipo (F-04). El email vive en auth.users,
-- que la API no expone: esta función lo devuelve SOLO al dueño de esa inmobiliaria (o a la sesión de
-- soporte), con la cuenta legible. Para cualquier otro devuelve vacío.
-- =============================================================================

create function public.organization_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.member_role,
  status public.membership_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, coalesce(p.full_name, ''), u.email::text, m.role, m.status, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_organization_id
    and app.is_owner(p_organization_id)
    and app.can_read(p_organization_id)
  order by m.status, m.role desc, coalesce(p.full_name, ''), u.email;
$$;

revoke all on function public.organization_members(uuid) from public, anon;
grant execute on function public.organization_members(uuid) to authenticated;
