import 'server-only';
import type { Database } from '@inmogest/shared';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireServerEnv } from '../env.server.ts';

/**
 * Cliente con la clave SECRETA: saltea RLS. Solo para webhooks y acciones del servidor que lo
 * requieran explícitamente (docs/ARCHITECTURE.md). Toda consulta debe filtrar por organization_id
 * derivado de un dato confiable. Nunca importarlo desde un Client Component.
 */
export function createAdminClient() {
  const env = requireServerEnv();
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
