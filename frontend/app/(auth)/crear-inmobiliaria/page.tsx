import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireUser } from '@/lib/auth.ts';
import { getPlatformRole } from '@/lib/platform.ts';
import { listMyOrganizations } from '@/lib/tenant.ts';
import { getRegistrationLegalDocuments } from '@/modules/auth/queries.ts';
import { CreateOrganizationForm } from '@/modules/onboarding/components.tsx';

export const metadata: Metadata = { title: 'Crear inmobiliaria' };

export default function CreateOrganizationPage() {
  return (
    <Card>
      <CardTitle>Creá tu inmobiliaria</CardTitle>
      <CardDescription>Arranca la prueba gratis de 14 días. Después podés completar los datos y sumar a tu equipo.</CardDescription>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <CreateOrganization />
        </Suspense>
      </div>
    </Card>
  );
}

async function CreateOrganization() {
  const user = await requireUser('/crear-inmobiliaria');
  // Quien ya pertenece a una inmobiliaria va directo al panel.
  if ((await listMyOrganizations()).length > 0) redirect('/panel');

  const legal = await getRegistrationLegalDocuments();
  if (!legal) {
    return <p className="text-sm text-muted-foreground">El registro de inmobiliarias todavía no está disponible.</p>;
  }
  if ((await getPlatformRole()).isAdmin) redirect('/plataforma');
  const pending = user.metadata.pending_organization_name;
  const accepted = user.metadata.accepted_legal_document_ids;
  const alreadyAccepted =
    Array.isArray(accepted) && legal.every((doc) => accepted.includes(doc.id));
  return (
    <CreateOrganizationForm
      defaultName={typeof pending === 'string' ? pending : ''}
      legal={legal}
      alreadyAccepted={alreadyAccepted}
    />
  );
}
