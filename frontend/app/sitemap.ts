import type { MetadataRoute } from 'next';
import { isIndexable, siteUrl } from '@/lib/site.ts';

// sitemap.xml: solo páginas públicas con valor comercial. Hoy, la landing. Las páginas públicas de
// propiedades (incremento 1.3) se agregan cuando existan. Vacío mientras el sitio no sea indexable.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  if (!isIndexable() || !base) return [];
  return [{ url: new URL('/', base).toString(), changeFrequency: 'weekly', priority: 1 }];
}
