import { formatDate, formatTime, fromLocal, toLocalParts } from '@inmogest/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { rescheduleAppointmentAction, setAppointmentStatusAction, setTaskStatusAction } from '@/modules/agenda/actions.ts';
import { AppointmentForm, TaskForm } from '@/modules/agenda/components.tsx';
import { getAgendaOptions, getAppointments, getPendingTasks } from '@/modules/agenda/queries.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';

export const metadata: Metadata = { title: 'Agenda' };

const STATUS = {
  scheduled: { label: 'Agendada', variant: 'brand' },
  done: { label: 'Realizada', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'default' },
  no_show: { label: 'No asistió', variant: 'warning' },
} as const;

const PRIORITY = {
  high: { label: 'Alta', variant: 'destructive' },
  normal: { label: 'Normal', variant: 'default' },
  low: { label: 'Baja', variant: 'default' },
} as const;

// Hoy en Argentina y límites de la semana pedida. Fuera del componente: la hora actual no es parte
// del render (regla de pureza de React).
function weekRange(offset: number) {
  const now = toLocalParts(new Date());
  const start = fromLocal({ year: now.year, month: now.month, day: now.day + offset * 7, hour: 0, minute: 0 });
  const end = fromLocal({ year: now.year, month: now.month, day: now.day + (offset + 1) * 7, hour: 0, minute: 0 });
  const pad = (value: number) => value.toString().padStart(2, '0');
  return { start, end, today: `${now.year}-${pad(now.month)}-${pad(now.day)}`, nowMs: Date.now() };
}

function isoDate(iso: string) {
  const p = toLocalParts(iso);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

// Agenda de visitas y tareas (CU-10, F-21): "mi agenda" o la de todo el equipo, por semana.
export default function AgendaPage({ searchParams }: PageProps<'/panel/agenda'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="agenda" title="Agenda" description="Visitas y tareas del equipo. Te avisamos de las tareas vencidas y de las visitas de las próximas 24 horas." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando agenda…</p>}>
        <Agenda searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Agenda({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/agenda');
  const params = await searchParams;
  const team = params.vista === 'equipo';
  const offset = Number(typeof params.semana === 'string' ? params.semana : '0') || 0;
  const { start, end, today, nowMs } = weekRange(offset);
  const onlyUser = team ? null : user.id;
  const [appointments, tasks, members, options, details] = await Promise.all([
    getAppointments(organization.id, start.toISOString(), end.toISOString(), onlyUser),
    getPendingTasks(organization.id, onlyUser),
    getActiveMembers(organization.id),
    organization.canWrite ? getAgendaOptions(organization.id) : Promise.resolve({ contacts: [], properties: [] }),
    getOrganizationDetails(organization.id),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const canWrite = organization.canWrite;
  const formOptions = {
    contacts: options.contacts,
    properties: options.properties,
    members,
    currentUserId: user.id,
    canAssignOthers: organization.isOwner || Boolean(details?.agents_can_reassign),
    today,
  };
  const byDay = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const day = formatDate(appointment.starts_at);
    byDay.set(day, [...(byDay.get(day) ?? []), appointment]);
  }
  const href = (week: number, view: boolean) => `/panel/agenda?semana=${week}${view ? '&vista=equipo' : ''}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant={team ? 'outline' : 'secondary'} size="sm">
          <Link href={href(offset, false)}>Mi agenda</Link>
        </Button>
        <Button asChild variant={team ? 'secondary' : 'outline'} size="sm">
          <Link href={href(offset, true)}>Todo el equipo</Link>
        </Button>
      </div>

      {canWrite ? (
        <Card className="grid gap-3">
          <details>
            <summary className="cursor-pointer font-semibold text-primary">+ Agendar una visita</summary>
            <div className="mt-4">
              {formOptions.contacts.length === 0 || formOptions.properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Para agendar una visita hace falta tener al menos un contacto y una propiedad cargados.</p>
              ) : (
                <AppointmentForm {...formOptions} />
              )}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold text-primary">+ Crear una tarea</summary>
            <div className="mt-4">
              <TaskForm {...formOptions} />
            </div>
          </details>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Visitas</CardTitle>
            <span className="flex items-center gap-1 text-sm">
              <Button asChild variant="ghost" size="sm">
                <Link href={href(offset - 1, team)}>← Anterior</Link>
              </Button>
              <span className="text-muted-foreground">
                {formatDate(start)} al {formatDate(new Date(end.getTime() - 1))}
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link href={href(offset + 1, team)}>Siguiente →</Link>
              </Button>
            </span>
          </div>
          {byDay.size === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay visitas en estos días.</p> : null}
          <div className="mt-4 grid gap-5">
            {[...byDay.entries()].map(([day, items]) => (
              <section key={day}>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</h3>
                <ul className="grid gap-2">
                  {items.map((appointment) => {
                    const status = STATUS[appointment.status];
                    const current = isoDate(appointment.starts_at);
                    return (
                      <li key={appointment.id} className="grid gap-2 rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-bold text-primary">{formatTime(appointment.starts_at)}</span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/panel/contactos/${appointment.contacts?.id}`} className="text-sm font-semibold hover:text-primary">
                              {appointment.contacts?.full_name}
                            </Link>
                            <Link href={`/panel/propiedades/${appointment.properties?.id}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
                              {appointment.properties?.code} · {appointment.properties?.title}
                            </Link>
                          </div>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {appointment.assigned_user_id ? (names.get(appointment.assigned_user_id) ?? 'Ex miembro del equipo') : 'Sin asignar'}
                          {appointment.notes ? ` · ${appointment.notes}` : ''}
                        </p>
                        {canWrite && appointment.status === 'scheduled' ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {(['done', 'no_show', 'cancelled'] as const).map((value) => (
                              <form key={value} action={setAppointmentStatusAction}>
                                <input type="hidden" name="id" value={appointment.id} />
                                <input type="hidden" name="status" value={value} />
                                <Button type="submit" variant="ghost" size="sm">
                                  {value === 'done' ? 'Realizada' : value === 'no_show' ? 'No asistió' : 'Cancelar'}
                                </Button>
                              </form>
                            ))}
                            <details className="text-sm">
                              <summary className="cursor-pointer px-3 py-2 font-medium">Reprogramar</summary>
                              <form action={rescheduleAppointmentAction} className="flex flex-wrap items-center gap-2 pt-1">
                                <input type="hidden" name="id" value={appointment.id} />
                                <Input name="date" type="date" aria-label="Fecha" defaultValue={current.date} className="w-auto" />
                                <Input name="time" type="time" aria-label="Hora" defaultValue={current.time} className="w-auto" />
                                <Button type="submit" variant="outline" size="sm">
                                  Guardar
                                </Button>
                              </form>
                            </details>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Tareas pendientes</CardTitle>
          {tasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay tareas pendientes.</p> : null}
          <ul className="mt-4 grid gap-2">
            {tasks.map((task) => {
              const overdue = new Date(task.due_at).getTime() < nowMs;
              const priority = PRIORITY[task.priority];
              return (
                <li key={task.id} className={`grid gap-1 rounded-md border p-3 ${overdue ? 'border-destructive' : 'border-border'}`}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {task.title}
                    {task.priority !== 'normal' ? <Badge variant={priority.variant}>{priority.label}</Badge> : null}
                    {overdue ? <Badge variant="destructive">Vencida</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(task.due_at)} {formatTime(task.due_at)} · {task.assigned_user_id ? (names.get(task.assigned_user_id) ?? 'Ex miembro del equipo') : 'Sin asignar'}
                    {task.contacts ? ` · ${task.contacts.full_name}` : ''}
                    {task.properties ? ` · ${task.properties.code}` : ''}
                  </p>
                  {canWrite ? (
                    <div className="flex gap-1">
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="status" value="done" />
                        <Button type="submit" variant="secondary" size="sm">
                          Hecha
                        </Button>
                      </form>
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancelar
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
