import { formatDateTime } from '@inmogest/shared';
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { STATUS_LABELS, STATUS_TONES } from '@/modules/properties/labels.ts';
import { moveStageAction, setMatchStatusAction } from '@/modules/searches/actions.ts';
import { SearchForm } from '@/modules/searches/components.tsx';
import { budgetLabel, matchReason } from '@/modules/searches/format.ts';
import { getSearch, getSearchMatches, getStageHistory, getStages } from '@/modules/searches/queries.ts';

export const metadata: Metadata = { title: 'Búsqueda' };

// Ficha de una búsqueda: coincidencias con puntaje y motivo (F-12), etapa (F-13) y criterios (F-11).
export default function SearchPage({ params }: PageProps<'/panel/busquedas/[id]'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/busquedas" className="text-sm text-muted-foreground hover:text-foreground">
        ← Búsquedas
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Cargando búsqueda…</p>}>
        <Search params={params} />
      </Suspense>
    </div>
  );
}

async function Search({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, organization } = await requireActiveOrganization(`/panel/busquedas/${id}`);
  const search = await getSearch(organization.id, id);
  if (!search) notFound();

  const [matches, stages, history, members, details] = await Promise.all([
    getSearchMatches(organization.id, id),
    getStages(organization.id),
    getStageHistory(organization.id, id),
    getActiveMembers(organization.id),
    getOrganizationDetails(organization.id),
  ]);
  const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
  const stage = stageMap.get(search.stage_id);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const canWrite = organization.canWrite;
  const active = matches.filter((match) => !match.stale && match.status !== 'dismissed');
  const archived = matches.filter((match) => match.stale || match.status === 'dismissed');

  return (
    <>
      <PageHeader
        section="busquedas"
        title={
          <Link href={`/panel/contactos/${search.contact_id}`} className="hover:text-primary">
            {search.contacts?.full_name ?? 'Contacto'}
          </Link>
        }
        description={budgetLabel(search.budget_min, search.budget_max, search.currency)}
        badge={stage ? <Badge variant={stage.kind === 'won' ? 'success' : stage.kind === 'lost' ? 'default' : 'brand'}>{stage.name}</Badge> : null}
      />
      {!canWrite ? <Alert variant="warning">La cuenta está en solo lectura: podés consultar, pero no modificar.</Alert> : null}
      {stage && stage.kind !== 'open' ? <Alert>Esta búsqueda está cerrada: no genera coincidencias nuevas. Las anteriores se conservan.</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardTitle>Coincidencias</CardTitle>
            {active.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Todavía no hay propiedades que cumplan. Cuando entre una, te avisamos.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {active.map((match) => {
                  const property = match.properties;
                  if (!property) return null;
                  const cover = [...property.property_images].sort((a, b) => a.position - b.position)[0]?.storage_path;
                  return (
                    <li key={match.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-primary-soft text-primary-soft-foreground sm:aspect-square">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado
                          <img src={publicImageUrl(cover)} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <Building2 aria-hidden="true" className="size-6 opacity-60" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Link href={`/panel/propiedades/${property.id}`} className="font-semibold hover:text-primary">
                            {property.title}
                          </Link>
                          <span className="rounded-full bg-highlight px-2.5 py-0.5 text-sm font-bold text-highlight-foreground">{match.score} %</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {property.code} · {priceLabel(property.price, property.currency)}
                          {[property.neighborhood, property.city].filter(Boolean).length > 0 ? ` · ${[property.neighborhood, property.city].filter(Boolean).join(', ')}` : ''}
                        </p>
                        <p className="mt-1 text-sm">{matchReason(match)}.</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {match.over_budget ? <Badge variant="warning">Superior al presupuesto</Badge> : null}
                          <Badge variant={STATUS_TONES[property.status]}>{STATUS_LABELS[property.status]}</Badge>
                          {match.status === 'new' ? <Badge variant="success">Nueva</Badge> : null}
                          {match.status === 'sent' ? <Badge variant="brand">Enviada</Badge> : null}
                          {canWrite ? (
                            <span className="ml-auto flex gap-1">
                              {[
                                match.status === 'new' ? { value: 'seen', label: 'Marcar vista' } : null,
                                match.status !== 'sent' ? { value: 'sent', label: 'Marcar enviada' } : null,
                                { value: 'dismissed', label: 'Descartar' },
                              ]
                                .filter((option) => option !== null)
                                .map((option) => (
                                  <form key={option.value} action={setMatchStatusAction}>
                                    <input type="hidden" name="matchId" value={match.id} />
                                    <input type="hidden" name="searchId" value={search.id} />
                                    <input type="hidden" name="status" value={option.value} />
                                    <Button type="submit" variant="ghost" size="sm">
                                      {option.label}
                                    </Button>
                                  </form>
                                ))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {archived.length > 0 ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Historial: {archived.length} que ya no aplican o se descartaron</summary>
                <ul className="mt-2 grid gap-1">
                  {archived.map((match) => (
                    <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                      <Link href={`/panel/propiedades/${match.properties?.id}`} className="hover:text-primary">
                        {match.properties?.code} · {match.properties?.title}
                      </Link>
                      {canWrite && match.status === 'dismissed' && !match.stale ? (
                        <form action={setMatchStatusAction}>
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="searchId" value={search.id} />
                          <input type="hidden" name="status" value="seen" />
                          <Button type="submit" variant="ghost" size="sm">
                            Recuperar
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Criterios</CardTitle>
            <div className="mt-4">
              {canWrite ? (
                <SearchForm
                  values={{
                    id: search.id,
                    contactId: search.contact_id,
                    operation: search.operation,
                    propertyTypes: search.property_types,
                    budgetMin: search.budget_min,
                    budgetMax: search.budget_max,
                    currency: search.currency,
                    tolerance: search.budget_tolerance_pct,
                    minRooms: search.min_rooms,
                    minBedrooms: search.min_bedrooms,
                    locations: search.client_search_locations.map((zone) => zone.name).join(', '),
                    required: search.required_features,
                    desired: search.desired_features,
                    notes: search.notes,
                    assignedUserId: search.assigned_user_id,
                  }}
                  members={members}
                  canReassign={organization.isOwner || Boolean(details?.agents_can_reassign)}
                  currentUserId={user.id}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Disponibles cuando la cuenta vuelva a estar activa.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardTitle>Etapa del embudo</CardTitle>
            {canWrite ? (
              <form action={moveStageAction} className="mt-3 flex gap-2">
                <input type="hidden" name="searchId" value={search.id} />
                <label htmlFor="stageId" className="sr-only">
                  Etapa
                </label>
                <Select id="stageId" name="stageId" defaultValue={search.stage_id}>
                  {stages
                    .filter((option) => option.is_active || option.id === search.stage_id)
                    .map((option) => (
                      <option key={option.id} value={option.id} disabled={!option.is_active}>
                        {option.name}
                      </option>
                    ))}
                </Select>
                <Button type="submit" variant="outline">
                  Mover
                </Button>
              </form>
            ) : null}
            <ol className="mt-4 grid gap-3 border-l-2 border-primary-soft pl-5">
              {history.map((change) => (
                <li key={change.id} className="relative">
                  <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(change.created_at)}
                    {change.author_id ? ` · ${names.get(change.author_id) ?? 'Ex miembro del equipo'}` : ''}
                  </p>
                  <p className="text-sm">{stageMap.get(change.to_stage_id)?.name ?? 'Etapa'}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
