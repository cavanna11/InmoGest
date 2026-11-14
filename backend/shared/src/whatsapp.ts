/**
 * Contrato con el proveedor de WhatsApp (docs/ARCHITECTURE.md). La app y el worker dependen de esta
 * interfaz, no de Evolution, para poder pasar a la API oficial sin tocar el resto del sistema.
 */

export type ProviderConnectionState = 'connected' | 'connecting' | 'disconnected' | 'needs_qr';
export type ProviderMessageType = 'text' | 'image' | 'audio' | 'document' | 'video' | 'other';
export type ProviderMediaType = 'image' | 'audio' | 'document' | 'video';

export type ProviderQr = { base64: string | null; pairingCode: string | null };

export type SendTextInput = { instanceName: string; phoneE164: string; text: string };
export type SendMediaInput = {
  instanceName: string;
  phoneE164: string;
  type: ProviderMediaType;
  /** URL que el proveedor pueda descargar (pública o firmada). */
  mediaUrl: string;
  mimeType?: string | null | undefined;
  fileName?: string | null | undefined;
  caption?: string | null | undefined;
};

export interface WhatsAppProvider {
  createInstance(input: { instanceName: string; webhookUrl: string }): Promise<{ qr: ProviderQr | null }>;
  /** Pide un QR nuevo para escanear. */
  getQr(instanceName: string): Promise<ProviderQr | null>;
  getState(instanceName: string): Promise<ProviderConnectionState>;
  /** Cierra la sesión y borra la instancia. No falla si ya no existía. */
  removeInstance(instanceName: string): Promise<void>;
  sendText(input: SendTextInput): Promise<{ externalId: string | null }>;
  sendMedia(input: SendMediaInput): Promise<{ externalId: string | null }>;
  downloadMedia(input: { instanceName: string; externalId: string }): Promise<{ base64: string; mimeType: string | null }>;
}

/** Error del proveedor con un código estable, sin datos personales: se guarda en la cola y en los logs. */
export class WhatsAppProviderError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number | null = null,
  ) {
    super(code);
    this.name = 'WhatsAppProviderError';
  }
}

/** Evento del proveedor ya normalizado. */
export type ProviderEvent =
  | {
      kind: 'message';
      externalId: string;
      phoneE164: string;
      pushName: string | null;
      fromMe: boolean;
      type: ProviderMessageType;
      body: string;
      mediaMime: string | null;
      mediaName: string | null;
      sentAt: string | null;
    }
  | { kind: 'connection'; state: ProviderConnectionState; phoneE164: string | null; reason: string | null }
  | { kind: 'ignored'; reason: string };
