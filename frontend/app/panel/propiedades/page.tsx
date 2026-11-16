import { Building2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';
import { PropertyCode } from '@/components/ui/property-code.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { appOrigin } from '@/lib/request.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getMercadoLibreConnection } from '@/modules/integrations/queries.ts';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { OPERATION_LABELS, STATUS_LABELS, STATUS_TONES, TYPE_LABELS } from '@/modules/properties/labels.ts';
import { PropertyListControls, type PropertyListParams } from '@/modules/properties/list-controls.tsx';
import { PropertyActions } from '@/modules/properties/property-actions.tsx';
import { listProperties, organizationSlug, PAGE_SIZE } from '@/modules/properties/queries.ts';

export const metadata: Metadata = { title: 'Propiedades' };

export default function PropertiesPage({ searchParams }: PageProps<'/panel/propiedades'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader section="propiedades" title="Propiedades" description="La cartera de la inmobiliaria, con fotos, propietarios y su página pública." />
        <Suspense fallback={null}>
          <NewPropertyButton />
        </Suspense>
      </div>
      <Suspense fallback={<PageSkeleton variant="cards" label="Cargando propiedades…" />}>
        <Properties searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewPropertyButton() {
  const { organization } = await requireActiveOrganization('/panel/propiedades');
  if (!organization.canWrite) return null;
  return (
    <Button asChild>
      <Link href="/panel/propiedades/nueva">
        <Plus aria-hidden="true" /> Nueva propiedad
      </Link>
    </Button>
  );
}

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

async function Properties({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/propiedades');
  const raw = await searchParams;
  const params: PropertyListParams = {
    q: param(raw.q),
    estado: param(raw.estado),
    operacion: param(raw.operacion),
    tipo: param(raw.tipo),
    asignado: param(raw.asignado),
    orden: param(raw.orden),
  };
  const [{ properties, total, page }, slug, origin, mercadoLibre] = await Promise.all([
    listProperties(organization.id, user.id, {
      q: params.q || undefined,
      status: params.estado || undefined,
      operation: params.operacion || undefined,
      type: params.tipo || undefined,
      assigned: params.asignado || undefined,
      sort: params.orden || undefined,
      page: Number(param(raw.pagina) || '1') || 1,
    }),
    organizationSlug(organization.id),
    appOrigin(),
    getMercadoLibreConnection(organization.id),
  ]);
  const filtered = Boolean(params.q || params.estado || params.operacion || params.tipo || params.asignado);
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) next.set(key, value);
    next.set('pagina', String(target));
    return `/panel/propiedades?${next.toString()}`;
  };

  return (
    <>
      <PropertyListControls params={params} />

      {properties.length === 0 ? (
        <Empty className="border border-border bg-surface">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{filtered ? 'No hay propiedades con esos filtros' : 'Cargá tu primera propiedad'}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Probá con otra palabra o sacá algún filtro.'
                : 'Con título, operación y precio alcanza para empezar. Después le sumás fotos y la publicás.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button asChild variant="outline">
                <Link href="/panel/propiedades">Ver todas</Link>
              </Button>
            ) : organization.canWrite ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/panel/propiedades/nueva">
                    <Plus aria-hidden="true" /> Nueva propiedad
                  </Link>
                </Button>
                {organization.isOwner ? (
                  <Button asChild variant="outline">
                    <Link href="/panel/importar">Importar desde una planilla</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <p className="-mt-3 text-sm text-muted-foreground tabular-nums">
            {total === 1 ? '1 propiedad' : `${total} propiedades`}
            {pages > 1 ? ` · página ${page} de ${pages}` : ''}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.map((property, index) => {
              const cover = property.property_images[0]?.storage_path;
              const location = [property.neighborhood, property.city].filter(Boolean).join(', ');
              return (
                <li key={property.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary/60 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
                  <div className="relative aspect-[4/3] bg-primary-soft">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado
                      <img
                        src={publicImageUrl(cover)}
                        alt=""
                        width={400}
                        height={300}
                        className="size-full object-cover"
                        loading={index < 3 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-primary-soft-foreground">
                        <Building2 aria-hidden="true" className="size-10 opacity-60" />
                      </span>
                    )}
                    <span className="absolute top-2 left-2">
                      <Badge variant={STATUS_TONES[property.status]} className="shadow-sm">
                        {STATUS_LABELS[property.status]}
                      </Badge>
                    </span>
                  </div>
                  <div className="grid flex-1 content-start gap-1.5 p-4 pr-14">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <PropertyCode code={property.code} />
                      {OPERATION_LABELS[property.operation]} · {TYPE_LABELS[property.property_type]}
                    </p>
                    <h2 className="font-semibold text-pretty">
                      {/* El enlace cubre toda la tarjeta; el menú de acciones queda por encima. */}
                      <Link href={`/panel/propiedades/${property.id}`} className="outline-none after:absolute after:inset-0 group-hover:text-primary">
                        {property.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {location || 'Sin ubicación'}
                      {property.rooms ? ` · ${property.rooms} amb.` : ''}
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary tabular-nums">{priceLabel(property.price, property.currency)}</p>
                  </div>
                  <div className="absolute right-3 bottom-3 z-10">
                    <PropertyActions
                      id={property.id}
                      title={property.title}
                      status={property.status}
                      publicUrl={slug ? `${origin}/p/${slug}/${property.slug}` : null}
                      canWrite={organization.canWrite}
                      mercadoLibre={mercadoLibre?.status === 'connected'}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-end gap-2 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>Siguiente</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
