import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Verifica que la identidad visual (provisoria o definitiva) cumpla WCAG 2.2 AA:
// texto ≥ 4,5:1 sobre su fondo; bordes de campos y anillo de foco ≥ 3:1 (criterio 1.4.11).
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function parseBlock(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

const [lightBlock = '', darkBlock = ''] = css.split('@media (prefers-color-scheme: dark)');
const themes = { claro: parseBlock(lightBlock), oscuro: parseBlock(darkBlock) };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: Array<[string, string]> = [
  ['background', 'foreground'],
  ['background', 'muted-foreground'],
  ['surface', 'surface-foreground'],
  ['surface', 'muted-foreground'],
  ['popover', 'popover-foreground'],
  ['muted', 'muted-foreground'],
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['accent', 'accent-foreground'],
  ['destructive', 'destructive-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
  ['background', 'destructive'],
];

const UI_PAIRS: Array<[string, string]> = [
  ['background', 'input'],
  ['surface', 'input'],
  ['background', 'ring'],
  ['surface', 'ring'],
];

describe.each(Object.entries(themes))('tema %s', (_name, tokens) => {
  it('define todos los tokens de color', () => {
    for (const name of new Set([...TEXT_PAIRS, ...UI_PAIRS].flat())) {
      expect(tokens[name], `falta --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TEXT_PAIRS)('texto %s / %s ≥ 4,5:1', (bg, fg) => {
    expect(contrast(tokens[bg] ?? '', tokens[fg] ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('componente %s / %s ≥ 3:1', (bg, fg) => {
    expect(contrast(tokens[bg] ?? '', tokens[fg] ?? '')).toBeGreaterThanOrEqual(3);
  });
});
