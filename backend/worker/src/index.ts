import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database } from '@inmogest/shared';
import { createClient } from '@supabase/supabase-js';
import { readConfig } from './config.ts';
import { handlers } from './handlers.ts';
import { createJsonLogger } from './logger.ts';
import { SupabaseJobQueue } from './queue.ts';
import { runWorker } from './runner.ts';

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

await runWorker({
  queue: new SupabaseJobQueue(client, config.workerId),
  handlers,
  logger,
  signal: controller.signal,
});
