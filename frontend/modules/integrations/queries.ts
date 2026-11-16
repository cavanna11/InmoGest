import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';
import type { ListingChannel, ListingSyncStatus } from './labels.ts';

// Lecturas con la sesión: RLS limita a la inmobiliaria activa.

export type PropertyListing = {
  id: string;
  channel: ListingChannel;
  url: string | null;
  managed: boolean;
  external_id: string | null;
  sync_status: ListingSyncStatus;
  last_error: string | null;
  settings: unknown;
  synced_at: string | null;
};

export async function getPropertyListings(organizationId: string, propertyId: string): Promise<PropertyListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('property_listings')
    .select('id, channel, url, managed, external_id, sync_status, last_error, settings, synced_at')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId);
  return (data ?? []) as PropertyListing[];
}

export async function getMercadoLibreConnection(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('mercadolibre_connections')
    .select('id, ml_user_id, nickname, status, connected_at')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data;
}

export async function getApiTokens(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('api_tokens')
    .select('id, name, token_prefix, created_at, last_used_at')
    .eq('organization_id', organizationId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  return data ?? [];
}
