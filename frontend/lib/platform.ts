import 'server-only';
import { cache } from 'react';
import { getCurrentUser } from './auth.ts';
import { createClient } from './supabase/server.ts';

/**
 * Rol de plataforma del usuario de la sesión. La pantalla lo usa para mostrar el panel de C&C; quien
 * decide de verdad es la base (RLS y RPC con app.is_platform_admin / app.is_principal).
 */
export const getPlatformRole = cache(async (): Promise<{ isAdmin: boolean; isPrincipal: boolean }> => {
  const user = await getCurrentUser();
  if (!user) return { isAdmin: false, isPrincipal: false };
  const supabase = await createClient();
  const { data } = await supabase.from('platform_admins').select('is_principal').eq('user_id', user.id).maybeSingle();
  return { isAdmin: Boolean(data), isPrincipal: Boolean(data?.is_principal) };
});
