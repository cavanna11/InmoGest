/**
 * Valida un destino de redirección recibido por parámetro (`next`). Solo rutas internas: evita
 * redirecciones abiertas a otros sitios (ej. "//evil.test" o "https://evil.test").
 */
export function safeNext(value: unknown, fallback = '/panel'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
