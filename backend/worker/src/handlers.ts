import { WhatsAppProviderError, type Database, type JobPayload, type JobType, type WhatsAppProvider } from '@inmogest/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from './logger.ts';
import { downloadMessageMedia } from './whatsapp.ts';

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

export type HandlerDeps = {
  client?: SupabaseClient<Database>;
  provider?: WhatsAppProvider | null;
};

export const createHandlers = ({ client, provider }: HandlerDeps = {}): JobHandlers => ({
  // Job de prueba de la Fase 0: confirma el circuito encolar → tomar → completar.
  'system.ping': async (payload, context) => {
    context.logger('info', 'job.ping', { job_id: context.jobId, has_note: payload.note !== undefined });
  },
  'whatsapp.media': async (payload, context) => {
    if (!client || !provider) throw new JobError('whatsapp_not_configured');
    try {
      await downloadMessageMedia(client, provider, payload.message_id, context.organizationId);
    } catch (error) {
      // El código del proveedor no lleva datos personales: se guarda en el job para diagnosticar.
      throw error instanceof WhatsAppProviderError ? new JobError(error.code) : error;
    }
  },
});

export const handlers: JobHandlers = createHandlers();
