import { describe, expect, it } from 'vitest';
import { searchSchema } from './schemas.ts';

const base = {
  contactId: '11111111-1111-4111-8111-111111111111',
  operation: 'sale',
  propertyTypes: ['apartment'],
  budgetMin: '80.000',
  budgetMax: '100.000',
  currency: 'USD',
  tolerance: '',
  minRooms: '3',
  minBedrooms: '',
  locations: 'Belgrano, Núñez, ,Belgrano',
  required: ['garage'],
  desired: ['garage', 'balcony'],
  notes: '',
};

describe('searchSchema', () => {
  it('aplica la tolerancia por defecto del 10 %', () => {
    expect(searchSchema.parse(base).tolerance).toBe(10);
  });

  it('separa zonas sin vacías ni repetidas', () => {
    expect(searchSchema.parse(base).locations).toEqual(['Belgrano', 'Núñez']);
  });

  it('una característica requerida no cuenta como deseada', () => {
    expect(searchSchema.parse(base).desired).toEqual(['balcony']);
  });

  it('exige al menos un tipo y mínimo no mayor al máximo', () => {
    expect(searchSchema.safeParse({ ...base, propertyTypes: [] }).success).toBe(false);
    expect(searchSchema.safeParse({ ...base, budgetMin: '200.000' }).success).toBe(false);
  });
});
