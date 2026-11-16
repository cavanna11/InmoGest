'use server';

import { randomBytes } from 'node:crypto';
import { createPkce, ML_COUNTRY_ID, type MlListingSettings, translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { getCurrentUser } from '@/lib/auth.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { accessToken, getMercadoLibre, ListingSyncError, ML_CALLBACK_PATH, ML_OAUTH_COOKIE, syncMercadoLibreListing } from './service.ts';

// Acciones de Mercado Libre (ADR 0012). La inmobiliaria sale de la sesión. Conectar y desconectar es del
// dueño; publicar, de cualquiera que pueda editar la propiedad. La base lo vuelve a validar.

const uuid = z.uuid();
const NOT_AVAILABLE = 'Mercado Libre todavía no está habilitado en esta instalación.';

async function activeOrganization() {
  const [{ active }, user] = await Promise.all([resolveActiveOrganization(), getCurrentUser()]);
  if (!active || !user) redirect('/seleccionar-inmobiliaria');
  return { organization: active, user };
}

/** Inicia el OAuth: guarda state y verifier en una cookie cifrada de 10 minutos y va a Mercado Libre. */
export async function connectMercadoLibreAction(): Promise<void> {
  const { organization, user } = await activeOrganization();
  if (!organization.isOwner || !organization.canWrite) redirect('/panel/integraciones?ml=sin_permiso');
  const ml = await getMercadoLibre();
  if (!ml) redirect('/panel/integraciones?ml=no_habilitado');

  const state = randomBytes(24).toString('base64url');
  const { verifier, challenge } = await createPkce();
  const payload = { state, verifier, organizationId: organization.id, userId: user.id, exp: Date.now() + 10 * 60 * 1000 };
  (await cookies()).set(ML_OAUTH_COOKIE, await ml.box.seal(JSON.stringify(payload)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: ML_CALLBACK_PATH,
    maxAge: 600,
  });
  redirect(ml.client.authorizationUrl({ state, codeChallenge: challenge }));
}

export async function disconnectMercadoLibreAction(): Promise<void> {
  const { organization } = await activeOrganization();
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_mercadolibre_connection', { p_organization_id: organization.id });
  revalidatePath('/panel/integraciones');
  redirect(error ? '/panel/integraciones?ml=sin_permiso' : '/panel/integraciones?ml=desconectado');
}

export type LocationOption = { id: string; name: string };

/** Opciones de ubicación de Mercado Libre: provincias (sin id), ciudades de una provincia o barrios de una ciudad. */
export async function mercadoLibreLocationsAction(
  kind: 'country' | 'state' | 'city',
  id: string | null,
): Promise<{ options: LocationOption[]; error?: string }> {
  const { organization } = await activeOrganization();
  const ml = await getMercadoLibre();
  if (!ml) return { options: [], error: NOT_AVAILABLE };
  const target = kind === 'country' ? ML_COUNTRY_ID : id;
  if (!target || !/^[A-Za-z0-9=_-]{1,80}$/.test(target)) return { options: [] };
  try {
    const { token } = await accessToken(ml, organization.id);
    const location = await ml.client.location(token, kind, target);
    return { options: location.children.sort((a, b) => a.name.localeCompare(b.name, 'es')) };
  } catch (caught) {
    if (caught instanceof ListingSyncError) return { options: [], error: caught.message };
    return { options: [], error: 'No pudimos traer las ubicaciones de Mercado Libre.' };
  }
}

const namedSchema = z.object({ id: z.string().min(1).max(80), name: z.string().min(1).max(120) });
const settingsSchema = z.object({
  category_id: z.string().regex(/^MLA\d{1,12}$/),
  listing_type_id: z.string().regex(/^[a-z_]{1,40}$/, 'Elegí el tipo de publicación.'),
  location: z.object({ state: namedSchema, city: namedSchema, neighborhood: namedSchema }),
  attributes: z
    .record(
      z.string().regex(/^[A-Z0-9_]{1,60}$/),
      z.object({ value_id: z.string().max(60).optional(), value_name: z.string().max(255).optional() }),
    )
    .refine((value) => Object.keys(value).length <= 80),
});

/** Guarda la configuración elegida y publica (o actualiza) en Mercado Libre. */
export async function publishMercadoLibreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization } = await activeOrganization();
  if (!organization.canWrite) return fail('La cuenta está en solo lectura: no se pueden hacer cambios.');
  const propertyId = formData.get('propertyId');
  if (typeof propertyId !== 'string' || !uuid.safeParse(propertyId).success) return fail('Propiedad no válida.');

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('settings') ?? ''));
  } catch {
    return fail('Revisá los datos de la publicación.');
  }
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const location = parsed.error.issues.some((issue) => issue.path[0] === 'location');
    return fail(location ? 'Elegí la provincia, la ciudad y el barrio de Mercado Libre.' : 'Revisá los datos de la publicación.');
  }
  const settings: MlListingSettings = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc('prepare_mercadolibre_listing', { p_property_id: propertyId, p_settings: settings });
  if (error) return fail(translateDbError(error).error.message);

  const result = await syncMercadoLibreListing(organization.id, propertyId);
  revalidatePath(`/panel/propiedades/${propertyId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/mercadolibre`);
  return result.ok ? done(result.message) : fail(result.message);
}

/** Vuelve a mandar la propiedad a Mercado Libre (botón "Sincronizar ahora"). */
export async function syncMercadoLibreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization } = await activeOrganization();
  if (!organization.canWrite) return fail('La cuenta está en solo lectura: no se pueden hacer cambios.');
  const propertyId = formData.get('propertyId');
  if (typeof propertyId !== 'string' || !uuid.safeParse(propertyId).success) return fail('Propiedad no válida.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('prepare_mercadolibre_listing', { p_property_id: propertyId });
  if (error) return fail(translateDbError(error).error.message);
  const result = await syncMercadoLibreListing(organization.id, propertyId);
  revalidatePath(`/panel/propiedades/${propertyId}`);
  revalidatePath(`/panel/propiedades/${propertyId}/mercadolibre`);
  return result.ok ? done(result.message) : fail(result.message);
}

/** Deja de gestionar una publicación finalizada o que nunca llegó a publicarse. */
export async function unlinkMercadoLibreAction(formData: FormData): Promise<void> {
  const propertyId = formData.get('propertyId');
  if (typeof propertyId !== 'string' || !uuid.safeParse(propertyId).success) return;
  const supabase = await createClient();
  await supabase.rpc('unlink_mercadolibre_listing', { p_property_id: propertyId });
  revalidatePath(`/panel/propiedades/${propertyId}`);
  redirect(`/panel/propiedades/${propertyId}`);
}

