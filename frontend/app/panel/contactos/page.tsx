import { formatDate, formatPhone } from '@inmogest/shared';
import { Plus, Users, UserRoundSearch } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { cn } from '@/lib/utils.ts';
import { ContactActions } from '@/modules/contacts/contact-actions.tsx';
import { countOpenDuplicateReports, getActiveMembers, listContacts, PAGE_SIZE } from '@/modules/contacts/queries.ts';
import { ListControls, type ListFilter } from '@/modules/panel/list-controls.tsx';
import { getContactsToFollowUp, STALE_DAYS } from '@/modules/panel/today-queries.ts';

export const metadata: Metadata = { title: 'Contactos' };

const SORTS = { recientes: 'Últimos movimientos', nombre: 'Nombre (A a Z)', nuevos: 'Cargados recientemente' };

// Contactos (F-06, F-07): búsqueda por nombre, teléfono o email, filtros, vistas guardadas y acciones
// por fila. La vista "Para retomar" lista a quienes tienen una búsqueda abierta y hace tiempo que no
// tienen novedades (repesca).
export default function ContactsPage({ searchParams }: PageProps<'/panel/contactos'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader section="contactos" title="Contactos" description="Interesados y propietarios de la inmobiliaria, con todo su historial." />
        <Suspense fallback={null}>
          <NewContactButton />
        </Suspense>
      </div>
      <Suspense fallback={<PageSkeleton variant="list" label="Cargando contactos…" />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewContactButton() {
  const { organization } = await requireActiveOrganization('/panel/contactos');
  if (!organization.canWrite) return null;
  return (
    <Button asChild>
      <Link href="/panel/contactos/nuevo">
        <Plus aria-hidden="true" /> Nuevo contacto
      </Link>
    </Button>
  );
}

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function sinceText(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/contactos');
  const raw = await searchParams;
  const followUpView = param(raw.vista) === 'retomar';
  const params = { q: param(raw.q), asignado: param(raw.asignado), tipo: param(raw.tipo), orden: param(raw.orden) };
  const now = new Date();

  const [{ contacts, total, page }, members, duplicates, followUp] = await Promise.all([
    followUpView
      ? Promise.resolve({ contacts: [], total: 0, page: 1 })
      : listContacts(organization.id, user.id, {
          q: params.q || undefined,
          assigned: params.asignado || undefined,
          kind: params.tipo || undefined,
          sort: params.orden || undefined,
          page: Number(param(raw.pagina) || '1') || 1,
        }),
    getActiveMembers(organization.id),
    organization.isOwner ? countOpenDuplicateReports(organization.id) : Promise.resolve(0),
    getContactsToFollowUp(organization.id, now, 50),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const filtered = Boolean(params.q || params.asignado || params.tipo);
  const pages = Math.ceil(total / PAGE_SIZE);
  const filters: ListFilter[] = [
    {
      key: 'asignado',
      label: 'A cargo',
      all: 'De todo el equipo',
      options: { mine: 'Mis contactos', unassigned: 'Sin asignar', ...Object.fromEntries(members.map((member) => [member.userId, member.name])) },
    },
    { key: 'tipo', label: 'Tipo', all: 'Todos los tipos', options: { prospect: 'Interesados', owner: 'Propietarios', dnc: 'No contactar' } },
  ];
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) next.set(key, value);
    next.set('pagina', String(target));
    return `/panel/contactos?${next.toString()}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vistas de contactos" className="inline-flex rounded-lg bg-muted p-1">
          {[
            { href: '/panel/contactos', label: 'Todos', current: !followUpView },
            { href: '/panel/contactos?vista=retomar', label: `Para retomar${followUp.total > 0 ? ` (${followUp.total})` : ''}`, current: followUpView },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium tabular-nums transition-colors',
                tab.current ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {organization.isOwner && duplicates > 0 ? (
          <Link href="/panel/contactos/duplicados" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            Posibles duplicados <Badge variant="highlight">{duplicates}</Badge>
          </Link>
        ) : null}
      </div>

      {followUpView ? (
        <FollowUpList items={followUp.items} canWrite={organization.canWrite} now={now} />
      ) : (
        <>
          <ListControls
            params={params}
            filters={filters}
            sorts={SORTS}
            storageKey="contactos"
            searchLabel="Buscar contactos"
            searchPlaceholder="Nombre, teléfono o email"
          />

          {contacts.length === 0 ? (
            <Empty className="border border-border bg-surface">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{filtered ? 'No hay contactos con esos filtros' : 'Cargá tu primer contacto'}</EmptyTitle>
                <EmptyDescription>
                  {filtered
                    ? 'Probá buscando por teléfono o con otra parte del nombre.'
                    : 'Los que te escriban por WhatsApp se cargan solos. También podés traerlos desde una planilla.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {filtered ? (
                  <Button asChild variant="outline">
                    <Link href="/panel/contactos">Ver todos</Link>
                  </Button>
                ) : organization.canWrite ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/panel/contactos/nuevo">
                        <Plus aria-hidden="true" /> Nuevo contacto
                      </Link>
                    </Button>
                    {organization.isOwner ? (
                      <Button asChild variant="outline">
                        <Link href="/panel/importar">Importar desde una planilla</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <p className="-mt-3 text-sm text-muted-foreground tabular-nums">
                {total === 1 ? '1 contacto' : `${total} contactos`}
                {pages > 1 ? ` · página ${page} de ${pages}` : ''}
              </p>
              {/* Celular: tarjetas (una tabla no entra). Desde md: tabla. */}
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface md:hidden">
                {contacts.map((contact) => {
                  const phone = contact.contact_phones[0]?.phone_e164 ?? null;
                  return (
                    <li key={contact.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/panel/contactos/${contact.id}`} className="font-medium hover:text-primary hover:underline">
                          {contact.full_name}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {phone ? <span className="tabular-nums">{formatPhone(phone)}</span> : <span>Sin teléfono</span>}
                          {contact.do_not_contact ? <Badge variant="destructive">No contactar</Badge> : contact.is_owner ? <Badge variant="highlight">Propietario</Badge> : null}
                        </p>
                      </div>
                      <ContactActions id={contact.id} name={contact.full_name} phone={phone} doNotContact={contact.do_not_contact} canWrite={organization.canWrite} />
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Contactos</caption>
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Nombre</th>
                      <th scope="col" className="px-4 py-3 font-medium">Teléfono</th>
                      <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">A cargo</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Último movimiento</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contacts.map((contact) => {
                      const phone = contact.contact_phones[0]?.phone_e164 ?? null;
                      return (
                        <tr key={contact.id} className="hover:bg-muted/50">
                          <td className="max-w-64 px-4 py-3">
                            <Link href={`/panel/contactos/${contact.id}`} className="font-medium hover:text-primary hover:underline">
                              {contact.full_name}
                            </Link>
                            {contact.contact_emails[0] ? <span className="block truncate text-xs text-muted-foreground">{contact.contact_emails[0].email}</span> : null}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap tabular-nums">{phone ? formatPhone(phone) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className="flex flex-wrap gap-1">
                              {contact.is_prospect ? <Badge variant="brand">Interesado</Badge> : null}
                              {contact.is_owner ? <Badge variant="highlight">Propietario</Badge> : null}
                              {contact.do_not_contact ? <Badge variant="destructive">No contactar</Badge> : null}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                            {contact.assigned_user_id ? (names.get(contact.assigned_user_id) ?? '—') : 'Sin asignar'}
                          </td>
                          <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell">{formatDate(contact.updated_at)}</td>
                          <td className="px-4 py-2">
                            <ContactActions id={contact.id} name={contact.full_name} phone={phone} doNotContact={contact.do_not_contact} canWrite={organization.canWrite} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pages > 1 ? (
            <nav aria-label="Páginas" className="flex items-center justify-end gap-2 text-sm">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page - 1)}>Anterior</Link>
                </Button>
              ) : null}
              {page < pages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page + 1)}>Siguiente</Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

function FollowUpList({ items, canWrite, now: today }: { items: Awaited<ReturnType<typeof getContactsToFollowUp>>['items']; canWrite: boolean; now: Date }) {
  if (items.length === 0) {
    return (
      <Empty className="border border-border bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRoundSearch aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nadie para retomar</EmptyTitle>
          <EmptyDescription>Todos los clientes con una búsqueda abierta tuvieron novedades en los últimos {STALE_DAYS} días.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <>
      <p className="-mt-3 text-sm text-pretty text-muted-foreground">
        Clientes con una búsqueda abierta que hace más de {STALE_DAYS} días no tienen notas, llamadas, visitas ni mensajes. Los que hace más tiempo que no se tocan, primero.
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {items.map((item) => (
          <li key={item.contactId} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/panel/contactos/${item.contactId}`} className="font-medium hover:text-primary hover:underline">
                {item.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {item.stage} · último movimiento {sinceText(item.lastTouch, today)}
                {item.matches > 0 ? ` · ${item.matches === 1 ? '1 propiedad le sirve' : `${item.matches} propiedades le sirven`}` : ''}
              </p>
            </div>
            <ContactActions id={item.contactId} name={item.name} phone={null} doNotContact={false} canWrite={canWrite} />
            {canWrite ? null : null}
          </li>
        ))}
      </ul>
    </>
  );
}
