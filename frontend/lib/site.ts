/**
 * Configuración pública del sitio para SEO.
 * - URL canónica: NEXT_PUBLIC_APP_URL. El dominio previsto inmopanel.com.ar todavía no está comprado
 *   (docs/DEPLOYMENT.md, "Al comprar el dominio"); mientras tanto no se fija una URL inventada.
 * - Indexación: SOLO si NEXT_PUBLIC_SITE_INDEXABLE === 'true'. Se activa en producción cuando el
 *   dominio definitivo esté configurado, para no indexar dominios temporales de Vercel ni previews.
 */
export function siteUrl(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

export function isIndexable(): boolean {
  return process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true';
}

/** Rutas privadas o transaccionales que nunca se indexan. */
export const PRIVATE_PATHS = [
  '/panel',
  '/plataforma',
  '/ingresar',
  '/registro',
  '/recuperar',
  '/restablecer',
  '/crear-inmobiliaria',
  '/seleccionar-inmobiliaria',
  '/invitacion',
  '/auth',
  '/api',
];
