import { parseEvolutionWebhook } from '@inmogest/shared';
import { NextResponse } from 'next/server';
import { allowRequest, rateLimitKey } from '@/lib/rate-limit.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { hashWebhookSecret } from '@/lib/whatsapp.ts';

const MAX_BODY_BYTES = 1024 * 1024;
const RATE_LIMIT_PER_MINUTE = 600;

function logError(action: string, code?: string) {
  console.error(JSON.stringify({ level: 'error', component: 'web', action, code }));
}

/**
 * Webhook de Evolution (docs/ARCHITECTURE.md, flujo 4). La conexión y la inmobiliaria salen del secreto
 * de la URL, nunca del cuerpo. Se busca por el hash, así que no se compara el secreto en sí. Solo guarda
 * y responde: los adjuntos se bajan en segundo plano. Un 500 hace que el proveedor reintente, y reintentar
 * es seguro porque guardar es idempotente.
 */
export async function POST(request: Request, { params }: RouteContext<'/api/webhooks/evolution/[secret]'>) {
  const { secret } = await params;
  if (!/^[0-9a-f]{64}$/.test(secret)) return new NextResponse(null, { status: 404 });
  const hash = hashWebhookSecret(secret);

  if (!(await allowRequest(rateLimitKey('whatsapp_webhook', hash), 60, RATE_LIMIT_PER_MINUTE))) {
    return new NextResponse(null, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from('whatsapp_connections')
    .select('id, organization_id')
    .eq('webhook_secret_hash', hash)
    .is('removed_at', null)
    .maybeSingle();
  if (connectionError) {
    logError('whatsapp.webhook_lookup_failed', connectionError.code);
    return new NextResponse(null, { status: 500 });
  }
  if (!connection) return new NextResponse(null, { status: 404 });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const event = parseEvolutionWebhook(payload);

  if (event.kind === 'connection') {
    const { error } = await admin.rpc('whatsapp_set_connection_state', {
      p_connection_id: connection.id,
      p_status: event.state,
      ...(event.phoneE164 ? { p_phone_e164: event.phoneE164 } : {}),
      ...(event.reason ? { p_reason: event.reason } : {}),
    });
    if (error) {
      logError('whatsapp.webhook_state_failed', error.code);
      return new NextResponse(null, { status: 500 });
    }
  }

  if (event.kind === 'message') {
    const { data, error } = await admin.rpc('whatsapp_ingest_message', {
      p_connection_id: connection.id,
      p_external_id: event.externalId,
      p_phone_e164: event.phoneE164,
      p_push_name: event.pushName as string,
      p_from_me: event.fromMe,
      p_type: event.type,
      p_body: event.body,
      p_media_mime: event.mediaMime as string,
      p_media_name: event.mediaName as string,
      p_sent_at: event.sentAt as string,
    });
    if (error) {
      logError('whatsapp.webhook_ingest_failed', error.code);
      return new NextResponse(null, { status: 500 });
    }
    const result = data as { status: string; message_id?: string; has_media?: boolean } | null;
    if (result?.status === 'stored' && result.has_media && result.message_id) {
      const { error: jobError } = await admin.rpc('enqueue_job', {
        p_type: 'whatsapp.media',
        p_payload: { message_id: result.message_id },
        p_organization_id: connection.organization_id,
        p_idempotency_key: `whatsapp.media:${result.message_id}`,
      });
      // El mensaje ya quedó guardado: si esto falla, se ve el aviso de adjunto pendiente.
      if (jobError) logError('whatsapp.webhook_media_job_failed', jobError.code);
    }
  }

  return NextResponse.json({ ok: true });
}
