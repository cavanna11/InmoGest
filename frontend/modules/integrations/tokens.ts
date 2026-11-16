import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

// Tokens de la API de propiedades (F-33): se muestran una sola vez; en la base queda el hash SHA-256.

export const API_TOKEN_PREFIX = 'ipk_';

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateApiToken(): { token: string; hash: string; prefix: string } {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashApiToken(token), prefix: token.slice(0, 10) };
}

/** Token del header Authorization: Bearer. Null si no tiene el formato esperado. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(ipk_[A-Za-z0-9_-]{43})$/.exec(header?.trim() ?? '');
  return match?.[1] ?? null;
}
