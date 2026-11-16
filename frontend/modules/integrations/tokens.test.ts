import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { bearerToken, generateApiToken, hashApiToken } = await import('./tokens.ts');

describe('tokens de la API', () => {
  it('genera un token con prefijo y guarda solo el hash', () => {
    const { token, hash, prefix } = generateApiToken();
    expect(token).toMatch(/^ipk_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashApiToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(prefix).toBe(token.slice(0, 10));
    expect(generateApiToken().token).not.toBe(token);
  });

  it('lee el token del header Authorization', () => {
    const { token } = generateApiToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken('Bearer otro')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
