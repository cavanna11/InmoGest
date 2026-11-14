import { formatDate, formatTime } from '@inmogest/shared';

export const CONNECTION_STATUS = {
  connecting: { label: 'Esperando escaneo', variant: 'warning', help: 'Escaneá el código con el WhatsApp del número: Dispositivos vinculados → Vincular un dispositivo.' },
  connected: { label: 'Conectado', variant: 'success', help: 'Los mensajes entran a la bandeja y se puede responder desde el panel.' },
  disconnected: { label: 'Desconectado', variant: 'destructive', help: 'No entran mensajes nuevos ni se puede responder. Lo guardado se conserva.' },
  needs_qr: { label: 'Hay que volver a escanear', variant: 'destructive', help: 'WhatsApp cerró la sesión. Escaneá el código de nuevo para reconectar.' },
} as const;

export const MESSAGE_STATUS: Record<string, string> = {
  queued: 'En cola',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'No se pudo enviar',
  cancelled: 'Cancelado',
};

/** Adjuntos que se pueden enviar desde el panel, con su tipo de mensaje y extensión. */
export const ATTACHMENT_TYPES: Record<string, { type: 'image' | 'audio' | 'document' | 'video'; extension: string }> = {
  'image/jpeg': { type: 'image', extension: 'jpg' },
  'image/png': { type: 'image', extension: 'png' },
  'image/webp': { type: 'image', extension: 'webp' },
  'audio/ogg': { type: 'audio', extension: 'ogg' },
  'audio/mpeg': { type: 'audio', extension: 'mp3' },
  'audio/mp4': { type: 'audio', extension: 'm4a' },
  'video/mp4': { type: 'video', extension: 'mp4' },
  'application/pdf': { type: 'document', extension: 'pdf' },
  'application/msword': { type: 'document', extension: 'doc' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', extension: 'docx' },
  'application/vnd.ms-excel': { type: 'document', extension: 'xls' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'document', extension: 'xlsx' },
};

export const ATTACHMENT_MAX_BYTES = 16 * 1024 * 1024;
export const MEDIA_BUCKET = 'whatsapp-media';

export function conversationTime(iso: string): string {
  const date = new Date(iso);
  return formatDate(iso) === formatDate(new Date().toISOString()) ? formatTime(date.toISOString()) : formatDate(iso);
}

/** Texto de la ficha de una propiedad para WhatsApp (CU-08): sin datos que no estén en la página pública. */
export function propertyMessage(input: { title: string; price: string | null; location: string | null; url: string }): string {
  return [input.title, input.price, input.location, `Fotos y detalles: ${input.url}`].filter(Boolean).join('\n');
}
