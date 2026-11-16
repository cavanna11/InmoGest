import {
  automaticAttributes,
  buildListing,
  findByName,
  ML_COUNTRY_ID,
  ML_LISTING_TYPES,
  resolveCategory,
  type MlCategory,
  type MlListingSettings,
  type MlNamed,
} from '@inmogest/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { getMercadoLibreConnection, getPropertyListings } from '@/modules/integrations/queries.ts';
import { MercadoLibrePublishForm } from '@/modules/mercadolibre/components.tsx';
import { accessToken, getMercadoLibre, issueText, ListingSyncError, listingContext, type MercadoLibre } from '@/modules/mercadolibre/service.ts';
import { STATUS_LABELS } from '@/modules/properties/labels.ts';

export const metadata: Metadata = { title: 'Publicar en Mercado Libre' };

const LISTING_TYPE_NAMES: Record<string, string> = { silver: 'Plata', gold: 'Oro', gold_premium: 'Oro Premium' };

// Nombres de provincia de InmoPanel que en Mercado Libre se llaman distinto.
const STATE_ALIASES: Record<string, string> = {
  caba: 'Capital Federal',
  'ciudad autonoma de buenos aires': 'Capital Federal',
  'ciudad de buenos aires': 'Capital Federal',
};

export default function MercadoLibrePage({ params }: PageProps<'/panel/propiedades/[id]/mercadolibre'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Suspense fallback={<p className="text-muted-foreground">Consultando Mercado Libre…</p>}>
        <MercadoLibrePublication params={params} />
      </Suspense>
    </div>
  );
}

async function MercadoLibrePublication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { organization } = await requireActiveOrganization(`/panel/propiedades/${id}/mercadolibre`);
  const back = (
    <Link href={`/panel/propiedades/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
      ← Volver a la propiedad
    </Link>
  );

  const [context, connection, listings, ml] = await Promise.all([
    listingContext(organization.id, id),
    getMercadoLibreConnection(organization.id),
    getPropertyListings(organization.id, id),
    getMercadoLibre(),
  ]);
  if (!context) notFound();
  const { property } = context;
  const header = <PageHeader section="propiedades" title="Publicar en Mercado Libre" description={property.title} />;
  const stop = (message: string) => (
    <>
      {back}
      {header}
      <Alert variant="warning">{message}</Alert>
    </>
  );

  if (!ml) return stop('Mercado Libre todavía no está habilitado en esta instalación.');
  if (!organization.canWrite) return stop('La cuenta está en solo lectura: no se pueden hacer cambios.');
  if (connection?.status !== 'connected') {
    return stop('Mercado Libre no está conectado, o pidió volver a conectar la cuenta. El dueño lo puede hacer en Integraciones.');
  }

  const listing = listings.find((item) => item.channel === 'mercadolibre' && item.managed) ?? null;
  const published = Boolean(listing?.external_id && listing.sync_status !== 'closed');
  if (!published && property.status !== 'available') {
    return stop(`La propiedad está en ${STATUS_LABELS[property.status].toLowerCase()}. Solo se publican propiedades disponibles.`);
  }

  const loaded = await loadPublishData(ml, organization.id, context, listing?.settings).catch((caught: unknown) => ({
    error: caught instanceof ListingSyncError ? caught.message : 'No pudimos consultar Mercado Libre. Probá de nuevo en unos minutos.',
  }));
  if ('error' in loaded) return stop(loaded.error);
  const { categoryId, editable, automatic, types, states, cities, neighborhoods, saved, location, blocking } = loaded;

  return (
    <>
      {back}
      {header}
      {listing?.sync_status === 'error' && listing.last_error ? <Alert variant="destructive">{listing.last_error}</Alert> : null}
      {blocking.map((issue) => (
        <Alert key={issue.kind} variant="warning">
          {issueText(issue)}
        </Alert>
      ))}
      <Card>
        <CardTitle>{published ? 'Publicación en Mercado Libre' : 'Datos de la publicación'}</CardTitle>
        <CardDescription>
          Se publica con la cuenta {connection.nickname || 'conectada'}: título, precio, descripción, fotos y contacto salen de la propiedad.
          {property.show_address ? '' : ' La dirección exacta queda oculta, como en la página pública.'}
        </CardDescription>
        <div className="mt-6">
          <MercadoLibrePublishForm
            propertyId={property.id}
            categoryId={categoryId}
            listingTypes={types}
            definitions={editable}
            automatic={automatic}
            states={states}
            initialCities={cities}
            initialNeighborhoods={neighborhoods}
            initial={{ ...saved, location }}
            published={published}
          />
        </div>
      </Card>
    </>
  );
}

type Context = NonNullable<Awaited<ReturnType<typeof listingContext>>>;

/** Categoría, atributos, tipos de publicación y ubicación sugerida, consultados a Mercado Libre. */
async function loadPublishData(ml: MercadoLibre, organizationId: string, context: Context, savedSettings: unknown) {
    const { property } = context;
    const { token, userId } = await accessToken(ml, organizationId);
    const categories = new Map<string, Promise<MlCategory>>();
    const getCategory = (categoryId: string) => {
      if (!categories.has(categoryId)) categories.set(categoryId, ml.client.category(token, categoryId));
      return categories.get(categoryId) as Promise<MlCategory>;
    };
    const categoryId = await resolveCategory(getCategory, property.operation, property.property_type);
    if (!categoryId) throw new ListingSyncError('Mercado Libre no tiene una categoría para esta combinación de operación y tipo de propiedad.');

    const saved = (savedSettings ?? {}) as MlListingSettings;
    const [definitions, listingTypes, country] = await Promise.all([
      ml.client.categoryAttributes(token, categoryId),
      ml.client.availableListingTypes(token, userId, categoryId).catch(() => [] as MlNamed[]),
      ml.client.location(token, 'country', ML_COUNTRY_ID),
    ]);
    const states = [...country.children].sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Ubicación: la guardada o una sugerencia por nombre a partir de la propiedad.
    let location = saved.location ?? {};
    let cities: MlNamed[] = [];
    let neighborhoods: MlNamed[] = [];
    if (!location.state) {
      const province = STATE_ALIASES[property.city.trim().toLowerCase()] ?? STATE_ALIASES[property.province.trim().toLowerCase()] ?? property.province;
      const state = findByName(states, province);
      if (state) location = { state };
    }
    if (location.state) {
      cities = [...(await ml.client.location(token, 'state', location.state.id)).children].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      if (!location.city) {
        const city = findByName(cities, property.city) ?? findByName(cities, property.neighborhood);
        if (city) location = { ...location, city };
      }
    }
    if (location.city) {
      neighborhoods = [...(await ml.client.location(token, 'city', location.city.id)).children].sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      );
      if (!location.neighborhood) {
        const neighborhood = findByName(neighborhoods, property.neighborhood) ?? findByName(neighborhoods, property.city);
        if (neighborhood) location = { ...location, neighborhood };
      }
    }

    const visible = definitions.filter((definition) => !definition.hidden);
    const automaticIds = new Set(Object.keys(automaticAttributes(property)).filter((key) => visible.some((definition) => definition.id === key)));
    const editable = visible.filter((definition) => !automaticIds.has(definition.id) || saved.attributes?.[definition.id]);
    const automatic = visible.filter((definition) => automaticIds.has(definition.id)).map((definition) => definition.name);
    const types: MlNamed[] =
      listingTypes.length > 0
        ? listingTypes.map((type) => ({ id: type.id, name: LISTING_TYPE_NAMES[type.id] ?? type.name }))
        : ML_LISTING_TYPES.map((type) => ({ id: type, name: LISTING_TYPE_NAMES[type] ?? type }));

    const preview = buildListing({ ...context, settings: { ...saved, category_id: categoryId, listing_type_id: 'x', location }, definitions });
    const blocking = preview.issues.filter((issue) => issue.kind === 'pictures' || issue.kind === 'whatsapp' || issue.kind === 'price');

    return { categoryId, editable, automatic, types, states, cities, neighborhoods, saved, location, blocking };
}
