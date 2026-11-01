import { describe, expect, it } from 'vitest';
import { isValidSlug, SLUG_MAX_LENGTH, slugify } from './slug.ts';

describe('slugify', () => {
  it.each([
    ['Inmobiliaria Peña & Asociados', 'inmobiliaria-pena-asociados'],
    ['  López Propiedades  ', 'lopez-propiedades'],
    ['Ñuñoa—Bienes Raíces S.A.', 'nunoa-bienes-raices-s-a'],
    ['ABC 123', 'abc-123'],
    ['--Ya--Tiene--Guiones--', 'ya-tiene-guiones'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(isValidSlug(slugify(input))).toBe(true);
  });

  it('usa el valor por defecto si no queda nada', () => {
    expect(slugify('¡¡¡!!!')).toBe('inmobiliaria');
    expect(slugify('', 'propiedad')).toBe('propiedad');
  });

  it('respeta el largo máximo sin terminar en guion', () => {
    const slug = slugify(`${'a'.repeat(59)} b c d`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('isValidSlug', () => {
  it.each(['demo', 'demo-2', 'a1-b2'])('acepta %j', (value) => expect(isValidSlug(value)).toBe(true));
  it.each(['Demo', 'demo_2', '-demo', 'demo-', 'de--mo', '', 'a'.repeat(61)])('rechaza %j', (value) =>
    expect(isValidSlug(value)).toBe(false),
  );
});
