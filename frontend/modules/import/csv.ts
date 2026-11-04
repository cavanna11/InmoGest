// CSV sin dependencias: lectura según RFC 4180 (comillas, saltos de línea dentro de comillas) y
// separador "," o ";" (Excel en español usa ";"). Escritura con protección contra inyección de
// fórmulas al abrir el archivo en una planilla.

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

/** Filas como objetos según el encabezado (claves en minúsculas, sin acentos ni espacios). */
export function rowsToObjects(rows: string[][]): Array<{ line: number; values: Record<string, string> }> {
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map(normalizeHeader);
  return body.map((row, index) => ({
    // Línea del archivo (1 es el encabezado), para que el error se pueda ubicar en la planilla.
    line: index + 2,
    values: Object.fromEntries(keys.map((key, column) => [key, (row[column] ?? '').trim()])),
  }));
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function escapeCell(value: string): string {
  // Una celda que empieza con = + - @ se ejecutaría como fórmula al abrirla en una planilla. Un
  // número (teléfono +549…, monto negativo) no es una fórmula: queda igual para poder reimportarlo.
  const safe = /^[=+\-@\t\r]/.test(value) && !/^[+-]?[\d\s.,]+$/.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** CSV con BOM (para que Excel respete los acentos) y separador ";" (Excel en español). */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const body = rows.map((row) => row.map((value) => escapeCell(value === null || value === undefined ? '' : String(value))).join(';')).join('\r\n');
  return `﻿${body}\r\n`;
}
