'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { searchSchema } from './schemas.ts';

// Acciones de búsquedas y embudo. La escritura de búsquedas pasa por RPC con permisos verificados en
// la base; la inmobiliaria sale siempre de la sesión.

const uuid = z.uuid();
const READ_ONLY = 'La cuenta está en solo lectura: no se pueden hacer cambios.';

async function writeContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return { organization: active, error: active.canWrite ? null : READ_ONLY };
}

function strings(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === 'string');
}

export async function saveSearchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await writeContext();
  if (contextError) return fail(contextError);
  const rawId = formData.get('searchId');
  const id = rawId ? uuid.safeParse(rawId) : null;
  if (id && !id.success) return fail('Búsqueda no válida.');

  const parsed = searchSchema.safeParse({
    ...formValues(formData),
    propertyTypes: strings(formData, 'propertyTypes'),
    required: strings(formData, 'required'),
    desired: strings(formData, 'desired'),
  });
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  // Los tipos generados no marcan como nulos los parámetros de la RPC, pero la función los acepta.
  const { data, error } = await supabase.rpc('save_client_search', {
    p_organization_id: organization.id,
    p_id: (id?.success ? id.data : null) as string,
    p_contact_id: input.contactId,
    p_operation: input.operation,
    p_property_types: input.propertyTypes,
    p_budget_min: input.budgetMin as number,
    p_budget_max: input.budgetMax as number,
    p_currency: input.currency,
    p_budget_tolerance_pct: input.tolerance,
    p_min_rooms: input.minRooms as number,
    p_min_bedrooms: input.minBedrooms as number,
    p_required_features: input.required,
    p_desired_features: input.desired,
    p_notes: input.notes,
    p_assigned_user_id: input.assignedUserId as string,
    p_locations: input.locations,
  });
  if (error || !data) return fail(translateDbError(error).error.message);

  revalidatePath('/panel/busquedas');
  revalidatePath('/panel/oportunidades');
  if (id?.success) {
    revalidatePath(`/panel/busquedas/${data}`);
    return done('Búsqueda actualizada. Las coincidencias se recalcularon.');
  }
  redirect(`/panel/busquedas/${data}`);
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const { error: contextError } = await writeContext();
  const searchId = uuid.safeParse(formData.get('searchId'));
  const stageId = uuid.safeParse(formData.get('stageId'));
  if (contextError || !searchId.success || !stageId.success) return;
  const supabase = await createClient();
  await supabase.rpc('move_search_stage', { p_search_id: searchId.data, p_stage_id: stageId.data });
  revalidatePath('/panel/oportunidades');
  revalidatePath('/panel/busquedas');
  revalidatePath(`/panel/busquedas/${searchId.data}`);
}

/** Estado de una coincidencia: vista, enviada o descartada. */
export async function setMatchStatusAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await writeContext();
  const id = uuid.safeParse(formData.get('matchId'));
  const searchId = uuid.safeParse(formData.get('searchId'));
  const status = z.enum(['new', 'seen', 'sent', 'dismissed']).safeParse(formData.get('status'));
  if (contextError || !id.success || !searchId.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('match_results').update({ status: status.data }).eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath(`/panel/busquedas/${searchId.data}`);
}

// -----------------------------------------------------------------------------
// Configuración del embudo (F-13): solo el dueño; RLS e IG010 validan en la base.
// -----------------------------------------------------------------------------
const stageName = z.string().trim().min(1, 'Ingresá un nombre.').max(60, 'Máximo 60 caracteres.');

async function ownerContext() {
  const { organization, error } = await writeContext();
  if (error) return { organization, error };
  return { organization, error: organization.isOwner ? null : 'Solo el dueño puede configurar el embudo.' };
}

export async function addStageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { organization, error: contextError } = await ownerContext();
  if (contextError) return fail(contextError);
  const name = stageName.safeParse(formData.get('name'));
  if (!name.success) return fail('Revisá el nombre.', { name: name.error.issues[0]?.message ?? 'Nombre no válido.' });
  const supabase = await createClient();
  const { data: stages } = await supabase.from('pipeline_stages').select('id, position, kind').eq('organization_id', organization.id).order('position');
  // Las etapas nuevas son abiertas y van antes de las de cierre.
  const firstTerminal = (stages ?? []).findIndex((stage) => stage.kind !== 'open');
  const position = firstTerminal === -1 ? (stages?.length ?? 0) : firstTerminal;
  const terminal = firstTerminal === -1 ? [] : (stages ?? []).slice(firstTerminal);
  for (const [index, stage] of terminal.entries()) {
    await supabase.from('pipeline_stages').update({ position: position + 1 + index }).eq('organization_id', organization.id).eq('id', stage.id);
  }
  const { error } = await supabase.from('pipeline_stages').insert({ organization_id: organization.id, name: name.data, position, kind: 'open' });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/oportunidades', 'layout');
  return done('Etapa agregada.');
}

export async function renameStageAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await ownerContext();
  const id = uuid.safeParse(formData.get('stageId'));
  const name = stageName.safeParse(formData.get('name'));
  if (contextError || !id.success || !name.success) return;
  const supabase = await createClient();
  await supabase.from('pipeline_stages').update({ name: name.data }).eq('organization_id', organization.id).eq('id', id.data);
  revalidatePath('/panel/oportunidades', 'layout');
}

export async function toggleStageAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await ownerContext();
  const id = uuid.safeParse(formData.get('stageId'));
  if (contextError || !id.success) return;
  const active = formData.get('active') === '1';
  const supabase = await createClient();
  const { error } = await supabase.from('pipeline_stages').update({ is_active: active }).eq('organization_id', organization.id).eq('id', id.data);
  if (error) redirect(`/panel/oportunidades/etapas?error=${encodeURIComponent(translateDbError(error).error.code)}`);
  revalidatePath('/panel/oportunidades', 'layout');
}

/** Sube o baja una etapa, intercambiando su posición con la vecina. */
export async function moveStagePositionAction(formData: FormData): Promise<void> {
  const { organization, error: contextError } = await ownerContext();
  const id = uuid.safeParse(formData.get('stageId'));
  const direction = formData.get('direction') === 'up' ? -1 : 1;
  if (contextError || !id.success) return;
  const supabase = await createClient();
  const { data: stages } = await supabase.from('pipeline_stages').select('id, position').eq('organization_id', organization.id).order('position');
  const list = stages ?? [];
  const index = list.findIndex((stage) => stage.id === id.data);
  const other = list[index + direction];
  const current = list[index];
  if (!current || !other) return;
  await supabase.from('pipeline_stages').update({ position: other.position }).eq('organization_id', organization.id).eq('id', current.id);
  await supabase.from('pipeline_stages').update({ position: current.position }).eq('organization_id', organization.id).eq('id', other.id);
  revalidatePath('/panel/oportunidades', 'layout');
}
