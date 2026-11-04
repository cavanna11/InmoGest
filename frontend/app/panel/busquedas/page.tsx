import { formatDate } from '@inmogest/shared';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Badge, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { OPERATION_LABELS, TYPE_LABELS } from '@/modules/properties/labels.ts';
import { budgetLabel } from '@/modules/searches/format.ts';
import { getStages, listSearches, PAGE_SIZE } from '@/modules/searches/queries.ts';

export const metadata: Metadata = { title: 'Búsquedas' };

// Listado de búsquedas de clientes (F-11) con su etapa y cuántas coincidencias tienen (F-12).
export default function SearchesPage({ searchParams }: PageProps<'/panel/busquedas'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="busquedas" title="Búsquedas" description="Qué busca cada cliente y qué propiedades le sirven, con el motivo de cada coincidencia." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando búsquedas…</p>}>
        <Searches searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

async function Searches({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/busquedas');
  const params = await searchParams;
  const filters = { stage: param(params.etapa), assigned: param(params.asignado), page: Number(param(params.pagina) ?? '1') || 1 };
  const [{ searches, total, page }, stages, members] = await Promise.all([
    listSearches(organization.id, user.id, filters),
    getStages(organization.id),
    getActiveMembers(organization.id),
  ]);
  const stageNames = new Map(stages.map((stage) => [stage.id, stage]));
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const filtered = Boolean(filters.stage || filters.assigned);

  return (
    <>
      {organization.canWrite ? (
        <Button asChild className="justify-self-start">
          <Link href="/panel/busquedas/nueva">
            <Plus aria-hidden="true" /> Nueva búsqueda
          </Link>
        </Button>
      ) : null}

      <Card className="p-4 sm:p-4">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select name="etapa" aria-label="Etapa" defaultValue={filters.stage ?? ''}>
            <option value="">Todas las etapas</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
          <Select name="asignado" aria-label="Asignación" defaultValue={filters.assigned ?? ''}>
            <option value="">Todas</option>
            <option value="mine">Mis búsquedas</option>
            <option value="unassigned">Sin asignar</option>
          </Select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      {searches.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">{filtered ? 'No hay búsquedas con esos filtros.' : 'Todavía no cargaste búsquedas.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">Cargá qué busca un cliente y InmoPanel te avisa cuando entra una propiedad que le sirve.</p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {searches.map((search) => {
            const stage = stageNames.get(search.stage_id);
            const matches = search.match_results.filter((match) => !match.stale && match.status !== 'dismissed');
            const fresh = matches.filter((match) => match.status === 'new').length;
            const zones = search.client_search_locations.map((zone) => zone.name).join(', ');
            return (
              <li key={search.id}>
                <Link href={`/panel/busquedas/${search.id}`} className="grid gap-2 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {search.contacts?.full_name ?? 'Contacto'}
                      {stage ? <Badge variant={stage.kind === 'won' ? 'success' : stage.kind === 'lost' ? 'default' : 'brand'}>{stage.name}</Badge> : null}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {OPERATION_LABELS[search.operation]} · {search.property_types.map((type) => TYPE_LABELS[type]).join(', ')}
                      {zones ? ` · ${zones}` : ''} · {budgetLabel(search.budget_min, search.budget_max, search.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {search.assigned_user_id ? (names.get(search.assigned_user_id) ?? 'Ex miembro del equipo') : 'Sin asignar'} · actualizada el {formatDate(search.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={matches.length > 0 ? 'highlight' : 'default'}>
                      {matches.length === 1 ? '1 coincidencia' : `${matches.length} coincidencias`}
                    </Badge>
                    {fresh > 0 ? <Badge variant="success">{fresh} nuevas</Badge> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <p className="text-sm text-muted-foreground">
          Mostrando {searches.length} de {total} ·{' '}
          {page * PAGE_SIZE < total ? (
            <Link href={`/panel/busquedas?pagina=${page + 1}`} className="text-primary underline underline-offset-4">
              Siguiente página
            </Link>
          ) : (
            <Link href="/panel/busquedas" className="text-primary underline underline-offset-4">
              Volver al inicio
            </Link>
          )}
        </p>
      ) : null}
    </>
  );
}
