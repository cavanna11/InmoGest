import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';

// Lecturas de la agenda (F-21). onlyUserId aplica el filtro "mi agenda"; sin él, todo el equipo.

export async function getAppointments(organizationId: string, fromIso: string, toIso: string, onlyUserId: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from('appointments')
    .select('id, starts_at, status, notes, assigned_user_id, contacts(id, full_name), properties(id, code, title)')
    .eq('organization_id', organizationId)
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso);
  if (onlyUserId) query = query.eq('assigned_user_id', onlyUserId);
  const { data } = await query.order('starts_at').limit(300);
  return data ?? [];
}

export async function getPendingTasks(organizationId: string, onlyUserId: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from('tasks')
    .select('id, title, due_at, priority, status, assigned_user_id, contacts(id, full_name), properties(id, code)')
    .eq('organization_id', organizationId)
    .eq('status', 'pending');
  if (onlyUserId) query = query.eq('assigned_user_id', onlyUserId);
  const { data } = await query.order('due_at').limit(200);
  return data ?? [];
}

/** Opciones para los selectores de visitas y tareas: los contactos y propiedades más recientes. */
export async function getAgendaOptions(organizationId: string) {
  const supabase = await createClient();
  const [contacts, properties] = await Promise.all([
    supabase.from('contacts').select('id, full_name').eq('organization_id', organizationId).is('merged_into_id', null).order('full_name').limit(500),
    supabase
      .from('properties')
      .select('id, code, title')
      .eq('organization_id', organizationId)
      .is('merged_into_id', null)
      .in('status', ['available', 'reserved', 'draft'])
      .order('seq', { ascending: false })
      .limit(500),
  ]);
  return { contacts: contacts.data ?? [], properties: properties.data ?? [] };
}

export async function getContactAgenda(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('appointments')
    .select('id, starts_at, status, properties(code, title)')
    .eq('organization_id', organizationId)
    .eq('contact_id', contactId)
    .order('starts_at', { ascending: false })
    .limit(10);
  return data ?? [];
}
