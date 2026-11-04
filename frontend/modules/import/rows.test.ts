import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_ROWS, TEMPLATE_EXAMPLES, TEMPLATE_HEADERS, validateContactRow, validateFile, validatePropertyRow } from './rows.ts';

const line = (cells: string[]) => cells.join(';');

describe('plantillas', () => {
  it('la fila de ejemplo de cada plantilla es válida', () => {
    const contactos = validateFile('contactos', `${line(TEMPLATE_HEADERS.contactos)}\n${line(TEMPLATE_EXAMPLES.contactos)}\n`);
    expect(contactos.rows[0]?.ok).toBe(true);
    const propiedades = validateFile('propiedades', `${line(TEMPLATE_HEADERS.propiedades)}\n${line(TEMPLATE_EXAMPLES.propiedades)}\n`);
    expect(propiedades.rows[0]?.ok).toBe(true);
  });
});

describe('validateContactRow', () => {
  it('normaliza el teléfono y entiende el tipo', () => {
    const result = validateContactRow({ nombre: 'Jorge', telefono: '11 5555-0123', tipo: 'Propietario' });
    expect(result.ok && result.data.phones).toEqual(['+5491155550123']);
    expect(result.ok && result.data.isOwner).toBe(true);
    expect(result.ok && result.data.isProspect).toBe(false);
  });

  it('exige nombre y al menos un medio de contacto', () => {
    expect(validateContactRow({ nombre: '', telefono: '11 5555-0123' }).ok).toBe(false);
    expect(validateContactRow({ nombre: 'Sin datos' }).ok).toBe(false);
  });

  it('explica un teléfono inválido', () => {
    const result = validateContactRow({ nombre: 'X', telefono: '123' });
    expect(!result.ok && result.error).toContain('teléfono');
  });
});

describe('validatePropertyRow', () => {
  const base = { titulo: 'Casa', operacion: 'Venta', tipo: 'Casa', estado: '', precio: '', moneda: '' };

  it('sin estado queda en borrador', () => {
    const result = validatePropertyRow(base);
    expect(result.ok && result.data.status).toBe('draft');
  });

  it('para publicar exige precio, como la carga manual', () => {
    expect(validatePropertyRow({ ...base, estado: 'disponible' }).ok).toBe(false);
    const ok = validatePropertyRow({ ...base, estado: 'disponible', precio: '100.000', moneda: 'usd' });
    expect(ok.ok && ok.data.price).toBe(100000);
  });

  it('rechaza opciones fuera de la lista', () => {
    expect(validatePropertyRow({ ...base, operacion: 'permuta' }).ok).toBe(false);
    expect(validatePropertyRow({ ...base, tipo: 'castillo' }).ok).toBe(false);
    expect(validatePropertyRow({ ...base, caracteristicas: 'Helipuerto' }).ok).toBe(false);
  });

  it('traduce las características a sus claves', () => {
    const result = validatePropertyRow({ ...base, caracteristicas: 'Balcón|Apto crédito' });
    expect(result.ok && result.data.features).toEqual(['balcony', 'credit']);
  });
});

describe('validateFile', () => {
  it('informa la línea de cada error y sigue con el resto', () => {
    const { rows } = validateFile('contactos', 'nombre;telefono\nAna;11 5555-0188\n;11 5555-0199\n');
    expect(rows.map((row) => [row.line, row.ok])).toEqual([[2, true], [3, false]]);
  });

  it('un teléfono repetido dentro del archivo es un error de esa fila', () => {
    const { rows } = validateFile('contactos', 'nombre;telefono\nAna;11 5555-0188\nAna bis;1155550188\n');
    expect(rows[1]?.ok).toBe(false);
  });

  it('detecta un encabezado equivocado y el límite de filas', () => {
    expect(validateFile('contactos', 'a;b\n1;2\n').badHeader).toBe(true);
    const many = `nombre\n${'x\n'.repeat(MAX_IMPORT_ROWS + 1)}`;
    expect(validateFile('contactos', many).tooMany).toBe(true);
  });
});
