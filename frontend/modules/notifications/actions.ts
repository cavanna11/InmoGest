'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';

// Notificaciones internas (F-23). RLS: cada persona solo ve y marca las suyas.

export async function markReadAction(formData: FormData): Promise<void> {
  const { active } = await resolveActiveOrganization();
  const id = z.uuid().safeParse(formData.get('id'));
  if (!active || !id.success) return;
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('organization_id', active.id).eq('id', id.data);
  const link = formData.get('link');
  revalidatePath('/panel', 'layout');
  if (typeof link === 'string' && link.startsWith('/panel/')) redirect(link);
}

export async function markAllReadAction(): Promise<void> {
  const { active } = await resolveActiveOrganization();
  if (!active) return;
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('organization_id', active.id).is('read_at', null);
  revalidatePath('/panel', 'layout');
}
