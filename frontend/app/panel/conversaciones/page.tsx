import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { AssignForm, Composer, InboxLive, MessageList, OpenConversation } from '@/modules/whatsapp/components.tsx';
import { getConversation, getMessages, hasActiveConnection, listConversations, type InboxFilter } from '@/modules/whatsapp/queries.ts';
import { conversationTime } from '@/modules/whatsapp/labels.ts';

export const metadata: Metadata = { title: 'Conversaciones' };

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Mías' },
  { value: 'unassigned', label: 'Sin asignar' },
  { value: 'unread', label: 'Sin leer' },
];

// Bandeja compartida de WhatsApp (CU-04, F-16). Se actualiza sola con Realtime.
export default function ConversationsPage({ searchParams }: PageProps<'/panel/conversaciones'>) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
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
  const lastMessageId = messages.at(-1)?.id ?? '';

  return (
    <div className="grid gap-4">
      <PageHeader section="conversaciones" title="Conversaciones" description="La bandeja de WhatsApp de la inmobiliaria, compartida por todo el equipo." />
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

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className={`min-w-0 p-0 ${conversation ? 'hidden lg:block' : ''}`}>
          <nav aria-label="Filtros" className="flex flex-wrap gap-1 border-b border-border p-2">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={hrefFor({ f: item.value, c: null })}
                aria-current={item.value === filter ? 'page' : undefined}
                className={`rounded-md px-2.5 py-1 text-sm ${item.value === filter ? 'bg-primary-soft font-medium text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ul className="max-h-[70dvh] divide-y divide-border overflow-y-auto">
            {conversations.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">
                {filter === 'all' ? 'Todavía no hay conversaciones. Cuando alguien escriba al número conectado, aparece acá.' : 'No hay conversaciones con este filtro.'}
              </li>
            ) : null}
            {conversations.map((item) => (
              <li key={item.id}>
                <Link
                  href={hrefFor({ c: item.id })}
                  aria-current={item.id === selected ? 'true' : undefined}
                  className={`grid gap-0.5 px-3 py-2.5 hover:bg-muted ${item.id === selected ? 'bg-primary-soft' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${item.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}>{item.contacts?.full_name ?? item.phone_e164}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.last_message_at ? conversationTime(item.last_message_at) : ''}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted-foreground">{item.last_message_preview || 'Sin mensajes'}</span>
                    {item.unread_count > 0 ? (
                      <span aria-label={`${item.unread_count} sin leer`} className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-highlight px-1 text-xs font-semibold text-white">
                        {item.unread_count}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.assigned_user_id ? (members.find((member) => member.userId === item.assigned_user_id)?.name ?? 'Asignada') : 'Sin asignar'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {conversation ? (
          <Card className="grid min-w-0 content-start gap-3 p-0">
            <OpenConversation conversationId={conversation.id} lastMessageId={lastMessageId} />
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <Link href={hrefFor({ c: null })} className="text-sm text-primary underline underline-offset-4 lg:hidden">
                  Volver a la bandeja
                </Link>
                <h2 className="truncate font-semibold">
                  <Link href={`/panel/contactos/${conversation.contact_id}`} className="hover:underline">
                    {conversation.contacts?.full_name ?? conversation.phone_e164}
                  </Link>
                </h2>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {conversation.phone_e164}
                  {conversation.contacts?.do_not_contact ? <Badge variant="warning">No contactar</Badge> : null}
                </p>
              </div>
              {canReassign && organization.canWrite ? (
                <AssignForm conversationId={conversation.id} assignedUserId={conversation.assigned_user_id} members={members} />
              ) : null}
            </header>
            <MessageList messages={messages} members={members} />
            {organization.canWrite ? (
              <Composer organizationId={organization.id} conversationId={conversation.id} disabled={conversation.whatsapp_connections?.status !== 'connected' || Boolean(conversation.whatsapp_connections?.removed_at)} />
            ) : (
              <p className="border-t border-border p-4 text-sm text-muted-foreground">La cuenta está en solo lectura: los mensajes se reciben, pero no se puede responder.</p>
            )}
          </Card>
        ) : (
          <Card className="hidden place-items-center p-10 text-sm text-muted-foreground lg:grid">Elegí una conversación para verla.</Card>
        )}
      </div>
    </div>
  );
}
