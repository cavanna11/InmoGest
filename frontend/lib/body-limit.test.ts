import { describe, expect, it } from 'vitest';
import { readTextWithLimit } from './body-limit.ts';

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/x', { method: 'POST', body, headers });

describe('readTextWithLimit', () => {
  it('devuelve el texto si entra en el límite', async () => {
    expect(await readTextWithLimit(post('{"a":1}'), 100)).toBe('{"a":1}');
  });

  it('rechaza por Content-Length declarado sin leer el cuerpo', async () => {
    expect(await readTextWithLimit(post('{}', { 'content-length': '5000' }), 100)).toBeNull();
  });

  it('cuenta bytes, no caracteres', async () => {
    // 'ñ' ocupa 2 bytes en UTF-8: 60 caracteres = 120 bytes.
    const text = 'ñ'.repeat(60);
    expect(text.length).toBe(60);
    expect(await readTextWithLimit(post(text), 100)).toBeNull();
    expect(await readTextWithLimit(post(text), 120)).toBe(text);
  });
});
