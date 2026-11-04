-- =============================================================================
-- Incremento 1.4: búsquedas de clientes, embudo, coincidencias y notificaciones
-- (F-11, F-12, F-13, F-23 base, F-31).
-- - Búsquedas: se escriben por RPC (save_client_search, move_search_stage) para guardar búsqueda y
--   zonas en una sola operación y recalcular una sola vez.
-- - Coincidencias: cálculo en la base, disparado al guardar (ADR 0011: provisorio hasta tener worker).
--   Obligatorios: operación, tipo, zona, presupuesto, ambientes y dormitorios mínimos, características
--   requeridas. Puntaje = deseables cumplidos / deseables cargados (100 sin deseables, PRD §6).
-- - Lo que deja de coincidir se conserva como historial (stale), nunca se borra.
-- - Una búsqueda en una etapa desactivada sigue en esa etapa (PRD pregunta abierta 9, provisorio).
-- =============================================================================

create table public.client_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  stage_id uuid not null,
  operation public.property_operation not null,
  property_types public.property_type[] not null check (cardinality(property_types) between 1 and 9),
  budget_min numeric(14,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14,2) check (budget_max is null or budget_max > 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD')),
  budget_tolerance_pct numeric(5,2) not null default 10 check (budget_tolerance_pct between 0 and 100),
  min_rooms smallint check (min_rooms is null or min_rooms between 0 and 99),
  min_bedrooms smallint check (min_bedrooms is null or min_bedrooms between 0 and 99),
  required_features text[] not null default '{}' check (cardinality(required_features) <= 40),
  desired_features text[] not null default '{}' check (cardinality(desired_features) <= 40),
  notes text not null default '' check (char_length(notes) <= 2000),
  assigned_user_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, stage_id) references public.pipeline_stages (organization_id, id),
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index client_searches_org_stage on public.client_searches (organization_id, stage_id, updated_at desc);
create index client_searches_contact on public.client_searches (organization_id, contact_id);
create index client_searches_assigned on public.client_searches (organization_id, assigned_user_id);

create table public.client_search_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  search_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  foreign key (organization_id, search_id) references public.client_searches (organization_id, id) on delete cascade
);

create index client_search_locations_search on public.client_search_locations (search_id);

create table public.stage_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  search_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, search_id) references public.client_searches (organization_id, id) on delete cascade
);

create index stage_changes_search on public.stage_changes (organization_id, search_id, created_at desc);

create type public.match_status as enum ('new', 'seen', 'sent', 'dismissed');

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  search_id uuid not null,
  property_id uuid not null,
  score smallint not null check (score between 0 and 100),
  desired_met smallint not null,
  desired_total smallint not null,
  missing_features text[] not null default '{}',
  over_budget boolean not null default false,
  -- Cotización usada si propiedad y búsqueda tienen distinta moneda (F-31); null si es la misma.
  exchange_rate numeric(14,2),
  status public.match_status not null default 'new',
  -- Ya no coincide: se conserva como historial (PRD §6).
  stale boolean not null default false,
  algorithm_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (search_id, property_id),
  foreign key (organization_id, search_id) references public.client_searches (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade
);

create index match_results_property on public.match_results (organization_id, property_id, score desc);
create index match_results_search on public.match_results (organization_id, search_id, score desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('new_match', 'task_overdue', 'appointment', 'whatsapp_disconnected', 'new_message')),
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 500),
  link text check (link is null or link like '/panel/%'),
  dedupe_key text not null check (char_length(dedupe_key) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, dedupe_key)
);

create index notifications_user on public.notifications (user_id, organization_id, created_at desc);
create index notifications_unread on public.notifications (user_id, organization_id) where read_at is null;

-- Historial del contacto: tipos nuevos que escribe la base.
alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'note', 'call', 'contact_created', 'assigned', 'do_not_contact', 'contact_merged',
  'search_created', 'stage_changed'
));

-- -----------------------------------------------------------------------------
-- Triggers básicos
-- -----------------------------------------------------------------------------
create trigger client_searches_set_updated_at before update on public.client_searches
  for each row execute function app.set_updated_at();
create trigger match_results_set_updated_at before update on public.match_results
  for each row execute function app.set_updated_at();
create trigger client_searches_prevent_key_change before update on public.client_searches
  for each row execute function app.prevent_tenant_key_change();
create trigger client_search_locations_prevent_key_change before update on public.client_search_locations
  for each row execute function app.prevent_tenant_key_change();
create trigger match_results_prevent_key_change before update on public.match_results
  for each row execute function app.prevent_tenant_key_change();
create trigger notifications_prevent_key_change before update on public.notifications
  for each row execute function app.prevent_tenant_key_change();

-- -----------------------------------------------------------------------------
-- Cálculo (PRD §6)
-- -----------------------------------------------------------------------------
-- Texto comparable: minúsculas, sin acentos ni espacios de más.
create function app.normalize_text(p_value text) returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'),
    'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
$$;

-- Evalúa una búsqueda contra una propiedad. Sin filas si falla un obligatorio.
create function app.evaluate_match(p_search public.client_searches, p_property public.properties)
returns table (score smallint, desired_met smallint, desired_total smallint, missing text[], over_budget boolean, rate numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_price numeric;
  v_rate numeric;
  v_org public.organizations;
  v_total integer := cardinality(p_search.desired_features);
  v_met integer;
begin
  if p_property.operation <> p_search.operation or not (p_property.property_type = any (p_search.property_types)) then
    return;
  end if;
  if p_property.price is null then
    return;
  end if;
  if p_search.min_rooms is not null and coalesce(p_property.rooms, 0) < p_search.min_rooms then
    return;
  end if;
  if p_search.min_bedrooms is not null and coalesce(p_property.bedrooms, 0) < p_search.min_bedrooms then
    return;
  end if;
  if not (p_property.features @> p_search.required_features) then
    return;
  end if;

  -- Zona: si la búsqueda tiene zonas, la propiedad tiene que estar en alguna (barrio, localidad o provincia).
  if exists (select 1 from public.client_search_locations l where l.search_id = p_search.id)
     and not exists (
       select 1 from public.client_search_locations l
       where l.search_id = p_search.id
         and app.normalize_text(l.name) in (app.normalize_text(p_property.neighborhood), app.normalize_text(p_property.city), app.normalize_text(p_property.province))
     ) then
    return;
  end if;

  -- Moneda: misma moneda, o cotización manual habilitada (F-31).
  v_price := p_property.price;
  if p_property.currency <> p_search.currency then
    select * into v_org from public.organizations where id = p_search.organization_id;
    if not v_org.usd_ars_rate_enabled or v_org.usd_ars_rate is null then
      return;
    end if;
    v_rate := v_org.usd_ars_rate;
    v_price := case when p_property.currency = 'USD' then p_property.price * v_rate else p_property.price / v_rate end;
  end if;

  -- Presupuesto: sin tolerancia hacia abajo; hasta máximo + tolerancia hacia arriba.
  if p_search.budget_min is not null and v_price < p_search.budget_min then
    return;
  end if;
  if p_search.budget_max is not null
     and v_price > p_search.budget_max * (1 + p_search.budget_tolerance_pct / 100) then
    return;
  end if;

  select count(*) into v_met from unnest(p_search.desired_features) f where f = any (p_property.features);
  score := case when v_total = 0 then 100 else round(v_met::numeric / v_total * 100) end;
  desired_met := v_met;
  desired_total := v_total;
  missing := array(select f from unnest(p_search.desired_features) f where not (f = any (p_property.features)));
  over_budget := p_search.budget_max is not null and v_price > p_search.budget_max;
  rate := v_rate;
  return next;
end;
$$;

-- Aviso al agente asignado a la búsqueda; sin asignar, a los dueños. Una sola vez por coincidencia.
create function app.notify_new_match(p_search public.client_searches, p_property public.properties, p_score smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact text;
begin
  select full_name into v_contact from public.contacts where id = p_search.contact_id;
  insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
  select p_search.organization_id, u.user_id, 'new_match',
    left('Nueva coincidencia para ' || coalesce(v_contact, 'un cliente'), 200),
    left(p_property.code || ' · ' || p_property.title || ' (' || p_score || ' %)', 500),
    '/panel/busquedas/' || p_search.id,
    'match:' || p_search.id || ':' || p_property.id
  from (
    select p_search.assigned_user_id as user_id where p_search.assigned_user_id is not null
    union
    select m.user_id from public.memberships m
    where p_search.assigned_user_id is null and m.organization_id = p_search.organization_id
      and m.role = 'owner' and m.status = 'active'
  ) u
  on conflict (organization_id, user_id, dedupe_key) do nothing;
end;
$$;

-- Guarda el resultado de un par búsqueda-propiedad.
create function app.apply_match(p_search public.client_searches, p_property public.properties)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_existing public.match_results;
begin
  select * into v_existing from public.match_results where search_id = p_search.id and property_id = p_property.id;
  select * into v_result from app.evaluate_match(p_search, p_property);

  if v_result is null or v_result.score is null then
    -- Dejó de coincidir: queda como historial.
    if v_existing.id is not null and not v_existing.stale then
      update public.match_results set stale = true where id = v_existing.id;
    end if;
    return;
  end if;

  if v_existing.id is null then
    insert into public.match_results (organization_id, search_id, property_id, score, desired_met, desired_total,
                                      missing_features, over_budget, exchange_rate)
    values (p_search.organization_id, p_search.id, p_property.id, v_result.score, v_result.desired_met, v_result.desired_total,
            v_result.missing, v_result.over_budget, v_result.rate);
    perform app.notify_new_match(p_search, p_property, v_result.score);
  else
    update public.match_results set score = v_result.score, desired_met = v_result.desired_met,
      desired_total = v_result.desired_total, missing_features = v_result.missing, over_budget = v_result.over_budget,
      exchange_rate = v_result.rate, stale = false
    where id = v_existing.id;
  end if;
end;
$$;

-- Participan propiedades disponibles o reservadas y búsquedas activas (etapa abierta). Si la propiedad
-- o la búsqueda no participa, no se generan coincidencias nuevas y se conservan las anteriores.
create function app.refresh_matches_for_property(p_property_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property public.properties;
  v_search public.client_searches;
begin
  select * into v_property from public.properties where id = p_property_id;
  if v_property.id is null or v_property.merged_into_id is not null or v_property.status not in ('available', 'reserved') then
    return;
  end if;
  for v_search in
    select s.* from public.client_searches s
    join public.pipeline_stages st on st.id = s.stage_id and st.kind = 'open'
    join public.contacts c on c.id = s.contact_id and c.merged_into_id is null
    where s.organization_id = v_property.organization_id
  loop
    perform app.apply_match(v_search, v_property);
  end loop;
end;
$$;

create function app.refresh_matches_for_search(p_search_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search public.client_searches;
  v_property public.properties;
begin
  select s.* into v_search from public.client_searches s
  join public.pipeline_stages st on st.id = s.stage_id and st.kind = 'open'
  where s.id = p_search_id;
  if v_search.id is null then
    return;
  end if;
  for v_property in
    select * from public.properties
    where organization_id = v_search.organization_id and merged_into_id is null and status in ('available', 'reserved')
  loop
    perform app.apply_match(v_search, v_property);
  end loop;
end;
$$;

-- Al guardar una propiedad (o cambiar la cotización) se recalcula.
create function app.properties_refresh_matches() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.refresh_matches_for_property(new.id);
  return new;
end;
$$;

create trigger properties_refresh_matches after insert or update on public.properties
  for each row execute function app.properties_refresh_matches();

create function app.organizations_refresh_matches() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if new.usd_ars_rate_enabled is distinct from old.usd_ars_rate_enabled or new.usd_ars_rate is distinct from old.usd_ars_rate then
    for v_id in select id from public.client_searches where organization_id = new.id loop
      perform app.refresh_matches_for_search(v_id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger organizations_refresh_matches after update on public.organizations
  for each row execute function app.organizations_refresh_matches();

-- Unificaciones: las búsquedas pasan al contacto que queda y las coincidencias a la propiedad que queda.
create function app.contacts_move_searches_on_merge() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is not null and old.merged_into_id is null then
    update public.client_searches set contact_id = new.merged_into_id where contact_id = new.id;
  end if;
  return new;
end;
$$;

create trigger contacts_move_searches_on_merge after update of merged_into_id on public.contacts
  for each row execute function app.contacts_move_searches_on_merge();

create function app.properties_move_matches_on_merge() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is not null and old.merged_into_id is null then
    update public.match_results m set property_id = new.merged_into_id
    where m.property_id = new.id
      and not exists (select 1 from public.match_results o where o.search_id = m.search_id and o.property_id = new.merged_into_id);
    update public.match_results set stale = true where property_id = new.id;
  end if;
  return new;
end;
$$;

create trigger properties_move_matches_on_merge after update of merged_into_id on public.properties
  for each row execute function app.properties_move_matches_on_merge();

-- Al desactivar a un miembro, sus búsquedas también quedan sin asignar.
create function app.unassign_searches_of_deactivated_member() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deactivated' and old.status = 'active' then
    update public.client_searches set assigned_user_id = null
    where organization_id = new.organization_id and assigned_user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger memberships_unassign_searches after update of status on public.memberships
  for each row execute function app.unassign_searches_of_deactivated_member();

-- -----------------------------------------------------------------------------
-- RPC de búsquedas
-- -----------------------------------------------------------------------------
create function public.save_client_search(
  p_organization_id uuid,
  p_id uuid,
  p_contact_id uuid,
  p_operation public.property_operation,
  p_property_types public.property_type[],
  p_budget_min numeric,
  p_budget_max numeric,
  p_currency text,
  p_budget_tolerance_pct numeric,
  p_min_rooms smallint,
  p_min_bedrooms smallint,
  p_required_features text[],
  p_desired_features text[],
  p_notes text,
  p_assigned_user_id uuid,
  p_locations text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_old public.client_searches;
  v_stage uuid;
begin
  if not app.can_write(p_organization_id) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if v_id is not null then
    select * into v_old from public.client_searches where id = v_id and organization_id = p_organization_id for update;
    if v_old.id is null then
      raise exception using errcode = 'P0002', message = 'not_found';
    end if;
  end if;

  if p_assigned_user_id is distinct from v_old.assigned_user_id then
    if p_assigned_user_id is not null then
      perform 1 from public.memberships
      where organization_id = p_organization_id and user_id = p_assigned_user_id and status = 'active';
      if not found then
        raise exception using errcode = '23503', message = 'assignee_not_active_member';
      end if;
    end if;
    if not app.is_owner(p_organization_id)
       and not (v_old.assigned_user_id is null and p_assigned_user_id = auth.uid())
       and not exists (select 1 from public.organizations where id = p_organization_id and agents_can_reassign) then
      raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
    end if;
  end if;

  if v_id is null then
    select id into v_stage from public.pipeline_stages
    where organization_id = p_organization_id and is_active and kind = 'open'
    order by position limit 1;
    insert into public.client_searches (organization_id, contact_id, stage_id, operation, property_types, budget_min,
      budget_max, currency, budget_tolerance_pct, min_rooms, min_bedrooms, required_features, desired_features, notes,
      assigned_user_id, created_by)
    values (p_organization_id, p_contact_id, v_stage, p_operation, p_property_types, p_budget_min, p_budget_max, p_currency,
      coalesce(p_budget_tolerance_pct, 10), p_min_rooms, p_min_bedrooms, coalesce(p_required_features, '{}'),
      coalesce(p_desired_features, '{}'), coalesce(p_notes, ''), p_assigned_user_id, auth.uid())
    returning id into v_id;
    insert into public.stage_changes (organization_id, search_id, to_stage_id, author_id)
    values (p_organization_id, v_id, v_stage, auth.uid());
    insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
    values (p_organization_id, p_contact_id, 'search_created', jsonb_build_object('search_id', v_id), auth.uid());
    update public.contacts set is_prospect = true
    where organization_id = p_organization_id and id = p_contact_id and not is_prospect and merged_into_id is null;
  else
    update public.client_searches set operation = p_operation, property_types = p_property_types, budget_min = p_budget_min,
      budget_max = p_budget_max, currency = p_currency, budget_tolerance_pct = coalesce(p_budget_tolerance_pct, 10),
      min_rooms = p_min_rooms, min_bedrooms = p_min_bedrooms, required_features = coalesce(p_required_features, '{}'),
      desired_features = coalesce(p_desired_features, '{}'), notes = coalesce(p_notes, ''), assigned_user_id = p_assigned_user_id
    where id = v_id;
    delete from public.client_search_locations where search_id = v_id;
  end if;

  insert into public.client_search_locations (organization_id, search_id, name)
  select p_organization_id, v_id, btrim(name)
  from unnest(coalesce(p_locations, '{}')) as name
  where btrim(name) <> ''
  group by btrim(name);

  perform app.refresh_matches_for_search(v_id);
  return v_id;
end;
$$;

-- Mover de etapa (F-13). A una etapa desactivada no se puede mover.
create function public.move_search_stage(p_search_id uuid, p_stage_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search public.client_searches;
  v_stage public.pipeline_stages;
begin
  select * into v_search from public.client_searches where id = p_search_id for update;
  if v_search.id is null or not app.can_write(v_search.organization_id) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  select * into v_stage from public.pipeline_stages where id = p_stage_id and organization_id = v_search.organization_id;
  if v_stage.id is null or not v_stage.is_active then
    raise exception using errcode = '23503', message = 'stage_not_available';
  end if;
  if v_stage.id = v_search.stage_id then
    return;
  end if;
  update public.client_searches set stage_id = v_stage.id where id = p_search_id;
  insert into public.stage_changes (organization_id, search_id, from_stage_id, to_stage_id, author_id)
  values (v_search.organization_id, p_search_id, v_search.stage_id, v_stage.id, auth.uid());
  insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
  values (v_search.organization_id, v_search.contact_id, 'stage_changed',
          jsonb_build_object('search_id', p_search_id, 'stage', v_stage.name), auth.uid());
  -- Si volvió a una etapa abierta, recalcula; a una etapa de cierre no genera nada nuevo.
  perform app.refresh_matches_for_search(p_search_id);
end;
$$;

-- Métrica del dueño: búsquedas por etapa y agente (CU-11).
create function public.pipeline_metrics(p_organization_id uuid)
returns table (stage_id uuid, assigned_user_id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.stage_id, s.assigned_user_id, count(*)
  from public.client_searches s
  where s.organization_id = p_organization_id
  group by s.stage_id, s.assigned_user_id;
$$;

-- -----------------------------------------------------------------------------
-- RLS. Lectura para los miembros; la escritura de búsquedas pasa por las RPC.
-- -----------------------------------------------------------------------------
alter table public.client_searches enable row level security;
alter table public.client_searches force row level security;
alter table public.client_search_locations enable row level security;
alter table public.client_search_locations force row level security;
alter table public.stage_changes enable row level security;
alter table public.stage_changes force row level security;
alter table public.match_results enable row level security;
alter table public.match_results force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

revoke all on public.client_searches, public.client_search_locations, public.stage_changes, public.match_results,
  public.notifications from anon, authenticated;
grant select on public.client_searches, public.client_search_locations, public.stage_changes to authenticated;
grant select on public.match_results to authenticated;
grant update (status) on public.match_results to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.client_searches, public.client_search_locations, public.stage_changes, public.match_results,
  public.notifications to service_role;

create policy client_searches_select on public.client_searches for select to authenticated
  using (app.can_read(organization_id));
create policy client_search_locations_select on public.client_search_locations for select to authenticated
  using (app.can_read(organization_id));
create policy stage_changes_select on public.stage_changes for select to authenticated
  using (app.can_read(organization_id));
create policy match_results_select on public.match_results for select to authenticated
  using (app.can_read(organization_id));
create policy match_results_update on public.match_results for update to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));
-- Notificaciones: cada persona ve y marca las suyas.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and app.can_read(organization_id));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid() and app.can_read(organization_id))
  with check (user_id = auth.uid() and app.can_read(organization_id));

revoke all on function app.normalize_text(text), app.evaluate_match(public.client_searches, public.properties),
  app.notify_new_match(public.client_searches, public.properties, smallint),
  app.apply_match(public.client_searches, public.properties), app.refresh_matches_for_property(uuid),
  app.refresh_matches_for_search(uuid), app.properties_refresh_matches(), app.organizations_refresh_matches(),
  app.contacts_move_searches_on_merge(), app.properties_move_matches_on_merge(),
  app.unassign_searches_of_deactivated_member() from public;
revoke all on function public.save_client_search(uuid, uuid, uuid, public.property_operation, public.property_type[], numeric, numeric, text, numeric, smallint, smallint, text[], text[], text, uuid, text[]) from public, anon;
grant execute on function public.save_client_search(uuid, uuid, uuid, public.property_operation, public.property_type[], numeric, numeric, text, numeric, smallint, smallint, text[], text[], text, uuid, text[]) to authenticated;
revoke all on function public.move_search_stage(uuid, uuid) from public, anon;
grant execute on function public.move_search_stage(uuid, uuid) to authenticated;
revoke all on function public.pipeline_metrics(uuid) from public, anon;
grant execute on function public.pipeline_metrics(uuid) to authenticated;
