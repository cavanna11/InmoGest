import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@inmogest/shared';
import { requirePublicEnv } from '../env.ts';

/** Cliente de Supabase para Client Components. Usa solo la clave publicable: todo pasa por RLS. */
export function createClient() {
  const env = requirePublicEnv();
  return createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey);
}
