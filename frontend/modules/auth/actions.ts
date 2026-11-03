'use server';

import { redirect } from 'next/navigation';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { appOrigin, clientIp } from '@/lib/request.ts';
import { allowRequest, rateLimitKey } from '@/lib/rate-limit.ts';
import { safeNext } from '@/lib/safe-redirect.ts';
import { emailSchema, invitedSignUpSchema, newPasswordSchema, signInSchema, signUpSchema } from '@/lib/schemas.ts';
import { isRegistrationOpen } from '@/lib/env.server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { clearActiveOrganizationCookie } from '@/lib/tenant.ts';
import { getRegistrationLegalDocuments } from './queries.ts';

const TOO_MANY = 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.';

/** Registro de una inmobiliaria nueva (CU-01). La inmobiliaria se crea al confirmar el email. */
export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  if (!(await isRegistrationOpen())) return fail('InmoPanel está en beta cerrada: pedí tu acceso por WhatsApp.');
  const legal = await getRegistrationLegalDocuments();
  if (!legal) return fail('El registro todavía no está disponible.');

  const ip = await clientIp();
  if (!(await allowRequest(rateLimitKey('signup:ip', ip), 3600, 10))) return fail(TOO_MANY);
  if (!(await allowRequest(rateLimitKey('signup:email', parsed.data.email), 3600, 3))) return fail(TOO_MANY);

  const supabase = await createClient();
  const origin = await appOrigin();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/crear-inmobiliaria')}`,
      data: {
        full_name: parsed.data.fullName,
        pending_organization_name: parsed.data.organizationName,
        accepted_legal_document_ids: legal.map((doc) => doc.id),
      },
    },
  });
  if (error && error.code === 'weak_password') {
    return fail('La contraseña no cumple los requisitos.', { password: 'Usá al menos 10 caracteres con mayúsculas, minúsculas y números.' });
  }
  if (error && error.code !== 'user_already_exists') {
    return fail('No pudimos crear la cuenta. Probá de nuevo en unos minutos.');
  }
  // Mismo mensaje si el email ya existía: no revela qué emails están registrados.
  return done(`Te enviamos un email a ${parsed.data.email}. Abrí el enlace para confirmar tu cuenta y crear la inmobiliaria.`);
}

/** Registro de una persona invitada (CU-02): solo crea la cuenta; al confirmar, acepta la invitación. */
export async function invitedSignUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = invitedSignUpSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  if (!(await isRegistrationOpen())) return fail('InmoPanel está en beta cerrada: pedí tu acceso por WhatsApp.');
  const supabase = await createClient();
  const { data: preview } = await supabase.rpc('invitation_preview', { p_token: parsed.data.token });
  const invitation = preview?.[0];
  if (!invitation || invitation.status !== 'pending') return fail('La invitación ya no está disponible.');

  const ip = await clientIp();
  if (!(await allowRequest(rateLimitKey('signup:ip', ip), 3600, 10))) return fail(TOO_MANY);

  const origin = await appOrigin();
  const next = `/invitacion/${parsed.data.token}`;
  const { error } = await supabase.auth.signUp({
    email: invitation.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error && error.code === 'weak_password') {
    return fail('La contraseña no cumple los requisitos.', { password: 'Usá al menos 10 caracteres con mayúsculas, minúsculas y números.' });
  }
  if (error && error.code !== 'user_already_exists') {
    return fail('No pudimos crear la cuenta. Probá de nuevo en unos minutos.');
  }
  return done(`Te enviamos un email a ${invitation.email}. Abrí el enlace para confirmar tu cuenta y sumarte a ${invitation.organization_name}.`);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const ip = await clientIp();
  if (!(await allowRequest(rateLimitKey('signin:ip', ip), 900, 30))) return fail(TOO_MANY);
  if (!(await allowRequest(rateLimitKey('signin:email', parsed.data.email), 900, 10))) return fail(TOO_MANY);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === 'email_not_confirmed') {
    return fail('Todavía no confirmaste tu email. Revisá tu casilla o pedí que te lo reenviemos.', undefined);
  }
  if (error) return fail('El email o la contraseña no son correctos.');

  await clearActiveOrganizationCookie();
  redirect(safeNext(values.next));
}

export async function resendConfirmationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return fail('Ingresá un email válido.', { email: 'Ingresá un email válido.' });
  if (!(await allowRequest(rateLimitKey('resend:email', parsed.data), 3600, 3))) return fail(TOO_MANY);

  const supabase = await createClient();
  const origin = await appOrigin();
  await supabase.auth.resend({
    type: 'signup',
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/crear-inmobiliaria')}` },
  });
  return done('Si el email está registrado y sin confirmar, te reenviamos el enlace.');
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return fail('Ingresá un email válido.', { email: 'Ingresá un email válido.' });

  const ip = await clientIp();
  if (!(await allowRequest(rateLimitKey('reset:ip', ip), 3600, 10))) return fail(TOO_MANY);
  if (!(await allowRequest(rateLimitKey('reset:email', parsed.data), 3600, 3))) return fail(TOO_MANY);

  const supabase = await createClient();
  const origin = await appOrigin();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/restablecer')}`,
  });
  // Mismo mensaje exista o no la cuenta.
  return done('Si hay una cuenta con ese email, te enviamos un enlace para elegir una contraseña nueva.');
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('El enlace venció. Pedí uno nuevo desde "Olvidé mi contraseña".');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === 'same_password') return fail('Elegí una contraseña distinta de la anterior.');
  if (error) return fail('No pudimos cambiar la contraseña. Probá de nuevo.');
  return done('Listo, tu contraseña quedó actualizada.');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActiveOrganizationCookie();
  redirect('/ingresar');
}
