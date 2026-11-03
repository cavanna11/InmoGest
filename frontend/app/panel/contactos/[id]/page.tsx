import { formatDate, formatDateTime, formatPhone } from '@inmogest/shared';
import { Mail, Phone, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { removeChannelAction } from '@/modules/contacts/actions.ts';
import { ActivityForm, AddChannelForm, ContactEditForm, ReportDuplicateForm } from '@/modules/contacts/components.tsx';
import { getActiveMembers, getActivities, getContact, getSimilarContacts } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';

export const metadata: Metadata = { title: 'Contacto' };

const SOURCES: Record<string, string> = { manual: 'Carga manual', whatsapp: 'WhatsApp', import: 'Importación' };

// Ficha del contacto (F-06, F-07, F-19, F-22, F-34).
export default function ContactPage({ params }: PageProps<'/panel/contactos/[id]'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/contactos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Contactos
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Cargando contacto…</p>}>
        <Contact params={params} />
      </Suspense>
    </div>
  );
}

function activityText(activity: { kind: string; body: string; metadata: unknown }, names: Map<string, string>): string {
  const meta = (activity.metadata ?? {}) as Record<string, unknown>;
  switch (activity.kind) {
    case 'contact_created':
      return `Contacto creado (${SOURCES[String(meta.source)] ?? 'carga manual'}).`;
    case 'assigned':
      return meta.to ? `Asignado a ${names.get(String(meta.to)) ?? 'un miembro del equipo'}.` : 'Quedó sin asignar.';
    case 'do_not_contact':
      return meta.value ? 'Marcado como "no contactar".' : 'Se quitó la marca "no contactar".';
    case 'contact_merged':
      return `Se unificó con "${String(meta.merged_name ?? 'otro contacto')}".`;
    default:
      return activity.body;
  }
}

async function Contact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { organization } = await requireActiveOrganization(`/panel/contactos/${id}`);
  const contact = await getContact(organization.id, id);
  if (!contact) notFound();
  // Un contacto unificado lleva al que lo absorbió.
  if (contact.merged_into_id) redirect(`/panel/contactos/${contact.merged_into_id}`);

  const [members, activities, details, similar] = await Promise.all([
    getActiveMembers(organization.id),
    getActivities(organization.id, id),
    getOrganizationDetails(organization.id),
    getSimilarContacts(organization.id, id, contact.full_name),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const canWrite = organization.canWrite;
  const canReassign = organization.isOwner || Boolean(details?.agents_can_reassign);

  return (
    <>
      <PageHeader
        section="contactos"
        title={contact.full_name}
        description={`${SOURCES[contact.source] ?? 'Carga manual'} · creado el ${formatDate(contact.created_at)}`}
        badge={
          <span className="flex flex-wrap gap-1">
            {contact.is_prospect ? <Badge variant="brand">Interesado</Badge> : null}
            {contact.is_owner ? <Badge variant="highlight">Propietario</Badge> : null}
            {contact.do_not_contact ? <Badge variant="destructive">No contactar</Badge> : null}
          </span>
        }
      />
      {!canWrite ? <Alert variant="warning">La cuenta está en solo lectura: podés consultar, pero no modificar.</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardTitle>Datos</CardTitle>
            <div className="mt-4">
              {canWrite ? (
                <ContactEditForm contact={contact} members={members} canReassign={canReassign} />
              ) : (
                <dl className="grid gap-2 text-sm">
                  <dt className="text-muted-foreground">Asignado a</dt>
                  <dd>{contact.assigned_user_id ? names.get(contact.assigned_user_id) : 'Sin asignar'}</dd>
                  <dt className="text-muted-foreground">Notas</dt>
                  <dd className="whitespace-pre-line">{contact.notes || '—'}</dd>
                </dl>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Historial</CardTitle>
            {canWrite ? (
              <div className="mt-4">
                <ActivityForm contactId={contact.id} />
              </div>
            ) : null}
            <ol className="mt-6 grid gap-4 border-l-2 border-primary-soft pl-5">
              {activities.map((activity) => (
                <li key={activity.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ${activity.kind === 'note' || activity.kind === 'call' ? 'bg-highlight' : 'bg-primary'}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(activity.created_at)}
                    {activity.author_id ? ` · ${names.get(activity.author_id) ?? 'Ex miembro del equipo'}` : ''}
                    {activity.kind === 'call' ? ' · Llamada' : activity.kind === 'note' ? ' · Nota' : ''}
                  </p>
                  <p className="mt-0.5 text-sm whitespace-pre-line">{activityText(activity, names)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardTitle>Teléfonos</CardTitle>
            <ul className="mt-3 grid gap-2">
              {contact.contact_phones.length === 0 ? <li className="text-sm text-muted-foreground">Sin teléfonos.</li> : null}
              {contact.contact_phones.map((phone) => (
                <li key={phone.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Phone aria-hidden="true" className="size-4 text-primary" />
                    {formatPhone(phone.phone_e164)}
                  </span>
                  {canWrite ? (
                    <form action={removeChannelAction}>
                      <input type="hidden" name="channelId" value={phone.id} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <input type="hidden" name="kind" value="phone" />
                      <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label={`Quitar ${formatPhone(phone.phone_e164)}`}>
                        <X aria-hidden="true" />
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <div className="mt-3">
                <AddChannelForm contactId={contact.id} kind="phone" />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Emails</CardTitle>
            <ul className="mt-3 grid gap-2">
              {contact.contact_emails.length === 0 ? <li className="text-sm text-muted-foreground">Sin emails.</li> : null}
              {contact.contact_emails.map((email) => (
                <li key={email.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Mail aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{email.email}</span>
                  </span>
                  {canWrite ? (
                    <form action={removeChannelAction}>
                      <input type="hidden" name="channelId" value={email.id} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <input type="hidden" name="kind" value="email" />
                      <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label={`Quitar ${email.email}`}>
                        <X aria-hidden="true" />
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <div className="mt-3">
                <AddChannelForm contactId={contact.id} kind="email" />
              </div>
            ) : null}
          </Card>

          {canWrite ? (
            <Card>
              <CardTitle>¿Está repetido?</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Reportalo y el dueño decide si se unifican. Nunca se unifican solos.
              </p>
              <div className="mt-4">
                <ReportDuplicateForm contactId={contact.id} candidates={similar} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
