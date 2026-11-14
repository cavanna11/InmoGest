import {
  WhatsAppProviderError,
  type ProviderConnectionState,
  type ProviderEvent,
  type ProviderMessageType,
  type ProviderQr,
  type WhatsAppProvider,
} from './whatsapp.ts';

/**
 * Implementación de WhatsAppProvider para Evolution API v2.3.7 (docs/STACK.md). Rutas, cuerpos y eventos
 * tomados del código de esa versión. Nunca incluye la API key ni datos personales en los errores.
 */

export const EVOLUTION_WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] as const;

const REQUEST_TIMEOUT_MS = 20_000;

export type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
};

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
const asString = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

function toQr(value: unknown): ProviderQr | null {
  const record = asRecord(value);
  if (!record) return null;
  const base64 = asString(record.base64);
  const pairingCode = asString(record.pairingCode);
  return base64 || pairingCode ? { base64, pairingCode } : null;
}

function digits(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

function externalIdOf(response: unknown): string | null {
  return asString(asRecord(asRecord(response)?.key)?.id);
}

export function mapEvolutionState(state: unknown, statusReason?: unknown): ProviderConnectionState {
  if (state === 'open') return 'connected';
  if (state === 'connecting') return 'connecting';
  // 401: WhatsApp cerró la sesión. "refused": se agotaron los QR sin escanear. Hay que escanear de nuevo.
  if (state === 'refused' || statusReason === 401) return 'needs_qr';
  return 'disconnected';
}

export function createEvolutionProvider(config: EvolutionConfig): WhatsAppProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;

  async function request(method: 'GET' | 'POST' | 'DELETE', path: string, body?: Json): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: { apikey: config.apiKey, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new WhatsAppProviderError('provider_unreachable');
    }
    if (!response.ok) {
      throw new WhatsAppProviderError(`provider_http_${response.status}`, response.status);
    }
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const instancePath = (action: string, instanceName: string) => `${action}/${encodeURIComponent(instanceName)}`;

  return {
    async createInstance({ instanceName, webhookUrl }) {
      const response = await request('POST', '/instance/create', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        groupsIgnore: true,
        readMessages: false,
        syncFullHistory: false,
        webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: [...EVOLUTION_WEBHOOK_EVENTS] },
      });
      return { qr: toQr(asRecord(response)?.qrcode) };
    },

    async getQr(instanceName) {
      return toQr(await request('GET', instancePath('/instance/connect', instanceName)));
    },

    async getState(instanceName) {
      const response = await request('GET', instancePath('/instance/connectionState', instanceName));
      return mapEvolutionState(asRecord(asRecord(response)?.instance)?.state);
    },

    async removeInstance(instanceName) {
      // Si la sesión ya estaba cerrada, logout responde error: lo importante es borrar la instancia.
      await request('DELETE', instancePath('/instance/logout', instanceName)).catch(() => undefined);
      try {
        await request('DELETE', instancePath('/instance/delete', instanceName));
      } catch (error) {
        if (!(error instanceof WhatsAppProviderError && error.httpStatus === 404)) throw error;
      }
    },

    async sendText({ instanceName, phoneE164, text }) {
      const response = await request('POST', instancePath('/message/sendText', instanceName), {
        number: digits(phoneE164),
        text,
      });
      return { externalId: externalIdOf(response) };
    },

    async sendMedia({ instanceName, phoneE164, type, mediaUrl, mimeType, fileName, caption }) {
      const response = await request('POST', instancePath('/message/sendMedia', instanceName), {
        number: digits(phoneE164),
        mediatype: type,
        media: mediaUrl,
        ...(mimeType ? { mimetype: mimeType } : {}),
        ...(fileName ? { fileName } : {}),
        ...(caption ? { caption } : {}),
      });
      return { externalId: externalIdOf(response) };
    },

    async downloadMedia({ instanceName, externalId }) {
      const response = asRecord(
        await request('POST', instancePath('/chat/getBase64FromMediaMessage', instanceName), {
          message: { key: { id: externalId } },
          convertToMp4: false,
        }),
      );
      const base64 = asString(response?.base64);
      if (!base64) throw new WhatsAppProviderError('provider_media_unavailable');
      return { base64, mimeType: asString(response?.mimetype) };
    },
  };
}

/** Número de un JID individual ("5491155550002@s.whatsapp.net" o con sufijo de dispositivo) → E.164. */
export function jidToE164(jid: string | null): string | null {
  if (!jid?.endsWith('@s.whatsapp.net')) return null;
  const number = jid.split('@')[0]?.split(':')[0] ?? '';
  return /^[1-9]\d{6,14}$/.test(number) ? `+${number}` : null;
}

type Parsed = { type: ProviderMessageType; body: string; mime: string | null; name: string | null };

function parseContent(message: Json | null): Parsed | null {
  if (!message) return null;
  const text = asString(message.conversation) ?? asString(asRecord(message.extendedTextMessage)?.text);
  if (text) return { type: 'text', body: text, mime: null, name: null };

  const media = (key: string, type: ProviderMessageType): Parsed | null => {
    const content = asRecord(message[key]);
    if (!content) return null;
    return {
      type,
      body: asString(content.caption) ?? '',
      mime: asString(content.mimetype),
      name: asString(content.fileName),
    };
  };
  const wrapped = asRecord(asRecord(message.documentWithCaptionMessage)?.message);
  return (
    media('imageMessage', 'image') ??
    media('audioMessage', 'audio') ??
    media('videoMessage', 'video') ??
    media('documentMessage', 'document') ??
    (wrapped ? parseContent(wrapped) : null)
  );
}

// Eventos técnicos que no son mensajes de una persona.
const TECHNICAL_MESSAGES = new Set([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'reactionMessage',
  'pollUpdateMessage',
  'editedMessage',
]);

function parseMessage(data: Json): ProviderEvent {
  const key = asRecord(data.key);
  const externalId = asString(key?.id);
  if (!key || !externalId) return { kind: 'ignored', reason: 'invalid_message' };

  // Evolution ya reemplaza @lid por el número cuando lo conoce; sin número real no se puede vincular.
  const remoteJid = asString(key.remoteJid);
  const phoneE164 = jidToE164(remoteJid) ?? jidToE164(asString(key.remoteJidAlt));
  if (!phoneE164) return { kind: 'ignored', reason: 'not_individual_chat' };

  const messageType = asString(data.messageType);
  if (messageType && TECHNICAL_MESSAGES.has(messageType)) return { kind: 'ignored', reason: 'technical_message' };

  const parsed = parseContent(asRecord(data.message));
  const timestamp = Number(data.messageTimestamp);
  return {
    kind: 'message',
    externalId,
    phoneE164,
    pushName: asString(data.pushName),
    fromMe: key.fromMe === true,
    // Lo que el panel no sabe mostrar (ubicación, contacto, sticker…) se conserva como aviso, no se pierde.
    type: parsed?.type ?? 'other',
    body: parsed?.body ?? 'Mensaje que no se puede mostrar acá. Miralo en el teléfono.',
    mediaMime: parsed?.mime ?? null,
    mediaName: parsed?.name ?? null,
    sentAt: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null,
  };
}

/** Normaliza el cuerpo de un webhook de Evolution. Nunca lanza: lo desconocido se ignora. */
export function parseEvolutionWebhook(payload: unknown): ProviderEvent {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const event = asString(root?.event)?.toLowerCase().replace(/_/g, '.');
  if (!data || !event) return { kind: 'ignored', reason: 'invalid_payload' };

  if (event === 'messages.upsert') return parseMessage(data);
  if (event === 'connection.update') {
    const wuid = asString(data.wuid);
    const reason = data.statusReason;
    return {
      kind: 'connection',
      state: mapEvolutionState(data.state, reason),
      phoneE164: jidToE164(wuid),
      reason: typeof reason === 'number' ? `status_${reason}` : null,
    };
  }
  return { kind: 'ignored', reason: 'unhandled_event' };
}
