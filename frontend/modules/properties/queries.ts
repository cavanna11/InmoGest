import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';
import type { PropertyOperation, PropertyStatus, PropertyType } from './labels.ts';

// Lecturas de propiedades (F-08, F-09). Filtran por la inmobiliaria activa; RLS aísla en la base.

export const PAGE_SIZE = 30;

export type PropertyFilters = {
  q?: string | undefined;
  status?: string | undefined;
  operation?: string | undefined;
  type?: string | undefined;
  assigned?: string | undefined;
  page?: number | undefined;
};

function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listProperties(organizationId: string, userId: string, filters: PropertyFilters) {
  const supabase = await createClient();
  let query = supabase
    .from('properties')
    .select(
      'id, code, title, operation, property_type, status, price, currency, city, neighborhood, rooms, assigned_user_id, updated_at, property_images(storage_path, position)',
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .is('merged_into_id', null);

  // Sin comas ni paréntesis: son la sintaxis del filtro "or" de PostgREST.
  const q = filters.q?.trim().replace(/[,()]/g, ' ');
  if (q) {
    const code = /^(pro-?)?0*(\d{1,6})$/i.exec(q);
    query = code
      ? query.eq('seq', Number(code[2]))
      : query.or(`title.ilike.${likeTerm(q)},neighborhood.ilike.${likeTerm(q)},city.ilike.${likeTerm(q)},address.ilike.${likeTerm(q)}`);
  }
  if (filters.status) query = query.eq('status', filters.status as PropertyStatus);
  if (filters.operation) query = query.eq('operation', filters.operation as PropertyOperation);
  if (filters.type) query = query.eq('property_type', filters.type as PropertyType);
  if (filters.assigned === 'mine') query = query.eq('assigned_user_id', userId);
  else if (filters.assigned === 'unassigned') query = query.is('assigned_user_id', null);

  const page = Math.max(1, filters.page ?? 1);
  const { data, count } = await query
    .order('updated_at', { ascending: false })
    .order('position', { referencedTable: 'property_images', ascending: true })
    .limit(1, { referencedTable: 'property_images' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return { properties: data ?? [], total: count ?? 0, page };
}

export async function getProperty(organizationId: string, propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('properties')
    .select(
      '*, property_images(id, storage_path, position), property_owners(contact_id, contacts(id, full_name))',
    )
    .eq('organization_id', organizationId)
    .eq('id', propertyId)
    .order('position', { referencedTable: 'property_images', ascending: true })
    .maybeSingle();
  return data;
}

export type PropertyDetail = NonNullable<Awaited<ReturnType<typeof getProperty>>>;

export async function getPropertyChanges(organizationId: string, propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('property_changes')
    .select('id, field, old_value, new_value, author_id, created_at')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getDuplicateCandidates(
  organizationId: string,
  property: { id?: string; address: string; operation: PropertyOperation; property_type: PropertyType },
  ownerIds: string[],
) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('property_duplicate_candidates', {
    p_organization_id: organizationId,
    p_address: property.address,
    p_operation: property.operation,
    p_property_type: property.property_type,
    p_owner_ids: ownerIds,
    ...(property.id ? { p_exclude_id: property.id } : {}),
  });
  return data ?? [];
}

/** Contactos para vincular como propietarios (búsqueda por nombre). */
export async function searchContacts(organizationId: string, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, is_owner')
    .eq('organization_id', organizationId)
    .is('merged_into_id', null)
    .ilike('full_name', likeTerm(term))
    .order('full_name')
    .limit(8);
  return data ?? [];
}

export async function organizationSlug(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('organizations').select('slug').eq('id', organizationId).maybeSingle();
  return data?.slug ?? null;
}
