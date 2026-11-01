/**
 * Slugs para URLs públicas (ADR 0008). Mismo formato que valida la base:
 * ^[a-z0-9]+(-[a-z0-9]+)*$, máximo 60 caracteres.
 * La unicidad (incluidos los slugs históricos reservados) la garantiza la base.
 */
export const SLUG_MAX_LENGTH = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Inmobiliaria Peña & Asociados" → "inmobiliaria-pena-asociados". Nunca devuelve vacío. */
export function slugify(text: string, fallback = 'inmobiliaria'): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug === '' ? fallback : slug;
}

export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}
