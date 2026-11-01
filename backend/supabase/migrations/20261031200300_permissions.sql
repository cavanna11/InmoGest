-- =============================================================================
-- Funciones de permisos (docs/SECURITY.md, Tenancy) y «Ingresar como» (ADR 0003).
-- Todas SECURITY DEFINER con search_path vacío: consultan memberships/support_sessions sin pasar por
-- RLS (el dueño de las funciones tiene BYPASSRLS), lo que evita recursión en las políticas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Estado efectivo de la cuenta, calculado por fechas (no depende de que un job corra a tiempo).
--   deleted_at        → pending_deletion
--   suspended_at      → blocked
--   antes del fin     → active (si paid_until vigente) o trial
--   +30 días          → read_only
--   +120 días (30+90) → blocked
--   después           → pending_deletion (lo elimina el job de retención)
-- -----------------------------------------------------------------------------
create function app.organization_state(p_organization_id uuid) returns public.account_state
language sql
stable
security definer
set search_path = ''
as $$
  select (
    case
      when o.deleted_at is not null then 'pending_deletion'
      when o.suspended_at is not null then 'blocked'
      when now() < e.ends_at then
        case when o.paid_until is not null and now() < o.paid_until then 'active' else 'trial' end
      when now() < e.ends_at + interval '30 days' then 'read_only'
      when now() < e.ends_at + interval '120 days' then 'blocked'
      else 'pending_deletion'
    end
  )::public.account_state
  from public.organizations o
  cross join lateral (select greatest(o.trial_ends_at, o.paid_until) as ends_at) e
  where o.id = p_organization_id;
$$;

-- -----------------------------------------------------------------------------
-- Plataforma
-- -----------------------------------------------------------------------------
create function app.is_platform_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function app.is_principal() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid() and is_principal);
$$;

-- Inmobiliaria de la sesión de soporte abierta del superadministrador principal (o null).
create function app.support_organization_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.organization_id
  from public.support_sessions s
  join public.platform_admins pa on pa.user_id = s.user_id and pa.is_principal
  where s.user_id = auth.uid() and s.ended_at is null;
$$;

create function app.has_support_access(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null and app.support_organization_id() is not distinct from p_organization_id;
$$;

-- -----------------------------------------------------------------------------
-- Inmobiliaria
-- -----------------------------------------------------------------------------
create function app.is_member(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_support_access(p_organization_id)
    or exists (
      select 1 from public.memberships
      where organization_id = p_organization_id and user_id = auth.uid() and status = 'active'
    );
$$;

create function app.is_owner(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_support_access(p_organization_id)
    or exists (
      select 1 from public.memberships
      where organization_id = p_organization_id and user_id = auth.uid()
        and status = 'active' and role = 'owner'
    );
$$;

-- Lectura: miembro activo y cuenta no bloqueada. La sesión de soporte ignora el estado.
create function app.can_read(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_support_access(p_organization_id)
    or (
      app.is_member(p_organization_id)
      and app.organization_state(p_organization_id) not in ('blocked', 'pending_deletion')
    );
$$;

-- Escritura: miembro activo y cuenta en prueba o activa. La sesión de soporte ignora el estado.
create function app.can_write(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_support_access(p_organization_id)
    or (
      app.is_member(p_organization_id)
      and app.organization_state(p_organization_id) in ('trial', 'active')
    );
$$;

revoke all on function
  app.organization_state(uuid), app.is_platform_admin(), app.is_principal(),
  app.support_organization_id(), app.has_support_access(uuid),
  app.is_member(uuid), app.is_owner(uuid), app.can_read(uuid), app.can_write(uuid),
  app.set_updated_at(), app.is_privileged_role()
from public;

grant execute on function
  app.organization_state(uuid), app.is_platform_admin(), app.is_principal(),
  app.support_organization_id(), app.has_support_access(uuid),
  app.is_member(uuid), app.is_owner(uuid), app.can_read(uuid), app.can_write(uuid),
  app.is_privileged_role()
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: «Ingresar como» (CU-16). Solo el superadministrador principal.
-- Abre una sesión en la inmobiliaria indicada y cierra cualquier otra abierta (una por vez).
-- -----------------------------------------------------------------------------
create function public.start_support_session(p_organization_id uuid) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  update public.support_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.support_sessions (user_id, organization_id)
  values (auth.uid(), p_organization_id)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- Cierra la sesión de soporte abierta. Devuelve false si no había ninguna.
create function public.end_support_session() returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  update public.support_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;
  return found;
end;
$$;

-- Inmobiliaria de la sesión de soporte abierta (null si no hay). La app la usa como inmobiliaria activa.
create function public.current_support_organization() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app.support_organization_id();
$$;

-- -----------------------------------------------------------------------------
-- RPC: inmobiliarias del usuario con su rol y estado efectivo, incluso bloqueadas, para que la app
-- muestre el selector y el motivo cuando no puede entrar (F-02, F-27).
-- -----------------------------------------------------------------------------
create function public.my_organizations()
returns table (
  organization_id uuid,
  name text,
  slug text,
  role public.member_role,
  state public.account_state
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, m.role, app.organization_state(o.id)
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by o.name;
$$;

revoke all on function
  public.start_support_session(uuid), public.end_support_session(),
  public.current_support_organization(), public.my_organizations()
from public, anon;

grant execute on function
  public.start_support_session(uuid), public.end_support_session(),
  public.current_support_organization(), public.my_organizations()
to authenticated;
