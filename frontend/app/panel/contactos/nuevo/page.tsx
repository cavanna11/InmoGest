import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { NewContactForm } from '@/modules/contacts/components.tsx';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';

export const metadata: Metadata = { title: 'Nuevo contacto' };

export default function NewContactPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/contactos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Contactos
      </Link>
      <PageHeader section="contactos" title="Nuevo contacto" description="Si el teléfono o el email ya están cargados, te mostramos el contacto existente." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <NewContact />
      </Suspense>
    </div>
  );
}

async function NewContact() {
  const { user, organization } = await requireActiveOrganization('/panel/contactos/nuevo');
  if (!organization.canWrite) {
    return <Alert variant="warning">La cuenta está en solo lectura: no se pueden cargar contactos.</Alert>;
  }
  const [members, details] = await Promise.all([getActiveMembers(organization.id), getOrganizationDetails(organization.id)]);
  return (
    <Card>
      <NewContactForm
        members={members}
        currentUserId={user.id}
        canAssignOthers={organization.isOwner || Boolean(details?.agents_can_reassign)}
      />
    </Card>
  );
}
