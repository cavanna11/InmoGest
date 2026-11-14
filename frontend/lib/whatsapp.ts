import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createEvolutionProvider, type WhatsAppProvider } from '@inmogest/shared';
import { readEvolutionEnv } from './env.server.ts';
import { appOrigin } from './request.ts';

/** Proveedor de WhatsApp, o null si la instalación todavía no lo tiene configurado. */
export function getWhatsAppProvider(): WhatsAppProvider | null {
  const env = readEvolutionEnv();
  return env ? createEvolutionProvider(env) : null;
}

/** Secreto del webhook de una conexión: en la base queda solo su hash (docs/SECURITY.md). */
export function generateWebhookSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString('hex');
  return { secret, hash: hashWebhookSecret(secret) };
}

export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export async function webhookUrl(secret: string): Promise<string> {
  return `${await appOrigin()}/api/webhooks/evolution/${secret}`;
}
