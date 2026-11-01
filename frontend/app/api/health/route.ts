import type { Database } from '@inmogest/shared';
import { createClient } from '@supabase/supabase-js';
import { connection } from 'next/server';
import { readPublicEnv } from '@/lib/env.ts';
import { checkHealth } from '@/lib/health.ts';

const TIMEOUT_MS = 5000;

export async function GET() {
  // Siempre en tiempo de pedido: nunca se prerenderiza ni se cachea.
  await connection();

  const env = readPublicEnv();
  const probe = env
    ? async () => {
        const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase.rpc('health').abortSignal(AbortSignal.timeout(TIMEOUT_MS));
        return { ok: !error && (data as { ok?: unknown } | null)?.ok === true };
      }
    : null;

  const { httpStatus, report } = await checkHealth(probe);
  return Response.json(report, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
