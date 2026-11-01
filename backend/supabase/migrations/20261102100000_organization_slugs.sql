-- =============================================================================
-- Slugs de inmobiliarias (ADR 0008): únicos, modificables por el dueño, con historial reservado
-- para siempre (nunca los reutiliza otra inmobiliaria) y resolución para redirigir URLs viejas.
-- Código de error propio: IG005 slug no disponible.
-- =============================================================================

-- Slugs que una inmobiliaria usó antes. organization_id queda en null si la inmobiliaria se elimina:
-- el slug sigue reservado igual.
create table public.organization_slug_history (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  organization_id uuid references public.organizations (id) on delete set null,
  retired_at timestamptz not null default now()
);

create index organization_slug_history_org on public.organization_slug_history (organization_id);

alter table public.organization_slug_history enable row level security;
alter table public.organization_slug_history force row level security;
-- Sin políticas ni grants para usuarios: se consulta con resolve_organization_slug().
revoke all on public.organization_slug_history from anon, authenticated;
grant all on public.organization_slug_history to service_role;

-- -----------------------------------------------------------------------------
-- Antes de asignar un slug: rechazarlo si está reservado por OTRA inmobiliaria (o por una eliminada).
-- Si es un slug anterior de la misma inmobiliaria, se libera del historial (vuelve a ser el actual).
-- -----------------------------------------------------------------------------
create function app.check_organization_slug() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_found boolean;
begin
  if tg_op = 'UPDATE' and new.slug = old.slug then
    return new;
  end if;

  select true, organization_id into v_found, v_owner
  from public.organization_slug_history where slug = new.slug;

  if v_found then
    if v_owner is distinct from new.id then
      raise exception using errcode = 'IG005', message = 'slug_unavailable';
    end if;
    delete from public.organization_slug_history where slug = new.slug;
  end if;
  return new;
end;
$$;

create trigger organizations_check_slug
  before insert or update of slug on public.organizations
  for each row execute function app.check_organization_slug();

-- Después de cambiar el slug: reservar el anterior y auditar el cambio.
create function app.retire_organization_slug() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.organization_slug_history (slug, organization_id)
    values (old.slug, old.id)
    on conflict (slug) do nothing;
    return old;
  end if;

  if new.slug <> old.slug then
    insert into public.organization_slug_history (slug, organization_id)
    values (old.slug, new.id)
    on conflict (slug) do nothing;
    perform app.audit('organization', new.id, 'organization.slug_changed', 'organization', new.id::text,
      jsonb_build_object('from', old.slug, 'to', new.slug));
  end if;
  return new;
end;
$$;

create trigger organizations_retire_slug_on_update
  after update of slug on public.organizations
  for each row execute function app.retire_organization_slug();

-- Antes de borrar (retención) se reserva el slug actual; la FK deja organization_id en null.
create trigger organizations_retire_slug_on_delete
  before delete on public.organizations
  for each row execute function app.retire_organization_slug();

-- -----------------------------------------------------------------------------
-- Slug disponible a partir de una base ya normalizada (slugify de @inmogest/shared):
-- "demo" → "demo", o "demo-2", "demo-3"… si está en uso o reservado. Lo usará create_organization.
-- -----------------------------------------------------------------------------
create function app.available_organization_slug(p_base text) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := left(coalesce(nullif(p_base, ''), 'inmobiliaria'), 55);
  v_candidate text := left(coalesce(nullif(p_base, ''), 'inmobiliaria'), 60);
  v_suffix integer := 1;
begin
  v_base := regexp_replace(v_base, '-+$', '');
  while exists (select 1 from public.organizations where slug = v_candidate)
     or exists (select 1 from public.organization_slug_history where slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;
  return v_candidate;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC pública: slug actual de la inmobiliaria a la que pertenece un slug (actual o histórico).
-- Las páginas públicas (incremento 1.3) la usan para redirigir URLs viejas. Null si no existe o la
-- inmobiliaria fue eliminada. No expone otros datos.
-- -----------------------------------------------------------------------------
create function public.resolve_organization_slug(p_slug text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.slug
  from public.organizations o
  where o.deleted_at is null
    and (
      o.slug = p_slug
      or o.id = (select h.organization_id from public.organization_slug_history h where h.slug = p_slug)
    )
  limit 1;
$$;

revoke all on function
  app.check_organization_slug(), app.retire_organization_slug(), app.available_organization_slug(text)
from public;
revoke all on function public.resolve_organization_slug(text) from public;
grant execute on function public.resolve_organization_slug(text) to anon, authenticated;
