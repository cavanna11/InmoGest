import { describe, expect, it } from 'vitest';
import { contactUpdateSchema, newContactSchema, repeated } from './schemas.ts';

const base = { fullName: 'Ana G.', phones: [], emails: [], notes: '', isProspect: 'on' };

describe('newContactSchema', () => {
  it('normaliza los teléfonos argentinos a +549', () => {
    const parsed = newContactSchema.parse({ ...base, phones: ['11 5555-0188', '011 15 5555-0199'] });
    expect(parsed.phones).toEqual(['+5491155550188', '+5491155550199']);
  });

  it('rechaza un teléfono inválido', () => {
    expect(newContactSchema.safeParse({ ...base, phones: ['123'] }).success).toBe(false);
  });

  it('pasa los emails a minúsculas', () => {
    expect(newContactSchema.parse({ ...base, emails: ['Ana@Cliente.TEST'] }).emails).toEqual(['ana@cliente.test']);
  });

  it('exige que sea interesado, propietario o ambos', () => {
    const result = newContactSchema.safeParse({ ...base, isProspect: undefined });
    expect(result.success).toBe(false);
  });

  it('sin asignación queda null', () => {
    expect(newContactSchema.parse({ ...base, assignedUserId: '' }).assignedUserId).toBeNull();
  });
});

describe('contactUpdateSchema', () => {
  it('lee la baja "no contactar" del checkbox', () => {
    const parsed = contactUpdateSchema.parse({ fullName: 'Ana', notes: '', isOwner: 'on', doNotContact: 'on' });
    expect(parsed.doNotContact).toBe(true);
    expect(parsed.isProspect).toBe(false);
  });
});

describe('repeated', () => {
  it('devuelve los valores no vacíos de un campo repetido', () => {
    const data = new FormData();
    data.append('phone', ' 11 5555-0188 ');
    data.append('phone', '');
    expect(repeated(data, 'phone')).toEqual(['11 5555-0188']);
  });
});
