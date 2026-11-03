import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, toE164 } from './phone.ts';

describe('normalizePhone', () => {
  it.each([
    ['011 15 2345-6789', '+5491123456789'],
    ['11 2345-6789', '+5491123456789'],
    ['+54 11 2345 6789', '+5491123456789'],
    ['+54 9 11 2345 6789', '+5491123456789'],
    ['5491123456789', '+5491123456789'],
    ['+54 11 15 2345 6789', '+5491123456789'],
    ['0351 15 412-3456', '+5493514123456'],
    ['(0351) 412-3456', '+5493514123456'],
    ['0221 15 555-1234', '+5492215551234'],
    ['02944 15 41-2345', '+5492944412345'],
    ['+54 2944 15 412345', '+5492944412345'],
    ['02944 412345', '+5492944412345'],
  ])('canonicaliza el argentino %s como móvil %s', (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: { e164: expected, raw: input } });
  });

  it('todas las variantes del mismo número dan el mismo E.164 (duplicados)', () => {
    const variants = ['011 15 2345-6789', '+54 9 11 2345-6789', '11-2345-6789', '+541123456789'];
    expect(new Set(variants.map(toE164))).toEqual(new Set(['+5491123456789']));
  });

  it('mantiene números extranjeros válidos en E.164', () => {
    expect(toE164('+34 612 34 56 78')).toBe('+34612345678');
    expect(toE164('+1 202 555 0143')).toBe('+12025550143');
  });

  it('guarda el valor original recortado', () => {
    const result = normalizePhone('  11 2345-6789 ');
    expect(result.ok && result.value.raw).toBe('11 2345-6789');
  });

  it('rechaza vacío', () => {
    expect(normalizePhone('   ')).toMatchObject({ ok: false, error: { code: 'phone_empty' } });
  });

  it.each(['abc', '123', '15 2345-6789', '+54 11', '1'.repeat(40), '11 2345 6789 ext 2'])(
    'rechaza %s',
    (input) => {
      expect(normalizePhone(input)).toMatchObject({ ok: false, error: { code: 'phone_invalid' } });
    },
  );
});

describe('formatPhone', () => {
  it('muestra un E.164 argentino con espacios', () => {
    expect(formatPhone('+5491155550188')).toBe('+54 9 11 5555 0188');
  });

  it('devuelve el valor original si no lo reconoce', () => {
    expect(formatPhone('no-es-un-telefono')).toBe('no-es-un-telefono');
  });
});
