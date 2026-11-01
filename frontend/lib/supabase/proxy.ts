import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { readPublicEnv } from '../env.ts';

/**
 * Refresca la sesión de Supabase en cada pedido y reescribe las cookies en la respuesta.
 * No decide permisos: la autorización real está en la base (RLS) y en cada Server Action.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readPublicEnv();
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));
  if (!env || !hasAuthCookie) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Las respuestas que escriben cookies de sesión no se deben cachear.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getUser() valida el token contra Supabase Auth y lo renueva si venció.
  await supabase.auth.getUser();
  return response;
}
