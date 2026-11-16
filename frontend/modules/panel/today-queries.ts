import 'server-only';
import { fromLocal, toLocalParts } from '@inmogest/shared';
import { createClient } from '@/lib/supabase/server.ts';

// Lecturas de la pantalla "Hoy": solo lectura, filtradas por la inmobiliaria activa (RLS aísla además
// en la base). Ninguna crea tablas ni columnas: se arman con datos que ya existen.

const LIST_LIMIT = 5;
/** Días sin novedades para sugerir retomar a un cliente con una búsqueda abierta. */
export const STALE_DAYS = 15;

/** Inicio y fin del día de hoy en Argentina, y el "ahora" del pedido. */
export function todayRange(now = new Date()) {
  const local = toLocalParts(now);
  const start = fromLocal({ year: local.year, month: local.month, day: local.day, hour: 0, minute: 0 });
  const end = fromLocal({ year: local.year, month: local.month, day: local.day + 1, hour: 0, minute: 0 });
  return { start, end, now };
}

/** Conversaciones con mensajes sin leer, las más recientes primero. */
export async function getUnansweredConversations(organizationId: string) {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from('conversations')
    .select('id, phone_e164, unread_count, last_message_at, last_message_preview, contacts(full_name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gt('unread_count', 0)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(LIST_LIMIT);
  return { items: data ?? [], total: count ?? 0 };
}

/** Visitas agendadas para hoy (de todo el equipo: muchas inmobiliarias comparten una cuenta). */
export async function getTodayAppointments(organizationId: string, start: Date, end: Date) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('appointments')
    .select('id, starts_at, status, assigned_user_id, contacts(id, full_name), properties(id, code, title)')
    .eq('organization_id', organizationId)
    .eq('status', 'scheduled')
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at')
    .limit(20);
  return data ?? [];
}

/** Tareas pendientes que vencen hoy o ya vencieron. */
export async function getDueTasks(organizationId: string, end: Date) {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from('tasks')
    .select('id, title, due_at, priority, contacts(id, full_name), properties(id, code)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .lt('due_at', end.toISOString())
    .order('due_at')
    .limit(LIST_LIMIT);
  return { items: data ?? [], total: count ?? 0 };
}

/**
 * Clientes para retomar: tienen una búsqueda en una etapa abierta (ni ganada ni perdida) y no hubo
 * movimiento en los últimos STALE_DAYS días: ni actividad en su historial (notas, llamadas, visitas,
 * cambios de etapa, envíos) ni mensajes de WhatsApp. Los que hace más tiempo que no se tocan, primero.
 */
export async function getContactsToFollowUp(organizationId: string, now: Date, limit = LIST_LIMIT) {
  const supabase = await createClient();
  const cutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();

  const { data: searches, error } = await supabase
    .from('client_searches')
    .select('id, contact_id, updated_at, contacts!inner(full_name, do_not_contact, merged_into_id, contact_phones(phone_e164)), pipeline_stages!inner(name, kind), match_results(status, stale)')
    .eq('organization_id', organizationId)
    .eq('pipeline_stages.kind', 'open')
    .eq('contacts.do_not_contact', false)
    .is('contacts.merged_into_id', null)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(100);
  // Un error de consulta no rompe "Hoy" (el bloque queda vacío), pero queda en el log del servidor.
  if (error) console.error('Hoy: no se pudieron leer las búsquedas para retomar', error.message);
  if (!searches || searches.length === 0) return { items: [], total: 0 };

  const contactIds = [...new Set(searches.map((search) => search.contact_id))];
  const [{ data: recentActivity }, { data: recentChats }, { data: lastActivity }] = await Promise.all([
    supabase.from('activities').select('contact_id').eq('organization_id', organizationId).in('contact_id', contactIds).gte('created_at', cutoff),
    supabase.from('conversations').select('contact_id').eq('organization_id', organizationId).in('contact_id', contactIds).gte('last_message_at', cutoff),
    supabase
      .from('activities')
      .select('contact_id, created_at')
      .eq('organization_id', organizationId)
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  const active = new Set([...(recentActivity ?? []), ...(recentChats ?? [])].map((row) => row.contact_id));
  const lastTouch = new Map<string, string>();
  for (const row of lastActivity ?? []) if (!lastTouch.has(row.contact_id)) lastTouch.set(row.contact_id, row.created_at);

  const seen = new Set<string>();
  const items = [];
  for (const search of searches) {
    if (active.has(search.contact_id) || seen.has(search.contact_id)) continue;
    seen.add(search.contact_id);
    items.push({
      searchId: search.id,
      contactId: search.contact_id,
      name: search.contacts.full_name,
      phone: search.contacts.contact_phones[0]?.phone_e164 ?? null,
      stage: search.pipeline_stages.name,
      lastTouch: lastTouch.get(search.contact_id) ?? search.updated_at,
      matches: search.match_results.filter((match) => !match.stale && match.status !== 'dismissed').length,
    });
  }
  items.sort((a, b) => a.lastTouch.localeCompare(b.lastTouch));
  return { items: items.slice(0, limit), total: items.length };
}

/** Propiedades disponibles que todavía no tienen publicación en Mercado Libre. */
export async function getUnpublishedProperties(organizationId: string) {
  const supabase = await createClient();
  const [{ data: properties }, { data: listed }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, code, title, neighborhood, city')
      .eq('organization_id', organizationId)
      .eq('status', 'available')
      .is('merged_into_id', null)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase.from('property_listings').select('property_id').eq('organization_id', organizationId).eq('channel', 'mercadolibre').not('url', 'is', null),
  ]);
  const published = new Set((listed ?? []).map((row) => row.property_id));
  const pending = (properties ?? []).filter((property) => !published.has(property.id));
  return { items: pending.slice(0, LIST_LIMIT), total: pending.length };
}
