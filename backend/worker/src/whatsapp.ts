import {
  WhatsAppProviderError,
  type Database,
  type ProviderConnectionState,
  type ProviderMediaType,
  type WhatsAppProvider,
} from '@inmogest/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from './logger.ts';

/**
 * Envíos de la cola de WhatsApp y control de las conexiones (docs/ARCHITECTURE.md, flujos 4 y 5).
 * Por ahora solo salen mensajes humanos: no tienen topes de envío. Los automáticos (F-20) agregan sus
 * reglas al tomar de la cola.
 */

const MEDIA_BUCKET = 'whatsapp-media';
const SIGNED_URL_SECONDS = 3600;
const RETRY_SECONDS = 30;

export type OutboxItem = {
  id: string;
  organization_id: string;
  connection_id: string;
  instance_name: string;
  message_id: string;
  phone_e164: string;
  type: Database['public']['Enums']['message_type'];
  body: string;
  media_path: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_name: string | null;
  attempts: number;
};

export type ActiveConnection = {
  id: string;
  instance_name: string;
  status: ProviderConnectionState;
};

/** Acceso a la base que necesitan los envíos. Aparte para poder probarlos sin base. */
export interface WhatsAppStore {
  claimOutbox(limit: number): Promise<OutboxItem[]>;
  completeOutbox(id: string, externalId: string | null): Promise<void>;
  failOutbox(id: string, errorCode: string, retrySeconds: number): Promise<void>;
  signedMediaUrl(path: string): Promise<string | null>;
  activeConnections(): Promise<ActiveConnection[]>;
  setConnectionState(id: string, state: ProviderConnectionState, reason: string | null): Promise<void>;
}

export function createWhatsAppStore(client: SupabaseClient<Database>): WhatsAppStore {
  return {
    async claimOutbox(limit) {
      const { data, error } = await client.rpc('claim_whatsapp_outbox', { p_limit: limit });
      if (error) throw new WhatsAppProviderError('outbox_claim_failed');
      return (data ?? []) as OutboxItem[];
    },
    async completeOutbox(id, externalId) {
      const { error } = await client.rpc('complete_whatsapp_outbox', { p_id: id, p_external_id: externalId as string });
      if (error) throw new WhatsAppProviderError('outbox_complete_failed');
    },
    async failOutbox(id, errorCode, retrySeconds) {
      const { error } = await client.rpc('fail_whatsapp_outbox', { p_id: id, p_error: errorCode, p_retry_seconds: retrySeconds });
      if (error) throw new WhatsAppProviderError('outbox_fail_failed');
    },
    async signedMediaUrl(path) {
      const { data } = await client.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
      return data?.signedUrl ?? null;
    },
    async activeConnections() {
      const { data, error } = await client
        .from('whatsapp_connections')
        .select('id, instance_name, status')
        .is('removed_at', null)
        .eq('provider', 'evolution');
      if (error) throw new WhatsAppProviderError('connections_read_failed');
      return data ?? [];
    },
    async setConnectionState(id, state, reason) {
      const { error } = await client.rpc('whatsapp_set_connection_state', {
        p_connection_id: id,
        p_status: state,
        ...(reason ? { p_reason: reason } : {}),
      });
      if (error) throw new WhatsAppProviderError('connection_state_failed');
    },
  };
}

const MEDIA_TYPES = new Set<OutboxItem['type']>(['image', 'audio', 'document', 'video']);

async function sendItem(item: OutboxItem, store: WhatsAppStore, provider: WhatsAppProvider) {
  if (!MEDIA_TYPES.has(item.type)) {
    return provider.sendText({ instanceName: item.instance_name, phoneE164: item.phone_e164, text: item.body });
  }
  const mediaUrl = item.media_url ?? (item.media_path ? await store.signedMediaUrl(item.media_path) : null);
  if (!mediaUrl) throw new WhatsAppProviderError('media_unavailable');
  return provider.sendMedia({
    instanceName: item.instance_name,
    phoneE164: item.phone_e164,
    type: item.type as ProviderMediaType,
    mediaUrl,
    mimeType: item.media_mime,
    fileName: item.media_name,
    caption: item.body,
  });
}

/** Envía lo que esté listo. Devuelve cuántos tomó. Un envío que falla no frena a los demás. */
export async function processOutbox(store: WhatsAppStore, provider: WhatsAppProvider, logger: Logger, limit = 10): Promise<number> {
  const items = await store.claimOutbox(limit);
  for (const item of items) {
    const base = { outbox_id: item.id, organization_id: item.organization_id, connection_id: item.connection_id, attempt: item.attempts };
    try {
      const { externalId } = await sendItem(item, store, provider);
      await store.completeOutbox(item.id, externalId);
      logger('info', 'whatsapp.sent', base);
    } catch (error) {
      const code = error instanceof WhatsAppProviderError ? error.code : 'unexpected';
      await store.failOutbox(item.id, code, RETRY_SECONDS);
      logger('warn', 'whatsapp.send_failed', { ...base, error_code: code });
    }
  }
  return items.length;
}

/**
 * Compara el estado guardado con el del proveedor (objetivo: detectar una desconexión en menos de
 * 2 minutos aunque se pierda un webhook). Si no se llega al proveedor no cambia nada: ese problema es
 * de la instalación, no de la conexión de la inmobiliaria.
 */
export async function reconcileConnections(store: WhatsAppStore, provider: WhatsAppProvider, logger: Logger): Promise<void> {
  for (const connection of await store.activeConnections()) {
    try {
      const state = await provider.getState(connection.instance_name);
      if (state !== connection.status) {
        await store.setConnectionState(connection.id, state, 'reconciled');
        logger('info', 'whatsapp.connection_changed', { connection_id: connection.id, from: connection.status, to: state });
      }
    } catch (error) {
      if (error instanceof WhatsAppProviderError && error.httpStatus === 404) {
        await store.setConnectionState(connection.id, 'needs_qr', 'instance_missing');
        continue;
      }
      logger('warn', 'whatsapp.state_check_failed', {
        connection_id: connection.id,
        error_code: error instanceof WhatsAppProviderError ? error.code : 'unexpected',
      });
    }
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** "audio/ogg; codecs=opus" → "audio/ogg". */
export function baseMime(mime: string | null | undefined): string | null {
  return mime?.split(';')[0]?.trim().toLowerCase() || null;
}

export function mediaExtension(mime: string | null | undefined): string | null {
  const base = baseMime(mime);
  return base ? (MIME_EXTENSIONS[base] ?? null) : null;
}

/**
 * Job "whatsapp.media": baja el adjunto de un mensaje recibido y lo guarda en Storage. La inmobiliaria
 * sale de la fila del mensaje, y se exige que coincida con la del job.
 */
export async function downloadMessageMedia(
  client: SupabaseClient<Database>,
  provider: WhatsAppProvider,
  messageId: string,
  organizationId: string | null,
): Promise<void> {
  const { data: message, error } = await client
    .from('messages')
    .select('id, organization_id, external_id, media_mime, media_status, whatsapp_connections(instance_name)')
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw new WhatsAppProviderError('media_message_read_failed');
  if (!message || message.organization_id !== organizationId || message.media_status !== 'pending') return;

  const instanceName = message.whatsapp_connections?.instance_name;
  if (!message.external_id || !instanceName) {
    await client.rpc('whatsapp_set_message_media', { p_message_id: messageId, p_media_status: 'failed' });
    return;
  }

  const { base64, mimeType } = await provider.downloadMedia({ instanceName, externalId: message.external_id });
  const mime = baseMime(mimeType ?? message.media_mime);
  const extension = mediaExtension(mime);
  if (!mime || !extension) {
    // Formato que no se guarda: el mensaje queda con el aviso de adjunto no disponible.
    await client.rpc('whatsapp_set_message_media', { p_message_id: messageId, p_media_status: 'failed' });
    return;
  }

  const path = `${message.organization_id}/inbound/${messageId}.${extension}`;
  const { error: uploadError } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, Buffer.from(base64, 'base64'), { contentType: mime, upsert: true });
  if (uploadError) throw new WhatsAppProviderError('media_upload_failed');

  const { error: updateError } = await client.rpc('whatsapp_set_message_media', {
    p_message_id: messageId,
    p_media_status: 'ready',
    p_media_path: path,
    p_media_mime: mime,
  });
  if (updateError) throw new WhatsAppProviderError('media_update_failed');
}
