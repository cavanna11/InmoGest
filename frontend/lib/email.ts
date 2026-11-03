import 'server-only';
import { err, ok, type Result } from '@inmogest/shared';

/**
 * Emails PROPIOS de la aplicación (no los de Auth, que envía Supabase), ADR 0007.
 * Se envían por la API HTTP del proveedor transaccional con fetch, sin SDK. Mientras no esté
 * configurado (EMAIL_API_KEY y EMAIL_FROM), devuelve email_not_configured y quien llama ofrece
 * la alternativa (por ejemplo, el enlace copiable de una invitación).
 * Nunca escribir en logs el destinatario, el asunto ni el contenido: pueden llevar enlaces que son
 * credenciales temporales.
 */
export type EmailErrorCode = 'email_not_configured' | 'email_send_failed';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendAppEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<Result<null, EmailErrorCode>> {
  const apiKey = process.env.EMAIL_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return err('email_not_configured', 'El envío de emails todavía no está configurado.');
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ level: 'error', component: 'web', action: 'email.failed', status: response.status }));
      return err('email_send_failed', 'No se pudo enviar el email.');
    }
    return ok(null);
  } catch {
    console.error(JSON.stringify({ level: 'error', component: 'web', action: 'email.failed', status: 'network' }));
    return err('email_send_failed', 'No se pudo enviar el email.');
  }
}
