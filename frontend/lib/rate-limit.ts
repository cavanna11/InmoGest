import 'server-only';
import { createHash } from 'node:crypto';
import { readPublicEnv } from './env.ts';
import { createAdminClient } from './supabase/admin.ts';

/**
 * Rate limiting de ventana fija con la RPC hit_rate_limit (solo service_role).
 * Las claves nunca llevan datos personales en claro: se hashean (docs/DATABASE.md).
 * Si el servidor no tiene la clave secreta configurada, no limita (y lo deja asentado en el log).
 */
export function rateLimitKey(scope: string, ...parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('|').toLowerCase()).digest('hex').slice(0, 40);
  return `${scope}:${digest}`;
}

export async function allowRequest(key: string, windowSeconds: number, max: number): Promise<boolean> {
  if (!readPublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    console.warn(JSON.stringify({ level: 'warn', component: 'web', action: 'rate_limit.unconfigured' }));
    return true;
  }
  const { data, error } = await createAdminClient().rpc('hit_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    // Ante una falla de la base no se bloquea al usuario: la protección real sigue en Auth y RLS.
    console.error(JSON.stringify({ level: 'error', component: 'web', action: 'rate_limit.failed', code: error.code }));
    return true;
  }
  return data === true;
}
