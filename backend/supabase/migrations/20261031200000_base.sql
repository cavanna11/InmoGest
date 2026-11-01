-- =============================================================================
-- Base: extensiones, esquema app, enums y utilidades comunes.
-- docs/DATABASE.md (Convenciones), docs/SECURITY.md (Tenancy).
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Funciones auxiliares de permisos y reglas. No se expone por la API (PostgREST solo publica "public").
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Toda tabla o función nueva de public arranca sin permisos para anon/authenticated (Supabase los
-- otorga por defecto en este esquema): cada migración otorga explícitamente lo que hace falta.
-- El EXECUTE de PUBLIC es un default global de Postgres que no se puede quitar por esquema, así que
-- cada función hace además "revoke ... from public" explícito.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums de estados estables
-- -----------------------------------------------------------------------------
-- admin, supervisor y staff están reservados (PRD §3); en el MVP solo se permiten owner y agent.
create type public.member_role as enum ('owner', 'agent', 'admin', 'supervisor', 'staff');
create type public.membership_status as enum ('active', 'deactivated');
create type public.account_state as enum ('trial', 'active', 'read_only', 'blocked', 'pending_deletion');
create type public.job_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');
create type public.legal_document_kind as enum ('terms', 'privacy');
create type public.audit_scope as enum ('organization', 'platform');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create function app.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Verdadero cuando quien ejecuta no es un usuario de la API (postgres en migraciones, service_role en
-- el worker y webhooks). Se usa en triggers SECURITY INVOKER, donde current_user es el rol que invoca.
create function app.is_privileged_role() returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated');
$$;
