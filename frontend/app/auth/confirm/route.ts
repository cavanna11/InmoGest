import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { readPublicEnv } from '@/lib/env.ts';
import { safeNext } from '@/lib/safe-redirect.ts';
import { createClient } from '@/lib/supabase/server.ts';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Destino de los enlaces de Supabase Auth (confirmación de email y recuperación de contraseña).
 * Acepta las dos formas: `code` (PKCE, plantillas por defecto) y `token_hash` + `type` (plantillas
 * que apuntan directo acá, recomendadas para producción: funcionan aunque el email se abra en otro
 * navegador). Los parámetros son credenciales temporales: no se registran en logs.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const failure = NextResponse.redirect(new URL('/ingresar?error=enlace', url.origin));
  if (!readPublicEnv()) return failure;

  const supabase = await createClient();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  if (!ok) return failure;

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
