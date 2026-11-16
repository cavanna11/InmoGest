import { NextResponse } from 'next/server';
import { allowRequest, rateLimitKey } from '@/lib/rate-limit.ts';
import { appOrigin } from '@/lib/request.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { bearerToken, hashApiToken } from '@/modules/integrations/tokens.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';

// API de propiedades para webs propias (F-33, docs/API-PROPIEDADES.md). De servidor a servidor: sin CORS,
// porque el token no debe viajar en el navegador de los visitantes. La inmobiliaria sale del token.

const RATE_LIMIT_PER_MINUTE = 120;

function logError(action: string, code?: string) {
  console.error(JSON.stringify({ level: 'error', component: 'web', action, code }));
}

function problem(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: { 'cache-control': 'no-store' } });
}

type FeedProperty = { slug: string; images: string[] } & Record<string, unknown>;
type Feed = {
  organization: { slug: string } & Record<string, unknown>;
  total: number;
  limit: number;
  offset: number;
  properties: FeedProperty[];
  removed: string[];
};

export async function GET(request: Request) {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return problem(401, 'unauthorized', 'Falta el token: mandalo en el header Authorization: Bearer <token>.');
  const hash = hashApiToken(token);
  if (!(await allowRequest(rateLimitKey('api_feed', hash), 60, RATE_LIMIT_PER_MINUTE))) {
    return problem(429, 'rate_limited', 'Demasiados pedidos. Esperá un minuto.');
  }

  const params = new URL(request.url).searchParams;
  const since = params.get('desde');
  if (since !== null && Number.isNaN(Date.parse(since))) {
    return problem(400, 'invalid_since', '"desde" tiene que ser una fecha ISO 8601, por ejemplo 2026-11-15T10:00:00Z.');
  }
  const limit = Math.min(Math.max(Number.parseInt(params.get('limite') ?? '50', 10) || 50, 1), 100);
  const page = Math.max(Number.parseInt(params.get('pagina') ?? '1', 10) || 1, 1);

  const { data, error } = await createAdminClient().rpc('api_feed_properties', {
    p_token_hash: hash,
    p_limit: limit,
    p_offset: (page - 1) * limit,
    ...(since ? { p_since: new Date(since).toISOString() } : {}),
  });
  if (error) {
    logError('api_feed.failed', error.code);
    return problem(500, 'unexpected', 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.');
  }
  if (!data) return problem(401, 'unauthorized', 'El token no existe, fue revocado o la cuenta no está habilitada.');

  const feed = data as unknown as Feed;
  const origin = await appOrigin();
  return NextResponse.json(
    {
      organization: feed.organization,
      page,
      limit: feed.limit,
      total: feed.total,
      properties: feed.properties.map((property) => ({
        ...property,
        url: `${origin}/p/${feed.organization.slug}/${property.slug}`,
        images: property.images.map((path) => publicImageUrl(path)),
      })),
      removed: feed.removed,
    },
    { headers: { 'cache-control': 'private, max-age=60' } },
  );
}
