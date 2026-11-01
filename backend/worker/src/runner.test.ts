import type { ClaimedJob } from '@inmogest/shared';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './config.ts';
import { JobError, handlers, type JobHandlers } from './handlers.ts';
import { createJsonLogger, silentLogger, type LogFields } from './logger.ts';
import type { JobQueue } from './queue.ts';
import { abortableSleep, processBatch, runWorker } from './runner.ts';

function job(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    type: 'system.ping',
    payload: {},
    organization_id: null,
    attempts: 1,
    max_attempts: 3,
    ...overrides,
  };
}

class FakeQueue implements JobQueue {
  completed: string[] = [];
  failed: Array<{ id: string; code: string }> = [];
  constructor(
    private batches: ClaimedJob[][],
    private failStatus: string = 'pending',
  ) {}
  async claim() {
    return this.batches.shift() ?? [];
  }
  async complete(id: string) {
    this.completed.push(id);
    return true;
  }
  async fail(id: string, code: string) {
    this.failed.push({ id, code });
    return this.failStatus;
  }
}

describe('processBatch', () => {
  it('completa un job system.ping', async () => {
    const queue = new FakeQueue([[job()]]);
    expect(await processBatch({ queue, handlers, logger: silentLogger })).toBe(1);
    expect(queue.completed).toEqual(['job-1']);
    expect(queue.failed).toEqual([]);
  });

  it('devuelve 0 con la cola vacía', async () => {
    expect(await processBatch({ queue: new FakeQueue([]), handlers, logger: silentLogger })).toBe(0);
  });

  it('falla un tipo de job desconocido', async () => {
    const queue = new FakeQueue([[job({ type: 'otro.tipo' })]]);
    await processBatch({ queue, handlers, logger: silentLogger });
    expect(queue.failed).toEqual([{ id: 'job-1', code: 'unknown_job_type' }]);
  });

  it('falla un payload inválido sin ejecutar el handler', async () => {
    const ping = vi.fn();
    const queue = new FakeQueue([[job({ payload: { extra: 'no permitido' } })]]);
    await processBatch({ queue, handlers: { 'system.ping': ping }, logger: silentLogger });
    expect(ping).not.toHaveBeenCalled();
    expect(queue.failed).toEqual([{ id: 'job-1', code: 'invalid_payload' }]);
  });

  it('guarda el código de un JobError y uno genérico para otros errores', async () => {
    const failing: JobHandlers = {
      'system.ping': async (payload) => {
        if (payload.note === 'conocido') throw new JobError('provider_unavailable');
        throw new Error('detalle interno con datos que no se deben guardar');
      },
    };
    const queue = new FakeQueue([[job({ id: 'a', payload: { note: 'conocido' } }), job({ id: 'b' })]]);
    await processBatch({ queue, handlers: failing, logger: silentLogger });
    expect(queue.failed).toEqual([
      { id: 'a', code: 'provider_unavailable' },
      { id: 'b', code: 'handler_error' },
    ]);
  });

  it('pasa la inmobiliaria del job al handler', async () => {
    const ping = vi.fn(async () => {});
    const queue = new FakeQueue([[job({ organization_id: 'org-1', attempts: 2 })]]);
    await processBatch({ queue, handlers: { 'system.ping': ping }, logger: silentLogger });
    expect(ping).toHaveBeenCalledWith({}, expect.objectContaining({ organizationId: 'org-1', attempt: 2 }));
  });
});

describe('runWorker', () => {
  it('procesa hasta que se aborta y sobrevive a errores de la cola', async () => {
    const controller = new AbortController();
    const logs: string[] = [];
    let calls = 0;
    const queue: JobQueue = {
      claim: async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('x'), { code: 'claim_failed' });
        if (calls === 2) return [job()];
        controller.abort();
        return [];
      },
      complete: async () => true,
      fail: async () => 'pending',
    };
    await runWorker({
      queue,
      handlers,
      logger: (_level, action) => logs.push(action),
      signal: controller.signal,
      sleep: async () => {},
    });
    expect(logs).toEqual([
      'worker.started',
      'worker.cycle_failed',
      'job.claimed',
      'job.ping',
      'job.succeeded',
      'worker.stopped',
    ]);
  });

  it('abortableSleep termina al abortar', async () => {
    const controller = new AbortController();
    const sleeping = abortableSleep(60_000, controller.signal);
    controller.abort();
    await expect(sleeping).resolves.toBeUndefined();
  });
});

describe('logger y config', () => {
  it('escribe JSON con componente y acción', () => {
    const lines: string[] = [];
    createJsonLogger('worker', (line) => lines.push(line))('info', 'job.succeeded', { job_id: 'j' } satisfies LogFields);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ level: 'info', component: 'worker', action: 'job.succeeded', job_id: 'j' });
  });

  it('exige URL y clave secreta sin mostrar valores', () => {
    expect(() => readConfig({})).toThrow('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY');
    const config = readConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'test-key',
      WORKER_ID: 'w-1',
    });
    expect(config.workerId).toBe('w-1');
  });

  it('rechaza una URL de Supabase con ruta', () => {
    expect(() =>
      readConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/rest/v1/', SUPABASE_SECRET_KEY: 'k' }),
    ).toThrow('sin /rest/v1');
  });
});
