import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromDbNumeric,
  isCurrency,
  MAX_CENTS,
  money,
  parseAmount,
  toDbNumeric,
} from './money.ts';

describe('parseAmount', () => {
  it.each([
    ['100.000', 10_000_000n],
    ['100000', 10_000_000n],
    ['1.234,50', 123_450n],
    ['1234,5', 123_450n],
    ['99.90', 9_990n],
    ['99.9', 9_990n],
    ['0,01', 1n],
    ['$ 1.500', 150_000n],
    ['1.000.000', 100_000_000n],
  ])('%s → %s centavos', (input, cents) => {
    expect(parseAmount(input, 'USD')).toEqual({ ok: true, value: { cents, currency: 'USD' } });
  });

  it.each(['', 'abc', '-100', '1,234,5', '1.23.4', '12,345', '1.2345', '10.00.000'])('rechaza %j', (input) => {
    expect(parseAmount(input, 'ARS').ok).toBe(false);
  });

  it('rechaza montos fuera de numeric(14,2)', () => {
    expect(parseAmount('1.000.000.000.000', 'ARS')).toMatchObject({
      ok: false,
      error: { code: 'amount_out_of_range' },
    });
    expect(parseAmount('999.999.999.999,99', 'ARS')).toMatchObject({ ok: true, value: { cents: MAX_CENTS } });
  });
});

describe('conversión con la base', () => {
  it('ida y vuelta sin perder centavos', () => {
    for (const text of ['0.00', '0.01', '1234.50', '999999999999.99', '-15.05']) {
      expect(toDbNumeric(fromDbNumeric(text, 'ARS'))).toBe(text);
    }
  });

  it('acepta number de PostgREST', () => {
    expect(fromDbNumeric(110000, 'USD').cents).toBe(11_000_000n);
    expect(fromDbNumeric(0.1 + 0.2, 'USD').cents).toBe(30n);
    expect(fromDbNumeric('12.5', 'USD').cents).toBe(1_250n);
  });

  it('rechaza valores no numéricos', () => {
    expect(() => fromDbNumeric('12,5', 'USD')).toThrow(TypeError);
  });
});

describe('operaciones', () => {
  it('suma y compara solo en la misma moneda', () => {
    expect(addMoney(money(100n, 'USD'), money(50n, 'USD'))).toEqual({
      ok: true,
      value: { cents: 150n, currency: 'USD' },
    });
    expect(compareMoney(money(100n, 'USD'), money(50n, 'USD'))).toEqual({ ok: true, value: 1 });
    expect(compareMoney(money(1n, 'USD'), money(1n, 'USD'))).toEqual({ ok: true, value: 0 });
  });

  it('nunca combina monedas distintas', () => {
    expect(addMoney(money(100n, 'USD'), money(100n, 'ARS'))).toMatchObject({
      ok: false,
      error: { code: 'currency_mismatch' },
    });
    expect(compareMoney(money(100n, 'USD'), money(100n, 'ARS')).ok).toBe(false);
  });

  it('money() rechaza montos fuera de rango', () => {
    expect(() => money(MAX_CENTS + 1n, 'ARS')).toThrow(RangeError);
  });

  it('isCurrency', () => {
    expect(isCurrency('ARS')).toBe(true);
    expect(isCurrency('EUR')).toBe(false);
  });
});

describe('formatMoney', () => {
  it('muestra la moneda y el formato argentino', () => {
    expect(formatMoney(money(10_000_000n, 'USD'))).toBe('USD 100.000');
    expect(formatMoney(money(123_450n, 'ARS'))).toBe('ARS 1.234,50');
    expect(formatMoney(money(5n, 'ARS'))).toBe('ARS 0,05');
    expect(formatMoney(money(-150_000n, 'ARS'))).toBe('ARS -1.500');
  });
});
