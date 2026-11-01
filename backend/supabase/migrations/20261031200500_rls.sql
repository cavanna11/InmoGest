-- =============================================================================
-- RLS habilitada y FORZADA en todas las tablas + permisos explícitos por rol.
-- docs/DATABASE.md (Aislamiento y permisos), docs/SECURITY.md (Autorización).
-- Las políticas usan (select ...) para que Postgres evalúe las funciones una vez por consulta.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'plans', 'platform_settings', 'platform_admins', 'legal_documents', 'audit_logs', 'rate_limits',
    'organizations', 'profiles', 'memberships', 'invitations', 'legal_acceptances', 'support_sessions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de tabla (RLS decide qué filas). anon solo lee documentos legales.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.legal_documents to anon;

grant select on
  public.plans, public.platform_settings, public.platform_admins, public.legal_documents,
  public.audit_logs, public.organizations, public.profiles, public.memberships, public.invitations,
  public.legal_acceptances, public.support_sessions
to authenticated;

grant update on public.plans, public.platform_settings, public.organizations, public.profiles,
  public.memberships, public.invitations
to authenticated;

grant insert on public.legal_documents, public.memberships, public.invitations, public.legal_acceptances
to authenticated;

grant delete on public.memberships, public.invitations to authenticated;

grant all on all tables in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Plataforma. Lectura: administradores de la plataforma. Escritura: superadministrador principal
-- (otros usuarios de C&C [A CONFIRMAR], PRD pregunta abierta 11).
-- -----------------------------------------------------------------------------
create policy plans_select on public.plans for select to authenticated
  using (true);
create policy plans_update on public.plans for update to authenticated
  using ((select app.is_principal())) with check ((select app.is_principal()));

create policy platform_settings_select on public.platform_settings for select to authenticated
  using ((select app.is_platform_admin()));
create policy platform_settings_update on public.platform_settings for update to authenticated
  using ((select app.is_principal())) with check ((select app.is_principal()));

-- Cada usuario ve si él mismo es administrador; los administradores ven a todos.
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_platform_admin()));

create policy legal_documents_select_published on public.legal_documents for select to anon, authenticated
  using (published_at is not null and published_at <= now());
create policy legal_documents_select_admin on public.legal_documents for select to authenticated
  using ((select app.is_platform_admin()));
create policy legal_documents_insert on public.legal_documents for insert to authenticated
  with check ((select app.is_principal()));

-- Sesiones de soporte: registro técnico, solo visible para la plataforma (nunca para la inmobiliaria).
-- Se escriben únicamente con start_support_session / end_support_session.
create policy support_sessions_select on public.support_sessions for select to authenticated
  using ((select app.is_platform_admin()));

-- rate_limits: sin políticas (solo service_role, que saltea RLS).

-- -----------------------------------------------------------------------------
-- Auditoría: el dueño ve la de su inmobiliaria; la plataforma ve todo. Solo escriben triggers/funciones.
-- -----------------------------------------------------------------------------
create policy audit_logs_select_owner on public.audit_logs for select to authenticated
  using (scope = 'organization' and app.is_owner(organization_id) and app.can_read(organization_id));
create policy audit_logs_select_platform on public.audit_logs for select to authenticated
  using ((select app.is_platform_admin()));

-- -----------------------------------------------------------------------------
-- Inmobiliarias
-- La plataforma ve la lista para su panel (CU-15); los datos internos de cada inmobiliaria
-- (miembros, invitaciones y luego el CRM) solo con «Ingresar como».
-- -----------------------------------------------------------------------------
create policy organizations_select_member on public.organizations for select to authenticated
  using (app.can_read(id));
create policy organizations_select_platform on public.organizations for select to authenticated
  using ((select app.is_platform_admin()));
-- Configuración de la inmobiliaria: solo dueño y cuenta habilitada para escribir.
-- Plan y estado los protege el trigger organizations_protect_platform_columns.
create policy organizations_update_owner on public.organizations for update to authenticated
  using (app.is_owner(id) and app.can_write(id))
  with check (app.is_owner(id) and app.can_write(id));
-- Plan, estado y suspensión desde el panel de superadministrador (CU-15).
create policy organizations_update_platform on public.organizations for update to authenticated
  using ((select app.is_principal())) with check ((select app.is_principal()));
-- Sin insert/delete: el alta es la RPC create_organization (Fase 1) y la baja el job de retención.

-- -----------------------------------------------------------------------------
-- Perfiles: el propio, y los de quienes comparten una inmobiliaria legible.
-- -----------------------------------------------------------------------------
create function app.can_see_profile(p_user_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = p_user_id and app.can_read(m.organization_id)
    );
$$;

revoke all on function app.can_see_profile(uuid) from public;
grant execute on function app.can_see_profile(uuid) to authenticated, service_role;

create policy profiles_select on public.profiles for select to authenticated
  using (app.can_see_profile(id) or (select app.is_platform_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Membresías. Cada usuario ve las suyas (para elegir inmobiliaria); los miembros ven las de su
-- inmobiliaria. Altas, bajas y cambios de rol: solo el dueño, con la cuenta habilitada.
-- -----------------------------------------------------------------------------
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.can_read(organization_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy memberships_update on public.memberships for update to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id))
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id));

-- -----------------------------------------------------------------------------
-- Invitaciones: solo el dueño. La aceptación es una RPC (Fase 1).
-- -----------------------------------------------------------------------------
create policy invitations_select on public.invitations for select to authenticated
  using (app.is_owner(organization_id) and app.can_read(organization_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy invitations_update on public.invitations for update to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id))
  with check (app.is_owner(organization_id) and app.can_write(organization_id));
create policy invitations_delete on public.invitations for delete to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id));

-- -----------------------------------------------------------------------------
-- Aceptación de términos: cada usuario registra y ve las suyas.
-- -----------------------------------------------------------------------------
create policy legal_acceptances_select on public.legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_platform_admin()));
create policy legal_acceptances_insert on public.legal_acceptances for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (organization_id is null or app.is_member(organization_id))
  );
