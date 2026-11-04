-- =============================================================================
-- Súper panel de C&C: alta de inmobiliarias desde la plataforma, baja y eliminación de cuentas,
-- actividad y equipo de plataforma. Todo lo escribe el superadministrador principal; cada acción queda
-- auditada con scope = platform.
-- - Baja (deleted_at): nadie de la inmobiliaria puede ingresar; los datos se conservan y se puede
--   restaurar. Eliminación definitiva: solo sobre una cuenta dada de baja y escribiendo su nombre.
-- - El dueño de una inmobiliaria creada desde la plataforma acepta los términos al primer ingreso
--   (la aceptación es de esa persona: C&C no la hace en su nombre, ADR 0009).
-- =============================================================================

-- Ahora también devuelve las dadas de baja, para poder restaurarlas o eliminarlas.
drop function public.platform_organizations();

create function public.platform_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  plan_code text,
  state public.account_state,
  trial_ends_at timestamptz,
  paid_until timestamptz,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  owner_email text,
  users_count integer,
  properties_count integer,
  contacts_count integer,
  pending_payments integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return query
  select o.id, o.name, o.slug, o.plan_code, app.organization_state(o.id), o.trial_ends_at, o.paid_until, o.suspended_at, o.deleted_at, o.created_at,
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
     where m.organization_id = o.id and m.role = 'owner' and m.status = 'active' order by m.created_at limit 1),
    (select count(*)::integer from public.memberships m where m.organization_id = o.id and m.status = 'active'),
    (select count(*)::integer from public.properties p where p.organization_id = o.id and p.merged_into_id is null),
    (select count(*)::integer from public.contacts c where c.organization_id = o.id and c.merged_into_id is null),
    (select count(*)::integer from public.payment_reports r where r.organization_id = o.id and r.status = 'pending')
  from public.organizations o
  order by o.created_at desc
  limit 1000;
end;
$$;

-- Usuario por email, para saber si el dueño de una inmobiliaria nueva ya tiene cuenta.
create function public.platform_find_user(p_email text) returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return (select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1);
end;
$$;

-- Alta desde la plataforma: mismo resultado que create_organization (embudo y asistente), con el plan y
-- los días de prueba que elige C&C, y sin aceptación de términos: la hace el dueño al primer ingreso.
create function public.platform_create_organization(
  p_name text,
  p_slug_base text,
  p_owner_user_id uuid,
  p_plan_code text,
  p_trial_days integer default 14
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_org uuid;
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_name';
  end if;
  if p_slug_base is null or p_slug_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug_base) > 60 then
    raise exception using errcode = '22023', message = 'invalid_slug';
  end if;
  if p_trial_days is null or p_trial_days not between 0 and 365 then
    raise exception using errcode = '22023', message = 'invalid_trial_days';
  end if;

  insert into public.organizations (name, slug, plan_code, trial_ends_at, created_by)
  values (v_name, app.available_organization_slug(p_slug_base), p_plan_code, now() + make_interval(days => p_trial_days), p_owner_user_id)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role) values (v_org, p_owner_user_id, 'owner');

  insert into public.pipeline_stages (organization_id, name, position, kind) values
    (v_org, 'Nuevo contacto', 0, 'open'),
    (v_org, 'Primer contacto', 1, 'open'),
    (v_org, 'Calificado', 2, 'open'),
    (v_org, 'Visita coordinada', 3, 'open'),
    (v_org, 'Negociación', 4, 'open'),
    (v_org, 'Cerrado ganado', 5, 'won'),
    (v_org, 'Cerrado perdido', 6, 'lost');

  insert into public.onboarding_progress (organization_id, step)
  select v_org, step from unnest(array['organization', 'team', 'whatsapp', 'data']) as step;

  perform app.audit('platform', v_org, 'organization.created_by_platform', 'organization', v_org::text,
                    jsonb_build_object('plan_code', p_plan_code, 'trial_days', p_trial_days));
  return v_org;
end;
$$;

-- Dueño activo de una inmobiliaria, para generarle un enlace de acceso.
create function public.platform_organization_owner(p_organization_id uuid) returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return query
  select u.id, u.email::text from public.memberships m join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id and m.role = 'owner' and m.status = 'active'
  order by m.created_at limit 1;
end;
$$;

-- Baja y restauración.
create function public.platform_set_deleted(p_organization_id uuid, p_deleted boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  update public.organizations set deleted_at = case when p_deleted then now() end where id = p_organization_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'not_found';
  end if;
  -- Quien estaba operando esa cuenta como soporte deja de hacerlo.
  if p_deleted then
    update public.support_sessions set ended_at = now() where organization_id = p_organization_id and ended_at is null;
  end if;
end;
$$;

-- Eliminación definitiva: solo sobre una cuenta dada de baja y confirmando el nombre exacto. Devuelve
-- los archivos a borrar de Storage (la API de Storage los borra después; desde SQL no se puede).
create function public.platform_delete_organization(p_organization_id uuid, p_confirm_name text)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  select * into v_org from public.organizations where id = p_organization_id for update;
  if v_org.id is null then
    raise exception using errcode = 'P0002', message = 'not_found';
  end if;
  if v_org.deleted_at is null then
    raise exception using errcode = '23514', message = 'not_deleted_first';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_org.name then
    raise exception using errcode = '22023', message = 'name_mismatch';
  end if;

  return query
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('logos', 'property-images', 'payment-receipts')
    and app.storage_organization_id(o.name) = p_organization_id;

  -- La auditoría queda sin inmobiliaria: los registros de esa cuenta se borran con ella.
  perform app.audit('platform', null, 'organization.deleted_permanently', 'organization', p_organization_id::text,
                    jsonb_build_object('name', v_org.name, 'slug', v_org.slug));
  delete from public.organizations where id = p_organization_id;
end;
$$;

-- Actividad reciente de la plataforma, con quién la hizo.
create function public.platform_activity(p_limit integer default 100)
returns table (id uuid, action text, entity_type text, metadata jsonb, created_at timestamptz, organization_name text, actor_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return query
  select a.id, a.action, a.entity_type, a.metadata, a.created_at, o.name, u.email::text
  from public.audit_logs a
  left join public.organizations o on o.id = a.organization_id
  left join auth.users u on u.id = a.actor_user_id
  where a.scope = 'platform'
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$$;

-- Equipo de plataforma. El principal no se puede quitar.
create function public.platform_team() returns table (user_id uuid, email text, full_name text, is_principal boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  return query
  select a.user_id, u.email::text, p.full_name, a.is_principal, a.created_at
  from public.platform_admins a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id
  order by a.is_principal desc, a.created_at;
end;
$$;

create function public.platform_add_admin(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  insert into public.platform_admins (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform app.audit('platform', null, 'platform_admin.added', 'user', p_user_id::text, '{}'::jsonb);
end;
$$;

create function public.platform_remove_admin(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_principal() then
    raise exception using errcode = 'IG004', message = 'platform_only';
  end if;
  if exists (select 1 from public.platform_admins where user_id = p_user_id and is_principal) then
    raise exception using errcode = 'IG004', message = 'cannot_remove_principal';
  end if;
  delete from public.platform_admins where user_id = p_user_id;
  perform app.audit('platform', null, 'platform_admin.removed', 'user', p_user_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.platform_organizations() from public, anon;
revoke all on function public.platform_find_user(text) from public, anon;
revoke all on function public.platform_create_organization(text, text, uuid, text, integer) from public, anon;
revoke all on function public.platform_organization_owner(uuid) from public, anon;
revoke all on function public.platform_set_deleted(uuid, boolean) from public, anon;
revoke all on function public.platform_delete_organization(uuid, text) from public, anon;
revoke all on function public.platform_activity(integer) from public, anon;
revoke all on function public.platform_team() from public, anon;
revoke all on function public.platform_add_admin(uuid) from public, anon;
revoke all on function public.platform_remove_admin(uuid) from public, anon;
grant execute on function public.platform_organizations(), public.platform_find_user(text),
  public.platform_create_organization(text, text, uuid, text, integer), public.platform_organization_owner(uuid),
  public.platform_set_deleted(uuid, boolean), public.platform_delete_organization(uuid, text),
  public.platform_activity(integer), public.platform_team(), public.platform_add_admin(uuid),
  public.platform_remove_admin(uuid) to authenticated;
