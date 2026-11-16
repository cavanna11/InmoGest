export type ListingChannel = 'website' | 'mercadolibre' | 'zonaprop' | 'argenprop';
export type ListingSyncStatus = 'manual' | 'publishing' | 'active' | 'paused' | 'closed' | 'error';

export const CHANNELS: ListingChannel[] = ['website', 'mercadolibre', 'zonaprop', 'argenprop'];

export const CHANNEL_LABELS: Record<ListingChannel, string> = {
  website: 'Web de la inmobiliaria',
  mercadolibre: 'Mercado Libre',
  zonaprop: 'Zonaprop',
  argenprop: 'Argenprop',
};

export const SYNC_LABELS: Record<ListingSyncStatus, string> = {
  manual: 'Link cargado a mano',
  publishing: 'Publicando…',
  active: 'Activa',
  paused: 'Pausada',
  closed: 'Finalizada',
  error: 'Con error',
};

export const SYNC_TONES: Record<ListingSyncStatus, 'default' | 'success' | 'warning' | 'destructive' | 'brand'> = {
  manual: 'default',
  publishing: 'brand',
  active: 'success',
  paused: 'warning',
  closed: 'default',
  error: 'destructive',
};
