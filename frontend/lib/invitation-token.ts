import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Token de invitación (ADR 0007): 32 bytes aleatorios en base64url. La base guarda solo el hash
 * SHA-256 del texto del token (igual que app.invitation_by_token). El token en claro se muestra una
 * sola vez al dueño como enlace copiable y nunca se escribe en logs.
 */
export function newInvitationToken(): { token: string; hashHex: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hashHex: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Formato bytea de PostgREST para insertar el hash. */
export function byteaHex(hex: string): string {
  return `\\x${hex}`;
}
