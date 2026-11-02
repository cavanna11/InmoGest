import type { MetadataRoute } from 'next';
import { isIndexable, PRIVATE_PATHS, siteUrl } from '@/lib/site.ts';

// robots.txt: mientras el sitio no sea indexable (dominio definitivo sin configurar) se bloquea todo,
// para no indexar dominios temporales. Siempre se excluyen las rutas privadas y de autenticación.
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  const base = siteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    ...(base ? { sitemap: new URL('/sitemap.xml', base).toString(), host: base.origin } : {}),
  };
}
