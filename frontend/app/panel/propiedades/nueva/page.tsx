import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { QuickPropertyForm } from '@/modules/properties/components.tsx';
import { EMPTY_PROPERTY } from '@/modules/properties/form-values.ts';
import { PropertySteps } from '@/modules/properties/steps.tsx';

export const metadata: Metadata = { title: 'Nueva propiedad' };

// Alta en tres pasos (CU-05): 1) lo mínimo para crearla, 2) fotos, 3) dónde publicarla. Los pasos 2 y
// 3 se hacen en la ficha recién creada (?paso=fotos / ?paso=publicar); el resto de los datos, después.
export default function NewPropertyPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-6">
      <Link href="/panel/propiedades" className="text-sm text-muted-foreground hover:text-foreground">
        ← Propiedades
      </Link>
      <PageHeader
        section="propiedades"
        title="Nueva propiedad"
        description="Con estos datos ya se crea. Descripción, superficies y características los completás después."
        guide={false}
      />
      <PropertySteps current={1} />
      <Suspense fallback={<PageSkeleton variant="form" label="Cargando…" />}>
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
  const details = await getOrganizationDetails(organization.id);
  return (
    <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
      <QuickPropertyForm defaults={{ ...EMPTY_PROPERTY, currency: details?.default_currency ?? 'USD' }} currentUserId={user.id} />
    </div>
  );
}
