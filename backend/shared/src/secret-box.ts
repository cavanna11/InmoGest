/**
 * Cifrado de secretos de terceros (tokens de Mercado Libre) con AES-256-GCM, ADR 0012.
 * Usa Web Crypto (Node 20+ y navegador), sin dependencias. Formato: v1.<iv>.<cifrado+tag>, en base64url.
 * La clave (INTEGRATIONS_ENCRYPTION_KEY) son 32 bytes en base64 y vive solo en el servidor.
 */

const VERSION = 'v1';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class SecretBoxError extends Error {
  constructor(readonly code: 'invalid_key' | 'invalid_payload') {
    super(code);
    this.name = 'SecretBoxError';
  }
}

export type SecretBox = {
  seal(plain: string): Promise<string>;
  open(sealed: string): Promise<string>;
};

/** Crea el cifrador a partir de la clave en base64 (32 bytes). Falla si la clave no sirve. */
export async function createSecretBox(base64Key: string): Promise<SecretBox> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(base64Key.trim());
  } catch {
    throw new SecretBoxError('invalid_key');
  }
  if (raw.length !== 32) throw new SecretBoxError('invalid_key');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

  return {
    async seal(plain) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
      return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
    },
    async open(sealed) {
      const [version, iv, data] = sealed.split('.');
      if (version !== VERSION || !iv || !data) throw new SecretBoxError('invalid_payload');
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data));
        return new TextDecoder().decode(plain);
      } catch {
        throw new SecretBoxError('invalid_payload');
      }
    },
  };
}
