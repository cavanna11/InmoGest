import { describe, expect, it } from 'vitest';
import { checkHealth } from './health.ts';

describe('checkHealth', () => {
  it('sin configuración responde 503 unconfigured', async () => {
    expect(await checkHealth(null)).toEqual({
      httpStatus: 503,
      report: { status: 'unconfigured', database: 'unknown' },
    });
  });

  it('con la base respondiendo devuelve 200 y la latencia', async () => {
    let t = 1000;
    const result = await checkHealth(
      async () => {
        t += 25;
        return { ok: true };
      },
      () => t,
    );
    expect(result).toEqual({ httpStatus: 200, report: { status: 'ok', database: 'ok', latency_ms: 25 } });
  });

  it('si la base no responde ok devuelve 503', async () => {
    expect((await checkHealth(async () => ({ ok: false }))).httpStatus).toBe(503);
  });

  it('si la consulta falla devuelve 503 sin detalles internos', async () => {
    const result = await checkHealth(async () => {
      throw new Error('connection refused at 10.0.0.1');
    });
    expect(result).toEqual({ httpStatus: 503, report: { status: 'error', database: 'unreachable' } });
  });
});
