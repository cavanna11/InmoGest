import type { JobPayload, JobType } from '@inmogest/shared';
import type { Logger } from './logger.ts';

export type JobContext = {
  jobId: string;
  /** Inmobiliaria del job. Con la clave secreta no hay RLS: toda consulta debe filtrar por este valor. */
  organizationId: string | null;
  attempt: number;
  logger: Logger;
};

export type JobHandler<T extends JobType> = (payload: JobPayload<T>, context: JobContext) => Promise<void>;
export type JobHandlers = { [T in JobType]: JobHandler<T> };

/** Error de un handler con un código estable que se guarda en jobs.last_error (sin datos personales). */
export class JobError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'JobError';
  }
}

export const handlers: JobHandlers = {
  // Job de prueba de la Fase 0: confirma el circuito encolar → tomar → completar.
  'system.ping': async (payload, context) => {
    context.logger('info', 'job.ping', { job_id: context.jobId, has_note: payload.note !== undefined });
  },
};
