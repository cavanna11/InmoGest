import { describe, expect, it } from 'vitest';
import { propertySchema, toPropertyRow } from './schemas.ts';

const base = {
  title: 'Depto 3 amb.',
  description: '',
  operation: 'sale',
  propertyType: 'apartment',
  status: 'available',
  price: '98.000',
  currency: 'USD',
  expenses: '',
  expensesCurrency: 'ARS',
  province: '',
  city: 'CABA',
  neighborhood: 'Belgrano',
  address: '',
  rooms: '3',
  bedrooms: '',
  bathrooms: '1',
  coveredArea: '65,5',
  totalArea: '',
  features: ['balcony', 'garage', 'no-existe', 'balcony'],
  assignedUserId: '',
};

describe('propertySchema', () => {
  it('interpreta montos y superficies a la argentina', () => {
    const parsed = propertySchema.parse(base);
    expect(parsed.price).toBe(98000);
    expect(parsed.coveredArea).toBe(65.5);
    expect(parsed.rooms).toBe(3);
    expect(parsed.bedrooms).toBeNull();
  });

  it('se queda solo con características conocidas y sin repetir', () => {
    expect(propertySchema.parse(base).features).toEqual(['balcony', 'garage']);
  });

  it('para publicar exige precio; en borrador no', () => {
    expect(propertySchema.safeParse({ ...base, price: '' }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, price: '', status: 'draft' }).success).toBe(true);
  });

  it('rechaza montos mal escritos', () => {
    expect(propertySchema.safeParse({ ...base, price: '98,000,00' }).success).toBe(false);
  });

  it('arma las columnas de la base', () => {
    const row = toPropertyRow(propertySchema.parse(base));
    expect(row).toMatchObject({ property_type: 'apartment', price: 98000, currency: 'USD', covered_area_m2: 65.5, assigned_user_id: null });
  });
});
