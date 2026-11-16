import { formatPhone, formatTime, TIME_ZONE } from '@inmogest/shared';
import { CalendarCheck, CalendarDays, ChevronDown, ListTodo, MessageCircle, Store, UserRoundSearch, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.tsx';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { PropertyCode } from '@/components/ui/property-code.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization, type ActiveOrganization } from '@/lib/tenant.ts';
import { cn } from '@/lib/utils.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getMercadoLibreConnection } from '@/modules/integrations/queries.ts';
import { setOnboardingStepAction } from '@/modules/onboarding/actions.ts';
import { getOnboardingProgress, type OnboardingStep } from '@/modules/organization/queries.ts';
import {
  getContactsToFollowUp,
  getDueTasks,
  getTodayAppointments,
  getUnansweredConversations,
  getUnpublishedProperties,
  STALE_DAYS,
  todayRange,
} from '@/modules/panel/today-queries.ts';
import { StartConversationButton } from '@/modules/whatsapp/components.tsx';
import { conversationTime } from '@/modules/whatsapp/labels.ts';
import { hasActiveConnection } from '@/modules/whatsapp/queries.ts';

export const metadata: Metadata = { title: 'Hoy' };

// "Hoy": lo que necesita atención en el día (consultas sin responder, visitas, clientes para retomar,
// tareas y propiedades sin publicar). No es un tablero de números: cada fila lleva a resolverla.
export default function TodayPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" label="Cargando lo de hoy…" />}>
      <Today />
    </Suspense>
  );
}

// Asistente de configuración (CU-01 paso 5, F-03): queda arriba, chico, hasta completarse.
const STEPS: Array<{ step: OnboardingStep; title: string; description: string; href: string }> = [
  { step: 'organization', title: 'Datos y logo de la inmobiliaria', description: 'Nombre, contacto, moneda y logo.', href: '/panel/configuracion' },
  { step: 'team', title: 'Invitá a tu equipo', description: 'Sumá a los agentes de la inmobiliaria.', href: '/panel/equipo' },
  { step: 'whatsapp', title: 'Conectá WhatsApp', description: 'El número de la inmobiliaria, con un código QR.', href: '/panel/whatsapp' },
  { step: 'data', title: 'Cargá o importá propiedades y contactos', description: 'A mano o desde una planilla.', href: '/panel/importar' },
];

const longDate = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE });

function sinceText(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

async function Today() {
  const { organization } = await requireActiveOrganization('/panel');
  const { start, end, now } = todayRange();
  const [unanswered, visits, followUp, tasks, unpublished, members, connected, mercadoLibre, progress] = await Promise.all([
    getUnansweredConversations(organization.id),
    getTodayAppointments(organization.id, start, end),
    getContactsToFollowUp(organization.id, now),
    getDueTasks(organization.id, end),
    getUnpublishedProperties(organization.id),
    getActiveMembers(organization.id),
    hasActiveConnection(organization.id),
    getMercadoLibreConnection(organization.id),
    organization.isOwner ? getOnboardingProgress(organization.id) : Promise.resolve(null),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const showAgent = members.length > 1;
  const mlConnected = mercadoLibre?.status === 'connected';
  const overdue = tasks.items.filter((task) => new Date(task.due_at).getTime() < now.getTime()).length;

  const pending = [
    unanswered.total > 0 ? plural(unanswered.total, 'conversación sin responder', 'conversaciones sin responder') : null,
    visits.length > 0 ? plural(visits.length, 'visita', 'visitas') : null,
    followUp.total > 0 ? plural(followUp.total, 'cliente para retomar', 'clientes para retomar') : null,
    tasks.total > 0 ? plural(tasks.total, 'tarea', 'tareas') : null,
  ].filter(Boolean);
  const formatted = longDate.format(now);
  const date = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <div className="grid gap-6">
      <PageHeader
        section=""
        title="Hoy"
        description={
          <>
            {date}
            {' · '}
            {pending.length > 0 ? `Tenés ${pending.join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : 'Estás al día.'}
          </>
        }
      />

      {progress ? <Onboarding organization={organization} progress={progress} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          id="sin-responder"
          icon={MessageCircle}
          title="Sin responder"
          count={unanswered.total}
          more={{ href: '/panel/conversaciones?f=unread', label: 'Ver todas en WhatsApp' }}
        >
          {unanswered.items.length === 0 ? (
            connected ? (
              <EmptyBlock title="Estás al día con WhatsApp" description="Cuando entre un mensaje nuevo, aparece acá." />
            ) : (
              <EmptyBlock title="WhatsApp no está conectado" description="Sin un número conectado no entran mensajes al panel.">
                {organization.isOwner ? (
                  <Button asChild size="sm">
                    <Link href="/panel/whatsapp">Conectar WhatsApp</Link>
                  </Button>
                ) : null}
              </EmptyBlock>
            )
          ) : (
            <Rows>
              {unanswered.items.map((conversation) => (
                <li key={conversation.id}>
                  <Link href={`/panel/conversaciones?c=${conversation.id}`} className={rowLink}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{conversation.contacts?.full_name ?? formatPhone(conversation.phone_e164)}</span>
                      <span className="block truncate text-sm text-muted-foreground">{conversation.last_message_preview || 'Mensaje nuevo'}</span>
                    </span>
                    <span className="grid shrink-0 justify-items-end gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">{conversation.last_message_at ? conversationTime(conversation.last_message_at) : ''}</span>
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-highlight px-1.5 text-xs font-semibold text-highlight-foreground tabular-nums">
                        {conversation.unread_count}
                        <span className="sr-only"> sin leer</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </Rows>
          )}
        </Block>

        <Block id="visitas" icon={CalendarDays} title="Visitas de hoy" count={visits.length} more={{ href: '/panel/agenda?vista=equipo', label: 'Ver la agenda' }}>
          {visits.length === 0 ? (
            <EmptyBlock title="No hay visitas para hoy" description="Las visitas que agendes para hoy aparecen acá, en orden.">
              {organization.canWrite ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/panel/agenda?agendar=1">Agendar visita</Link>
                </Button>
              ) : null}
            </EmptyBlock>
          ) : (
            <Rows>
              {visits.map((visit) => (
                <li key={visit.id}>
                  <Link href={`/panel/contactos/${visit.contacts?.id}`} className={rowLink}>
                    <span className="w-12 shrink-0 text-base font-semibold text-primary tabular-nums">{formatTime(visit.starts_at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{visit.contacts?.full_name ?? 'Cliente'}</span>
                      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                        <PropertyCode code={visit.properties?.code ?? null} />
                        <span className="truncate">{visit.properties?.title}</span>
                      </span>
                    </span>
                    {showAgent ? (
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                        {visit.assigned_user_id ? (names.get(visit.assigned_user_id) ?? 'Ex miembro') : 'Sin asignar'}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </Rows>
          )}
        </Block>

        <Block
          id="para-retomar"
          icon={UserRoundSearch}
          title="Para retomar"
          hint={`Búsquedas abiertas sin novedades hace más de ${STALE_DAYS} días`}
          count={followUp.total}
          more={{ href: '/panel/oportunidades', label: 'Ver oportunidades' }}
        >
          {followUp.items.length === 0 ? (
            <EmptyBlock
              title="Nadie para retomar"
              description={`Todos los clientes con una búsqueda abierta tuvieron novedades en los últimos ${STALE_DAYS} días.`}
            />
          ) : (
            <Rows>
              {followUp.items.map((item) => (
                <li key={item.contactId} className="flex items-center gap-2 pr-3">
                  <Link href={`/panel/contactos/${item.contactId}`} className={cn(rowLink, 'pr-0')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {item.stage} · último movimiento {sinceText(item.lastTouch, now)}
                        {item.matches > 0 ? ` · ${plural(item.matches, 'propiedad que le sirve', 'propiedades que le sirven')}` : ''}
                      </span>
                    </span>
                  </Link>
                  {organization.canWrite ? <StartConversationButton contactId={item.contactId} contactName={item.name} /> : null}
                </li>
              ))}
            </Rows>
          )}
        </Block>

        <Block
          id="tareas"
          icon={ListTodo}
          title="Tareas de hoy"
          count={tasks.total}
          badge={overdue > 0 ? <Badge variant="destructive">{plural(overdue, 'vencida', 'vencidas')}</Badge> : null}
          more={{ href: '/panel/agenda', label: 'Ver todas las tareas' }}
        >
          {tasks.items.length === 0 ? (
            <EmptyBlock title="Sin tareas para hoy" description="Las tareas que venzan hoy, o que ya vencieron, aparecen acá.">
              {organization.canWrite ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/panel/agenda">Crear una tarea</Link>
                </Button>
              ) : null}
            </EmptyBlock>
          ) : (
            <Rows>
              {tasks.items.map((task) => {
                const late = new Date(task.due_at).getTime() < now.getTime();
                return (
                  <li key={task.id}>
                    <Link href="/panel/agenda" className={rowLink}>
                      <CalendarCheck aria-hidden="true" className={cn('size-4 shrink-0', late ? 'text-destructive' : 'text-muted-foreground')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{task.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {late ? 'Vencida' : `Hoy ${formatTime(task.due_at)}`}
                          {task.contacts ? ` · ${task.contacts.full_name}` : ''}
                          {task.properties?.code ? ` · ${task.properties.code}` : ''}
                        </span>
                      </span>
                      {task.priority === 'high' ? <Badge variant="destructive">Alta</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </Rows>
          )}
        </Block>

        <Block
          id="sin-publicar"
          icon={Store}
          title="Sin publicar en Mercado Libre"
          hint={mlConnected ? 'Propiedades disponibles sin publicación' : 'Para publicar desde el panel, el dueño conecta la cuenta en Integraciones'}
          count={unpublished.total}
          more={{ href: '/panel/propiedades?estado=available', label: 'Ver propiedades disponibles' }}
          className="lg:col-span-2"
        >
          {unpublished.items.length === 0 ? (
            <EmptyBlock title="Todo publicado" description="Todas las propiedades disponibles tienen su publicación en Mercado Libre." />
          ) : (
            <Rows>
              {unpublished.items.map((property) => (
                <li key={property.id} className="flex items-center gap-2 pr-3">
                  <Link href={`/panel/propiedades/${property.id}`} className={cn(rowLink, 'pr-0')}>
                    <PropertyCode code={property.code} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{property.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[property.neighborhood, property.city].filter(Boolean).join(', ') || 'Sin ubicación'}
                      </span>
                    </span>
                  </Link>
                  {organization.canWrite && mlConnected ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/panel/propiedades/${property.id}/mercadolibre`} aria-label={`Publicar ${property.title} en Mercado Libre`}>
                        Publicar
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </Rows>
          )}
        </Block>
      </div>
    </div>
  );
}

const rowLink = 'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted';

function Block({
  id,
  icon: Icon,
  title,
  hint,
  count,
  badge,
  more,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  count: number;
  badge?: ReactNode;
  more: { href: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col rounded-lg border border-border bg-surface', className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-4 pb-2">
        <Icon aria-hidden="true" className="size-4 text-primary" />
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {count > 0 ? (
          <span className="rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground tabular-nums">
            {count}
            <span className="sr-only"> en total</span>
          </span>
        ) : null}
        {badge}
        {hint ? <p className="w-full text-xs text-muted-foreground">{hint}</p> : null}
      </header>
      <div className="flex-1 px-1 pb-1">{children}</div>
      {count > 0 ? (
        <footer className="border-t border-border px-4 py-2.5">
          <Link href={more.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {more.label}
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="grid divide-y divide-border">{children}</ul>;
}

function EmptyBlock({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <Empty className="gap-3 p-6 md:p-6">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

function Onboarding({ organization, progress }: { organization: ActiveOrganization; progress: Awaited<ReturnType<typeof getOnboardingProgress>> }) {
  const completed = STEPS.filter(({ step }) => progress.get(step)?.completed_at).length;
  if (completed === STEPS.length) return null;
  const next = STEPS.find(({ step }) => !progress.get(step)?.completed_at && !progress.get(step)?.skipped_at);
  return (
    <Collapsible className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:flex-1">
          <p className="text-sm font-semibold">
            Configuración inicial <span className="font-normal text-muted-foreground">· {completed} de {STEPS.length} listos</span>
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progreso de la configuración"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={completed}
          >
            <div className="h-full bg-primary" style={{ width: `${(completed / STEPS.length) * 100}%` }} />
          </div>
        </div>
        {next ? (
          <Button asChild size="sm">
            <Link href={next.href}>{next.title}</Link>
          </Button>
        ) : null}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group">
            Ver los pasos
            <ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ol className="grid divide-y divide-border border-t border-border">
          {STEPS.map(({ step, title, description, href }) => {
            const row = progress.get(step);
            const status = row?.completed_at ? 'done' : row?.skipped_at ? 'skipped' : 'pending';
            return (
              <li key={step} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {title}
                    {status === 'done' ? <Badge variant="success">Listo</Badge> : null}
                    {status === 'skipped' ? <Badge>Salteado</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                {status !== 'done' ? (
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={href}>{status === 'skipped' ? 'Retomar' : 'Empezar'}</Link>
                    </Button>
                    {organization.canWrite ? (
                      <form action={setOnboardingStepAction}>
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="skip" value={status === 'skipped' ? '0' : '1'} />
                        <Button type="submit" size="sm" variant="ghost">
                          {status === 'skipped' ? 'Marcar pendiente' : 'Saltear'}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
