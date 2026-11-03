import { formatDateTime } from '@inmogest/shared';
import { ExternalLink, Star, Trash2, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { Input } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { appOrigin } from '@/lib/request.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getActiveMembers } from '@/modules/contacts/queries.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { addOwnerAction, deleteImageAction, mergePropertiesAction, removeOwnerAction, setCoverAction } from '@/modules/properties/actions.ts';
import { CopyPublicLink, ImageUploader, PropertyForm } from '@/modules/properties/components.tsx';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { OPERATION_LABELS, STATUS_LABELS, STATUS_TONES, TYPE_LABELS, type PropertyStatus } from '@/modules/properties/labels.ts';
import { getDuplicateCandidates, getProperty, getPropertyChanges, organizationSlug, searchContacts } from '@/modules/properties/queries.ts';

export const metadata: Metadata = { title: 'Propiedad' };

// Ficha de la propiedad (CU-05, F-08, F-09, F-10).
export default function PropertyPage({ params, searchParams }: PageProps<'/panel/propiedades/[id]'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/propiedades" className="text-sm text-muted-foreground hover:text-foreground">
        ← Propiedades
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Cargando propiedad…</p>}>
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
  const ownerIds = property.property_owners.map((owner) => owner.contact_id);
  const [members, details, changes, slug, origin, duplicates, ownerResults] = await Promise.all([
    getActiveMembers(organization.id),
    getOrganizationDetails(organization.id),
    getPropertyChanges(organization.id, id),
    organizationSlug(organization.id),
    appOrigin(),
    getDuplicateCandidates(organization.id, property, ownerIds),
    searchContacts(organization.id, ownerQuery),
  ]);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const canWrite = organization.canWrite;
  const isPublic = property.status !== 'draft' && property.status !== 'paused';
  const publicUrl = slug ? `${origin}/p/${slug}/${property.slug}` : null;

  return (
    <>
      <PageHeader
        section="propiedades"
        title={property.title}
        description={`${property.code} · ${OPERATION_LABELS[property.operation]} · ${TYPE_LABELS[property.property_type]} · ${priceLabel(property.price, property.currency)}`}
        badge={<Badge variant={STATUS_TONES[property.status]}>{STATUS_LABELS[property.status]}</Badge>}
      />
      {query.nueva ? <Alert variant="success">Propiedad creada. Sumale fotos y el propietario.</Alert> : null}
      {query.error ? <Alert variant="destructive">No se pudo fusionar: alguna de las propiedades ya fue fusionada.</Alert> : null}
      {!canWrite ? <Alert variant="warning">La cuenta está en solo lectura: podés consultar, pero no modificar.</Alert> : null}

      <Card className="border-primary/30 bg-primary-soft/40">
        <CardTitle>Página pública</CardTitle>
        {isPublic && publicUrl ? (
          <div className="mt-3 grid gap-3">
            <CopyPublicLink url={publicUrl} />
            <Link href={publicUrl} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4">
              Ver la página pública <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            En {STATUS_LABELS[property.status].toLowerCase()} no se publica. Pasala a Disponible para compartir su enlace.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardTitle>Fotos</CardTitle>
            {property.property_images.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {property.property_images.map((image, index) => (
                  <li key={image.id} className="group relative overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado */}
                    <img src={publicImageUrl(image.storage_path)} alt={`Foto ${index + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    {index === 0 ? (
                      <span className="absolute top-1.5 left-1.5">
                        <Badge variant="highlight">Portada</Badge>
                      </span>
                    ) : null}
                    {canWrite ? (
                      <div className="flex justify-end gap-1 bg-surface p-1">
                        {index > 0 ? (
                          <form action={setCoverAction}>
                            <input type="hidden" name="imageId" value={image.id} />
                            <input type="hidden" name="propertyId" value={property.id} />
                            <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label={`Usar la foto ${index + 1} como portada`} title="Usar como portada">
                              <Star aria-hidden="true" />
                            </Button>
                          </form>
                        ) : null}
                        <form action={deleteImageAction}>
                          <input type="hidden" name="imageId" value={image.id} />
                          <input type="hidden" name="propertyId" value={property.id} />
                          <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label={`Borrar la foto ${index + 1}`} title="Borrar">
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Todavía no tiene fotos.</p>
            )}
            {canWrite ? (
              <div className="mt-4">
                <ImageUploader organizationId={organization.id} propertyId={property.id} />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Datos</CardTitle>
            <div className="mt-4">
              {canWrite ? (
                <PropertyForm
                  values={property}
                  members={members}
                  canReassign={organization.isOwner || Boolean(details?.agents_can_reassign)}
                  currentUserId={user.id}
                />
              ) : (
                <p className="text-sm whitespace-pre-line">{property.description || 'Sin descripción.'}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-6">
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
                      <Button type="submit" variant="ghost" size="sm">
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
                    Buscar contacto
                  </label>
                  <Input id="propietario" name="propietario" type="search" defaultValue={ownerQuery} placeholder="Buscar contacto por nombre" />
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
              <p className="mt-1 text-sm text-muted-foreground">
                {organization.isOwner ? 'Si es la misma propiedad, fusionalas: esta conserva fotos, propietarios e historial de ambas.' : 'El dueño puede fusionarlas si es la misma propiedad.'}
              </p>
              <ul className="mt-3 grid gap-2">
                {duplicates.map((duplicate) => {
                  const formId = `merge-${duplicate.id}`;
                  return (
                    <li key={duplicate.id} className="grid gap-2 rounded-md bg-muted p-3 text-sm">
                      <Link href={`/panel/propiedades/${duplicate.id}`} className="font-medium text-primary hover:underline">
                        {duplicate.code} · {duplicate.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {duplicate.reason === 'same_address' ? 'Misma dirección' : 'Mismo propietario, operación y tipo'}
                      </span>
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

          <Card>
            <CardTitle>Historial</CardTitle>
            <ol className="mt-4 grid gap-3 border-l-2 border-primary-soft pl-5">
              {changes.map((change) => (
                <li key={change.id} className="relative">
                  <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(change.created_at)}
                    {change.author_id ? ` · ${names.get(change.author_id) ?? 'Ex miembro del equipo'}` : ''}
                  </p>
                  <p className="text-sm">{changeText(change)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
