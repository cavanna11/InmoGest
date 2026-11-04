import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';

// Lecturas de búsquedas, embudo y coincidencias (F-11, F-12, F-13).

export const PAGE_SIZE = 50;

export async function getStages(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pipeline_stages')
    .select('id, name, position, kind, is_active')
    .eq('organization_id', organizationId)
    .order('position');
  return data ?? [];
}

const SEARCH_LIST =
  'id, contact_id, stage_id, operation, property_types, budget_min, budget_max, currency, assigned_user_id, updated_at, contacts(id, full_name), client_search_locations(name), match_results(id, status, stale)';

export async function listSearches(
  organizationId: string,
  userId: string,
  filters: { stage?: string | undefined; assigned?: string | undefined; contactId?: string | undefined; page?: number | undefined },
) {
  const supabase = await createClient();
  let query = supabase.from('client_searches').select(SEARCH_LIST, { count: 'exact' }).eq('organization_id', organizationId);
  if (filters.stage) query = query.eq('stage_id', filters.stage);
  if (filters.contactId) query = query.eq('contact_id', filters.contactId);
  if (filters.assigned === 'mine') query = query.eq('assigned_user_id', userId);
  else if (filters.assigned === 'unassigned') query = query.is('assigned_user_id', null);
  const page = Math.max(1, filters.page ?? 1);
  const { data, count } = await query.order('updated_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return { searches: data ?? [], total: count ?? 0, page };
}

/** Búsquedas para el tablero (hasta 500: alcanza para el tamaño de una inmobiliaria). */
export async function boardSearches(organizationId: string, userId: string, onlyMine: boolean) {
  const supabase = await createClient();
  let query = supabase.from('client_searches').select(SEARCH_LIST).eq('organization_id', organizationId);
  if (onlyMine) query = query.eq('assigned_user_id', userId);
  const { data } = await query.order('updated_at', { ascending: false }).limit(500);
  return data ?? [];
}

export async function getSearch(organizationId: string, searchId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_searches')
    .select('*, contacts(id, full_name), client_search_locations(name)')
    .eq('organization_id', organizationId)
    .eq('id', searchId)
    .maybeSingle();
  return data;
}

export async function getSearchMatches(organizationId: string, searchId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('match_results')
    .select(
      'id, score, desired_met, desired_total, missing_features, over_budget, exchange_rate, status, stale, created_at, properties!match_results_organization_id_property_id_fkey(id, code, title, price, currency, status, neighborhood, city, slug, property_images(storage_path, position))',
    )
    .eq('organization_id', organizationId)
    .eq('search_id', searchId)
    .order('stale')
    .order('score', { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getPropertyMatches(organizationId: string, propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('match_results')
    .select('id, score, over_budget, status, stale, search_id, client_searches!match_results_organization_id_search_id_fkey(id, contacts(full_name))')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId)
    .eq('stale', false)
    .order('score', { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function getStageHistory(organizationId: string, searchId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stage_changes')
    .select('id, from_stage_id, to_stage_id, author_id, created_at')
    .eq('organization_id', organizationId)
    .eq('search_id', searchId)
    .order('created_at', { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function getPipelineMetrics(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('pipeline_metrics', { p_organization_id: organizationId });
  return data ?? [];
}

export async function findContact(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name')
    .eq('organization_id', organizationId)
    .eq('id', contactId)
    .is('merged_into_id', null)
    .maybeSingle();
  return data;
}
