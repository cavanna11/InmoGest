// Reducción de fotos en el navegador antes de subirlas (ui-ux-pro-max §3, docs/ARCHITECTURE.md
// "imágenes optimizadas"). Una foto de celular de 4-5 MB queda en unos cientos de KB.
// JPEG y no WebP: las fotos también se mandan por WhatsApp (send_property_whatsapp las envía como
// image/jpeg) y WhatsApp no acepta WebP como foto.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.82;
/** Por debajo de esto, un JPEG que ya entra en MAX_SIDE se sube tal cual. */
const SMALL_ENOUGH_BYTES = 600 * 1024;

/** Medidas para que el lado mayor no pase de `max`, sin agrandar nunca. */
export function fitWithin(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Devuelve la foto lista para subir. Si el navegador no puede procesarla, devuelve la original
 * (que ya pasó la validación de tipo y tamaño), para no bloquear la carga.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; type: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = fitWithin(bitmap.width, bitmap.height);
    if (file.type === 'image/jpeg' && size.width === bitmap.width && file.size <= SMALL_ENOUGH_BYTES) {
      bitmap.close();
      return { blob: file, type: file.type };
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unavailable');
    // Fondo blanco: las transparencias de un PNG quedarían negras en JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('encode_failed');
    // Si por algún motivo pesa más que la original, se queda la original.
    return blob.size < file.size ? { blob, type: 'image/jpeg' } : { blob: file, type: file.type };
  } catch {
    return { blob: file, type: file.type };
  }
}
