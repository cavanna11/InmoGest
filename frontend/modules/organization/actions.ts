'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { organizationSettingsSchema } from '@/lib/schemas.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

async function requireOwnerOrganization() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return active;
}

/** Datos de la inmobiliaria (F-05). Solo el dueño; RLS y los triggers lo vuelven a verificar. */
export async function updateOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireOwnerOrganization();
  if (!organization.isOwner) return fail('Solo el dueño puede cambiar los datos de la inmobiliaria.');
  if (!organization.canWrite) return fail('La cuenta está en solo lectura: no se pueden hacer cambios.');

  const parsed = organizationSettingsSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
      default_currency: parsed.data.defaultCurrency,
      agents_can_reassign: parsed.data.agentsCanReassign,
    })
    .eq('id', organization.id)
    .select('id');
  if (error) {
    const translated = translateDbError(error).error;
    return translated.code === 'slug_unavailable' || translated.code === 'duplicate'
      ? fail('Revisá los datos marcados.', { slug: 'Esa dirección ya está en uso o la usó otra inmobiliaria.' })
      : fail(translated.message);
  }
  if (!data || data.length === 0) return fail('No tenés permiso para hacer este cambio.');

  await supabase
    .from('onboarding_progress')
    .update({ completed_at: new Date().toISOString(), skipped_at: null })
    .eq('organization_id', organization.id)
    .eq('step', 'organization')
    .is('completed_at', null);

  revalidatePath('/panel', 'layout');
  return done('Guardamos los datos de la inmobiliaria.');
}

/** Sube o reemplaza el logo en Storage (bucket "logos", carpeta de la inmobiliaria). */
export async function uploadLogoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireOwnerOrganization();
  if (!organization.isOwner || !organization.canWrite) return fail('No tenés permiso para cambiar el logo.');

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return fail('Elegí una imagen.', { logo: 'Elegí una imagen.' });
  const extension = LOGO_TYPES[file.type];
  if (!extension) return fail('Usá una imagen PNG, JPG o WebP.', { logo: 'Usá una imagen PNG, JPG o WebP.' });
  if (file.size > LOGO_MAX_BYTES) return fail('La imagen pesa más de 2 MB.', { logo: 'La imagen pesa más de 2 MB.' });

  const supabase = await createClient();
  // Nombre nuevo en cada subida: evita que navegadores y CDN muestren el logo anterior en caché.
  const path = `${organization.id}/logo-${Date.now()}.${extension}`;
  const upload = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return fail('No pudimos subir el logo. Probá de nuevo.');

  const { data: previous } = await supabase.from('organizations').select('logo_path').eq('id', organization.id).single();
  const { error } = await supabase.from('organizations').update({ logo_path: path }).eq('id', organization.id);
  if (error) {
    await supabase.storage.from('logos').remove([path]);
    return fail(translateDbError(error).error.message);
  }
  if (previous?.logo_path && previous.logo_path !== path) {
    await supabase.storage.from('logos').remove([previous.logo_path]);
  }
  revalidatePath('/panel', 'layout');
  return done('Actualizamos el logo.');
}
