// Textos de las opciones de propiedades (los valores son los de la base).

export const OPERATION_LABELS = {
  sale: 'Venta',
  rent: 'Alquiler',
  temporary_rent: 'Alquiler temporario',
} as const;

export const TYPE_LABELS = {
  apartment: 'Departamento',
  house: 'Casa',
  ph: 'PH',
  land: 'Terreno',
  office: 'Oficina',
  commercial: 'Local',
  garage: 'Cochera',
  warehouse: 'Galpón',
  farm: 'Quinta o campo',
} as const;

export const STATUS_LABELS = {
  draft: 'Borrador',
  available: 'Disponible',
  reserved: 'Reservada',
  sold: 'Vendida',
  rented: 'Alquilada',
  paused: 'Pausada',
} as const;

export type PropertyOperation = keyof typeof OPERATION_LABELS;
export type PropertyType = keyof typeof TYPE_LABELS;
export type PropertyStatus = keyof typeof STATUS_LABELS;

/** Tono de la etiqueta de cada estado. */
export const STATUS_TONES: Record<PropertyStatus, 'default' | 'success' | 'warning' | 'brand' | 'highlight'> = {
  draft: 'default',
  available: 'success',
  reserved: 'warning',
  sold: 'brand',
  rented: 'brand',
  paused: 'default',
};

/** Catálogo de características (se guardan las claves). */
export const FEATURES = {
  garage: 'Cochera',
  balcony: 'Balcón',
  terrace: 'Terraza',
  garden: 'Jardín',
  pool: 'Pileta',
  grill: 'Parrilla',
  laundry: 'Lavadero',
  storage: 'Baulera',
  elevator: 'Ascensor',
  doorman: 'Portería',
  security: 'Seguridad 24 h',
  gym: 'Gimnasio',
  sum: 'SUM',
  air_conditioning: 'Aire acondicionado',
  heating: 'Calefacción',
  furnished: 'Amoblado',
  pets: 'Apto mascotas',
  credit: 'Apto crédito',
  professional: 'Apto profesional',
  bright: 'Luminoso',
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeature(value: string): value is FeatureKey {
  return Object.hasOwn(FEATURES, value);
}
