-- =============================================================================
-- Incremento 1.2: contactos (F-06, F-07, F-19, F-22 base, F-34).
-- - Varios teléfonos (E.164, argentinos como móvil +549…, normalizados en la app con
--   @inmogest/shared normalizePhone) y emails por contacto, únicos por inmobiliaria.
-- - Asignación organizativa (no es un permiso); reasignar requiere ser dueño o la capacidad
--   agents_can_reassign. Al desactivar a un agente, sus contactos quedan sin asignar.
-- - Historial de actividad por contacto (las propiedades se suman en el 1.3).
-- - Reportes de posibles duplicados y unificación explícita solo por el dueño (nunca automática).
-- Códigos de error propios: IG011 teléfono o email ya registrado (detail: id del contacto existente),
-- IG012 reasignación no permitida, IG013 unificación no válida.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create type public.contact_source as enum ('manual', 'whatsapp', 'import');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 5000),
  source public.contact_source not null default 'manual',
  -- Interesado, propietario o ambos (PRD §6). Se cargan a mano hasta que existan propiedades (1.3) y
  -- búsquedas (1.4); entonces se derivan también de esas relaciones.
  is_prospect boolean not null default true,
  is_owner boolean not null default false,
  -- Baja "no contactar" (F-19): el sistema nunca le envía mensajes automáticos.
  do_not_contact boolean not null default false,
  do_not_contact_at timestamptz,
  assigned_user_id uuid,
  -- Contacto unificado en otro (F-34): deja de listarse; se conserva para el historial.
  merged_into_id uuid,
  merged_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id),
  foreign key (organization_id, merged_into_id) references public.contacts (organization_id, id),
  check (do_not_contact = (do_not_contact_at is not null)),
  check ((merged_into_id is null) = (merged_at is null)),
  check (merged_into_id is distinct from id)
);

-- Búsqueda por nombre (trigram); el filtro por inmobiliaria lo aplican RLS y la consulta.
create index contacts_name_trgm on public.contacts using gin (lower(full_name) extensions.gin_trgm_ops);
create index contacts_org_updated on public.contacts (organization_id, updated_at desc) where merged_into_id is null;
create index contacts_org_assigned on public.contacts (organization_id, assigned_user_id) where merged_into_id is null;

create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 40),
  is_whatsapp boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, phone_e164),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade
);

create index contact_phones_contact on public.contact_phones (contact_id);

create table public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  email extensions.citext not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (organization_id, email),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade
);

create index contact_emails_contact on public.contact_emails (contact_id);

-- Historial unificado (F-22). kind: notas y llamadas las cargan los usuarios; el resto lo registra la
-- base. Los tipos de propiedades, mensajes y etapas se agregan en sus incrementos.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  kind text not null check (kind in ('note', 'call', 'contact_created', 'assigned', 'do_not_contact', 'contact_merged')),
  body text not null default '' check (char_length(body) <= 5000),
  metadata jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  check (kind not in ('note', 'call') or char_length(btrim(body)) > 0)
);

create index activities_contact_created on public.activities (organization_id, contact_id, created_at desc);

-- Posibles duplicados (CU-17): los reporta un agente; el dueño unifica o descarta.
create type public.duplicate_report_status as enum ('open', 'merged', 'dismissed');

create table public.duplicate_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_a_id uuid not null,
  contact_b_id uuid not null,
  reason text not null default '' check (char_length(reason) <= 500),
  status public.duplicate_report_status not null default 'open',
  reported_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_a_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_b_id) references public.contacts (organization_id, id) on delete cascade,
  check (contact_a_id <> contact_b_id),
  check ((status = 'open') = (resolved_at is null))
);

-- Un solo reporte abierto por par, sin importar el orden.
create unique index duplicate_reports_open_pair on public.duplicate_reports
  (organization_id, least(contact_a_id, contact_b_id), greatest(contact_a_id, contact_b_id))
  where status = 'open';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function app.set_updated_at();
create trigger contacts_prevent_key_change before update on public.contacts
  for each row execute function app.prevent_tenant_key_change();
create trigger contact_phones_prevent_key_change before update on public.contact_phones
  for each row execute function app.prevent_tenant_key_change();
create trigger contact_emails_prevent_key_change before update on public.contact_emails
  for each row execute function app.prevent_tenant_key_change();
create trigger activities_prevent_key_change before update on public.activities
  for each row execute function app.prevent_tenant_key_change();
create trigger duplicate_reports_prevent_key_change before update on public.duplicate_reports
  for each row execute function app.prevent_tenant_key_change();

-- Asignación (PRD §6): solo a miembros activos; cambiarla requiere ser dueño o tener habilitada la
-- reasignación, salvo que un agente se asigne a sí mismo un contacto sin asignar. La marca de baja
-- lleva su fecha. Las operaciones de la base (postgres, service_role) no tienen esta restricción.
create function app.contacts_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_assigned uuid := case when tg_op = 'UPDATE' then old.assigned_user_id end;
begin
  if new.do_not_contact and (tg_op = 'INSERT' or not old.do_not_contact) then
    new.do_not_contact_at := now();
  elsif not new.do_not_contact then
    new.do_not_contact_at := null;
  end if;

  if new.assigned_user_id is distinct from v_old_assigned and new.assigned_user_id is not null then
    perform 1 from public.memberships
    where organization_id = new.organization_id and user_id = new.assigned_user_id and status = 'active';
    if not found then
      raise exception using errcode = '23503', message = 'assignee_not_active_member';
    end if;
  end if;

  if new.assigned_user_id is distinct from v_old_assigned
     and auth.uid() is not null
     and not app.is_owner(new.organization_id)
     and not (v_old_assigned is null and new.assigned_user_id = auth.uid())
     and not exists (select 1 from public.organizations where id = new.organization_id and agents_can_reassign) then
    raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
  end if;
  return new;
end;
$$;

create trigger contacts_guard before insert or update on public.contacts
  for each row execute function app.contacts_guard();

-- Historial automático: alta, cambio de asignación y de baja.
create function app.contacts_log_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
    values (new.organization_id, new.id, 'contact_created', jsonb_build_object('source', new.source), auth.uid());
    return new;
  end if;
  if new.assigned_user_id is distinct from old.assigned_user_id then
    insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
    values (new.organization_id, new.id, 'assigned',
            jsonb_build_object('from', old.assigned_user_id, 'to', new.assigned_user_id), auth.uid());
  end if;
  if new.do_not_contact is distinct from old.do_not_contact then
    insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
    values (new.organization_id, new.id, 'do_not_contact', jsonb_build_object('value', new.do_not_contact), auth.uid());
  end if;
  return new;
end;
$$;

create trigger contacts_log_activity after insert or update on public.contacts
  for each row execute function app.contacts_log_activity();

-- Al desactivar a un miembro, lo que tenía asignado queda sin asignar (PRD §6). El historial queda.
create function app.unassign_deactivated_member() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deactivated' and old.status = 'active' then
    update public.contacts set assigned_user_id = null
    where organization_id = new.organization_id and assigned_user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger memberships_unassign_on_deactivate after update of status on public.memberships
  for each row execute function app.unassign_deactivated_member();

-- -----------------------------------------------------------------------------
-- Alta de un contacto con sus teléfonos y emails, en una sola operación (F-06). Si un teléfono o email
-- ya pertenece a otro contacto, no crea nada y devuelve IG011 con el id del existente (para mostrarlo).
-- SECURITY INVOKER: rigen las políticas de RLS del usuario.
-- -----------------------------------------------------------------------------
create function public.create_contact(
  p_organization_id uuid,
  p_full_name text,
  p_phones text[] default '{}',
  p_emails text[] default '{}',
  p_notes text default '',
  p_is_prospect boolean default true,
  p_is_owner boolean default false,
  p_assigned_user_id uuid default null,
  p_source public.contact_source default 'manual'
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing uuid;
  v_id uuid;
begin
  select contact_id into v_existing from public.contact_phones
  where organization_id = p_organization_id and phone_e164 = any (p_phones) limit 1;
  if v_existing is null then
    select contact_id into v_existing from public.contact_emails
    where organization_id = p_organization_id and email = any (p_emails::extensions.citext[]) limit 1;
  end if;
  if v_existing is not null then
    raise exception using errcode = 'IG011', message = 'contact_exists', detail = v_existing::text;
  end if;

  insert into public.contacts (organization_id, full_name, notes, is_prospect, is_owner, assigned_user_id, source, created_by)
  values (p_organization_id, btrim(p_full_name), coalesce(p_notes, ''), p_is_prospect, p_is_owner,
          p_assigned_user_id, p_source, auth.uid())
  returning id into v_id;

  insert into public.contact_phones (organization_id, contact_id, phone_e164)
  select p_organization_id, v_id, phone from unnest(p_phones) as phone group by phone;
  insert into public.contact_emails (organization_id, contact_id, email)
  select p_organization_id, v_id, email from unnest(p_emails::extensions.citext[]) as email group by email;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Unificación (F-34, PRD §6): solo el dueño, con acción explícita. El contacto que queda conserva
-- teléfonos, emails, historial, notas y reportes de ambos; el otro se marca como unificado.
-- Al sumar conversaciones (1.7), propiedades (1.3), búsquedas (1.4) y agenda (1.5), esos
-- incrementos agregan acá el traspaso de sus filas.
-- -----------------------------------------------------------------------------
create function public.merge_contacts(p_keep_id uuid, p_merge_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.contacts;
  v_merge public.contacts;
begin
  select * into v_keep from public.contacts where id = p_keep_id for update;
  select * into v_merge from public.contacts where id = p_merge_id for update;
  if v_keep.id is null or v_merge.id is null or v_keep.organization_id <> v_merge.organization_id
     or p_keep_id = p_merge_id or v_keep.merged_into_id is not null or v_merge.merged_into_id is not null then
    raise exception using errcode = 'IG013', message = 'invalid_merge';
  end if;
  if not (app.is_owner(v_keep.organization_id) and app.can_write(v_keep.organization_id)) then
    raise exception using errcode = '42501', message = 'only_owner_can_merge';
  end if;

  update public.contact_phones set contact_id = p_keep_id where contact_id = p_merge_id;
  update public.contact_emails set contact_id = p_keep_id where contact_id = p_merge_id;
  update public.activities set contact_id = p_keep_id where contact_id = p_merge_id;

  update public.contacts set
    notes = left(concat_ws(E'\n\n', nullif(v_keep.notes, ''), nullif(v_merge.notes, '')), 5000),
    is_prospect = v_keep.is_prospect or v_merge.is_prospect,
    is_owner = v_keep.is_owner or v_merge.is_owner,
    do_not_contact = v_keep.do_not_contact or v_merge.do_not_contact,
    assigned_user_id = coalesce(v_keep.assigned_user_id, v_merge.assigned_user_id)
  where id = p_keep_id;
  update public.contacts set merged_into_id = p_keep_id, merged_at = now(), assigned_user_id = null
  where id = p_merge_id;

  update public.duplicate_reports
  set status = 'merged', resolved_by = auth.uid(), resolved_at = now()
  where status = 'open' and organization_id = v_keep.organization_id
    and (contact_a_id in (p_keep_id, p_merge_id) and contact_b_id in (p_keep_id, p_merge_id));
  -- Reportes abiertos del unificado con terceros pasan al que queda (salvo que ya exista ese par).
  update public.duplicate_reports r set contact_a_id = p_keep_id
  where r.status = 'open' and r.contact_a_id = p_merge_id and r.contact_b_id <> p_keep_id
    and not exists (select 1 from public.duplicate_reports o where o.status = 'open' and o.organization_id = r.organization_id
      and least(o.contact_a_id, o.contact_b_id) = least(p_keep_id, r.contact_b_id)
      and greatest(o.contact_a_id, o.contact_b_id) = greatest(p_keep_id, r.contact_b_id));
  update public.duplicate_reports r set contact_b_id = p_keep_id
  where r.status = 'open' and r.contact_b_id = p_merge_id and r.contact_a_id <> p_keep_id
    and not exists (select 1 from public.duplicate_reports o where o.status = 'open' and o.organization_id = r.organization_id
      and least(o.contact_a_id, o.contact_b_id) = least(p_keep_id, r.contact_a_id)
      and greatest(o.contact_a_id, o.contact_b_id) = greatest(p_keep_id, r.contact_a_id));
  update public.duplicate_reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
  where status = 'open' and (contact_a_id = p_merge_id or contact_b_id = p_merge_id);

  insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
  values (v_keep.organization_id, p_keep_id, 'contact_merged',
          jsonb_build_object('merged_id', p_merge_id, 'merged_name', v_merge.full_name), auth.uid());
  perform app.audit('organization', v_keep.organization_id, 'contact.merged', 'contact', p_keep_id::text,
                    jsonb_build_object('merged_id', p_merge_id));
  return p_keep_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS. Todos los miembros ven y editan todos los contactos (PRD §6: la asignación no es un permiso).
-- -----------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
alter table public.contact_phones enable row level security;
alter table public.contact_phones force row level security;
alter table public.contact_emails enable row level security;
alter table public.contact_emails force row level security;
alter table public.activities enable row level security;
alter table public.activities force row level security;
alter table public.duplicate_reports enable row level security;
alter table public.duplicate_reports force row level security;

revoke all on public.contacts, public.contact_phones, public.contact_emails, public.activities,
  public.duplicate_reports from anon, authenticated;
grant select, insert, update on public.contacts to authenticated;
grant select, insert, update, delete on public.contact_phones, public.contact_emails to authenticated;
grant select, insert, delete on public.activities to authenticated;
grant select, insert, update on public.duplicate_reports to authenticated;
grant all on public.contacts, public.contact_phones, public.contact_emails, public.activities,
  public.duplicate_reports to service_role;

create policy contacts_select on public.contacts for select to authenticated
  using (app.can_read(organization_id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (app.can_write(organization_id) and merged_into_id is null);
-- La unificación solo pasa por merge_contacts (SECURITY DEFINER): un update directo no puede marcarla.
create policy contacts_update on public.contacts for update to authenticated
  using (app.can_write(organization_id) and merged_into_id is null)
  with check (app.can_write(organization_id) and merged_into_id is null);

create policy contact_phones_select on public.contact_phones for select to authenticated
  using (app.can_read(organization_id));
create policy contact_phones_write on public.contact_phones for all to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));
create policy contact_emails_select on public.contact_emails for select to authenticated
  using (app.can_read(organization_id));
create policy contact_emails_write on public.contact_emails for all to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));

-- Historial: los usuarios agregan notas y llamadas propias y pueden borrar las suyas; el resto de
-- los tipos solo los escribe la base.
create policy activities_select on public.activities for select to authenticated
  using (app.can_read(organization_id));
create policy activities_insert on public.activities for insert to authenticated
  with check (app.can_write(organization_id) and kind in ('note', 'call') and author_id = auth.uid());
create policy activities_delete on public.activities for delete to authenticated
  using (app.can_write(organization_id) and kind in ('note', 'call') and author_id = auth.uid());

-- Duplicados: cualquier miembro reporta; solo el dueño resuelve (descarta). Unificar: merge_contacts.
create policy duplicate_reports_select on public.duplicate_reports for select to authenticated
  using (app.can_read(organization_id));
create policy duplicate_reports_insert on public.duplicate_reports for insert to authenticated
  with check (app.can_write(organization_id) and status = 'open' and reported_by = auth.uid());
create policy duplicate_reports_update on public.duplicate_reports for update to authenticated
  using (app.is_owner(organization_id) and app.can_write(organization_id))
  with check (app.is_owner(organization_id) and app.can_write(organization_id) and status = 'dismissed');

revoke all on function app.contacts_guard(), app.contacts_log_activity(), app.unassign_deactivated_member() from public;
revoke all on function public.create_contact(uuid, text, text[], text[], text, boolean, boolean, uuid, public.contact_source) from public, anon;
grant execute on function public.create_contact(uuid, text, text[], text[], text, boolean, boolean, uuid, public.contact_source) to authenticated;
revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
