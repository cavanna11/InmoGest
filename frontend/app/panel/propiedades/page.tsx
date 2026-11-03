import { Building2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input, Select } from '@/components/ui/form-controls.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Badge, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { OPERATION_LABELS, STATUS_LABELS, STATUS_TONES, TYPE_LABELS } from '@/modules/properties/labels.ts';
import { listProperties, PAGE_SIZE } from '@/modules/properties/queries.ts';

export const metadata: Metadata = { title: 'Propiedades' };

export default function PropertiesPage({ searchParams }: PageProps<'/panel/propiedades'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="propiedades" title="Propiedades" description="La cartera de la inmobiliaria, con fotos, propietarios y su página pública." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando propiedades…</p>}>
        <Properties searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

async function Properties({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, organization } = await requireActiveOrganization('/panel/propiedades');
  const params = await searchParams;
  const filters = {
    q: param(params.q),
    status: param(params.estado),
    operation: param(params.operacion),
    type: param(params.tipo),
    assigned: param(params.asignado),
    page: Number(param(params.pagina) ?? '1') || 1,
  };
  const { properties, total, page } = await listProperties(organization.id, user.id, filters);
  const filtered = Boolean(filters.q || filters.status || filters.operation || filters.type || filters.assigned);
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: filters.q, estado: filters.status, operacion: filters.operation, tipo: filters.type, asignado: filters.assigned })) {
      if (value) next.set(key, value);
    }
    next.set('pagina', String(target));
    return `/panel/propiedades?${next.toString()}`;
  };

  return (
    <>
      {organization.canWrite ? (
        <Button asChild className="justify-self-start">
          <Link href="/panel/propiedades/nueva">
            <Plus aria-hidden="true" /> Nueva propiedad
          </Link>
        </Button>
      ) : null}

      <Card className="p-4 sm:p-4">
        <form role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Título, barrio, dirección o código" />
          <Select name="estado" aria-label="Estado" defaultValue={filters.status ?? ''}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="operacion" aria-label="Operación" defaultValue={filters.operation ?? ''}>
            <option value="">Toda operación</option>
            {Object.entries(OPERATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="tipo" aria-label="Tipo" defaultValue={filters.type ?? ''}>
            <option value="">Todo tipo</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="asignado" aria-label="Asignación" defaultValue={filters.assigned ?? ''}>
            <option value="">Todas</option>
            <option value="mine">Mis propiedades</option>
            <option value="unassigned">Sin asignar</option>
          </Select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      {properties.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">{filtered ? 'No hay propiedades con esos filtros.' : 'Todavía no cargaste propiedades.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? (
              <Link href="/panel/propiedades" className="text-primary underline underline-offset-4">
                Ver todas
              </Link>
            ) : (
              'Cargá la primera con sus fotos y compartila con su página pública.'
            )}
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const cover = property.property_images[0]?.storage_path;
            return (
              <li key={property.id}>
                <Link
                  href={`/panel/propiedades/${property.id}`}
                  className="group block h-full overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary"
                >
                  <div className="relative aspect-[4/3] bg-primary-soft">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado
                      <img src={publicImageUrl(cover)} alt="" className="size-full object-cover" loading="lazy" />
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
                  <div className="grid gap-1 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {property.code} · {OPERATION_LABELS[property.operation]} · {TYPE_LABELS[property.property_type]}
                    </p>
                    <p className="font-semibold group-hover:text-primary">{property.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[property.neighborhood, property.city].filter(Boolean).join(', ') || 'Sin ubicación'}
                      {property.rooms ? ` · ${property.rooms} amb.` : ''}
                    </p>
                    <p className="mt-1 text-lg font-bold text-primary">{priceLabel(property.price, property.currency)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {total} propiedades · página {page} de {Math.ceil(total / PAGE_SIZE)}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            ) : null}
            {page * PAGE_SIZE < total ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Siguiente</Link>
              </Button>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}
