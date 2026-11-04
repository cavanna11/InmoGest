-- =============================================================================
-- Incremento 1.5: agenda de visitas y tareas con recordatorios dentro del panel (F-21, F-23).
-- - Una visita requiere cliente y propiedad; una tarea puede no tener ninguno (PRD §6).
-- - Todos los miembros ven y gestionan la agenda de todo el equipo; la asignación es organizativa.
-- - Recordatorios: sync_my_reminders() los genera al abrir el panel (ADR 0011: sin worker no hay
--   proceso programado). Es idempotente por la clave de deduplicación de notifications.
-- =============================================================================

create type public.appointment_status as enum ('scheduled', 'done', 'cancelled', 'no_show');
create type public.task_status as enum ('pending', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null,
  property_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 5 and 600),
  status public.appointment_status not null default 'scheduled',
  notes text not null default '' check (char_length(notes) <= 2000),
  assigned_user_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id)
);

create index appointments_org_start on public.appointments (organization_id, starts_at);
create index appointments_assigned on public.appointments (organization_id, assigned_user_id, starts_at);
create index appointments_contact on public.appointments (contact_id);
create index appointments_property on public.appointments (property_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  due_at timestamptz not null,
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  contact_id uuid,
  property_id uuid,
  assigned_user_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, assigned_user_id)
    references public.memberships (organization_id, user_id) on delete set null (assigned_user_id)
);

create index tasks_org_due on public.tasks (organization_id, status, due_at);
create index tasks_assigned on public.tasks (organization_id, assigned_user_id, status, due_at);
create index tasks_contact on public.tasks (contact_id);
create index tasks_property on public.tasks (property_id);

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'note', 'call', 'contact_created', 'assigned', 'do_not_contact', 'contact_merged',
  'search_created', 'stage_changed', 'appointment'
));

create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function app.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function app.set_updated_at();
create trigger appointments_prevent_key_change before update on public.appointments
  for each row execute function app.prevent_tenant_key_change();
create trigger tasks_prevent_key_change before update on public.tasks
  for each row execute function app.prevent_tenant_key_change();

-- Asignación (PRD §6): a miembros activos; cambiarla requiere ser dueño o tener habilitada la
-- reasignación, salvo que alguien se asigne a sí mismo algo sin asignar.
create function app.agenda_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid := case when tg_op = 'UPDATE' then old.assigned_user_id end;
begin
  if new.assigned_user_id is distinct from v_old then
    if new.assigned_user_id is not null then
      perform 1 from public.memberships
      where organization_id = new.organization_id and user_id = new.assigned_user_id and status = 'active';
      if not found then
        raise exception using errcode = '23503', message = 'assignee_not_active_member';
      end if;
    end if;
    if auth.uid() is not null and not app.is_owner(new.organization_id)
       and not (v_old is null and new.assigned_user_id = auth.uid())
       and not exists (select 1 from public.organizations where id = new.organization_id and agents_can_reassign) then
      raise exception using errcode = 'IG012', message = 'reassign_not_allowed';
    end if;
  end if;
  if tg_table_name = 'tasks' then
    new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) end;
  end if;
  return new;
end;
$$;

create trigger appointments_guard before insert or update on public.appointments
  for each row execute function app.agenda_guard();
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function app.agenda_guard();

-- Una visita queda en el historial del contacto.
create function app.appointments_log_activity() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.activities (organization_id, contact_id, kind, metadata, author_id)
    values (new.organization_id, new.contact_id, 'appointment',
            jsonb_build_object('appointment_id', new.id, 'property_id', new.property_id, 'status', new.status, 'starts_at', new.starts_at),
            auth.uid());
  end if;
  return new;
end;
$$;

create trigger appointments_log_activity after insert or update on public.appointments
  for each row execute function app.appointments_log_activity();

-- Al desactivar a un miembro, lo pendiente queda sin asignar (PRD §6).
create function app.unassign_agenda_of_deactivated_member() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deactivated' and old.status = 'active' then
    update public.tasks set assigned_user_id = null
    where organization_id = new.organization_id and assigned_user_id = new.user_id and status = 'pending';
    update public.appointments set assigned_user_id = null
    where organization_id = new.organization_id and assigned_user_id = new.user_id and status = 'scheduled';
  end if;
  return new;
end;
$$;

create trigger memberships_unassign_agenda after update of status on public.memberships
  for each row execute function app.unassign_agenda_of_deactivated_member();

-- Unificaciones: la agenda pasa al contacto o a la propiedad que queda.
create function app.contacts_move_agenda_on_merge() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is not null and old.merged_into_id is null then
    update public.appointments set contact_id = new.merged_into_id where contact_id = new.id;
    update public.tasks set contact_id = new.merged_into_id where contact_id = new.id;
  end if;
  return new;
end;
$$;

create trigger contacts_move_agenda_on_merge after update of merged_into_id on public.contacts
  for each row execute function app.contacts_move_agenda_on_merge();

create function app.properties_move_agenda_on_merge() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is not null and old.merged_into_id is null then
    update public.appointments set property_id = new.merged_into_id where property_id = new.id;
    update public.tasks set property_id = new.merged_into_id where property_id = new.id;
  end if;
  return new;
end;
$$;

create trigger properties_move_agenda_on_merge after update of merged_into_id on public.properties
  for each row execute function app.properties_move_agenda_on_merge();

-- -----------------------------------------------------------------------------
-- Recordatorios (F-21, F-23): para quien llama, en la inmobiliaria indicada. Tareas vencidas y
-- visitas de las próximas 24 horas. Una sola vez por tarea o visita y fecha.
-- -----------------------------------------------------------------------------
create function public.sync_my_reminders(p_organization_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app.can_read(p_organization_id) then
    return;
  end if;

  insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
  select t.organization_id, auth.uid(), 'task_overdue', left('Tarea vencida: ' || t.title, 200), '',
    '/panel/agenda', 'task:' || t.id || ':' || extract(epoch from t.due_at)::bigint
  from public.tasks t
  where t.organization_id = p_organization_id and t.assigned_user_id = auth.uid()
    and t.status = 'pending' and t.due_at < now()
  on conflict (organization_id, user_id, dedupe_key) do nothing;

  insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
  select a.organization_id, auth.uid(), 'appointment',
    left('Visita con ' || c.full_name, 200), left(p.code || ' · ' || p.title, 500),
    '/panel/agenda', 'appointment:' || a.id || ':' || extract(epoch from a.starts_at)::bigint
  from public.appointments a
  join public.contacts c on c.id = a.contact_id
  join public.properties p on p.id = a.property_id
  where a.organization_id = p_organization_id and a.assigned_user_id = auth.uid()
    and a.status = 'scheduled' and a.starts_at between now() and now() + interval '24 hours'
  on conflict (organization_id, user_id, dedupe_key) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS: todos los miembros ven y gestionan toda la agenda (PRD §6). No se borran: se cancelan.
-- -----------------------------------------------------------------------------
alter table public.appointments enable row level security;
alter table public.appointments force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

revoke all on public.appointments, public.tasks from anon, authenticated;
grant select, insert, update on public.appointments, public.tasks to authenticated;
grant all on public.appointments, public.tasks to service_role;

create policy appointments_select on public.appointments for select to authenticated using (app.can_read(organization_id));
create policy appointments_insert on public.appointments for insert to authenticated with check (app.can_write(organization_id));
create policy appointments_update on public.appointments for update to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));
create policy tasks_select on public.tasks for select to authenticated using (app.can_read(organization_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (app.can_write(organization_id));
create policy tasks_update on public.tasks for update to authenticated
  using (app.can_write(organization_id)) with check (app.can_write(organization_id));

revoke all on function app.agenda_guard(), app.appointments_log_activity(), app.unassign_agenda_of_deactivated_member(),
  app.contacts_move_agenda_on_merge(), app.properties_move_agenda_on_merge() from public;
revoke all on function public.sync_my_reminders(uuid) from public, anon;
grant execute on function public.sync_my_reminders(uuid) to authenticated;
