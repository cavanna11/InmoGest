import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';

export async function getOrganizationDetails(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_path, contact_email, contact_phone, default_currency, agents_can_reassign, trial_ends_at, paid_until')
    .eq('id', organizationId)
    .maybeSingle();
  return data;
}

/** URL pública del logo (bucket público "logos"). */
export async function logoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
}

export type OnboardingStep = 'organization' | 'team' | 'whatsapp' | 'data';

export async function getOnboardingProgress(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('onboarding_progress')
    .select('step, completed_at, skipped_at')
    .eq('organization_id', organizationId);
  const byStep = new Map((data ?? []).map((row) => [row.step as OnboardingStep, row]));
  return byStep;
}

export async function getTeam(organizationId: string) {
  const supabase = await createClient();
  const [members, invitations] = await Promise.all([
    supabase.rpc('organization_members', { p_organization_id: organizationId }),
    supabase
      .from('invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ]);
  return { members: members.data ?? [], invitations: invitations.data ?? [] };
}

export async function getOwnProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).maybeSingle();
  return data;
}
