import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { connection, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth.ts';
import { appOrigin } from '@/lib/request.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { getMercadoLibre, ML_CALLBACK_PATH, ML_OAUTH_COOKIE } from '@/modules/mercadolibre/service.ts';

// Retorno del OAuth de Mercado Libre (ADR 0012). Solo se aceptan si coinciden el state de la cookie
// cifrada, el usuario de la sesión y la inmobiliaria activa, y si ese usuario sigue siendo el dueño.

const cookieSchema = z.object({
  state: z.string().min(16),
  verifier: z.string().min(43),
  organizationId: z.uuid(),
  userId: z.uuid(),
  exp: z.number(),
});

function logError(action: string, code?: string) {
  console.error(JSON.stringify({ level: 'error', component: 'web', action, code }));
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  // Siempre por pedido: sin esto, sin variables de Mercado Libre en el build quedaría prerenderizada.
  await connection();
  const origin = await appOrigin();
  const back = (result: string) => {
    const response = NextResponse.redirect(`${origin}/panel/integraciones?ml=${result}`);
    response.cookies.set(ML_OAUTH_COOKIE, '', { path: ML_CALLBACK_PATH, maxAge: 0 });
    return response;
  };

  const ml = await getMercadoLibre();
  if (!ml) return back('no_habilitado');

  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return back(params.get('error') ? 'cancelado' : 'error');

  const sealed = (await cookies()).get(ML_OAUTH_COOKIE)?.value;
  if (!sealed) return back('vencido');
  let stored: z.infer<typeof cookieSchema>;
  try {
    stored = cookieSchema.parse(JSON.parse(await ml.box.open(sealed)));
  } catch {
    return back('error');
  }
  if (stored.exp < Date.now()) return back('vencido');
  if (!sameText(stored.state, state)) return back('error');

  const [user, { active }] = await Promise.all([getCurrentUser(), resolveActiveOrganization()]);
  if (!user || user.id !== stored.userId || !active || active.id !== stored.organizationId || !active.isOwner || !active.canWrite) {
    return back('sin_permiso');
  }

  try {
    const tokens = await ml.client.exchangeCode({ code, codeVerifier: stored.verifier });
    const me = await ml.client.me(tokens.accessToken);
    const { error } = await createAdminClient().rpc('mercadolibre_save_connection', {
      p_organization_id: active.id,
      p_connected_by: user.id,
      p_ml_user_id: me.id,
      p_nickname: me.nickname,
      p_access_token_enc: await ml.box.seal(tokens.accessToken),
      p_refresh_token_enc: await ml.box.seal(tokens.refreshToken),
      p_expires_at: tokens.expiresAt.toISOString(),
    });
    if (error) {
      if (error.code === '23505') return back('en_uso');
      logError('mercadolibre.save_connection_failed', error.code);
      return back('error');
    }
  } catch (caught) {
    logError('mercadolibre.oauth_failed', caught instanceof Error ? caught.message.slice(0, 80) : 'unexpected');
    return back('error');
  }
  return back('conectado');
}
