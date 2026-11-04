import { describe, expect, it } from 'vitest';
import { normalizeHeader, parseCsv, rowsToObjects, toCsv } from './csv.ts';

describe('parseCsv', () => {
  it('lee comillas, comas y saltos de línea dentro de una celda', () => {
    expect(parseCsv('a,b\n"x, y","línea 1\nlínea 2"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'línea 1\nlínea 2'],
    ]);
  });

  it('detecta el separador ; de Excel en español y quita el BOM', () => {
    expect(parseCsv('﻿a;b\r\n1,5;2\r\n')).toEqual([
      ['a', 'b'],
      ['1,5', '2'],
    ]);
  });

  it('ignora filas vacías y comillas dobles escapadas', () => {
    expect(parseCsv('a\n\n"di""jo"\n , \n')).toEqual([['a'], ['di"jo']]);
  });
});

describe('rowsToObjects', () => {
  it('normaliza encabezados e informa la línea del archivo', () => {
    expect(rowsToObjects([['Teléfono 2', 'Baños'], ['11', '2']])).toEqual([{ line: 2, values: { telefono_2: '11', banos: '2' } }]);
  });

  it('normalizeHeader quita acentos y símbolos', () => {
    expect(normalizeHeader(' Sup. Cubierta (m²) ')).toBe('sup_cubierta_m');
  });
});

describe('toCsv', () => {
  it('deja los teléfonos tal cual', () => {
    expect(toCsv([['+5491155550188']])).toBe('\uFEFF+5491155550188\r\n');
  });

  it('neutraliza fórmulas y escapa separadores', () => {
    expect(toCsv([['=HYPERLINK("x")', 'a;b', null, 5]])).toBe('﻿"\'=HYPERLINK(""x"")";"a;b";;5\r\n');
  });
});
