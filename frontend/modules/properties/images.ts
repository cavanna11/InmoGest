import { readPublicEnv } from '@/lib/env.ts';

// Fotos de propiedades: bucket público "property-images", rutas "<organization_id>/<property_id>/<archivo>".

export const IMAGES_BUCKET = 'property-images';
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 30;

/** URL pública de una foto, armada con la URL del proyecto (sin pedidos). */
export function publicImageUrl(path: string): string {
  const env = readPublicEnv();
  if (!env) return '';
  return `${env.supabaseUrl}/storage/v1/object/public/${IMAGES_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
