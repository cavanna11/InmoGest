'use server';

import { slugify, translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { IMAGES_BUCKET, MAX_IMAGES } from './images.ts';
import { propertySchema, toPropertyRow } from './schemas.ts';

// Acciones de propiedades. La inmobiliaria sale de la sesión; RLS y los triggers validan en la base
// (límite del plan, asignación, slug y código).

const uuid = z.uuid();
const READ_ONLY = 'La cuenta está en solo lectura: no se pueden hacer cambios.';

async function writeContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return { organization: active, error: active.canWrite ? null : READ_ONLY };
}

function propertyPath(id: string) {
  return `/panel/propiedades/${id}`;
}

function parseProperty(formData: FormData) {
  return propertySchema.safeParse({
    ...formValues(formData),
    features: formData.getAll('features').filter((value): value is string => typeof value === 'string'),
  });
}

export async function createPropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const parsed = parseProperty(formData);
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('properties')
    .insert({
      organization_id: organization.id,
      // Base del slug; la base le agrega el número de la propiedad y no lo cambia después.
      slug: slugify(parsed.data.title, 'propiedad').slice(0, 70).replace(/-+$/, ''),
      created_by: auth.user?.id ?? null,
      ...toPropertyRow(parsed.data),
    })
    .select('id')
    .single();
  if (error || !data) return fail(translateDbError(error).error.message);

  revalidatePath('/panel/propiedades');
  redirect(`${propertyPath(data.id)}?nueva=1`);
}

export async function updatePropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('propertyId'));
  if (!id.success) return fail('Propiedad no válida.');
  const parsed = parseProperty(formData);
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .update(toPropertyRow(parsed.data))
    .eq('organization_id', organization.id)
    .eq('id', id.data)
    .select('id');
  if (error) return fail(translateDbError(error).error.message);
  if (!data?.length) return fail('No se pudo guardar: la propiedad no existe o fue fusionada.');

  revalidatePath(propertyPath(id.data));
  revalidatePath('/panel/propiedades');
  return done('Propiedad actualizada.');
}

export async function addOwnerAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const propertyId = uuid.safeParse(formData.get('propertyId'));
  const contactId = uuid.safeParse(formData.get('contactId'));
  if (contextError || !propertyId.success || !contactId.success) return;
  const supabase = await createClient();
  await supabase
    .from('property_owners')
    .upsert({ organization_id: organization.id, property_id: propertyId.data, contact_id: contactId.data }, { ignoreDuplicates: true });
  revalidatePath(propertyPath(propertyId.data));
  redirect(propertyPath(propertyId.data));
}

export async function removeOwnerAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const propertyId = uuid.safeParse(formData.get('propertyId'));
  const contactId = uuid.safeParse(formData.get('contactId'));
  if (contextError || !propertyId.success || !contactId.success) return;
  const supabase = await createClient();
  await supabase
    .from('property_owners')
    .delete()
    .eq('organization_id', organization.id)
    .eq('property_id', propertyId.data)
    .eq('contact_id', contactId.data);
  revalidatePath(propertyPath(propertyId.data));
}

/**
 * Registra fotos ya subidas a Storage desde el navegador (Vercel no acepta cuerpos de más de 4,5 MB,
 * así que los archivos no pasan por el servidor). Solo acepta rutas dentro de la carpeta de esta
 * inmobiliaria y propiedad; la base vuelve a verificar la carpeta de la inmobiliaria.
 */
export async function registerImagesAction(propertyId: string, paths: string[]): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  if (!uuid.safeParse(propertyId).success) return fail('Propiedad no válida.');
  const prefix = `${organization.id}/${propertyId}/`;
  const valid = paths.filter((path) => path.startsWith(prefix) && /^[\w./-]+$/.test(path) && !path.includes('..'));
  if (valid.length === 0) return fail('No hay fotos para guardar.');

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('property_images')
    .select('position')
    .eq('organization_id', organization.id)
    .eq('property_id', propertyId)
    .order('position', { ascending: false });
  if ((existing?.length ?? 0) + valid.length > MAX_IMAGES) {
    await supabase.storage.from(IMAGES_BUCKET).remove(valid);
    return fail(`Cada propiedad admite hasta ${MAX_IMAGES} fotos.`);
  }
  const start = (existing?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from('property_images').insert(
    valid.map((path, index) => ({ organization_id: organization.id, property_id: propertyId, storage_path: path, position: start + index })),
  );
  if (error) {
    await supabase.storage.from(IMAGES_BUCKET).remove(valid);
    return fail(translateDbError(error).error.message);
  }
  revalidatePath(propertyPath(propertyId));
  return done(valid.length === 1 ? 'Foto agregada.' : `${valid.length} fotos agregadas.`);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const id = uuid.safeParse(formData.get('imageId'));
  const propertyId = uuid.safeParse(formData.get('propertyId'));
  if (contextError || !id.success || !propertyId.success) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from('property_images')
    .delete()
    .eq('organization_id', organization.id)
    .eq('id', id.data)
    .select('storage_path');
  const path = data?.[0]?.storage_path;
  if (path) await supabase.storage.from(IMAGES_BUCKET).remove([path]);
  revalidatePath(propertyPath(propertyId.data));
}

/** Pone una foto como portada (primera). */
export async function setCoverAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const id = uuid.safeParse(formData.get('imageId'));
  const propertyId = uuid.safeParse(formData.get('propertyId'));
  if (contextError || !id.success || !propertyId.success) return;
  const supabase = await createClient();
  const { data: images } = await supabase
    .from('property_images')
    .select('id')
    .eq('organization_id', organization.id)
    .eq('property_id', propertyId.data)
    .order('position');
  const ordered = [id.data, ...(images ?? []).map((image) => image.id).filter((imageId) => imageId !== id.data)];
  await Promise.all(
    ordered.map((imageId, position) =>
      supabase.from('property_images').update({ position }).eq('organization_id', organization.id).eq('id', imageId),
    ),
  );
  revalidatePath(propertyPath(propertyId.data));
}

/** Fusión (F-09): solo el dueño; la base verifica el permiso. */
export async function mergePropertiesAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const keep = uuid.safeParse(formData.get('keepId'));
  const merge = uuid.safeParse(formData.get('mergeId'));
  if (contextError || !organization.isOwner || !keep.success || !merge.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_properties', { p_keep_id: keep.data, p_merge_id: merge.data });
  if (error) redirect(`${propertyPath(keep.data)}?error=fusion`);
  revalidatePath('/panel/propiedades');
  redirect(propertyPath(keep.data));
}

/** Aviso de posible duplicado mientras se carga (CU-05: avisa antes de guardar, no lo impide). */
export async function findDuplicatesAction(input: {
  address: string;
  operation: string;
  propertyType: string;
  excludeId?: string | undefined;
}): Promise<Array<{ id: string; code: string; title: string; reason: string }>> {
  const { active } = await resolveActiveOrganization();
  const parsed = z
    .object({
      address: z.string().max(160),
      operation: z.enum(['sale', 'rent', 'temporary_rent']),
      propertyType: z.enum(['apartment', 'house', 'ph', 'land', 'office', 'commercial', 'garage', 'warehouse', 'farm']),
      excludeId: z.uuid().optional(),
    })
    .safeParse(input);
  if (!active || !parsed.success || parsed.data.address.trim().length < 4) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc('property_duplicate_candidates', {
    p_organization_id: active.id,
    p_address: parsed.data.address,
    p_operation: parsed.data.operation,
    p_property_type: parsed.data.propertyType,
    ...(parsed.data.excludeId ? { p_exclude_id: parsed.data.excludeId } : {}),
  });
  return data ?? [];
}
