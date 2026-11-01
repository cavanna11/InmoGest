// Integración del worker con la cola real del proyecto Supabase de desarrollo.
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY y las migraciones aplicadas.
// Sin esas variables el test FALLA (no se saltea), para no dar por verificado algo que no corrió.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database } from '@inmogest/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handlers } from '../../backend/worker/src/handlers.ts';
import { silentLogger } from '../../backend/worker/src/logger.ts';
import { SupabaseJobQueue } from '../../backend/worker/src/queue.ts';
import { processBatch } from '../../backend/worker/src/runner.ts';

const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const key = `integration:ping:${Date.now()}:${Math.random().toString(36).slice(2)}`;
let client: SupabaseClient<Database>;
let jobId: string;

describe('worker + cola de jobs (Supabase de desarrollo)', () => {
  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SECRET_KEY en .env.local');
    }
    client = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    if (client && jobId) await client.from('jobs').delete().eq('id', jobId);
  });

  it('encola, toma y completa un system.ping', async () => {
    const enqueued = await client.rpc('enqueue_job', {
      p_type: 'system.ping',
      p_payload: { note: 'integration' },
      p_idempotency_key: key,
    });
    expect(enqueued.error).toBeNull();
    jobId = enqueued.data as string;

    const queue = new SupabaseJobQueue(client, `integration-${process.pid}`);
    // Puede haber otros jobs pendientes en desarrollo: se procesan lotes hasta encontrar el nuestro.
    for (let i = 0; i < 5; i += 1) {
      const { data } = await client.from('jobs').select('status').eq('id', jobId).single();
      if (data?.status === 'succeeded') break;
      await processBatch({ queue, handlers, logger: silentLogger, batchSize: 20 });
    }

    const { data, error } = await client.from('jobs').select('status, attempts, last_error').eq('id', jobId).single();
    expect(error).toBeNull();
    expect(data).toEqual({ status: 'succeeded', attempts: 1, last_error: null });
  });

  it('la clave publicable no puede tocar la cola', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!publishable) throw new Error('Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local');
    const anon = createClient(url, publishable, { auth: { persistSession: false } });
    const claim = await anon.rpc('claim_jobs', { p_worker_id: 'intruso' });
    expect(claim.error).not.toBeNull();
    const read = await anon.from('jobs').select('id').limit(1);
    expect(read.error).not.toBeNull();
  });
});
