import type { ClaimedJob, Database } from '@inmogest/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Operaciones de la cola (RPC de backend/supabase/migrations/*_jobs.sql). */
export interface JobQueue {
  claim(limit: number): Promise<ClaimedJob[]>;
  complete(jobId: string): Promise<boolean>;
  /** Devuelve el estado resultante: 'pending' (se reintentará) o 'failed'. */
  fail(jobId: string, errorCode: string): Promise<string | null>;
}

export class SupabaseJobQueue implements JobQueue {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly workerId: string,
    private readonly lockTimeoutSeconds = 600,
  ) {}

  async claim(limit: number): Promise<ClaimedJob[]> {
    const { data, error } = await this.client.rpc('claim_jobs', {
      p_worker_id: this.workerId,
      p_limit: limit,
      p_lock_timeout_seconds: this.lockTimeoutSeconds,
    });
    if (error) throw new QueueError('claim_failed', error.code);
    return (data ?? []) as ClaimedJob[];
  }

  async complete(jobId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('complete_job', {
      p_job_id: jobId,
      p_worker_id: this.workerId,
    });
    if (error) throw new QueueError('complete_failed', error.code);
    return data === true;
  }

  async fail(jobId: string, errorCode: string): Promise<string | null> {
    const { data, error } = await this.client.rpc('fail_job', {
      p_job_id: jobId,
      p_worker_id: this.workerId,
      p_error: errorCode,
    });
    if (error) throw new QueueError('fail_failed', error.code);
    return (data as string | null) ?? null;
  }
}

export class QueueError extends Error {
  constructor(
    readonly code: string,
    readonly dbCode?: string,
  ) {
    super(code);
    this.name = 'QueueError';
  }
}
