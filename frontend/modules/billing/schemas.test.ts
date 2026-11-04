import { describe, expect, it } from 'vitest';
import { paymentSchema } from './schemas.ts';

const base = { planCode: 'professional', months: '2', amount: '78.000,50', currency: 'ARS', reference: 'Transf. 123' };

describe('paymentSchema', () => {
  it('interpreta el monto a la argentina', () => {
    const parsed = paymentSchema.parse(base);
    expect(parsed.amount).toBe(78000.5);
    expect(parsed.months).toBe(2);
  });

  it('rechaza monto vacío, cero y meses fuera de rango', () => {
    expect(paymentSchema.safeParse({ ...base, amount: '' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, months: '25' }).success).toBe(false);
  });
});
