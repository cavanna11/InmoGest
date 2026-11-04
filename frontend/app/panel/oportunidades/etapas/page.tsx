import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { moveStagePositionAction, renameStageAction, toggleStageAction } from '@/modules/searches/actions.ts';
import { AddStageForm } from '@/modules/searches/components.tsx';
import { getStages } from '@/modules/searches/queries.ts';

export const metadata: Metadata = { title: 'Etapas del embudo' };

const KIND_LABELS = { open: 'Abierta', won: 'Cierre ganado', lost: 'Cierre perdido' } as const;

// Configuración del embudo (F-13): solo el dueño renombra, agrega, reordena y desactiva.
export default function StagesPage({ searchParams }: PageProps<'/panel/oportunidades/etapas'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/oportunidades" className="text-sm text-muted-foreground hover:text-foreground">
        ← Embudo
      </Link>
      <PageHeader
        section="oportunidades"
        title="Etapas del embudo"
        description="Las búsquedas de una etapa desactivada siguen ahí hasta que las muevas; no se pueden mover nuevas a esa etapa."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Stages searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Stages({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organization } = await requireActiveOrganization('/panel/oportunidades/etapas');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede configurar el embudo.</Alert>;
  }
  const { error } = await searchParams;
  const stages = await getStages(organization.id);
  const disabled = !organization.canWrite;

  return (
    <>
      {error ? <Alert variant="destructive">El embudo tiene que conservar al menos una etapa activa de cierre ganado y una de cierre perdido.</Alert> : null}
      <Card>
        <ol className="grid gap-3">
          {stages.map((stage, index) => (
            <li key={stage.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <form action={renameStageAction} className="flex items-center gap-2">
                <input type="hidden" name="stageId" value={stage.id} />
                <label htmlFor={`stage-${stage.id}`} className="sr-only">
                  Nombre de la etapa
                </label>
                <Input id={`stage-${stage.id}`} name="name" defaultValue={stage.name} maxLength={60} disabled={disabled} />
                <Button type="submit" variant="outline" size="sm" disabled={disabled}>
                  Renombrar
                </Button>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={stage.kind === 'open' ? 'brand' : stage.kind === 'won' ? 'success' : 'default'}>{KIND_LABELS[stage.kind]}</Badge>
                {!stage.is_active ? <Badge variant="warning">Desactivada</Badge> : null}
                {[
                  { direction: 'up', Icon: ArrowUp, label: 'Subir', off: index === 0 },
                  { direction: 'down', Icon: ArrowDown, label: 'Bajar', off: index === stages.length - 1 },
                ].map(({ direction, Icon, label, off }) => (
                  <form key={direction} action={moveStagePositionAction}>
                    <input type="hidden" name="stageId" value={stage.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <Button type="submit" variant="ghost" size="icon" className="size-8" disabled={disabled || off} aria-label={`${label} ${stage.name}`}>
                      <Icon aria-hidden="true" />
                    </Button>
                  </form>
                ))}
                <form action={toggleStageAction}>
                  <input type="hidden" name="stageId" value={stage.id} />
                  <input type="hidden" name="active" value={stage.is_active ? '0' : '1'} />
                  <Button type="submit" variant="ghost" size="sm" disabled={disabled}>
                    {stage.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      {!disabled ? (
        <Card>
          <AddStageForm />
        </Card>
      ) : null}
    </>
  );
}
