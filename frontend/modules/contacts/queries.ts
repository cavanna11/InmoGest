import 'server-only';
import { toE164 } from '@inmogest/shared';
import { createClient } from '@/lib/supabase/server.ts';

// Lecturas de contactos (F-06, F-07, F-22, F-34). Todas filtran por la inmobiliaria activa; además
// RLS garantiza el aislamiento en la base.

export const PAGE_SIZE = 50;

export type ContactFilters = {
  q?: string | undefined;
  /** 'mine' | 'unassigned' | id de un miembro | undefined (todos) */
  assigned?: string | undefined;
  /** 'prospect' | 'owner' | 'dnc' | undefined */
  kind?: string | undefined;
  page?: number | undefined;
};

/** Escapa los comodines de LIKE en lo que escribe el usuario. */
function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listContacts(organizationId: string, userId: string, filters: ContactFilters) {
  const supabase = await createClient();
  const q = filters.q?.trim() ?? '';
  const phone = /\d{6,}/.test(q.replace(/\D/g, '')) && !/[a-z@]/i.test(q) ? (toE164(q) ?? q.replace(/\D/g, '')) : null;
  const byEmail = q.includes('@');

  const select = [
    'id, full_name, is_prospect, is_owner, do_not_contact, assigned_user_id, updated_at, source',
    phone ? 'contact_phones!inner(phone_e164)' : 'contact_phones(phone_e164)',
    byEmail ? 'contact_emails!inner(email)' : 'contact_emails(email)',
  ].join(', ');

  let query = supabase
    .from('contacts')
    .select(select, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('merged_into_id', null);

  if (phone) query = query.like('contact_phones.phone_e164', likeTerm(phone.replace(/^\+/, '')));
  else if (byEmail) query = query.ilike('contact_emails.email', likeTerm(q));
  else if (q) query = query.ilike('full_name', likeTerm(q));

  if (filters.assigned === 'mine') query = query.eq('assigned_user_id', userId);
  else if (filters.assigned === 'unassigned') query = query.is('assigned_user_id', null);
  else if (filters.assigned) query = query.eq('assigned_user_id', filters.assigned);

  if (filters.kind === 'prospect') query = query.eq('is_prospect', true);
  else if (filters.kind === 'owner') query = query.eq('is_owner', true);
  else if (filters.kind === 'dnc') query = query.eq('do_not_contact', true);

  const page = Math.max(1, filters.page ?? 1);
  const { data, count } = await query
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  type Row = {
    id: string;
    full_name: string;
    is_prospect: boolean;
    is_owner: boolean;
    do_not_contact: boolean;
    assigned_user_id: string | null;
    updated_at: string;
    source: string;
    contact_phones: Array<{ phone_e164: string }>;
    contact_emails: Array<{ email: string }>;
  };
  return { contacts: (data ?? []) as unknown as Row[], total: count ?? 0, page };
}

export async function getContact(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select(
      'id, full_name, notes, source, is_prospect, is_owner, do_not_contact, do_not_contact_at, assigned_user_id, merged_into_id, created_at, updated_at, contact_phones(id, phone_e164, label, is_whatsapp), contact_emails(id, email, label)',
    )
    .eq('organization_id', organizationId)
    .eq('id', contactId)
    .maybeSingle();
  return data;
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContact>>>;

export async function getActivities(organizationId: string, contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('activities')
    .select('id, kind, body, metadata, author_id, created_at')
    .eq('organization_id', organizationId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

/** Miembros activos, para asignar y para mostrar nombres (autor, asignado). */
export async function getActiveMembers(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('organization_members', { p_organization_id: organizationId });
  return (data ?? [])
    .filter((member) => member.status === 'active')
    .map((member) => ({ userId: member.user_id, name: member.full_name || member.email || 'Sin nombre' }));
}

/** Contactos con nombre parecido, candidatos a reportar como duplicado (nunca se unifican solos). */
export async function getSimilarContacts(organizationId: string, contactId: string, fullName: string) {
  const firstWord = fullName.trim().split(/\s+/)[0] ?? '';
  if (firstWord.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name')
    .eq('organization_id', organizationId)
    .is('merged_into_id', null)
    .neq('id', contactId)
    .ilike('full_name', likeTerm(firstWord))
    .order('full_name')
    .limit(10);
  return data ?? [];
}

export async function getOpenDuplicateReports(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('duplicate_reports')
    .select(
      'id, reason, created_at, reported_by, a:contacts!duplicate_reports_organization_id_contact_a_id_fkey(id, full_name, created_at, contact_phones(phone_e164), contact_emails(email)), b:contacts!duplicate_reports_organization_id_contact_b_id_fkey(id, full_name, created_at, contact_phones(phone_e164), contact_emails(email))',
    )
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function countOpenDuplicateReports(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('duplicate_reports')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'open');
  return count ?? 0;
}
