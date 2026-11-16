import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';
import { MEDIA_BUCKET } from './labels.ts';

export type InboxFilter = 'all' | 'mine' | 'unassigned' | 'unread';

const SIGNED_URL_SECONDS = 3600;

export async function listConnections(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('id, phone_e164, status, connected_at, created_at')
    .eq('organization_id', organizationId)
    .is('removed_at', null)
    .order('created_at');
  return data ?? [];
}

export async function hasActiveConnection(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('whatsapp_connections')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'connected')
    .is('removed_at', null);
  return (count ?? 0) > 0;
}

export async function getOpenApiRequest(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_api_requests')
    .select('id, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  return data;
}

/** Conversaciones con mensajes sin leer (contador del menú). */
export async function countUnreadConversations(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gt('unread_count', 0);
  return count ?? 0;
}

export async function listConversations(organizationId: string, userId: string, filter: InboxFilter) {
  const supabase = await createClient();
  let query = supabase
    .from('conversations')
    .select('id, phone_e164, assigned_user_id, unread_count, last_message_at, last_message_preview, contacts(full_name)')
    .eq('organization_id', organizationId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (filter === 'mine') query = query.eq('assigned_user_id', userId);
  if (filter === 'unassigned') query = query.is('assigned_user_id', null);
  if (filter === 'unread') query = query.gt('unread_count', 0);
  const { data } = await query;
  return data ?? [];
}

export async function getConversation(organizationId: string, conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('conversations')
    .select('id, contact_id, phone_e164, assigned_user_id, contacts(full_name, do_not_contact), whatsapp_connections(status, removed_at)')
    .eq('organization_id', organizationId)
    .eq('id', conversationId)
    .maybeSingle();
  return data;
}

/** Últimos mensajes, del más viejo al más nuevo, con URLs firmadas de corta duración para los adjuntos. */
export async function getMessages(organizationId: string, conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('messages')
    .select('id, direction, kind, author_user_id, type, body, media_path, media_url, media_mime, media_name, media_status, status, error_code, sent_at, created_at')
    .eq('organization_id', organizationId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(200);
  const messages = (data ?? []).reverse();

  const paths = messages.flatMap((message) => (message.media_path ? [message.media_path] : []));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const url of urls ?? []) {
      if (url.path && url.signedUrl) signed.set(url.path, url.signedUrl);
    }
  }
  return messages.map((message) => ({
    ...message,
    mediaHref: message.media_url ?? (message.media_path ? (signed.get(message.media_path) ?? null) : null),
  }));
}

export type InboxMessage = Awaited<ReturnType<typeof getMessages>>[number];

/** Contactos a los que se les puede enviar por WhatsApp (con teléfono, sin baja). */
export async function getSendableContacts(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, contact_phones!inner(phone_e164)')
    .eq('organization_id', organizationId)
    .is('merged_into_id', null)
    .eq('do_not_contact', false)
    .eq('contact_phones.is_whatsapp', true)
    .order('full_name')
    .limit(500);
  return (data ?? []).map((contact) => ({ id: contact.id, name: contact.full_name }));
}

/** Propiedades que se pueden mandar por WhatsApp desde una conversación (tienen página pública). */
export async function getSendableProperties(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('properties')
    .select('id, code, title')
    .eq('organization_id', organizationId)
    .is('merged_into_id', null)
    .in('status', ['available', 'reserved'])
    .order('updated_at', { ascending: false })
    .limit(300);
  return data ?? [];
}

/** Envíos de esta propiedad, para su historial (CU-08). */
export async function getPropertySends(organizationId: string, propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('activities')
    .select('id, created_at, contact_id, contacts(full_name)')
    .eq('organization_id', organizationId)
    .eq('kind', 'property_sent')
    .eq('metadata->>property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}
