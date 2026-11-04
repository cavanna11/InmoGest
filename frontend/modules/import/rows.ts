import { newContactSchema } from '../contacts/schemas.ts';
import { FEATURES, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from '../properties/labels.ts';
import { propertySchema, toPropertyRow } from '../properties/schemas.ts';
import { normalizeHeader, parseCsv, rowsToObjects } from './csv.ts';

// Validación fila por fila de la importación (CU-12): mismas reglas que la carga manual.

export const MAX_IMPORT_ROWS = 1000;

export type ImportKind = 'contactos' | 'propiedades';

export const TEMPLATE_HEADERS: Record<ImportKind, string[]> = {
  contactos: ['nombre', 'telefono', 'telefono2', 'email', 'email2', 'tipo', 'notas'],
  propiedades: [
    'titulo', 'operacion', 'tipo', 'estado', 'precio', 'moneda', 'expensas', 'provincia', 'localidad', 'barrio', 'direccion',
    'ambientes', 'dormitorios', 'banos', 'sup_cubierta', 'sup_total', 'caracteristicas', 'descripcion',
  ],
};

export const TEMPLATE_EXAMPLES: Record<ImportKind, string[]> = {
  contactos: ['Ana Gómez', '11 5555-0188', '', 'ana@ejemplo.com', '', 'interesado', 'Busca 3 ambientes'],
  propiedades: [
    'Departamento 3 ambientes', 'venta', 'departamento', 'disponible', '98.000', 'USD', '85.000', 'Buenos Aires', 'CABA', 'Belgrano',
    'Av. Cabildo 1234 4°B', '3', '2', '1', '65,5', '70', 'Balcón|Luminoso', 'Al frente, a 2 cuadras del subte.',
  ],
};

export type ContactRow = { fullName: string; phones: string[]; emails: string[]; notes: string; isProspect: boolean; isOwner: boolean };
export type PropertyRow = ReturnType<typeof toPropertyRow>;

export type RowResult<T> =
  | { line: number; ok: true; data: T; label: string }
  | { line: number; ok: false; error: string; values: Record<string, string> };

function byLabel<T extends string>(labels: Record<T, string>): Map<string, T> {
  return new Map((Object.entries(labels) as Array<[T, string]>).map(([key, label]) => [normalizeHeader(label), key]));
}

const OPERATIONS = byLabel(OPERATION_LABELS);
const TYPES = byLabel(TYPE_LABELS);
const STATUSES = byLabel(STATUS_LABELS);
const FEATURE_KEYS = byLabel(FEATURES);

export function validateContactRow(values: Record<string, string>): { ok: true; data: ContactRow } | { ok: false; error: string } {
  const kind = normalizeHeader(values.tipo ?? '');
  if (kind && !['interesado', 'interesada', 'propietario', 'propietaria', 'ambos'].includes(kind)) {
    return { ok: false, error: 'tipo: usá interesado, propietario o ambos.' };
  }
  const phones = [values.telefono, values.telefono2, values.telefono_2].filter((value): value is string => Boolean(value));
  const emails = [values.email, values.email2, values.email_2].filter((value): value is string => Boolean(value));
  const parsed = newContactSchema.safeParse({
    fullName: values.nombre ?? '',
    phones,
    emails,
    notes: values.notas ?? '',
    isProspect: !kind || kind.startsWith('interesad') || kind === 'ambos' ? 'on' : undefined,
    isOwner: kind.startsWith('propietari') || kind === 'ambos' ? 'on' : undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Fila no válida.' };
  if (parsed.data.phones.length === 0 && parsed.data.emails.length === 0) {
    return { ok: false, error: 'Cargá al menos un teléfono o un email.' };
  }
  return { ok: true, data: parsed.data };
}

export function validatePropertyRow(values: Record<string, string>): { ok: true; data: PropertyRow } | { ok: false; error: string } {
  const operation = OPERATIONS.get(normalizeHeader(values.operacion ?? ''));
  if (!operation) return { ok: false, error: 'operacion: usá venta, alquiler o alquiler temporario.' };
  const propertyType = TYPES.get(normalizeHeader(values.tipo ?? ''));
  if (!propertyType) return { ok: false, error: `tipo: usá ${Object.values(TYPE_LABELS).join(', ').toLowerCase()}.` };
  const rawStatus = normalizeHeader(values.estado ?? '');
  const status = rawStatus ? STATUSES.get(rawStatus) : 'draft';
  if (!status) return { ok: false, error: `estado: usá ${Object.values(STATUS_LABELS).join(', ').toLowerCase()}.` };

  const features: string[] = [];
  for (const raw of (values.caracteristicas ?? '').split('|').map((value) => value.trim()).filter(Boolean)) {
    const key = FEATURE_KEYS.get(normalizeHeader(raw));
    if (!key) return { ok: false, error: `caracteristicas: "${raw}" no está en la lista.` };
    features.push(key);
  }

  const parsed = propertySchema.safeParse({
    title: values.titulo ?? '',
    description: values.descripcion ?? '',
    operation,
    propertyType,
    status,
    price: values.precio ?? '',
    currency: (values.moneda ?? '').toUpperCase() || 'USD',
    expenses: values.expensas ?? '',
    expensesCurrency: 'ARS',
    province: values.provincia ?? '',
    city: values.localidad ?? '',
    neighborhood: values.barrio ?? '',
    address: values.direccion ?? '',
    rooms: values.ambientes ?? '',
    bedrooms: values.dormitorios ?? '',
    bathrooms: values.banos ?? '',
    coveredArea: values.sup_cubierta ?? '',
    totalArea: values.sup_total ?? '',
    features,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Fila no válida.' };
  return { ok: true, data: toPropertyRow(parsed.data) };
}

/** Valida el archivo completo. Dentro del archivo, un teléfono o email repetido es un error de esa fila. */
export function validateFile(kind: 'contactos', text: string): { rows: Array<RowResult<ContactRow>>; tooMany: boolean; badHeader: boolean };
export function validateFile(kind: 'propiedades', text: string): { rows: Array<RowResult<PropertyRow>>; tooMany: boolean; badHeader: boolean };
export function validateFile(kind: ImportKind, text: string) {
  const objects = rowsToObjects(parseCsv(text));
  const required = kind === 'contactos' ? 'nombre' : 'titulo';
  if (objects.length > 0 && !(required in (objects[0]?.values ?? {}))) return { rows: [], tooMany: false, badHeader: true };
  if (objects.length > MAX_IMPORT_ROWS) return { rows: [], tooMany: true, badHeader: false };

  const seen = new Set<string>();
  const rows = objects.map(({ line, values }) => {
    if (kind === 'propiedades') {
      const result = validatePropertyRow(values);
      return result.ok
        ? { line, ok: true as const, data: result.data, label: result.data.title }
        : { line, ok: false as const, error: result.error, values };
    }
    const result = validateContactRow(values);
    if (!result.ok) return { line, ok: false as const, error: result.error, values };
    const keys = [...result.data.phones, ...result.data.emails];
    const repeated = keys.find((key) => seen.has(key));
    if (repeated) return { line, ok: false as const, error: `${repeated} ya aparece en otra fila del archivo.`, values };
    for (const key of keys) seen.add(key);
    return { line, ok: true as const, data: result.data, label: result.data.fullName };
  });
  return { rows, tooMany: false, badHeader: false };
}
