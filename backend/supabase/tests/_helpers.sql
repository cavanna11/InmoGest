-- =============================================================================
-- Helpers de pgTAP. scripts/run-pgtap.mjs ejecuta este archivo antes de cada test, dentro de la
-- misma transacción, que siempre se revierte: nada de esto (ni los datos de prueba) queda en la base.
-- =============================================================================

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Usuario de Auth mínimo (el trigger on_auth_user_created crea el perfil).
create function tests.create_user(p_id uuid, p_email text) returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
          now(), '{}'::jsonb, jsonb_build_object('full_name', split_part(p_email, '@', 1)), now(), now())
  returning id;
$$;

create function tests.create_org(
  p_id uuid,
  p_slug text,
  p_plan text default 'professional',
  p_trial_ends_at timestamptz default now() + interval '14 days',
  p_paid_until timestamptz default null
) returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.organizations (id, name, slug, plan_code, trial_ends_at, paid_until)
  values (p_id, 'Org ' || p_slug, p_slug, p_plan, p_trial_ends_at, p_paid_until)
  returning id;
$$;

create function tests.add_member(p_org uuid, p_user uuid, p_role public.member_role default 'agent')
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.memberships (organization_id, user_id, role)
  values (p_org, p_user, p_role)
  returning id;
$$;

-- Solo puede haber un principal (índice único). Si la base ya tiene uno (ej. el del seed), se lo
-- desmarca dentro de la transacción del test, que se revierte al final.
create function tests.make_principal(p_user uuid, p_principal boolean default true) returns void
language sql
security definer
set search_path = ''
as $$
  update public.platform_admins set is_principal = false where is_principal and p_principal;
  insert into public.platform_admins (user_id, is_principal) values (p_user, p_principal);
$$;

-- Simula un pedido de la API con el JWT de ese usuario (rol authenticated, RLS activa).
create function tests.authenticate_as(p_user uuid) returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.authenticate_as_anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function tests.authenticate_as_service() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'service_role', true);
end;
$$;

-- Vuelve al rol de la conexión (postgres), sin JWT.
create function tests.clear_authentication() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end;
$$;

-- Ejecuta una sentencia y devuelve cuántas filas afectó (RLS hace que UPDATE/DELETE ajenos afecten 0).
create function tests.affected(p_sql text) returns bigint
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Ejecuta una sentencia que debe fallar y devuelve {sqlstate, detail} del error (null si no falla).
create function tests.error_of(p_sql text) returns jsonb
language plpgsql
as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return jsonb_build_object('sqlstate', sqlstate, 'detail', nullif(v_detail, ''));
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
