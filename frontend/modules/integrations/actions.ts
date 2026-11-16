'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { generateApiToken } from './tokens.ts';

// Links de publicación (F-36) y tokens de la API de propiedades (F-33). La inmobiliaria sale de la
// sesión; las RPC validan permisos en la base.

const uuid = z.uuid();
const CHANNELS = ['website', 'mercadolibre', 'zonaprop', 'argenprop'] as const;
const urlSchema = z
  .string()
  .trim()
  .max(500, 'El link es demasiado largo.')
  .refine((value) => value === '' || /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value), 'Pegá el link completo, empezando por https://');

async function activeOrganization() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return active;
}

export async function setListingLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await activeOrganization();
  if (!organization.canWrite) return fail('La cuenta está en solo lectura: no se pueden hacer cambios.');
  const propertyId = formData.get('propertyId');
  const channel = z.enum(CHANNELS).safeParse(formData.get('channel'));
  const url = urlSchema.safeParse(formData.get('url') ?? '');
  if (typeof propertyId !== 'string' || !uuid.safeParse(propertyId).success || !channel.success) return fail('Datos no válidos.');
  if (!url.success) return fail(url.error.issues[0]?.message ?? 'Link no válido.', { url: url.error.issues[0]?.message ?? '' });

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_property_listing_link', {
    p_property_id: propertyId,
    p_channel: channel.data,
    p_url: url.data,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath(`/panel/propiedades/${propertyId}`);
  return done(url.data ? 'Guardamos el link.' : 'Quitamos el link.');
}

export async function createApiTokenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await activeOrganization();
  if (!organization.isOwner) return fail('Solo el dueño puede crear tokens de la API.');
  const name = z.string().trim().min(1, 'Poné un nombre, por ejemplo "Web".').max(60).safeParse(formData.get('name') ?? '');
  if (!name.success) return fail('Revisá el nombre.', { name: name.error.issues[0]?.message ?? '' });

  const { token, hash, prefix } = generateApiToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_api_token', {
    p_organization_id: organization.id,
    p_name: name.data,
    p_token_hash: hash,
    p_token_prefix: prefix,
  });
  if (error) {
    return fail(error.message === 'too_many_tokens' ? 'Ya tenés 5 tokens activos. Revocá alguno para crear otro.' : translateDbError(error).error.message);
  }
  revalidatePath('/panel/integraciones');
  return done('Copiá el token ahora: no lo vamos a volver a mostrar.', { token });
}

export async function revokeApiTokenAction(formData: FormData): Promise<void> {
  const tokenId = formData.get('tokenId');
  if (typeof tokenId !== 'string' || !uuid.safeParse(tokenId).success) return;
  const supabase = await createClient();
  await supabase.rpc('revoke_api_token', { p_token_id: tokenId });
  revalidatePath('/panel/integraciones');
}
