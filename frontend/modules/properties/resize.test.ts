import { describe, expect, it } from 'vitest';
import { fitWithin, prepareImage } from './resize.ts';

describe('fitWithin', () => {
  it('no agranda fotos chicas', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('reduce por el lado mayor manteniendo la proporción', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('respeta un máximo explícito', () => {
    expect(fitWithin(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });
});

describe('prepareImage', () => {
  it('si el navegador no puede procesarla, devuelve la original', async () => {
    // En Node no existe createImageBitmap: cae en el respaldo.
    const file = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });
    const result = await prepareImage(file);
    expect(result.blob).toBe(file);
    expect(result.type).toBe('image/png');
  });
});
