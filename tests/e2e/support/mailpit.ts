// Lectura de emails del Mailpit de Supabase local (solo CI / Supabase local, tests @auth).
// Los links de los emails son credenciales temporales: nunca se imprimen ni se guardan en reportes.
const MAILPIT_URL = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324';

type MailpitSummary = { ID: string; To: Array<{ Address: string }>; Subject: string };

/** Espera el último email enviado a `to` y devuelve su texto. */
export async function waitForEmail(to: string, { timeoutMs = 20_000 } = {}): Promise<{ subject: string; text: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: MailpitSummary[] };
      const [latest] = messages;
      if (latest) {
        const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
        const body = (await detail.json()) as { Subject: string; Text: string; HTML: string };
        return { subject: body.Subject, text: `${body.Text}\n${body.HTML}` };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('No llegó el email esperado a Mailpit');
}

/** Primer link de verificación de Supabase Auth en el email. */
export function extractAuthLink(text: string): string {
  const match = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(text);
  if (!match) throw new Error('El email no contiene un link de verificación');
  return match[0].replaceAll('&amp;', '&');
}

/** Email único por corrida para aislar los datos de prueba. */
export function uniqueTestEmail(label: string): string {
  const run = process.env.GITHUB_RUN_ID ?? 'local';
  return `e2e-${label}-${run}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@inmogest.test`;
}
