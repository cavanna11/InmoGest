-- =============================================================================
-- Incremento 1.1: alta de la inmobiliaria (CU-01) y aceptación de invitaciones (CU-02, ADR 0007).
-- Códigos de error propios:
--   IG007 email sin confirmar · IG008 límite de inmobiliarias creadas (anti-abuso)
--   IG009 invitación no disponible (detail: not_found | expired | revoked | accepted | email_mismatch |
--         organization_unavailable)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_organization: la llama el usuario con email confirmado en su primer ingreso.
-- Crea la inmobiliaria en prueba (14 días, plan de prueba de platform_settings), lo deja como dueño,
-- crea el embudo predefinido y el asistente, y registra la aceptación de términos y privacidad
-- vigentes (ADR 0009). Devuelve el id de la inmobiliaria.
-- -----------------------------------------------------------------------------
create function public.create_organization(
  p_name text,
  p_slug_base text,
  p_legal_document_ids uuid[]
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_settings public.platform_settings;
  v_org uuid;
  v_recent integer;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if not exists (select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = 'IG007', message = 'email_not_confirmed';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_name';
  end if;
  if p_slug_base is null or p_slug_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug_base) > 60 then
    raise exception using errcode = '22023', message = 'invalid_slug';
  end if;

  select * into v_settings from public.platform_settings where id;

  -- Registro habilitado solo con términos y privacidad vigentes, y aceptados ambos (ADR 0009).
  if v_settings.current_terms_id is null or v_settings.current_privacy_id is null then
    raise exception using errcode = 'IG006', message = 'registration_closed';
  end if;
  if p_legal_document_ids is null
     or not (v_settings.current_terms_id = any (p_legal_document_ids))
     or not (v_settings.current_privacy_id = any (p_legal_document_ids)) then
    raise exception using errcode = 'IG006', message = 'legal_document_not_current';
  end if;

  -- Anti-abuso: inmobiliarias creadas por este usuario en la ventana configurada.
  perform pg_advisory_xact_lock(hashtextextended('create_organization:' || v_user::text, 0));
  select count(*) into v_recent from public.organizations
  where created_by = v_user
    and created_at > now() - make_interval(hours => v_settings.signup_window_hours);
  if v_recent >= v_settings.signup_max_organizations_per_user then
    raise exception using errcode = 'IG008', message = 'organization_limit';
  end if;

  insert into public.organizations (name, slug, plan_code, trial_ends_at, created_by)
  values (v_name, app.available_organization_slug(p_slug_base), v_settings.trial_plan_code,
          now() + interval '14 days', v_user)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role) values (v_org, v_user, 'owner');

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

  -- Aceptación de la versión vigente (si ya la había aceptado para otra inmobiliaria, se conserva).
  insert into public.legal_acceptances (user_id, organization_id, legal_document_id)
  select v_user, v_org, doc_id
  from unnest(array[v_settings.current_terms_id, v_settings.current_privacy_id]) as doc_id
  on conflict (user_id, legal_document_id) do nothing;

  perform app.audit('organization', v_org, 'organization.created', 'organization', v_org::text,
    jsonb_build_object('plan_code', v_settings.trial_plan_code));
  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitaciones. El token lo genera el servidor de la app (32 bytes aleatorios) y la base guarda solo
-- su hash SHA-256. Estas funciones reciben el token en claro y lo comparan por hash.
-- -----------------------------------------------------------------------------
create function app.invitation_by_token(p_token text) returns public.invitations
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.invitations
  where token_hash = extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256');
$$;

-- Vista previa para la pantalla de aceptación: qué inmobiliaria invita, con qué rol y si sigue
-- disponible. Solo quien tiene el enlace (credencial temporal) puede consultarla.
create function public.invitation_preview(p_token text)
returns table (
  organization_name text,
  role public.member_role,
  email extensions.citext,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  if p_token is null or char_length(p_token) not between 20 and 200 then
    return;
  end if;
  v_inv := app.invitation_by_token(p_token);
  if v_inv.id is null then
    return;
  end if;
  return query
  select o.name, v_inv.role, v_inv.email, v_inv.expires_at,
    case
      when v_inv.accepted_at is not null then 'accepted'
      when v_inv.revoked_at is not null then 'revoked'
      when v_inv.expires_at <= now() then 'expired'
      when app.organization_state(o.id) not in ('trial', 'active') then 'organization_unavailable'
      else 'pending'
    end
  from public.organizations o
  where o.id = v_inv.organization_id;
end;
$$;

-- Acepta la invitación con el usuario autenticado. El email del usuario tiene que coincidir.
-- Cierra la invitación ANTES de crear o reactivar la membresía, para no contarla dos veces en el
-- límite de usuarios del plan.
create function public.accept_invitation(p_token text) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email extensions.citext;
  v_inv public.invitations;
  v_membership public.memberships;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  select email into v_email from auth.users where id = v_user;

  v_inv := app.invitation_by_token(p_token);
  if v_inv.id is null then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'not_found';
  end if;
  -- Bloquea la invitación para que no se acepte dos veces en paralelo.
  select * into v_inv from public.invitations where id = v_inv.id for update;

  if v_inv.accepted_at is not null then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'accepted';
  elsif v_inv.revoked_at is not null then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'revoked';
  elsif v_inv.expires_at <= now() then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'expired';
  elsif v_email is null or v_email <> v_inv.email then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'email_mismatch';
  elsif app.organization_state(v_inv.organization_id) not in ('trial', 'active') then
    raise exception using errcode = 'IG009', message = 'invitation_unavailable', detail = 'organization_unavailable';
  end if;

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;

  select * into v_membership from public.memberships
  where organization_id = v_inv.organization_id and user_id = v_user;

  if v_membership.id is null then
    insert into public.memberships (organization_id, user_id, role)
    values (v_inv.organization_id, v_user, v_inv.role);
  elsif v_membership.status = 'deactivated' then
    update public.memberships
    set status = 'active', deactivated_at = null, role = v_inv.role
    where id = v_membership.id;
  end if;
  -- Si ya era miembro activo, la invitación queda aceptada sin cambiar su rol.

  return v_inv.organization_id;
end;
$$;

revoke all on function
  public.create_organization(text, text, uuid[]),
  public.invitation_preview(text),
  public.accept_invitation(text),
  app.invitation_by_token(text)
from public, anon, authenticated;

grant execute on function public.create_organization(text, text, uuid[]) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
