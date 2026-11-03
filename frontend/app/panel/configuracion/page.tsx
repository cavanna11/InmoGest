import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { LogoForm, OrganizationSettingsForm } from '@/modules/organization/components.tsx';
import { getOrganizationDetails, logoUrl } from '@/modules/organization/queries.ts';

export const metadata: Metadata = { title: 'Datos de la inmobiliaria' };

export default function OrganizationSettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <OrganizationSettings />
    </Suspense>
  );
}

async function OrganizationSettings() {
  const { organization } = await requireActiveOrganization('/panel/configuracion');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede ver y cambiar estos datos.</Alert>;
  }
  const details = await getOrganizationDetails(organization.id);
  if (!details) {
    return <Alert variant="destructive">No pudimos leer los datos de la inmobiliaria.</Alert>;
  }
  const disabled = !organization.canWrite;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Datos de la inmobiliaria</h1>
      {disabled ? <Alert variant="warning">La cuenta está en solo lectura: no se pueden hacer cambios.</Alert> : null}
      <Card>
        <CardTitle>Datos generales</CardTitle>
        <CardDescription>Aparecen en las páginas públicas de tus propiedades y en los mensajes a clientes.</CardDescription>
        <div className="mt-6">
          <OrganizationSettingsForm
            disabled={disabled}
            values={{
              name: details.name,
              slug: details.slug,
              contactEmail: details.contact_email ?? '',
              contactPhone: details.contact_phone ?? '',
              defaultCurrency: details.default_currency,
              agentsCanReassign: details.agents_can_reassign,
            }}
          />
        </div>
      </Card>
      <Card>
        <CardTitle>Logo</CardTitle>
        <div className="mt-6">
          <LogoForm currentLogoUrl={await logoUrl(details.logo_path)} disabled={disabled} />
        </div>
      </Card>
    </div>
  );
}
