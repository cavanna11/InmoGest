'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { appointmentSchema, localToIso, rescheduleSchema, taskSchema } from './schemas.ts';

// Acciones de la agenda (CU-10). La inmobiliaria sale de la sesión; RLS y triggers validan en la base.

const uuid = z.uuid();

async function writeContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return { organization: active, error: active.canWrite ? null : 'La cuenta está en solo lectura: no se pueden hacer cambios.' };
}

export async function createAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const parsed = appointmentSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  const startsAt = localToIso(parsed.data.date, parsed.data.time);
  if (!startsAt) return fail('Revisá la fecha y la hora.', { date: 'Fecha u hora no válida.' });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('appointments').insert({
    organization_id: organization.id,
    contact_id: parsed.data.contactId,
    property_id: parsed.data.propertyId,
    starts_at: startsAt,
    notes: parsed.data.notes,
    assigned_user_id: parsed.data.assignedUserId,
    created_by: auth.user?.id ?? null,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/agenda');
  return done('Visita agendada.');
}

export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const parsed = taskSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  const dueAt = localToIso(parsed.data.date, parsed.data.time);
  if (!dueAt) return fail('Revisá la fecha y la hora.', { date: 'Fecha u hora no válida.' });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('tasks').insert({
    organization_id: organization.id,
    title: parsed.data.title,
    due_at: dueAt,
    priority: parsed.data.priority,
    contact_id: parsed.data.contactId,
    property_id: parsed.data.propertyId,
    assigned_user_id: parsed.data.assignedUserId,
    created_by: auth.user?.id ?? null,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/agenda');
  return done('Tarea creada.');
}

export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  const { organization, error } = await writeContext();
  const id = uuid.safeParse(formData.get('id'));
  const status = z.enum(['scheduled', 'done', 'cancelled', 'no_show']).safeParse(formData.get('status'));
  if (error || !id.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('appointments').update({ status: status.data }).eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath('/panel/agenda');
}

export async function rescheduleAppointmentAction(formData: FormData): Promise<void> {
  const { organization, error } = await writeContext();
  const id = uuid.safeParse(formData.get('id'));
  const parsed = rescheduleSchema.safeParse(formValues(formData));
  if (error || !id.success || !parsed.success) return;
  const startsAt = localToIso(parsed.data.date, parsed.data.time);
  if (!startsAt) return;
  const supabase = await createClient();
  await supabase.from('appointments').update({ starts_at: startsAt, status: 'scheduled' }).eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath('/panel/agenda');
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const { organization, error } = await writeContext();
  const id = uuid.safeParse(formData.get('id'));
  const status = z.enum(['pending', 'done', 'cancelled']).safeParse(formData.get('status'));
  if (error || !id.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('tasks').update({ status: status.data }).eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath('/panel/agenda');
}
