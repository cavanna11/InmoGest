-- =============================================================================
-- Reglas de negocio en la base (docs/DATABASE.md, "Reglas en la base"):
--   último dueño, límites de plan, columnas de plataforma protegidas, claves inmutables y auditoría.
-- Códigos de error propios (traducidos en backend/shared/src/db-errors.ts):
--   IG001 límite del plan · IG003 último dueño · IG004 solo la plataforma
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auditoría: helper interno
-- -----------------------------------------------------------------------------
create function app.audit(
  p_scope public.audit_scope,
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_logs
    (scope, organization_id, actor_user_id, via_support_session, action, entity_type, entity_id, metadata)
  values (
    p_scope, p_organization_id, auth.uid(),
    p_organization_id is not null and app.has_support_access(p_organization_id),
    p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  );
$$;

revoke all on function app.audit(public.audit_scope, uuid, text, text, text, jsonb) from public;

-- -----------------------------------------------------------------------------
-- Último dueño activo (PRD §6). Aplica a todos, incluido el superadministrador y service_role.
-- El "for update" serializa bajas concurrentes de dos dueños: la segunda ve la primera ya aplicada.
-- -----------------------------------------------------------------------------
create function app.enforce_last_owner() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;
  -- Borrado en cascada de la inmobiliaria completa (retención): no hay dueño que conservar.
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then
    return old;
  end if;

  perform 1 from public.memberships
  where organization_id = old.organization_id and id <> old.id
    and role = 'owner' and status = 'active'
  for update;

  if not found then
    raise exception using
      errcode = 'IG003',
      message = 'last_owner',
      hint = 'La inmobiliaria tiene que conservar al menos un dueño activo.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_enforce_last_owner
  before update or delete on public.memberships
  for each row execute function app.enforce_last_owner();

-- -----------------------------------------------------------------------------
-- Límites de plan (F-26). Se leen de plans en cada operación: un cambio del superadministrador
-- aplica sin desplegar (F-29). Nunca se borran datos existentes.
-- Recursos: users (membresías activas + invitaciones abiertas), properties y whatsapp_numbers
-- (sus triggers se agregan con esas tablas en la Fase 1).
-- La sesión de soporte no tiene restricciones (PRD §6, «Ingresar como»).
-- -----------------------------------------------------------------------------
create function app.plan_limit(p_organization_id uuid, p_resource text) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_resource
    when 'users' then p.max_users
    when 'properties' then p.max_properties
    -- Sin definir: se permite 1 hasta que el superadministrador lo configure (docs/DATABASE.md).
    when 'whatsapp_numbers' then coalesce(p.max_whatsapp_numbers, 1)
  end
  from public.organizations o
  join public.plans p on p.code = o.plan_code
  where o.id = p_organization_id;
$$;

create function app.user_slots_used(p_organization_id uuid) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.memberships
      where organization_id = p_organization_id and status = 'active')
    +
    (select count(*) from public.invitations
      where organization_id = p_organization_id
        and accepted_at is null and revoked_at is null and expires_at > now())
  )::integer;
$$;

create function app.raise_plan_limit(p_organization_id uuid, p_resource text, p_limit integer) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_name text;
begin
  select p.name into v_plan_name
  from public.organizations o join public.plans p on p.code = o.plan_code
  where o.id = p_organization_id;

  raise exception using
    errcode = 'IG001',
    message = 'plan_limit_reached',
    detail = jsonb_build_object('resource', p_resource, 'limit', p_limit, 'plan', v_plan_name)::text;
end;
$$;

-- Trigger para memberships (alta o reactivación) e invitations (alta).
create function app.enforce_user_limit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  if tg_table_name = 'memberships' then
    if new.status <> 'active' then return new; end if;
    if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  end if;
  if app.has_support_access(new.organization_id) then
    return new;
  end if;

  -- Serializa altas concurrentes en la misma inmobiliaria.
  perform 1 from public.organizations where id = new.organization_id for update;

  v_limit := app.plan_limit(new.organization_id, 'users');
  if app.user_slots_used(new.organization_id) >= v_limit then
    perform app.raise_plan_limit(new.organization_id, 'users', v_limit);
  end if;
  return new;
end;
$$;

create trigger memberships_enforce_user_limit
  before insert or update of status on public.memberships
  for each row execute function app.enforce_user_limit();

create trigger invitations_enforce_user_limit
  before insert on public.invitations
  for each row execute function app.enforce_user_limit();

-- -----------------------------------------------------------------------------
-- Columnas de plataforma en organizations: plan y estado de cuenta solo los cambia C&C
-- (superadministrador principal o procesos del servidor). PRD §6: "Solo C&C cambia plan y estado".
-- Los cambios quedan en la auditoría de plataforma.
-- -----------------------------------------------------------------------------
create function app.protect_organization_platform_columns() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if new.id <> old.id then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;

  if new.plan_code is distinct from old.plan_code then
    v_changes := v_changes || jsonb_build_object('plan_code', jsonb_build_array(old.plan_code, new.plan_code));
  end if;
  if new.trial_ends_at is distinct from old.trial_ends_at then
    v_changes := v_changes || jsonb_build_object('trial_ends_at', jsonb_build_array(old.trial_ends_at, new.trial_ends_at));
  end if;
  if new.paid_until is distinct from old.paid_until then
    v_changes := v_changes || jsonb_build_object('paid_until', jsonb_build_array(old.paid_until, new.paid_until));
  end if;
  if new.suspended_at is distinct from old.suspended_at then
    v_changes := v_changes || jsonb_build_object('suspended_at', jsonb_build_array(old.suspended_at, new.suspended_at));
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    v_changes := v_changes || jsonb_build_object('deleted_at', jsonb_build_array(old.deleted_at, new.deleted_at));
  end if;
  if new.created_by is distinct from old.created_by then
    v_changes := v_changes || jsonb_build_object('created_by', true);
  end if;

  if v_changes = '{}'::jsonb then
    return new;
  end if;
  if not (app.is_privileged_role() or app.is_principal()) then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;

  perform app.audit('platform', new.id, 'organization.platform_updated', 'organization', new.id::text, v_changes);
  return new;
end;
$$;

create trigger organizations_protect_platform_columns
  before update on public.organizations
  for each row execute function app.protect_organization_platform_columns();

-- -----------------------------------------------------------------------------
-- Claves inmutables: una membresía o invitación no se puede mover de inmobiliaria ni de usuario.
-- -----------------------------------------------------------------------------
create function app.prevent_tenant_key_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception using errcode = '42501', message = 'organization_id is immutable';
  end if;
  if tg_table_name = 'memberships' and new.user_id <> old.user_id then
    raise exception using errcode = '42501', message = 'user_id is immutable';
  end if;
  return new;
end;
$$;

create trigger memberships_prevent_key_change before update on public.memberships
  for each row execute function app.prevent_tenant_key_change();
create trigger invitations_prevent_key_change before update on public.invitations
  for each row execute function app.prevent_tenant_key_change();

-- -----------------------------------------------------------------------------
-- Auditoría de miembros e invitaciones (docs/OBSERVABILITY.md)
-- -----------------------------------------------------------------------------
create function app.audit_membership() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit('organization', new.organization_id, 'member.added', 'membership', new.id::text,
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
  elsif tg_op = 'UPDATE' then
    if new.role <> old.role then
      perform app.audit('organization', new.organization_id, 'member.role_changed', 'membership', new.id::text,
        jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role));
    end if;
    if new.status <> old.status then
      perform app.audit('organization', new.organization_id,
        case new.status when 'active' then 'member.reactivated' else 'member.deactivated' end,
        'membership', new.id::text, jsonb_build_object('user_id', new.user_id));
    end if;
  elsif exists (select 1 from public.organizations where id = old.organization_id) then
    perform app.audit('organization', old.organization_id, 'member.removed', 'membership', old.id::text,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function app.audit_membership();

create function app.audit_invitation() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit('organization', new.organization_id, 'invitation.created', 'invitation', new.id::text,
      jsonb_build_object('role', new.role));
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform app.audit('organization', new.organization_id, 'invitation.revoked', 'invitation', new.id::text);
  elsif new.accepted_at is not null and old.accepted_at is null then
    perform app.audit('organization', new.organization_id, 'invitation.accepted', 'invitation', new.id::text,
      jsonb_build_object('user_id', new.accepted_by));
  end if;
  return new;
end;
$$;

create trigger invitations_audit after insert or update on public.invitations
  for each row execute function app.audit_invitation();

-- -----------------------------------------------------------------------------
-- Auditoría de plataforma: planes y configuración global (F-29)
-- -----------------------------------------------------------------------------
create function app.audit_platform_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- to_jsonb evita referenciar columnas que no existen en todas las tablas (plans tiene code; platform_settings no).
  perform app.audit('platform', null, tg_table_name || '.updated', tg_table_name,
    to_jsonb(new) ->> 'code',
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  return new;
end;
$$;

create trigger plans_audit after update on public.plans
  for each row execute function app.audit_platform_change();
create trigger platform_settings_audit after update on public.platform_settings
  for each row execute function app.audit_platform_change();

revoke all on function
  app.plan_limit(uuid, text), app.user_slots_used(uuid), app.raise_plan_limit(uuid, text, integer),
  app.enforce_last_owner(), app.enforce_user_limit(), app.protect_organization_platform_columns(),
  app.prevent_tenant_key_change(), app.audit_membership(), app.audit_invitation(),
  app.audit_platform_change(), app.handle_new_user(), app.bump_platform_settings_version()
from public;

grant execute on function app.plan_limit(uuid, text), app.user_slots_used(uuid) to authenticated, service_role;

-- protect_organization_platform_columns es SECURITY INVOKER (necesita saber qué rol invoca) y
-- registra auditoría: authenticated necesita ejecutar app.audit. El esquema app no está expuesto
-- por la API, así que no se puede llamar desde afuera.
grant execute on function app.audit(public.audit_scope, uuid, text, text, text, jsonb) to authenticated, service_role;
