import { Settings } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { moveStageAction } from '@/modules/searches/actions.ts';
import { budgetLabel } from '@/modules/searches/format.ts';
import { boardSearches, getPipelineMetrics, getStages } from '@/modules/searches/queries.ts';

export const metadata: Metadata = { title: 'Oportunidades' };

// Embudo comercial (CU-11, F-13): cada búsqueda avanza por las etapas de la inmobiliaria.
export default function OpportunitiesPage({ searchParams }: PageProps<'/panel/oportunidades'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="oportunidades" title="Embudo comercial" description="Cada búsqueda avanza por las etapas de venta de la inmobiliaria." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando embudo…</p>}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Board({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/oportunidades');
  const params = await searchParams;
  const onlyMine = params.vista === 'mias';
  const [stages, searches, members, metrics] = await Promise.all([
    getStages(organization.id),
    boardSearches(organization.id, user.id, onlyMine),
    getActiveMembers(organization.id),
    organization.isOwner ? getPipelineMetrics(organization.id) : Promise.resolve([]),
  ]);
  const usedStages = new Set(searches.map((search) => search.stage_id));
  // Las etapas desactivadas solo se muestran si todavía tienen búsquedas.
  const columns = stages.filter((stage) => stage.is_active || usedStages.has(stage.id));
  const selectable = stages.filter((stage) => stage.is_active);
  const names = new Map(members.map((member) => [member.userId, member.name]));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant={onlyMine ? 'outline' : 'secondary'} size="sm">
          <Link href="/panel/oportunidades">Todo el equipo</Link>
        </Button>
        <Button asChild variant={onlyMine ? 'secondary' : 'outline'} size="sm">
          <Link href="/panel/oportunidades?vista=mias">Mis búsquedas</Link>
        </Button>
        {organization.isOwner ? (
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/panel/oportunidades/etapas">
              <Settings aria-hidden="true" /> Configurar etapas
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <ol className="flex gap-3" style={{ minWidth: `${columns.length * 15}rem` }}>
          {columns.map((stage) => {
            const cards = searches.filter((search) => search.stage_id === stage.id);
            return (
              <li key={stage.id} className="flex w-60 shrink-0 flex-col gap-2 rounded-lg bg-muted p-3">
                <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`size-2 rounded-full ${stage.kind === 'won' ? 'bg-success' : stage.kind === 'lost' ? 'bg-muted-foreground' : 'bg-primary'}`} />
                    {stage.name}
                  </span>
                  <Badge>{cards.length}</Badge>
                </h2>
                {!stage.is_active ? <p className="text-xs text-muted-foreground">Etapa desactivada</p> : null}
                {cards.map((search) => {
                  const matches = search.match_results.filter((match) => !match.stale && match.status !== 'dismissed').length;
                  return (
                    <article key={search.id} className="grid gap-2 rounded-md border border-border bg-surface p-3">
                      <Link href={`/panel/busquedas/${search.id}`} className="text-sm font-semibold hover:text-primary">
                        {search.contacts?.full_name ?? 'Contacto'}
                      </Link>
                      <p className="text-xs text-muted-foreground">{budgetLabel(search.budget_min, search.budget_max, search.currency)}</p>
                      <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {search.assigned_user_id ? (names.get(search.assigned_user_id) ?? 'Ex miembro') : 'Sin asignar'}
                        {matches > 0 ? <Badge variant="highlight">{matches} coinc.</Badge> : null}
                      </p>
                      {organization.canWrite ? (
                        <form action={moveStageAction} className="flex gap-1">
                          <input type="hidden" name="searchId" value={search.id} />
                          <Select name="stageId" defaultValue={search.stage_id} aria-label={`Etapa de ${search.contacts?.full_name ?? 'la búsqueda'}`} className="h-8 px-2 text-xs">
                            {selectable.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" variant="outline" size="sm" className="h-8 px-2 text-xs">
                            Mover
                          </Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </li>
            );
          })}
        </ol>
      </div>

      {organization.isOwner && metrics.length > 0 ? (
        <Card>
          <CardTitle>Por agente</CardTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Búsquedas por etapa y agente</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Agente</th>
                  {columns.map((stage) => (
                    <th key={stage.id} scope="col" className="px-2 py-2 text-right font-medium">
                      {stage.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(metrics.map((row) => row.assigned_user_id))].map((agent) => (
                  <tr key={agent ?? 'none'} className="border-t border-border">
                    <th scope="row" className="py-2 pr-4 font-medium whitespace-nowrap">
                      {agent ? (names.get(agent) ?? 'Ex miembro') : 'Sin asignar'}
                    </th>
                    {columns.map((stage) => (
                      <td key={stage.id} className="px-2 py-2 text-right tabular-nums">
                        {metrics.find((row) => row.assigned_user_id === agent && row.stage_id === stage.id)?.total ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
