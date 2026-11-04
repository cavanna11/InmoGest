import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { ImportWizard } from '@/modules/import/components.tsx';

export const metadata: Metadata = { title: 'Importar y exportar' };

// Importación y exportación CSV (CU-12, F-24, F-25). Importar es del dueño; nada se importa sin
// confirmar la vista previa.
export default function ImportPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="importar" title="Importar y exportar" description="Traé tus planillas actuales y llevate tus datos cuando quieras." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <ImportExport />
      </Suspense>
    </div>
  );
}

async function ImportExport() {
  const { organization } = await requireActiveOrganization('/panel/importar');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede importar y exportar.</Alert>;
  }
  return (
    <>
      <Card>
        <CardTitle>Importar desde CSV</CardTitle>
        <CardDescription>
          Descargá la plantilla, completala o adaptá la de tu sistema anterior y subila. Antes de importar ves los errores fila por fila; las filas con error no se
          importan. Hasta 1000 filas por archivo.
        </CardDescription>
        <div className="mt-4">
          {organization.canWrite ? <ImportWizard /> : <Alert variant="warning">La cuenta está en solo lectura: no se puede importar.</Alert>}
        </div>
      </Card>
      <Card>
        <CardTitle>Exportar</CardTitle>
        <CardDescription>Tus datos en CSV, listos para abrir en una planilla.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/panel/importar/exportar?tipo=contactos">
              <Download aria-hidden="true" /> Contactos
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/panel/importar/exportar?tipo=propiedades">
              <Download aria-hidden="true" /> Propiedades
            </a>
          </Button>
        </div>
      </Card>
    </>
  );
}
