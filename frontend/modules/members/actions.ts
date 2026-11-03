'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { getCurrentUser } from '@/lib/auth.ts';
import { sendAppEmail } from '@/lib/email.ts';
import { byteaHex, newInvitationToken } from '@/lib/invitation-token.ts';
import { allowRequest, rateLimitKey } from '@/lib/rate-limit.ts';
import { appOrigin } from '@/lib/request.ts';
import { invitationSchema } from '@/lib/schemas.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';

const uuid = z.uuid();

async function ownerContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  if (!active.isOwner) return { organization: active, error: 'Solo el dueño puede gestionar el equipo.' };
  if (!active.canWrite) return { organization: active, error: 'La cuenta está en solo lectura: no se pueden hacer cambios.' };
  return { organization: active, error: null };
}

function invitationEmailText(organizationName: string, link: string) {
  return [
    `Te invitaron a sumarte a ${organizationName} en InmoPanel by C&C.`,
    '',
    `Aceptá la invitación desde este enlace (vence en 7 días):`,
    link,
    '',
    'Si no esperabas esta invitación, ignorá este email.',
  ].join('\n');
}

/**
 * Invita por email (CU-02, ADR 0007). Devuelve el enlace copiable UNA vez; si el email no sale
 * (o el envío no está configurado), el enlace sigue disponible para el dueño.
 */
export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await ownerContext();
  if (contextError) return fail(contextError);

  const parsed = invitationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  if (!(await allowRequest(rateLimitKey('invite:org', organization.id), 3600, 30))) {
    return fail('Enviaste demasiadas invitaciones seguidas. Esperá un rato y probá de nuevo.');
  }

  const user = await getCurrentUser();
  const { token, hashHex } = newInvitationToken();
  const supabase = await createClient();
  const { error } = await supabase.from('invitations').insert({
    organization_id: organization.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: byteaHex(hashHex),
    invited_by: user?.id ?? null,
  });
  if (error) {
    const translated = translateDbError(error).error;
    return translated.code === 'duplicate'
      ? fail('Ya hay una invitación abierta para ese email. Podés generar un enlace nuevo desde la lista.')
      : fail(translated.message);
  }

  await supabase
    .from('onboarding_progress')
    .update({ completed_at: new Date().toISOString(), skipped_at: null })
    .eq('organization_id', organization.id)
    .eq('step', 'team')
    .is('completed_at', null);

  const link = `${await appOrigin()}/invitacion/${token}`;
  const sent = await sendAppEmail({
    to: parsed.data.email,
    subject: `Invitación a ${organization.name} en InmoPanel`,
    text: invitationEmailText(organization.name, link),
  });
  revalidatePath('/panel/equipo');
  return done(
    sent.ok
      ? `Le enviamos la invitación a ${parsed.data.email}. También podés compartirle este enlace.`
      : `No pudimos enviar el email (${sent.error.message.toLowerCase()}). Compartile este enlace a ${parsed.data.email}.`,
    { link },
  );
}

/** Genera un enlace nuevo (invalida el anterior) y renueva el vencimiento a 7 días. */
export async function regenerateInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await ownerContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('invitationId'));
  if (!id.success) return fail('Invitación no válida.');

  const { token, hashHex } = newInvitationToken();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invitations')
    .update({ token_hash: byteaHex(hashHex), expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() })
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('email');
  if (error) return fail(translateDbError(error).error.message);
  if (!data?.[0]) return fail('La invitación ya no está disponible.');

  revalidatePath('/panel/equipo');
  return done(`Enlace nuevo para ${data[0].email}. El anterior ya no sirve.`, {
    link: `${await appOrigin()}/invitacion/${token}`,
  });
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await ownerContext();
  const id = uuid.safeParse(formData.get('invitationId'));
  if (contextError || !id.success) return;
  const supabase = await createClient();
  await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .is('accepted_at', null);
  revalidatePath('/panel/equipo');
}

const memberChangeSchema = z.object({
  membershipId: uuid,
  change: z.enum(['make_owner', 'make_agent', 'deactivate', 'reactivate']),
});

/** Cambios de rol y estado de miembros. La regla del último dueño y el límite del plan los aplica la base. */
export async function changeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await ownerContext();
  if (contextError) return fail(contextError);
  const parsed = memberChangeSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Cambio no válido.');

  const update =
    parsed.data.change === 'make_owner'
      ? { role: 'owner' as const }
      : parsed.data.change === 'make_agent'
        ? { role: 'agent' as const }
        : parsed.data.change === 'deactivate'
          ? { status: 'deactivated' as const, deactivated_at: new Date().toISOString() }
          : { status: 'active' as const, deactivated_at: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('memberships')
    .update(update)
    .eq('id', parsed.data.membershipId)
    .eq('organization_id', organization.id)
    .select('id');
  if (error) return fail(translateDbError(error).error.message);
  if (!data?.[0]) return fail('No tenés permiso para hacer este cambio.');

  revalidatePath('/panel/equipo');
  const messages = {
    make_owner: 'Ahora es dueño de la inmobiliaria.',
    make_agent: 'Ahora es agente.',
    deactivate: 'Desactivamos al usuario: ya no puede ingresar a la inmobiliaria.',
    reactivate: 'Reactivamos al usuario.',
  };
  return done(messages[parsed.data.change]);
}
