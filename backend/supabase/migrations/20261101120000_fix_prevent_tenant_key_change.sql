-- =============================================================================
-- Corrección de app.prevent_tenant_key_change (20261031200400_rules.sql).
-- PL/pgSQL no corta la evaluación de "tg_table_name = 'memberships' and new.user_id <> old.user_id":
-- en invitations (sin columna user_id) todo UPDATE fallaba con 42703. Detectado por pgTAP (05_plan_limits).
-- =============================================================================

create or replace function app.prevent_tenant_key_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception using errcode = '42501', message = 'organization_id is immutable';
  end if;
  if tg_table_name = 'memberships' then
    -- to_jsonb evita referenciar una columna que no existe en todas las tablas del trigger.
    if (to_jsonb(new) ->> 'user_id') is distinct from (to_jsonb(old) ->> 'user_id') then
      raise exception using errcode = '42501', message = 'user_id is immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.prevent_tenant_key_change() from public;
