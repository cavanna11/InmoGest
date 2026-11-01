import { describe, expect, it } from 'vitest';
import { demoHref, landingLinks } from './config.ts';

describe('demoHref', () => {
  it('sin canal definido lleva a la sección de demo de la propia landing', () => {
    expect(demoHref({ ...landingLinks, demo: null })).toBe('#demo');
  });

  it('con canal definido usa ese destino', () => {
    expect(demoHref({ ...landingLinks, demo: 'https://ejemplo.test/demo' })).toBe('https://ejemplo.test/demo');
  });
});

describe('landingLinks', () => {
  it('no trae emails ni teléfonos cargados en el código', () => {
    for (const value of Object.values(landingLinks)) {
      if (value === null) continue;
      expect(value).not.toMatch(/^(mailto:|tel:)|wa\.me/);
    }
  });
});
