import 'server-only';
import { createClient } from '@/lib/supabase/server.ts';

export async function listNotifications(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function syncReminders(organizationId: string) {
  const supabase = await createClient();
  await supabase.rpc('sync_my_reminders', { p_organization_id: organizationId });
}

export async function countUnread(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('read_at', null);
  return count ?? 0;
}
