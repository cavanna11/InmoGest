import { formatDate, formatPhone } from '@inmogest/shared';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input, Select } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Badge, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { countOpenDuplicateReports, getActiveMembers, listContacts, PAGE_SIZE } from '@/modules/contacts/queries.ts';

export const metadata: Metadata = { title: 'Contactos' };

// Listado de contactos (F-06, F-07): búsqueda por nombre, teléfono o email y filtros por asignación.
export default function ContactsPage({ searchParams }: PageProps<'/panel/contactos'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="contactos" title="Contactos" description="Interesados y propietarios de la inmobiliaria, con todo su historial." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando contactos…</p>}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/contactos');
  const params = await searchParams;
  const filters = {
    q: param(params.q),
    assigned: param(params.asignado),
    kind: param(params.tipo),
    page: Number(param(params.pagina) ?? '1') || 1,
  };
  const [{ contacts, total, page }, members, duplicates] = await Promise.all([
    listContacts(organization.id, user.id, filters),
    getActiveMembers(organization.id),
    organization.isOwner ? countOpenDuplicateReports(organization.id) : Promise.resolve(0),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const filtered = Boolean(filters.q || filters.assigned || filters.kind);
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: filters.q, asignado: filters.assigned, tipo: filters.kind })) {
      if (value) next.set(key, value);
    }
    next.set('pagina', String(target));
    return `/panel/contactos?${next.toString()}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {organization.canWrite ? (
          <Button asChild>
            <Link href="/panel/contactos/nuevo">
              <Plus aria-hidden="true" /> Nuevo contacto
            </Link>
          </Button>
        ) : null}
        {organization.isOwner && duplicates > 0 ? (
          <Link href="/panel/contactos/duplicados" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            Posibles duplicados <Badge variant="highlight">{duplicates}</Badge>
          </Link>
        ) : null}
      </div>

      <Card className="p-4 sm:p-4">
        <form role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Buscar por nombre, teléfono o email" />
          <label htmlFor="asignado" className="sr-only">
            Asignación
          </label>
          <Select id="asignado" name="asignado" defaultValue={filters.assigned ?? ''} className="sm:w-44">
            <option value="">Todos</option>
            <option value="mine">Mis contactos</option>
            <option value="unassigned">Sin asignar</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
          <label htmlFor="tipo" className="sr-only">
            Tipo
          </label>
          <Select id="tipo" name="tipo" defaultValue={filters.kind ?? ''} className="sm:w-40">
            <option value="">Todos los tipos</option>
            <option value="prospect">Interesados</option>
            <option value="owner">Propietarios</option>
            <option value="dnc">No contactar</option>
          </Select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      {contacts.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">{filtered ? 'No hay contactos con esos filtros.' : 'Todavía no cargaste contactos.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? (
              <Link href="/panel/contactos" className="text-primary underline underline-offset-4">
                Ver todos
              </Link>
            ) : (
              'Cargá el primero a mano. La importación desde planillas llega pronto.'
            )}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Contactos</caption>
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Nombre</th>
                  <th scope="col" className="px-4 py-3 font-medium">Teléfono</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Asignado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-t border-border hover:bg-primary-soft/40">
                    <td className="px-4 py-3">
                      <Link href={`/panel/contactos/${contact.id}`} className="font-medium hover:text-primary hover:underline">
                        {contact.full_name}
                      </Link>
                      {contact.contact_emails[0] ? (
                        <span className="block truncate text-xs text-muted-foreground">{contact.contact_emails[0].email}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {contact.contact_phones[0] ? formatPhone(contact.contact_phones[0].phone_e164) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {contact.is_prospect ? <Badge variant="brand">Interesado</Badge> : null}
                        {contact.is_owner ? <Badge variant="highlight">Propietario</Badge> : null}
                        {contact.do_not_contact ? <Badge variant="destructive">No contactar</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {contact.assigned_user_id ? (names.get(contact.assigned_user_id) ?? '—') : 'Sin asignar'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(contact.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {total} contactos · página {page} de {Math.ceil(total / PAGE_SIZE)}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            ) : null}
            {page * PAGE_SIZE < total ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Siguiente</Link>
              </Button>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}
