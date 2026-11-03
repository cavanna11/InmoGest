import 'server-only';
import type { Database } from '@inmogest/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, type CurrentUser } from './auth.ts';
import { createClient } from './supabase/server.ts';

/**
 * Inmobiliaria activa (docs/SECURITY.md, Tenancy): se recuerda en una cookie, pero SE VALIDA en cada
 * pedido contra las membresías del usuario (my_organizations) o su sesión de soporte. Nunca se confía
 * en un organization_id que venga del cliente; igual, la base lo vuelve a verificar con RLS.
 */
export const ACTIVE_ORG_COOKIE = 'inmopanel_org';

type AccountState = Database['public']['Enums']['account_state'];
type MemberRole = Database['public']['Enums']['member_role'];

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  state: AccountState;
};

export type ActiveOrganization = OrganizationSummary & {
  /** El superadministrador principal opera con «Ingresar como» (ADR 0003). */
  viaSupport: boolean;
  isOwner: boolean;
  canWrite: boolean;
};

export async function listMyOrganizations(): Promise<OrganizationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_organizations');
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.organization_id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    state: row.state,
  }));
}

async function supportOrganization(): Promise<OrganizationSummary | null> {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc('current_support_organization');
  if (!orgId) return null;
  const { data } = await supabase.from('organizations').select('id, name, slug').eq('id', orgId).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, slug: data.slug, role: 'owner', state: 'active' };
}

function toActive(org: OrganizationSummary, viaSupport: boolean): ActiveOrganization {
  return {
    ...org,
    viaSupport,
    isOwner: viaSupport || org.role === 'owner',
    // La sesión de soporte ignora el estado de la cuenta (ADR 0003).
    canWrite: viaSupport || org.state === 'trial' || org.state === 'active',
  };
}

/** Resuelve la inmobiliaria activa validada, o null si el usuario no tiene ninguna elegible. */
export async function resolveActiveOrganization(): Promise<{
  active: ActiveOrganization | null;
  organizations: OrganizationSummary[];
}> {
  const support = await supportOrganization();
  if (support) return { active: toActive(support, true), organizations: [support] };

  const organizations = await listMyOrganizations();
  const cookieOrg = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const fromCookie = organizations.find((org) => org.id === cookieOrg);
  if (fromCookie) return { active: toActive(fromCookie, false), organizations };
  if (organizations.length === 1 && organizations[0]) {
    return { active: toActive(organizations[0], false), organizations };
  }
  return { active: null, organizations };
}

/**
 * Exige usuario e inmobiliaria activa. Sin inmobiliarias → crear una; con varias y ninguna elegida →
 * selector.
 */
export async function requireActiveOrganization(
  next: string,
): Promise<{ user: CurrentUser; organization: ActiveOrganization; organizations: OrganizationSummary[] }> {
  const user = await requireUser(next);
  const { active, organizations } = await resolveActiveOrganization();
  if (!active) {
    redirect(organizations.length === 0 ? '/crear-inmobiliaria' : '/seleccionar-inmobiliaria');
  }
  return { user, organization: active, organizations };
}

/** Guarda la inmobiliaria activa (solo desde Server Actions o Route Handlers). */
export async function setActiveOrganizationCookie(organizationId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveOrganizationCookie() {
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
}
