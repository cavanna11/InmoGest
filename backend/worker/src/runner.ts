import { isJobType, jobPayloadSchemas, type ClaimedJob, type JobType } from '@inmogest/shared';
import { JobError, type JobContext, type JobHandlers } from './handlers.ts';
import type { Logger } from './logger.ts';
import type { JobQueue } from './queue.ts';

export type RunnerOptions = {
  queue: JobQueue;
  handlers: JobHandlers;
  logger: Logger;
  batchSize?: number;
};

/** Toma un lote de jobs y procesa cada uno. Devuelve cuántos tomó. */
export async function processBatch({ queue, handlers, logger, batchSize = 10 }: RunnerOptions): Promise<number> {
  const jobs = await queue.claim(batchSize);
  for (const job of jobs) {
    await processJob(job, queue, handlers, logger);
  }
  return jobs.length;
}

async function processJob(job: ClaimedJob, queue: JobQueue, handlers: JobHandlers, logger: Logger) {
  const started = Date.now();
  const base = { job_id: job.id, job_type: job.type, organization_id: job.organization_id, attempt: job.attempts };
  logger('info', 'job.claimed', base);

  const errorCode = await runHandler(job, handlers, logger);
  const duration_ms = Date.now() - started;

  if (errorCode === null) {
    const completed = await queue.complete(job.id);
    logger(completed ? 'info' : 'warn', completed ? 'job.succeeded' : 'job.complete_lost', { ...base, duration_ms });
    return;
  }

  const status = await queue.fail(job.id, errorCode);
  logger(status === 'pending' ? 'warn' : 'error', status === 'pending' ? 'job.retry' : 'job.failed', {
    ...base,
    duration_ms,
    error_code: errorCode,
  });
}

/** Ejecuta el handler. Devuelve null si terminó bien o un código de error sin datos personales. */
async function runHandler(job: ClaimedJob, handlers: JobHandlers, logger: Logger): Promise<string | null> {
  if (!isJobType(job.type)) return 'unknown_job_type';
  const type: JobType = job.type;

  const parsed = jobPayloadSchemas[type].safeParse(job.payload ?? {});
  if (!parsed.success) return 'invalid_payload';

  const context: JobContext = {
    jobId: job.id,
    organizationId: job.organization_id,
    attempt: job.attempts,
    logger,
  };
  try {
    await handlers[type](parsed.data, context);
    return null;
  } catch (error) {
    return error instanceof JobError ? error.code : 'handler_error';
  }
}

export type LoopOptions = RunnerOptions & {
  pollIntervalMs?: number;
  signal: AbortSignal;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

/** Bucle del worker: procesa lotes mientras haya trabajo y espera cuando la cola está vacía. */
export async function runWorker(options: LoopOptions): Promise<void> {
  const { signal, logger, pollIntervalMs = 2000, sleep = abortableSleep } = options;
  let consecutiveErrors = 0;
  logger('info', 'worker.started');

  while (!signal.aborted) {
    try {
      const processed = await processBatch(options);
      consecutiveErrors = 0;
      if (processed === 0) await sleep(pollIntervalMs, signal);
    } catch (error) {
      consecutiveErrors += 1;
      logger('error', 'worker.cycle_failed', {
        error_code: error instanceof Error && 'code' in error ? String(error.code) : 'unexpected',
        consecutive_errors: consecutiveErrors,
      });
      // Espera creciente ante fallas de la base o de la red (máximo 1 minuto).
      await sleep(Math.min(60_000, pollIntervalMs * 2 ** Math.min(consecutiveErrors, 5)), signal);
    }
  }
  logger('info', 'worker.stopped');
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}
