import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-redirect.ts';

describe('safeNext', () => {
  it.each(['/panel', '/invitacion/abc123', '/panel/equipo?x=1'])('acepta la ruta interna %s', (value) => {
    expect(safeNext(value)).toBe(value);
  });

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', 'panel', '', null, undefined, '/a\nb', `/${'a'.repeat(600)}`])(
    'rechaza %j y usa el destino por defecto',
    (value) => {
      expect(safeNext(value)).toBe('/panel');
    },
  );

  it('permite elegir el destino por defecto', () => {
    expect(safeNext('https://x.test', '/ingresar')).toBe('/ingresar');
  });
});
