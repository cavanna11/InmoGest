import { formatDate, formatPhone } from '@inmogest/shared';
import { ArrowLeft, CalendarPlus, MessageCircle, NotebookPen, Phone, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.tsx';
import { Alert, Badge } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization, type ActiveOrganization } from '@/lib/tenant.ts';
import { cn } from '@/lib/utils.ts';
import { getActiveMembers, getContact } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { budgetLabel } from '@/modules/searches/format.ts';
import { getStages, listSearches } from '@/modules/searches/queries.ts';
import { InboxLive, OpenConversation } from '@/modules/whatsapp/components.tsx';
import { conversationTime } from '@/modules/whatsapp/labels.ts';
import { getConversation, getMessages, getSendableProperties, hasActiveConnection, listConversations, type InboxFilter } from '@/modules/whatsapp/queries.ts';
import { AssignSelect, ConversationThread, ReplyBox, SendPropertyPicker } from '@/modules/whatsapp/thread.tsx';

export const metadata: Metadata = { title: 'WhatsApp' };

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'unread', label: 'Sin leer' },
  { value: 'mine', label: 'Mías' },
  { value: 'unassigned', label: 'Sin asignar' },
];

function initials(name: string) {
  const letters = name
    .replace(/^\+/, '')
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || '#';
}

// Bandeja compartida de WhatsApp (CU-04, F-16): lista, conversación y datos del contacto al costado
// (en pantallas chicas, en un panel). Se actualiza sola con Realtime.
export default function ConversationsPage({ searchParams }: PageProps<'/panel/conversaciones'>) {
  return (
    <Suspense fallback={<PageSkeleton variant="inbox" label="Cargando WhatsApp…" />}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<'/panel/conversaciones'>, 'searchParams'>) {
  const { user, organization } = await requireActiveOrganization('/panel/conversaciones');
  const params = await searchParams;
  const filter = FILTERS.find((item) => item.value === params.f)?.value ?? 'all';
  const selected = z.uuid().safeParse(params.c).data ?? null;

  const [conversations, connected, conversation, messages, members, details] = await Promise.all([
    listConversations(organization.id, user.id, filter),
    hasActiveConnection(organization.id),
    selected ? getConversation(organization.id, selected) : null,
    selected ? getMessages(organization.id, selected) : [],
    getActiveMembers(organization.id),
    getOrganizationDetails(organization.id),
  ]);
  const hrefFor = (next: { f?: string; c?: string | null }) => {
    const query = new URLSearchParams();
    const f = next.f ?? filter;
    if (f !== 'all') query.set('f', f);
    const c = next.c === undefined ? selected : next.c;
    if (c) query.set('c', c);
    const text = query.toString();
    return text ? `/panel/conversaciones?${text}` : '/panel/conversaciones';
  };
  const canReassign = organization.isOwner || Boolean(details?.agents_can_reassign);
  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(new Date(now.getTime() - 86_400_000));
  const name = conversation ? (conversation.contacts?.full_name ?? formatPhone(conversation.phone_e164)) : '';

  return (
    <div className="grid gap-4">
      <div className={conversation ? 'hidden lg:block' : undefined}>
        <PageHeader section="conversaciones" title="WhatsApp" description="Las conversaciones de WhatsApp de la inmobiliaria, compartidas por todo el equipo." />
      </div>
      <InboxLive organizationId={organization.id} />

      {!connected ? (
        <Alert variant="warning">
          No hay ningún número conectado: no entran mensajes nuevos ni se puede responder.{' '}
          {organization.isOwner ? (
            <Link href="/panel/whatsapp" className="font-medium underline underline-offset-4">
              Conectar WhatsApp
            </Link>
          ) : (
            'Pedile al dueño de la cuenta que lo conecte.'
          )}
        </Alert>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:h-[calc(100dvh-16rem)] lg:min-h-[30rem] lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_17rem]">
        {/* Lista de conversaciones */}
        <section aria-label="Conversaciones" className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface', conversation && 'hidden lg:flex')}>
          <nav aria-label="Filtrar conversaciones" className="flex flex-wrap gap-1 border-b border-border p-2">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={hrefFor({ f: item.value, c: null })}
                aria-current={item.value === filter ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  item.value === filter ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {conversations.length === 0 ? (
            <Empty className="gap-3 p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircle aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{filter === 'all' ? 'Todavía no hay conversaciones' : 'Nada por acá'}</EmptyTitle>
                <EmptyDescription>
                  {filter === 'all'
                    ? 'Cuando alguien le escriba al número conectado, la conversación aparece acá.'
                    : filter === 'unread'
                      ? 'Respondiste todo. Los mensajes nuevos aparecen acá.'
                      : 'No hay conversaciones con este filtro.'}
                </EmptyDescription>
              </EmptyHeader>
              {filter !== 'all' ? (
                <EmptyContent>
                  <Button asChild variant="outline" size="sm">
                    <Link href={hrefFor({ f: 'all', c: null })}>Ver todas</Link>
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
              {conversations.map((item) => {
                const title = item.contacts?.full_name ?? formatPhone(item.phone_e164);
                const unread = item.unread_count > 0;
                const current = item.id === selected;
                return (
                  <li key={item.id}>
                    <Link
                      href={hrefFor({ c: item.id })}
                      aria-current={current ? 'true' : undefined}
                      className={cn('flex gap-3 px-3 py-3 transition-colors hover:bg-muted', current && 'bg-primary-soft hover:bg-primary-soft')}
                    >
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {initials(title)}
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{title}</span>
                          <span className={cn('shrink-0 text-xs tabular-nums', unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                            {item.last_message_at ? conversationTime(item.last_message_at) : ''}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn('truncate text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>{item.last_message_preview || 'Sin mensajes'}</span>
                          {unread ? (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-highlight px-1.5 text-xs font-semibold text-highlight-foreground tabular-nums">
                              {item.unread_count}
                              <span className="sr-only"> sin leer</span>
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.assigned_user_id ? (members.find((member) => member.userId === item.assigned_user_id)?.name ?? 'Asignada') : 'Sin asignar'}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Conversación abierta */}
        {conversation ? (
          <section
            aria-label={`Conversación con ${name}`}
            className="flex h-[calc(100dvh-12rem)] min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface lg:h-auto lg:min-h-0"
          >
            <OpenConversation conversationId={conversation.id} lastMessageId={messages.at(-1)?.id ?? ''} />
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Button asChild variant="ghost" size="icon" className="size-10 lg:hidden">
                <Link href={hrefFor({ c: null })} aria-label="Volver a la lista de conversaciones">
                  <ArrowLeft aria-hidden="true" />
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{name}</h2>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {formatPhone(conversation.phone_e164)}
                  {conversation.contacts?.do_not_contact ? <Badge variant="warning">No contactar</Badge> : null}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon" className="size-10">
                <a href={`tel:${conversation.phone_e164}`} aria-label={`Llamar a ${name}`} title="Llamar">
                  <Phone aria-hidden="true" />
                </a>
              </Button>
              {conversation.contact_id ? (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-10 xl:hidden" aria-label={`Datos de ${name}`} title="Datos del contacto">
                      <UserRound aria-hidden="true" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[min(22rem,100vw)] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{name}</SheetTitle>
                      <SheetDescription>Datos y acciones del contacto.</SheetDescription>
                    </SheetHeader>
                    <div className="px-4 pb-6">
                      <Suspense fallback={<PageSkeleton variant="list" />}>
                        <ContactPanel organization={organization} userId={user.id} contactId={conversation.contact_id} />
                      </Suspense>
                    </div>
                  </SheetContent>
                </Sheet>
              ) : null}
              {canReassign && organization.canWrite ? (
                <div className="w-full sm:w-auto">
                  <AssignSelect conversationId={conversation.id} assignedUserId={conversation.assigned_user_id} members={members} />
                </div>
              ) : null}
            </header>
            <ConversationThread messages={messages} members={members} today={today} yesterday={yesterday} />
            {organization.canWrite ? (
              <ReplyBox
                organizationId={organization.id}
                conversationId={conversation.id}
                disabled={conversation.whatsapp_connections?.status !== 'connected' || Boolean(conversation.whatsapp_connections?.removed_at)}
              />
            ) : (
              <p className="border-t border-border p-4 text-sm text-muted-foreground">La cuenta está en solo lectura: los mensajes se reciben, pero no se puede responder.</p>
            )}
          </section>
        ) : (
          <Empty className="hidden rounded-lg border border-border bg-surface lg:flex">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Elegí una conversación</EmptyTitle>
              <EmptyDescription>Las que tienen mensajes sin leer aparecen con un número naranja.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {/* Datos del contacto al costado (pantallas grandes) */}
        {conversation?.contact_id ? (
          <aside aria-label="Datos del contacto" className="hidden min-h-0 overflow-y-auto rounded-lg border border-border bg-surface p-4 xl:block">
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <ContactPanel organization={organization} userId={user.id} contactId={conversation.contact_id} />
            </Suspense>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** Lo que hace falta del contacto para seguir la charla: teléfonos, búsquedas y acciones rápidas. */
async function ContactPanel({ organization, userId, contactId }: { organization: ActiveOrganization; userId: string; contactId: string }) {
  const [contact, { searches }, stages, properties] = await Promise.all([
    getContact(organization.id, contactId),
    listSearches(organization.id, userId, { contactId }),
    getStages(organization.id),
    organization.canWrite ? getSendableProperties(organization.id) : Promise.resolve([]),
  ]);
  if (!contact) return <p className="text-sm text-muted-foreground">No encontramos el contacto.</p>;
  const stageName = new Map(stages.map((stage) => [stage.id, stage.name]));

  return (
    <div className="grid gap-5 text-sm">
      <div className="grid gap-1.5">
        <Link href={`/panel/contactos/${contact.id}`} className="font-semibold hover:text-primary hover:underline">
          {contact.full_name}
        </Link>
        <span className="flex flex-wrap gap-1">
          {contact.is_prospect ? <Badge variant="brand">Interesado</Badge> : null}
          {contact.is_owner ? <Badge variant="highlight">Propietario</Badge> : null}
          {contact.do_not_contact ? <Badge variant="destructive">No contactar</Badge> : null}
        </span>
      </div>

      {contact.contact_phones.length > 0 ? (
        <ul aria-label="Teléfonos" className="grid gap-1">
          {contact.contact_phones.map((phone) => (
            <li key={phone.id}>
              <a href={`tel:${phone.phone_e164}`} className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-muted">
                <Phone aria-hidden="true" className="size-4 text-primary" />
                <span className="tabular-nums">{formatPhone(phone.phone_e164)}</span>
                <span className="sr-only">(llamar)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {organization.canWrite ? (
        <div className="grid gap-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link href={`/panel/agenda?agendar=1&contacto=${contact.id}`}>
              <CalendarPlus aria-hidden="true" />
              Agendar visita
            </Link>
          </Button>
          <SendPropertyPicker contactId={contact.id} properties={properties} />
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link href={`/panel/contactos/${contact.id}#historial`}>
              <NotebookPen aria-hidden="true" />
              Anotar en el historial
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Qué busca</h3>
        {searches.length === 0 ? (
          <p className="text-muted-foreground">
            Sin búsquedas cargadas.{' '}
            {organization.canWrite ? (
              <Link href={`/panel/busquedas/nueva?contacto=${contact.id}`} className="font-medium text-primary underline underline-offset-4">
                Cargar qué busca
              </Link>
            ) : null}
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {searches.slice(0, 3).map((search) => {
              const matches = search.match_results.filter((match) => !match.stale && match.status !== 'dismissed').length;
              return (
                <li key={search.id}>
                  <Link href={`/panel/busquedas/${search.id}`} className="grid gap-0.5 rounded-md bg-muted px-3 py-2 hover:bg-primary-soft">
                    <span className="font-medium tabular-nums">{budgetLabel(search.budget_min, search.budget_max, search.currency)}</span>
                    <span className="text-xs text-muted-foreground">
                      {stageName.get(search.stage_id) ?? 'Sin etapa'} · {matches === 1 ? '1 propiedad le sirve' : `${matches} propiedades le sirven`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {contact.notes ? (
        <div className="grid gap-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notas</h3>
          <p className="line-clamp-6 whitespace-pre-line text-pretty text-muted-foreground">{contact.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
