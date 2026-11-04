import { describe, expect, it } from 'vitest';
import { appointmentSchema, localToIso, taskSchema } from './schemas.ts';

describe('localToIso', () => {
  it('interpreta la fecha y hora en Argentina (UTC-3)', () => {
    expect(localToIso('2026-11-08', '11:30')).toBe('2026-11-08T14:30:00.000Z');
  });

  it('rechaza valores inválidos', () => {
    expect(localToIso('08/11/2026', '11:30')).toBeNull();
    expect(localToIso('2026-13-08', '11:30')).toBeNull();
    expect(localToIso('2026-11-08', '25:00')).toBeNull();
  });
});

describe('appointmentSchema', () => {
  it('una visita requiere cliente y propiedad', () => {
    const base = { date: '2026-11-08', time: '11:30', notes: '', propertyId: '11111111-1111-4111-8111-111111111111' };
    expect(appointmentSchema.safeParse({ ...base, contactId: '' }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, contactId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
  });
});

describe('taskSchema', () => {
  it('una tarea puede no tener contacto ni propiedad', () => {
    const parsed = taskSchema.parse({ title: 'Llamar', date: '2026-11-08', time: '10:00', priority: 'normal', contactId: '', propertyId: '' });
    expect(parsed.contactId).toBeNull();
    expect(parsed.propertyId).toBeNull();
  });
});
