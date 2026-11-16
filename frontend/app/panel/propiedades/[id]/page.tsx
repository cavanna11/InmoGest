import { formatDateTime } from '@inmogest/shared';
import { CalendarPlus, MessageCircle, Store, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { PropertyCode } from '@/components/ui/property-code.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { appOrigin } from '@/lib/request.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { PublicationsCard } from '@/modules/integrations/publications-card.tsx';
import { getMercadoLibreConnection, getPropertyListings } from '@/modules/integrations/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { addOwnerAction, mergePropertiesAction, removeOwnerAction } from '@/modules/properties/actions.ts';
import { ImageUploader, PropertyForm } from '@/modules/properties/components.tsx';
import { PropertyDetailTabs, PROPERTY_TABS, type PropertyTab } from '@/modules/properties/detail-tabs.tsx';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { FEATURES, OPERATION_LABELS, STATUS_LABELS, STATUS_TONES, TYPE_LABELS, type PropertyStatus } from '@/modules/properties/labels.ts';
import { PhotoGrid } from '@/modules/properties/photo-grid.tsx';
import { getDuplicateCandidates, getProperty, getPropertyChanges, organizationSlug, searchContacts } from '@/modules/properties/queries.ts';
import { PropertySteps } from '@/modules/properties/steps.tsx';
import { getPropertyMatches } from '@/modules/searches/queries.ts';
import { SendPropertyForm } from '@/modules/whatsapp/components.tsx';
import { getPropertySends, getSendableContacts } from '@/modules/whatsapp/queries.ts';

export const metadata: Metadata = { title: 'Propiedad' };

// Ficha de la propiedad (CU-05, F-08, F-09, F-10) en pestañas: Resumen (fotos, datos clave, envío por
// WhatsApp, interesados y propietarios), Datos (edición), Publicación e Historial. Con ?paso=fotos o
// ?paso=publicar muestra los pasos 2 y 3 del alta.
export default function PropertyPage({ params, searchParams }: PageProps<'/panel/propiedades/[id]'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/propiedades" className="text-sm text-muted-foreground hover:text-foreground">
        ← Propiedades
      </Link>
      <Suspense fallback={<PageSkeleton variant="detail" label="Cargando propiedad…" />}>
        <Property params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Change = { field: string; old_value: unknown; new_value: unknown };

function changeText(change: Change): string {
  const value = (raw: unknown) => (raw ?? {}) as { price?: number | null; currency?: string; status?: string; merged_code?: string };
  switch (change.field) {
    case 'created':
      return `Propiedad creada (${STATUS_LABELS[value(change.new_value).status as PropertyStatus] ?? 'borrador'}).`;
    case 'price': {
      const before = value(change.old_value);
      const after = value(change.new_value);
      return `Precio: ${priceLabel(before.price ?? null, before.currency ?? '')} → ${priceLabel(after.price ?? null, after.currency ?? '')}.`;
    }
    case 'status':
      return `Estado: ${STATUS_LABELS[change.old_value as PropertyStatus] ?? '—'} → ${STATUS_LABELS[change.new_value as PropertyStatus] ?? '—'}.`;
    case 'merged':
      return `Se fusionó con ${value(change.new_value).merged_code ?? 'otra propiedad'}.`;
    default:
      return '';
  }
}

function area(value: number | null) {
  return value === null ? null : `${new Intl.NumberFormat('es-AR').format(value)} m²`;
}

async function Property({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, organization } = await requireActiveOrganization(`/panel/propiedades/${id}`);
  const property = await getProperty(organization.id, id);
  if (!property) notFound();
  if (property.merged_into_id) redirect(`/panel/propiedades/${property.merged_into_id}`);

  const query = await searchParams;
  const ownerQuery = typeof query.propietario === 'string' ? query.propietario : '';
  const step = query.paso === 'fotos' ? 2 : query.paso === 'publicar' ? 3 : null;
  const tab: PropertyTab = typeof query.tab === 'string' && query.tab in PROPERTY_TABS ? (query.tab as PropertyTab) : 'resumen';
  const ownerIds = property.property_owners.map((owner) => owner.contact_id);
  const [members, details, changes, slug, origin, duplicates, ownerResults, matches, sends, sendable, listings, mlConnection] = await Promise.all([
    getActiveMembers(organization.id),
    getOrganizationDetails(organization.id),
    getPropertyChanges(organization.id, id),
    organizationSlug(organization.id),
    appOrigin(),
    getDuplicateCandidates(organization.id, property, ownerIds),
    searchContacts(organization.id, ownerQuery),
    getPropertyMatches(organization.id, id),
    getPropertySends(organization.id, id),
    getSendableContacts(organization.id),
    getPropertyListings(organization.id, id),
    getMercadoLibreConnection(organization.id),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const canWrite = organization.canWrite;
  const isPublic = property.status !== 'draft' && property.status !== 'paused';
  const publicUrl = slug ? `${origin}/p/${slug}/${property.slug}` : null;
  const photos = property.property_images.map((image) => ({ id: image.id, url: publicImageUrl(image.storage_path) }));
  const base = `/panel/propiedades/${property.id}`;

  const header = (
    <PageHeader
      section="propiedades"
      guide={false}
      title={property.title}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PropertyCode code={property.code} />
          {OPERATION_LABELS[property.operation]} · {TYPE_LABELS[property.property_type]} ·{' '}
          <span className="font-semibold text-foreground tabular-nums">{priceLabel(property.price, property.currency)}</span>
        </span>
      }
      badge={<Badge variant={STATUS_TONES[property.status]}>{STATUS_LABELS[property.status]}</Badge>}
    />
  );

  const publications = (
    <PublicationsCard
      propertyId={property.id}
      isPublic={isPublic}
      publicUrl={publicUrl}
      statusLabel={STATUS_LABELS[property.status]}
      listings={listings}
      canWrite={canWrite}
      mercadoLibreConnected={mlConnection?.status === 'connected'}
    />
  );

  const photoCard = (
    <Card>
      <CardTitle>Fotos</CardTitle>
      <div className="mt-4 grid gap-4">
        <PhotoGrid propertyId={property.id} photos={photos} canWrite={canWrite} />
        {canWrite ? <ImageUploader organizationId={organization.id} propertyId={property.id} /> : null}
      </div>
    </Card>
  );

  // Pasos 2 y 3 del alta: pantalla enfocada, sin pestañas.
  if (step && canWrite) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        {header}
        <PropertySteps current={step} />
        {step === 2 ? (
          <>
            <Alert variant="success">Propiedad creada. Ahora sumale fotos: la primera es la portada.</Alert>
            {photoCard}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`${base}?paso=publicar`}>Siguiente: dónde publicarla</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={base}>Lo hago después</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            {!isPublic ? (
              <Alert variant="warning">
                Está en borrador: para tener página pública y publicarla, cambiá el estado a Disponible en la pestaña Datos.
              </Alert>
            ) : null}
            {publications}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={base}>Terminar e ir a la ficha</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  const facts: Array<[string, string | null]> = [
    ['Precio', priceLabel(property.price, property.currency)],
    ['Expensas', property.expenses === null ? null : priceLabel(property.expenses, property.expenses_currency)],
    ['Ubicación', [property.address, property.neighborhood, property.city, property.province].filter(Boolean).join(', ') || null],
    [
      'Ambientes',
      [
        property.rooms ? `${property.rooms} amb.` : null,
        property.bedrooms ? `${property.bedrooms} dorm.` : null,
        property.bathrooms ? `${property.bathrooms} ${property.bathrooms === 1 ? 'baño' : 'baños'}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    ],
    ['Superficie', [area(property.covered_area_m2) && `${area(property.covered_area_m2)} cubiertos`, area(property.total_area_m2) && `${area(property.total_area_m2)} totales`].filter(Boolean).join(' · ') || null],
    ['A cargo', property.assigned_user_id ? (names.get(property.assigned_user_id) ?? 'Ex miembro del equipo') : 'Sin asignar'],
  ];
  const features = property.features.map((feature) => FEATURES[feature as keyof typeof FEATURES]).filter(Boolean);
  const missing = facts.filter(([, value]) => !value).length + (property.description ? 0 : 1);

  const summary = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        {photoCard}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Datos clave</CardTitle>
            {canWrite ? (
              <Button asChild variant="link" size="sm" className="h-auto px-0">
                <Link href={`${base}?tab=datos`}>Editar datos</Link>
              </Button>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={value ? 'font-medium tabular-nums' : 'text-muted-foreground'}>{value ?? 'Sin cargar'}</dd>
              </div>
            ))}
          </dl>
          {features.length > 0 ? (
            <ul aria-label="Características" className="mt-4 flex flex-wrap gap-1.5">
              {features.map((feature) => (
                <li key={feature}>
                  <Badge>{feature}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          {property.description ? <p className="mt-4 line-clamp-4 text-sm whitespace-pre-line text-pretty text-muted-foreground">{property.description}</p> : null}
          {canWrite && missing > 1 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Faltan algunos datos. Completarlos mejora la página pública y las coincidencias con lo que buscan tus clientes.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid content-start gap-6">
        {canWrite && isPublic ? (
          <Card id="enviar" className="scroll-mt-20">
            <CardTitle>Enviar por WhatsApp</CardTitle>
            <CardDescription>Sale con hasta 3 fotos y el link a su página pública.</CardDescription>
            <div className="mt-3">
              <SendPropertyForm propertyId={property.id} contacts={sendable} />
            </div>
          </Card>
        ) : null}

        <Card className={matches.length > 0 ? 'border-highlight/50' : undefined}>
          <CardTitle>Clientes que la buscan</CardTitle>
          <ul className="mt-3 grid gap-2">
            {matches.length === 0 ? <li className="text-sm text-muted-foreground">Por ahora ninguna búsqueda activa coincide.</li> : null}
            {matches.map((match) => (
              <li key={match.id}>
                <Link href={`/panel/busquedas/${match.search_id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm hover:bg-primary-soft">
                  <span className="font-medium">{match.client_searches?.contacts?.full_name ?? 'Cliente'}</span>
                  <span className="flex items-center gap-1">
                    {match.over_budget ? <Badge variant="warning">Sobre presupuesto</Badge> : null}
                    <Badge variant="highlight">{match.score} %</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Propietarios</CardTitle>
          <ul className="mt-3 grid gap-2">
            {property.property_owners.length === 0 ? <li className="text-sm text-muted-foreground">Sin propietario cargado.</li> : null}
            {property.property_owners.map((owner) => (
              <li key={owner.contact_id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <Link href={`/panel/contactos/${owner.contact_id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                  <UserRound aria-hidden="true" className="size-4 text-highlight" />
                  {owner.contacts?.full_name ?? 'Contacto'}
                </Link>
                {canWrite ? (
                  <form action={removeOwnerAction}>
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="contactId" value={owner.contact_id} />
                    <Button type="submit" variant="ghost" size="sm" aria-label={`Quitar a ${owner.contacts?.full_name ?? 'este contacto'} como propietario`}>
                      Quitar
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-4 grid gap-3">
              <form className="flex gap-2" role="search">
                <label htmlFor="propietario" className="sr-only">
                  Buscar contacto para sumar como propietario
                </label>
                <Input id="propietario" name="propietario" type="search" defaultValue={ownerQuery} placeholder="Buscar contacto por nombre" autoComplete="off" />
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
              </form>
              {ownerQuery ? (
                ownerResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No encontramos contactos con ese nombre.{' '}
                    <Link href="/panel/contactos/nuevo" className="text-primary underline underline-offset-4">
                      Crear contacto
                    </Link>
                  </p>
                ) : (
                  <ul className="grid gap-1">
                    {ownerResults
                      .filter((contact) => !ownerIds.includes(contact.id))
                      .map((contact) => (
                        <li key={contact.id}>
                          <form action={addOwnerAction} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                            <input type="hidden" name="propertyId" value={property.id} />
                            <input type="hidden" name="contactId" value={contact.id} />
                            <span>{contact.full_name}</span>
                            <Button type="submit" size="sm" variant="secondary">
                              Vincular
                            </Button>
                          </form>
                        </li>
                      ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : null}
        </Card>

        {duplicates.length > 0 ? (
          <Card className="border-warning">
            <CardTitle>Posibles duplicados</CardTitle>
            <CardDescription>
              {organization.isOwner ? 'Si es la misma propiedad, fusionalas: esta conserva fotos, propietarios e historial de ambas.' : 'El dueño puede fusionarlas si es la misma propiedad.'}
            </CardDescription>
            <ul className="mt-3 grid gap-2">
              {duplicates.map((duplicate) => {
                const formId = `merge-${duplicate.id}`;
                return (
                  <li key={duplicate.id} className="grid gap-2 rounded-md bg-muted p-3 text-sm">
                    <Link href={`/panel/propiedades/${duplicate.id}`} className="font-medium text-primary hover:underline">
                      {duplicate.code} · {duplicate.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{duplicate.reason === 'same_address' ? 'Misma dirección' : 'Mismo propietario, operación y tipo'}</span>
                    {organization.isOwner && canWrite ? (
                      <form id={formId} action={mergePropertiesAction}>
                        <input type="hidden" name="keepId" value={property.id} />
                        <input type="hidden" name="mergeId" value={duplicate.id} />
                        <ConfirmSubmit
                          formId={formId}
                          title={`¿Fusionar ${duplicate.code} en ${property.code}?`}
                          description={`${duplicate.code} deja de aparecer y sus fotos, propietarios e historial pasan a ${property.code}. No se puede deshacer.`}
                          confirmLabel="Fusionar"
                          trigger="Fusionar en esta"
                        />
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );

  const data = (
    <Card>
      {canWrite ? (
        <PropertyForm values={property} members={members} canReassign={organization.isOwner || Boolean(details?.agents_can_reassign)} currentUserId={user.id} />
      ) : (
        <p className="text-sm whitespace-pre-line">{property.description || 'Sin descripción.'}</p>
      )}
    </Card>
  );

  const history = (
    <Card>
      <CardTitle>Historial</CardTitle>
      <ol className="mt-4 grid gap-3 border-l-2 border-primary-soft pl-5">
        {changes.map((change) => (
          <li key={change.id} className="relative">
            <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(change.created_at)}
              {change.author_id ? ` · ${names.get(change.author_id) ?? 'Ex miembro del equipo'}` : ''}
            </p>
            <p className="text-sm">{changeText(change)}</p>
          </li>
        ))}
        {sends.map((send) => (
          <li key={send.id} className="relative">
            <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
            <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(send.created_at)}</p>
            <p className="text-sm">Ficha enviada por WhatsApp a {send.contacts?.full_name ?? 'un contacto'}.</p>
          </li>
        ))}
      </ol>
    </Card>
  );

  return (
    <>
      {header}
      {query.error ? <Alert variant="destructive">No se pudo fusionar: alguna de las propiedades ya fue fusionada.</Alert> : null}
      {!canWrite ? <Alert variant="warning">La cuenta está en solo lectura: podés consultar, pero no modificar.</Alert> : null}

      <PropertyDetailTabs key={tab} initial={tab} panels={{ resumen: summary, datos: data, publicacion: publications, historial: history }} />

      {canWrite ? (
        <>
          {/* En el celular, lo que se hace en la calle queda siempre a mano, arriba de la barra inferior. */}
          <div aria-hidden="true" className="h-16 md:hidden" />
          <nav aria-label="Acciones rápidas de la propiedad" className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur md:hidden">
            <div className="grid grid-cols-3 gap-2">
              {isPublic ? (
                <Button asChild variant="outline" size="sm" className="h-10">
                  <Link href={`${base}#enviar`}>
                    <MessageCircle aria-hidden="true" />
                    Enviar
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="h-10">
                  <Link href={`${base}?tab=datos`}>Editar</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="h-10">
                <Link href={`/panel/agenda?agendar=1&propiedad=${property.id}`}>
                  <CalendarPlus aria-hidden="true" />
                  Visita
                </Link>
              </Button>
              <Button asChild size="sm" className="h-10">
                <Link href={`${base}?tab=publicacion`}>
                  <Store aria-hidden="true" />
                  Publicar
                </Link>
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </>
  );
}
