import { z } from 'zod';

/**
 * Contrato de la cola de jobs (tabla public.jobs), compartido por quien encola (app, triggers)
 * y quien consume (worker). Cada tipo de job declara el esquema de su payload.
 */
export const jobPayloadSchemas = {
  /** Job de prueba de la Fase 0: verifica el circuito encolar → tomar → completar. */
  'system.ping': z.object({ note: z.string().max(200).optional() }).strict(),
} as const;

export type JobType = keyof typeof jobPayloadSchemas;
export type JobPayload<T extends JobType> = z.infer<(typeof jobPayloadSchemas)[T]>;

export const JOB_TYPES = Object.keys(jobPayloadSchemas) as JobType[];

export function isJobType(value: string): value is JobType {
  return Object.hasOwn(jobPayloadSchemas, value);
}

/** Fila que devuelve public.claim_jobs(). */
export type ClaimedJob = {
  id: string;
  type: string;
  payload: unknown;
  organization_id: string | null;
  attempts: number;
  max_attempts: number;
};
