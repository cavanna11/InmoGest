import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyOrder, navigationGroups } from './navigation.ts';
import { PREVIEW_SECTIONS } from './sections.ts';

const panelDir = fileURLToPath(new URL('../../app/panel/', import.meta.url));

describe('vistas previas del panel', () => {
  it('cada sección tiene su página y su slug coincide con la clave', () => {
    for (const [key, section] of Object.entries(PREVIEW_SECTIONS)) {
      expect(section.slug).toBe(key);
      expect(existsSync(`${panelDir}${key}/page.tsx`), `app/panel/${key}/page.tsx`).toBe(true);
    }
  });

  it('cada enlace del menú lleva a una página existente', () => {
    const hrefs = navigationGroups(true).flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const path = href === '/panel' ? '' : `${href.replace('/panel/', '')}/`;
      expect(existsSync(`${panelDir}${path}page.tsx`), href).toBe(true);
    }
  });
});

describe('menú del panel', () => {
  it('un agente no ve las secciones del dueño', () => {
    const hrefs = navigationGroups(false).flatMap((group) => group.items.map((item) => item.href));
    for (const href of ['/panel/importar', '/panel/configuracion', '/panel/equipo', '/panel/whatsapp', '/panel/integraciones', '/panel/plan']) {
      expect(hrefs).not.toContain(href);
    }
    expect(hrefs).toContain('/panel/perfil');
  });

  it('aplica el orden guardado y deja al final las secciones que no conoce', () => {
    const items = navigationGroups(true)[0]?.items ?? [];
    const ordered = applyOrder(items, ['agenda', 'contactos', 'inexistente']);
    expect(ordered.map((item) => item.id).slice(0, 3)).toEqual(['agenda', 'contactos', '']);
    expect(ordered).toHaveLength(items.length);
  });
});
