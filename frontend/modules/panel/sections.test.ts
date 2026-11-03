import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PREVIEW_SECTIONS } from './sections.ts';

const panelDir = fileURLToPath(new URL('../../app/panel/', import.meta.url));
const navSource = readFileSync(fileURLToPath(new URL('../organization/panel-nav.tsx', import.meta.url)), 'utf8');

describe('vistas previas del panel', () => {
  it('cada sección tiene su página y su slug coincide con la clave', () => {
    for (const [key, section] of Object.entries(PREVIEW_SECTIONS)) {
      expect(section.slug).toBe(key);
      expect(existsSync(`${panelDir}${key}/page.tsx`), `app/panel/${key}/page.tsx`).toBe(true);
    }
  });

  it('cada enlace del menú lleva a una página existente', () => {
    const hrefs = [...navSource.matchAll(/href: '(\/panel[^']*)'/g)].map((match) => match[1] ?? '');
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const path = href === '/panel' ? '' : `${href.replace('/panel/', '')}/`;
      expect(existsSync(`${panelDir}${path}page.tsx`), href).toBe(true);
    }
  });
});
