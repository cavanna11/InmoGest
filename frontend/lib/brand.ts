/**
 * Identidad del producto (docs/BRAND.md). Único lugar de la app con el nombre y los mensajes de marca:
 * las pantallas los importan en lugar de escribirlos a mano.
 * InmoPanel es la marca protagonista; "by C&C" es el respaldo y se muestra en segundo plano.
 */
export const brand = {
  product: 'InmoPanel',
  company: 'C&C',
  fullName: 'InmoPanel by C&C',
  descriptor: 'Gestión inmobiliaria inteligente',
  tagline: 'Todo tu negocio inmobiliario, en un solo lugar.',
} as const;
