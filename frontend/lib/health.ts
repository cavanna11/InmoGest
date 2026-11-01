/**
 * Health check de la app (docs/OBSERVABILITY.md): responde si puede consultar la base.
 * La consulta es la RPC public.health(), ejecutable con la clave publicable y sin datos.
 */
export type HealthReport = {
  status: 'ok' | 'unconfigured' | 'error';
  database: 'ok' | 'unreachable' | 'unknown';
  latency_ms?: number;
};

export type HealthProbe = () => Promise<{ ok: boolean }>;

export async function checkHealth(probe: HealthProbe | null, now: () => number = Date.now): Promise<{
  httpStatus: 200 | 503;
  report: HealthReport;
}> {
  if (!probe) {
    return { httpStatus: 503, report: { status: 'unconfigured', database: 'unknown' } };
  }
  const started = now();
  try {
    const { ok } = await probe();
    const latency_ms = now() - started;
    return ok
      ? { httpStatus: 200, report: { status: 'ok', database: 'ok', latency_ms } }
      : { httpStatus: 503, report: { status: 'error', database: 'unreachable', latency_ms } };
  } catch {
    return { httpStatus: 503, report: { status: 'error', database: 'unreachable' } };
  }
}
