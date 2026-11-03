import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { PropertyForm } from '@/modules/properties/components.tsx';
import { EMPTY_PROPERTY } from '@/modules/properties/form-values.ts';

export const metadata: Metadata = { title: 'Nueva propiedad' };

export default function NewPropertyPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/propiedades" className="text-sm text-muted-foreground hover:text-foreground">
        ← Propiedades
      </Link>
      <PageHeader
        section="propiedades"
        title="Nueva propiedad"
        description="Recibe un código (PRO-000123) y una página pública. Las fotos y el propietario se agregan después de crearla."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <NewProperty />
      </Suspense>
    </div>
  );
}

async function NewProperty() {
  const { user, organization } = await requireActiveOrganization('/panel/propiedades/nueva');
  if (!organization.canWrite) {
    return <Alert variant="warning">La cuenta está en solo lectura: no se pueden cargar propiedades.</Alert>;
  }
  const [members, details] = await Promise.all([getActiveMembers(organization.id), getOrganizationDetails(organization.id)]);
  return (
    <Card>
      <PropertyForm
        values={{ ...EMPTY_PROPERTY, currency: details?.default_currency ?? 'USD' }}
        members={members}
        canReassign={organization.isOwner || Boolean(details?.agents_can_reassign)}
        currentUserId={user.id}
      />
    </Card>
  );
}
