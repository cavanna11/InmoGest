import 'server-only';
import { redirect } from 'next/navigation';
import { readPublicEnv } from './env.ts';
import { createClient } from './supabase/server.ts';

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  emailConfirmed: boolean;
  metadata: Record<string, unknown>;
};

/**
 * Usuario de la sesión, validado contra Supabase Auth con getUser() (nunca solo la cookie,
 * docs/SECURITY.md). null si no hay sesión o falta configuración.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!readPublicEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    fullName: typeof metadata.full_name === 'string' ? metadata.full_name : '',
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    metadata,
  };
}

/** Exige sesión; si no hay, manda a ingresar y vuelve a `next` después. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}
