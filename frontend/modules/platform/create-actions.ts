'use server';

import { slugify, translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { getPlatformRole } from '@/lib/platform.ts';
import { appOrigin } from '@/lib/request.ts';
import { emailSchema } from '@/lib/schemas.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { createClient } from '@/lib/supabase/server.ts';

// Acciones del súper panel que necesitan la clave secreta (crear usuarios, enlaces de acceso, borrar
// archivos). La clave saltea RLS: cada acción verifica primero que quien llama sea el principal.

const uuid = z.uuid();
const NOT_ALLOWED = 'Solo el superadministrador principal puede hacer esto.';

/** Enlace de un solo uso para elegir contraseña. Sin email: C&C lo pasa por WhatsApp (ADR 0010). */
async function accessLink(email: string, kind: 'invite' | 'recovery', fullName?: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink(
    kind === 'invite' && fullName ? { type: 'invite', email, options: { data: { full_name: fullName } } } : { type: kind, email },
  );
  if (error) return null;
  const url = new URL('/auth/confirm', await appOrigin());
  url.searchParams.set('token_hash', data.properties.hashed_token);
  url.searchParams.set('type', kind);
  url.searchParams.set('next', '/restablecer');
  return { link: url.toString(), userId: data.user.id };
}

const newOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá el nombre.').max(120, 'Máximo 120 caracteres.'),
  ownerName: z.string().trim().min(1, 'Ingresá el nombre del dueño.').max(120, 'Máximo 120 caracteres.'),
  ownerEmail: emailSchema,
  planCode: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, 'Elegí un plan.'),
  trialDays: z.coerce.number({ message: 'Ingresá los días.' }).int('Ingresá un número entero.').min(0, 'Mínimo 0.').max(365, 'Máximo 365.'),
});

export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getPlatformRole()).isPrincipal) return fail(NOT_ALLOWED);
  const parsed = newOrganizationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.rpc('platform_find_user', { p_email: input.ownerEmail });
  let ownerId = existing as string | null;
  let link: string | null = null;
  if (!ownerId) {
    const created = await accessLink(input.ownerEmail, 'invite', input.ownerName);
    if (!created) return fail('No pudimos crear la cuenta del dueño. Probá de nuevo.');
    ownerId = created.userId;
    link = created.link;
  }

  const { data: organizationId, error } = await supabase.rpc('platform_create_organization', {
    p_name: input.name,
    p_slug_base: slugify(input.name),
    p_owner_user_id: ownerId,
    p_plan_code: input.planCode,
    p_trial_days: input.trialDays,
  });
  if (error || !organizationId) return fail(translateDbError(error).error.message);

  revalidatePath('/plataforma', 'layout');
  return done(
    link
      ? `Creamos ${input.name}. Mandale este enlace a ${input.ownerName}: es de un solo uso y vence en poco tiempo.`
      : `Creamos ${input.name} y sumamos a ${input.ownerEmail}, que ya tenía cuenta: entra con su contraseña.`,
    { organizationId, ...(link ? { link } : {}) },
  );
}

/** Enlace nuevo para el dueño: primer ingreso o contraseña olvidada. */
export async function ownerAccessLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getPlatformRole()).isPrincipal) return fail(NOT_ALLOWED);
  const id = uuid.safeParse(formData.get('organizationId'));
  if (!id.success) return fail('Inmobiliaria no válida.');
  const supabase = await createClient();
  const { data } = await supabase.rpc('platform_organization_owner', { p_organization_id: id.data });
  const email = data?.[0]?.email;
  if (!email) return fail('Esta inmobiliaria no tiene un dueño activo.');
  const created = await accessLink(email, 'recovery');
  if (!created) return fail('No pudimos generar el enlace. Probá de nuevo.');
  return done(`Enlace para ${email}: es de un solo uso y vence en poco tiempo.`, { link: created.link });
}

export async function setDeletedAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('organizationId'));
  if (!(await getPlatformRole()).isPrincipal || !id.success) return;
  const supabase = await createClient();
  await supabase.rpc('platform_set_deleted', { p_organization_id: id.data, p_deleted: formData.get('deleted') === '1' });
  revalidatePath('/plataforma', 'layout');
}

/** Eliminación definitiva: base primero y después los archivos. Si fallan los archivos, se avisa. */
export async function deleteForeverAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getPlatformRole()).isPrincipal) return fail(NOT_ALLOWED);
  const id = uuid.safeParse(formData.get('organizationId'));
  if (!id.success) return fail('Inmobiliaria no válida.');
  const supabase = await createClient();
  const { data: files, error } = await supabase.rpc('platform_delete_organization', {
    p_organization_id: id.data,
    p_confirm_name: String(formData.get('confirmName') ?? ''),
  });
  if (error?.code === '22023') return fail('El nombre no coincide.', { confirmName: 'Escribí el nombre exacto de la inmobiliaria.' });
  if (error) return fail(translateDbError(error).error.message);

  const admin = createAdminClient();
  const results = await Promise.all(
    ['logos', 'property-images', 'payment-receipts'].map((bucket) => {
      const paths = (files ?? []).filter((file) => file.bucket === bucket).map((file) => file.path);
      return paths.length > 0 ? admin.storage.from(bucket).remove(paths) : Promise.resolve({ error: null });
    }),
  );
  revalidatePath('/plataforma', 'layout');
  redirect(results.some((result) => result.error) ? '/plataforma/inmobiliarias?eliminada=archivos' : '/plataforma/inmobiliarias?eliminada=1');
}

/** Suma a alguien al equipo de plataforma (sin acceso a escribir: solo el principal escribe). */
export async function addTeamMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getPlatformRole()).isPrincipal) return fail(NOT_ALLOWED);
  const email = emailSchema.safeParse(formData.get('email'));
  if (!email.success) return fail('Revisá el email.', { email: 'Ingresá un email válido.' });
  const supabase = await createClient();
  const { data: existing } = await supabase.rpc('platform_find_user', { p_email: email.data });
  let userId = existing as string | null;
  let link: string | null = null;
  if (!userId) {
    const created = await accessLink(email.data, 'invite');
    if (!created) return fail('No pudimos crear la cuenta. Probá de nuevo.');
    userId = created.userId;
    link = created.link;
  }
  const { error } = await supabase.rpc('platform_add_admin', { p_user_id: userId });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/plataforma/equipo');
  return done(link ? `Sumamos a ${email.data}. Mandale este enlace para que elija su contraseña.` : `Sumamos a ${email.data}, que ya tenía cuenta.`, link ? { link } : undefined);
}

export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('userId'));
  if (!(await getPlatformRole()).isPrincipal || !id.success) return;
  const supabase = await createClient();
  await supabase.rpc('platform_remove_admin', { p_user_id: id.data });
  revalidatePath('/plataforma/equipo');
}
