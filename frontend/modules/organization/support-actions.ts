'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server.ts';
import { clearActiveOrganizationCookie } from '@/lib/tenant.ts';

/** Sale del contexto de «Ingresar como» (ADR 0003) y vuelve al panel de C&C. */
export async function endSupportSessionAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('end_support_session');
  await clearActiveOrganizationCookie();
  redirect('/plataforma');
}
