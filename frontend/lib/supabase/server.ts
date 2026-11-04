import 'server-only';
import type { Database } from '@inmogest/shared';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { requirePublicEnv } from '../env.ts';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers, con la sesión del
 * usuario (RLS activa). Crear uno por pedido; nunca compartirlo.
 * Para validar la identidad usar supabase.auth.getUser(), nunca solo la cookie (docs/SECURITY.md).
 */
export async function createClient() {
  // Siempre por pedido: la sesión de Supabase lee la hora (Date.now) y con cacheComponents eso no
  // puede quedar en un prerender. Va primero: sin variables de entorno, el build no debe fallar acá.
  await connection();
  const env = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; proxy.ts refresca la sesión.
        }
      },
    },
  });
}
