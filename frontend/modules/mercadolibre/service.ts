import 'server-only';
import {
  buildListing,
  createMercadoLibreClient,
  createSecretBox,
  MercadoLibreError,
  type ListingIssue,
  type MercadoLibreClient,
  type MlListingSettings,
  type SecretBox,
} from '@inmogest/shared';
import { readMercadoLibreEnv } from '@/lib/env.server.ts';
import { appOrigin } from '@/lib/request.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';

// Publicación en Mercado Libre desde el servidor web (ADR 0012). El cliente admin se usa solo con una
// inmobiliaria que ya se verificó con la sesión (o que viene de la fila de la propia publicación), y
// toda consulta filtra por organization_id. Los tokens se descifran solo acá y nunca se registran.

export const ML_CALLBACK_PATH = '/api/integraciones/mercadolibre/callback';
export const ML_OAUTH_COOKIE = 'ip_ml_oauth';

export type MercadoLibre = { client: MercadoLibreClient; box: SecretBox; redirectUri: string };

/** Null si la instalación no tiene la aplicación de Mercado Libre configurada. */
export async function getMercadoLibre(): Promise<MercadoLibre | null> {
  const env = readMercadoLibreEnv();
  if (!env) return null;
  const redirectUri = `${await appOrigin()}${ML_CALLBACK_PATH}`;
  return {
    client: createMercadoLibreClient({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      redirectUri,
      apiUrl: env.apiUrl,
      authUrl: env.authUrl,
    }),
    box: await createSecretBox(env.encryptionKey),
    redirectUri,
  };
}

/** Error con un mensaje para mostrar en el panel (en español, sin datos internos). */
export class ListingSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingSyncError';
  }
}

const NOT_CONNECTED = 'Mercado Libre no está conectado. El dueño lo puede conectar en Integraciones.';
const UNREACHABLE = 'No pudimos comunicarnos con Mercado Libre. Probá de nuevo en unos minutos.';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Access token vigente de la inmobiliaria. Si vence, lo renueva quien obtiene la reserva en la base
 * (el refresh token de Mercado Libre es de un solo uso); los demás esperan y vuelven a leer.
 */
export async function accessToken(ml: MercadoLibre, organizationId: string): Promise<{ token: string; userId: number }> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await admin.rpc('mercadolibre_token_lease', { p_organization_id: organizationId });
    const lease = data?.[0];
    if (error || !lease) throw new ListingSyncError(NOT_CONNECTED);
    if (!lease.needs_refresh) return { token: await ml.box.open(lease.access_token_enc), userId: lease.ml_user_id };
    if (!lease.leased) {
      await sleep(1000);
      continue;
    }
    try {
      const tokens = await ml.client.refresh(await ml.box.open(lease.refresh_token_enc));
      await admin.rpc('mercadolibre_save_tokens', {
        p_organization_id: organizationId,
        p_access_token_enc: await ml.box.seal(tokens.accessToken),
        p_refresh_token_enc: await ml.box.seal(tokens.refreshToken),
        p_expires_at: tokens.expiresAt.toISOString(),
      });
      return { token: tokens.accessToken, userId: tokens.userId };
    } catch (caught) {
      if (caught instanceof MercadoLibreError && !caught.transient) {
        // Permiso revocado o vencido (6 meses sin uso, cambio de contraseña): hay que volver a conectar.
        await admin.rpc('mercadolibre_mark_reauth', { p_organization_id: organizationId });
        throw new ListingSyncError('Mercado Libre pidió volver a conectar la cuenta. El dueño lo puede hacer en Integraciones.');
      }
      throw new ListingSyncError(UNREACHABLE);
    }
  }
  throw new ListingSyncError(UNREACHABLE);
}

export function issueText(issue: ListingIssue): string {
  switch (issue.kind) {
    case 'attribute':
      return `Completá "${issue.name}" para Mercado Libre.`;
    case 'price':
      return 'Cargá el precio de la propiedad.';
    case 'pictures':
      return 'Mercado Libre pide al menos una foto.';
    case 'location':
      return 'Elegí la provincia, la ciudad y el barrio de Mercado Libre.';
    case 'whatsapp':
      return 'Cargá el teléfono de la inmobiliaria (Configuración → Inmobiliaria) o conectá WhatsApp: Mercado Libre lo pide para el contacto.';
    case 'category':
      return 'Mercado Libre no tiene una categoría para esta operación y tipo de propiedad.';
    case 'listing_type':
      return 'Elegí el tipo de publicación.';
  }
}

function mlErrorText(error: MercadoLibreError): string {
  if (error.transient) return UNREACHABLE;
  if (error.causes.length > 0) return `Mercado Libre rechazó la publicación: ${error.causes.join(' · ')}`;
  return `Mercado Libre rechazó la publicación (${error.code}).`;
}

type PropertyRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  operation: 'sale' | 'rent' | 'temporary_rent';
  property_type: 'apartment' | 'house' | 'ph' | 'land' | 'office' | 'commercial' | 'garage' | 'warehouse' | 'farm';
  status: 'draft' | 'available' | 'reserved' | 'sold' | 'rented' | 'paused';
  price: number | null;
  currency: string;
  expenses: number | null;
  expenses_currency: string;
  address: string;
  show_address: boolean;
  neighborhood: string;
  city: string;
  province: string;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  covered_area_m2: number | null;
  total_area_m2: number | null;
  features: string[];
  merged_into_id: string | null;
};

/** Propiedad, fotos y datos de contacto de la inmobiliaria para armar la publicación. */
export async function listingContext(organizationId: string, propertyId: string) {
  const admin = createAdminClient();
  const [property, images, organization, whatsapp] = await Promise.all([
    admin
      .from('properties')
      .select(
        'id, organization_id, title, description, operation, property_type, status, price, currency, expenses, expenses_currency, address, show_address, neighborhood, city, province, rooms, bedrooms, bathrooms, covered_area_m2, total_area_m2, features, merged_into_id',
      )
      .eq('organization_id', organizationId)
      .eq('id', propertyId)
      .maybeSingle(),
    admin
      .from('property_images')
      .select('storage_path')
      .eq('organization_id', organizationId)
      .eq('property_id', propertyId)
      .order('position')
      .order('created_at'),
    admin.from('organizations').select('name, contact_email, contact_phone, website_url').eq('id', organizationId).maybeSingle(),
    admin
      .from('whatsapp_connections')
      .select('phone_e164')
      .eq('organization_id', organizationId)
      .eq('status', 'connected')
      .is('removed_at', null)
      .not('phone_e164', 'is', null)
      .limit(1)
      .maybeSingle(),
  ]);
  const row = property.data as PropertyRow | null;
  if (!row || row.merged_into_id || !organization.data) return null;
  return {
    property: row,
    pictures: (images.data ?? []).map((image) => publicImageUrl(image.storage_path)).filter(Boolean),
    contact: {
      name: organization.data.name,
      email: organization.data.contact_email,
      // El WhatsApp conectado, si hay; si no, el teléfono de la inmobiliaria.
      whatsappE164: whatsapp.data?.phone_e164 ?? organization.data.contact_phone,
      website: organization.data.website_url,
    },
  };
}

export type SyncResult = { ok: true; message: string } | { ok: false; message: string };

async function recordResult(
  listingId: string,
  status: 'active' | 'paused' | 'closed' | 'error',
  extra: { externalId?: string; url?: string | null; error?: string } = {},
) {
  await createAdminClient().rpc('mercadolibre_listing_result', {
    p_listing_id: listingId,
    p_status: status,
    ...(extra.externalId ? { p_external_id: extra.externalId } : {}),
    ...(extra.url ? { p_url: extra.url } : {}),
    ...(extra.error ? { p_error: extra.error } : {}),
  });
}

/**
 * Publica o actualiza la propiedad en Mercado Libre según su estado. La fila de la publicación ya
 * tiene que existir como gestionada (prepare_mercadolibre_listing). Registra el resultado en la base.
 */
export async function syncMercadoLibreListing(organizationId: string, propertyId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from('property_listings')
    .select('id, external_id, sync_status, settings')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId)
    .eq('channel', 'mercadolibre')
    .eq('managed', true)
    .maybeSingle();
  if (!listing) return { ok: false, message: 'Esta propiedad no se publica en Mercado Libre desde InmoPanel.' };

  const fail = async (message: string): Promise<SyncResult> => {
    await recordResult(listing.id, 'error', { error: message });
    return { ok: false, message };
  };

  const ml = await getMercadoLibre();
  if (!ml) return fail('Mercado Libre no está habilitado en esta instalación.');
  const context = await listingContext(organizationId, propertyId);
  if (!context) return fail('La propiedad ya no existe.');

  try {
    const { token } = await accessToken(ml, organizationId);
    const settings = (listing.settings ?? {}) as MlListingSettings;
    const definitions = settings.category_id ? await ml.client.categoryAttributes(token, settings.category_id) : [];
    const built = buildListing({ ...context, settings, definitions });
    const publishedBefore = listing.external_id && listing.sync_status !== 'closed';

    if (!publishedBefore) {
      // Una publicación finalizada no se reactiva en Mercado Libre: se crea otra.
      if (built.status !== 'active') {
        return fail('Solo se publican propiedades disponibles. Pasala a Disponible para publicarla.');
      }
      const first = built.issues[0];
      if (first) return fail(issueText(first));
      const item = await ml.client.createItem(token, built.create);
      if (built.hideAddress) await ml.client.setAddressHidden(token, item.id, true);
      await recordResult(listing.id, 'active', { externalId: item.id, url: item.permalink });
      return { ok: true, message: 'Publicamos la propiedad en Mercado Libre.' };
    }

    const itemId = listing.external_id as string;
    if (built.status === 'closed') {
      await ml.client.updateItem(token, itemId, { status: 'closed' });
      await recordResult(listing.id, 'closed');
      return { ok: true, message: 'Finalizamos la publicación en Mercado Libre.' };
    }
    const blocking = built.issues.find((issue) => issue.kind !== 'listing_type');
    if (blocking) return fail(issueText(blocking));
    const item = await ml.client.updateItem(token, itemId, built.update);
    await ml.client.updateDescription(token, itemId, built.description);
    await ml.client.setAddressHidden(token, itemId, built.hideAddress);
    if (item.status !== built.status) await ml.client.updateItem(token, itemId, { status: built.status });
    await recordResult(listing.id, built.status, { url: item.permalink });
    return {
      ok: true,
      message: built.status === 'active' ? 'Actualizamos la publicación en Mercado Libre.' : 'Pausamos la publicación en Mercado Libre.',
    };
  } catch (caught) {
    if (caught instanceof ListingSyncError) return fail(caught.message);
    if (caught instanceof MercadoLibreError) return fail(mlErrorText(caught));
    return fail('Ocurrió un error inesperado al sincronizar con Mercado Libre.');
  }
}

/** Después de editar una propiedad: si se publica en Mercado Libre desde InmoPanel, se sincroniza. */
export async function syncIfManaged(organizationId: string, propertyId: string): Promise<void> {
  if (!readMercadoLibreEnv()) return;
  const { data } = await createAdminClient()
    .from('property_listings')
    .select('external_id, sync_status')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId)
    .eq('channel', 'mercadolibre')
    .eq('managed', true)
    .maybeSingle();
  if (!data?.external_id || data.sync_status === 'closed') return;
  await syncMercadoLibreListing(organizationId, propertyId);
}
