import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEvolutionProvider, type Database } from '@inmogest/shared';
import { createClient } from '@supabase/supabase-js';
import { readConfig } from './config.ts';
import { createHandlers } from './handlers.ts';
import { createJsonLogger } from './logger.ts';
import { SupabaseJobQueue } from './queue.ts';
import { abortableSleep, runWorker } from './runner.ts';
import { createWhatsAppStore, processOutbox, reconcileConnections } from './whatsapp.ts';

// En desarrollo toma las variables de .env.local de la raíz; en el VPS llegan por docker compose.
const envFile = fileURLToPath(new URL('../../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const logger = createJsonLogger('worker');
let config: ReturnType<typeof readConfig>;
try {
  config = readConfig();
} catch (error) {
  logger('error', 'worker.config_invalid', { reason: error instanceof Error ? error.message : 'unknown' });
  process.exit(1);
}
const client = createClient<Database>(config.supabaseUrl, config.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger('info', 'worker.stopping', { signal });
    controller.abort();
  });
}

const provider = config.evolution ? createEvolutionProvider(config.evolution) : null;
if (!provider) logger('warn', 'worker.whatsapp_not_configured');

const OUTBOX_INTERVAL_MS = 2000;
const CONNECTIONS_INTERVAL_MS = 60_000;

/** Repite una tarea hasta que se pida frenar. Una falla se registra y no corta el proceso. */
async function loop(name: string, intervalMs: number, task: () => Promise<unknown>) {
  while (!controller.signal.aborted) {
    try {
      await task();
    } catch (error) {
      logger('error', name, { error_code: error instanceof Error && 'code' in error ? String(error.code) : 'unexpected' });
    }
    await abortableSleep(intervalMs, controller.signal);
  }
}

const store = createWhatsAppStore(client);
await Promise.all([
  runWorker({
    queue: new SupabaseJobQueue(client, config.workerId),
    handlers: createHandlers({ client, provider }),
    logger,
    signal: controller.signal,
  }),
  ...(provider
    ? [
        loop('whatsapp.outbox_failed', OUTBOX_INTERVAL_MS, () => processOutbox(store, provider, logger)),
        loop('whatsapp.reconcile_failed', CONNECTIONS_INTERVAL_MS, () => reconcileConnections(store, provider, logger)),
      ]
    : []),
]);
