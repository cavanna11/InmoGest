import { describe, expect, it } from 'vitest';
import { DEMO_WHATSAPP_NUMBER, demoHref, landingLinks } from './config.ts';

describe('demoHref', () => {
  it('sin canal definido lleva a la sección de demo de la propia landing', () => {
    expect(demoHref({ ...landingLinks, demo: null })).toBe('#demo');
  });

  it('con canal definido usa ese destino', () => {
    expect(demoHref({ ...landingLinks, demo: 'https://ejemplo.test/demo' })).toBe('https://ejemplo.test/demo');
  });
});

describe('landingLinks', () => {
  it('la demo va al WhatsApp comercial aprobado por C&C, con el mensaje precargado', () => {
    const url = new URL(landingLinks.demo ?? '');
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe(`/${DEMO_WHATSAPP_NUMBER}`);
    expect(DEMO_WHATSAPP_NUMBER).toBe('5492257529684');
    expect(url.searchParams.get('text')).toContain('InmoPanel');
  });

  it('fuera de la demo no trae emails ni teléfonos cargados en el código', () => {
    const { demo: _demo, ...rest } = landingLinks;
    for (const value of Object.values(rest)) {
      if (value === null) continue;
      expect(value).not.toMatch(/^(mailto:|tel:)|wa\.me/);
    }
  });
});
