'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { emailSchema } from '@/lib/schemas.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { activitySchema, contactUpdateSchema, newContactSchema, phoneSchema, repeated } from './schemas.ts';

// Acciones de contactos. La inmobiliaria sale siempre de la sesión (nunca del formulario) y RLS
// vuelve a verificar el acceso en la base.

const uuid = z.uuid();
const READ_ONLY = 'La cuenta está en solo lectura: no se pueden hacer cambios.';

async function writeContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return { organization: active, error: active.canWrite ? null : READ_ONLY };
}

function contactPath(id: string) {
  return `/panel/contactos/${id}`;
}

/** Alta (F-06). Si un teléfono o email ya existe, no crea otro y ofrece abrir el existente. */
export async function createContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);

  const parsed = newContactSchema.safeParse({
    ...formValues(formData),
    phones: repeated(formData, 'phone'),
    emails: repeated(formData, 'email'),
  });
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_contact', {
    p_organization_id: organization.id,
    p_full_name: parsed.data.fullName,
    p_phones: parsed.data.phones,
    p_emails: parsed.data.emails,
    p_notes: parsed.data.notes,
    p_is_prospect: parsed.data.isProspect,
    p_is_owner: parsed.data.isOwner,
    ...(parsed.data.assignedUserId ? { p_assigned_user_id: parsed.data.assignedUserId } : {}),
  });
  if (error?.code === 'IG011' && error.details) {
    return { status: 'error', message: 'Ya hay un contacto con ese teléfono o email.', data: { existingId: error.details } };
  }
  if (error || !data) return fail(translateDbError(error).error.message);

  revalidatePath('/panel/contactos');
  redirect(contactPath(data));
}

export async function updateContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('contactId'));
  if (!id.success) return fail('Contacto no válido.');

  const parsed = contactUpdateSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .update({
      full_name: parsed.data.fullName,
      notes: parsed.data.notes,
      is_prospect: parsed.data.isProspect,
      is_owner: parsed.data.isOwner,
      do_not_contact: parsed.data.doNotContact,
      assigned_user_id: parsed.data.assignedUserId,
    })
    .eq('organization_id', organization.id)
    .eq('id', id.data)
    .select('id');
  if (error) return fail(translateDbError(error).error.message);
  if (!data?.length) return fail('No se pudo guardar: el contacto no existe o fue unificado.');

  revalidatePath(contactPath(id.data));
  revalidatePath('/panel/contactos');
  return done('Contacto actualizado.');
}

/** Agrega un teléfono o un email. Si ya pertenece a otro contacto, la base lo rechaza (único). */
export async function addChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('contactId'));
  if (!id.success) return fail('Contacto no válido.');
  const kind = formData.get('kind');
  const supabase = await createClient();

  if (kind === 'phone') {
    const phone = phoneSchema.safeParse(formData.get('value') ?? '');
    if (!phone.success) return fail('Revisá el teléfono.', { value: phone.error.issues[0]?.message ?? 'Teléfono no válido.' });
    const { error } = await supabase
      .from('contact_phones')
      .insert({ organization_id: organization.id, contact_id: id.data, phone_e164: phone.data });
    if (error) return fail(error.code === '23505' ? 'Ese teléfono ya pertenece a otro contacto.' : translateDbError(error).error.message);
  } else if (kind === 'email') {
    const email = emailSchema.safeParse(formData.get('value') ?? '');
    if (!email.success) return fail('Revisá el email.', { value: email.error.issues[0]?.message ?? 'Email no válido.' });
    const { error } = await supabase
      .from('contact_emails')
      .insert({ organization_id: organization.id, contact_id: id.data, email: email.data });
    if (error) return fail(error.code === '23505' ? 'Ese email ya pertenece a otro contacto.' : translateDbError(error).error.message);
  } else {
    return fail('Tipo no válido.');
  }

  revalidatePath(contactPath(id.data));
  return done(kind === 'phone' ? 'Teléfono agregado.' : 'Email agregado.');
}

export async function removeChannelAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const id = uuid.safeParse(formData.get('channelId'));
  const contactId = uuid.safeParse(formData.get('contactId'));
  if (contextError || !id.success || !contactId.success) return;
  const table = formData.get('kind') === 'email' ? 'contact_emails' : 'contact_phones';
  const supabase = await createClient();
  await supabase.from(table).delete().eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath(contactPath(contactId.data));
}

/** Nota o llamada en el historial (F-22). */
export async function addActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('contactId'));
  if (!id.success) return fail('Contacto no válido.');
  const parsed = activitySchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('activities').insert({
    organization_id: organization.id,
    contact_id: id.data,
    kind: parsed.data.kind,
    body: parsed.data.body,
    author_id: auth.user?.id ?? null,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath(contactPath(id.data));
  return done(parsed.data.kind === 'call' ? 'Llamada registrada.' : 'Nota agregada.');
}

/** Reporte de posible duplicado (CU-17). Cualquier miembro reporta; el dueño decide. */
export async function reportDuplicateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const id = uuid.safeParse(formData.get('contactId'));
  const other = uuid.safeParse(formData.get('otherId'));
  if (!id.success) return fail('Contacto no válido.');
  if (!other.success) return fail('Elegí el contacto que podría ser el mismo.', { otherId: 'Elegí un contacto.' });
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('duplicate_reports').insert({
    organization_id: organization.id,
    contact_a_id: id.data,
    contact_b_id: other.data,
    reason,
    reported_by: auth.user?.id ?? null,
  });
  if (error?.code === '23505') return done('Ese par ya estaba reportado. El dueño lo va a revisar.');
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/contactos/duplicados');
  return done('Reporte enviado. El dueño de la inmobiliaria lo va a revisar.');
}

/** Unificación explícita (F-34): solo el dueño. La base verifica el permiso. */
export async function mergeContactsAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const keep = uuid.safeParse(formData.get('keepId'));
  const merge = uuid.safeParse(formData.get('mergeId'));
  if (contextError || !organization.isOwner || !keep.success || !merge.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('merge_contacts', { p_keep_id: keep.data, p_merge_id: merge.data });
  if (error) redirect(`/panel/contactos/duplicados?error=${encodeURIComponent(translateDbError(error).error.code)}`);
  revalidatePath('/panel/contactos');
  redirect(contactPath(keep.data));
}

export async function dismissDuplicateAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const id = uuid.safeParse(formData.get('reportId'));
  if (contextError || !organization.isOwner || !id.success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase
    .from('duplicate_reports')
    .update({ status: 'dismissed', resolved_by: auth.user?.id ?? null, resolved_at: new Date().toISOString() })
    .eq('organization_id', organization.id)
    .eq('id', id.data);
  revalidatePath('/panel/contactos/duplicados');
}
