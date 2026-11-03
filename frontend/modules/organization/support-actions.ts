'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server.ts';
import { clearActiveOrganizationCookie } from '@/lib/tenant.ts';

/** Sale del contexto de «Ingresar como» (ADR 0003). El panel de C&C para entrar llega en el 1.8. */
export async function endSupportSessionAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('end_support_session');
  await clearActiveOrganizationCookie();
  redirect('/seleccionar-inmobiliaria');
}
