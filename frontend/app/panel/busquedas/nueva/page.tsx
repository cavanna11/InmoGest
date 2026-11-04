import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { searchContacts } from '@/modules/properties/queries.ts';
import { SearchForm } from '@/modules/searches/components.tsx';
import { findContact } from '@/modules/searches/queries.ts';

export const metadata: Metadata = { title: 'Nueva búsqueda' };

export default function NewSearchPage({ searchParams }: PageProps<'/panel/busquedas/nueva'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/busquedas" className="text-sm text-muted-foreground hover:text-foreground">
        ← Búsquedas
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <NewSearch searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewSearch({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/busquedas/nueva');
  if (!organization.canWrite) {
    return <Alert variant="warning">La cuenta está en solo lectura: no se pueden cargar búsquedas.</Alert>;
  }
  const params = await searchParams;
  const contactId = typeof params.contacto === 'string' ? params.contacto : '';
  const query = typeof params.q === 'string' ? params.q : '';
  const contact = /^[0-9a-f-]{36}$/i.test(contactId) ? await findContact(organization.id, contactId) : null;

  // Primero se elige el cliente; la búsqueda siempre pertenece a un contacto (CU-06).
  if (!contact) {
    const results = await searchContacts(organization.id, query);
    return (
      <>
        <PageHeader section="busquedas" title="Nueva búsqueda" description="Elegí para qué cliente es." />
        <Card>
          <CardTitle>Cliente</CardTitle>
          <form role="search" className="mt-3 flex gap-2">
            <label htmlFor="q" className="sr-only">
              Buscar contacto
            </label>
            <Input id="q" name="q" type="search" defaultValue={query} placeholder="Buscar contacto por nombre" />
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
          {query ? (
            results.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No encontramos contactos con ese nombre.{' '}
                <Link href="/panel/contactos/nuevo" className="text-primary underline underline-offset-4">
                  Crear contacto
                </Link>
              </p>
            ) : (
              <ul className="mt-3 grid gap-1">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link href={`/panel/busquedas/nueva?contacto=${result.id}`} className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary">
                      {result.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Card>
      </>
    );
  }

  const [members, details] = await Promise.all([getActiveMembers(organization.id), getOrganizationDetails(organization.id)]);
  return (
    <>
      <PageHeader section="busquedas" title={`Búsqueda de ${contact.full_name}`} description="Al guardarla te mostramos las propiedades que coinciden." />
      <Card>
        <SearchForm
          values={{
            contactId: contact.id,
            operation: 'sale',
            propertyTypes: ['apartment'],
            budgetMin: null,
            budgetMax: null,
            currency: details?.default_currency ?? 'USD',
            tolerance: 10,
            minRooms: null,
            minBedrooms: null,
            locations: '',
            required: [],
            desired: [],
            notes: '',
            assignedUserId: null,
          }}
          members={members}
          canReassign={organization.isOwner || Boolean(details?.agents_can_reassign)}
          currentUserId={user.id}
        />
      </Card>
    </>
  );
}
