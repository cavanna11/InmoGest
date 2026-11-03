import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand.ts';

// Manifiesto web: nombre e íconos al guardar InmoPanel en la pantalla de inicio del celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.fullName,
    short_name: brand.product,
    description: `${brand.descriptor}. ${brand.tagline}`,
    lang: 'es-AR',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f9f8',
    theme_color: '#0a7468',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
