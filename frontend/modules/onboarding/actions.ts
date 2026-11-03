'use server';

import { slugify, translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { getCurrentUser } from '@/lib/auth.ts';
import { organizationNameSchema } from '@/lib/schemas.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { listMyOrganizations, resolveActiveOrganization, setActiveOrganizationCookie } from '@/lib/tenant.ts';
import { getRegistrationLegalDocuments } from '../auth/queries.ts';

const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  acceptLegal: z.literal('on', { message: 'Tenés que aceptar los términos y la política de privacidad.' }),
});

/** Crea la inmobiliaria del usuario recién confirmado (CU-01, paso 4). */
export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createOrganizationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) redirect('/ingresar?next=/crear-inmobiliaria');

  const legal = await getRegistrationLegalDocuments();
  if (!legal) return fail('El registro todavía no está disponible.');

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.name,
    p_slug_base: slugify(parsed.data.name),
    p_legal_document_ids: legal.map((doc) => doc.id),
  });
  if (error || !organizationId) return fail(translateDbError(error).error.message);

  await setActiveOrganizationCookie(organizationId);
  redirect('/panel');
}

/** Elige la inmobiliaria activa, validándola contra las membresías del usuario. */
export async function selectOrganizationAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const organizations = await listMyOrganizations();
  const target = organizations.find((org) => org.id === organizationId);
  if (!target) redirect('/seleccionar-inmobiliaria');
  await setActiveOrganizationCookie(target.id);
  revalidatePath('/panel', 'layout');
  redirect('/panel');
}

/** Acepta una invitación con la cuenta actual (CU-02). */
export async function acceptInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/invitacion/${token}`)}`);

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error || !organizationId) return fail(translateDbError(error).error.message);

  await setActiveOrganizationCookie(organizationId);
  redirect('/panel');
}

/** Paso del asistente marcado como salteado o retomado (solo el dueño; RLS lo exige igual). */
export async function setOnboardingStepAction(formData: FormData): Promise<void> {
  const step = String(formData.get('step') ?? '');
  const skip = formData.get('skip') === '1';
  const { active } = await resolveActiveOrganization();
  if (!active || !active.isOwner) redirect('/panel');

  const supabase = await createClient();
  await supabase
    .from('onboarding_progress')
    .update({ skipped_at: skip ? new Date().toISOString() : null })
    .eq('organization_id', active.id)
    .eq('step', step);
  revalidatePath('/panel');
}
