# ADR 0005 — Cola de jobs en PostgreSQL

- Estado: accepted
- Fecha: 2026-10-31

## Contexto

Matching, importaciones, medios de WhatsApp, recordatorios y retención corren en segundo plano (ARCHITECTURE flujos 4–8). Decisión heredada que `docs/ARCHITECTURE.md` dejó para documentar al implementarla (Fase 0).

## Decisión

- Tabla `public.jobs` con tipo, payload JSON, `organization_id`, `idempotency_key` (única mientras el job está pendiente o en curso), estado, intentos, `run_after` y lock.
- RPC solo para `service_role`:
  - `enqueue_job(...)`: idempotente; devuelve el id del job nuevo o del abierto existente.
  - `claim_jobs(worker_id, limit, lock_timeout)`: `FOR UPDATE SKIP LOCKED`, varios workers sin tomar dos veces el mismo job; recupera jobs con lock vencido y marca fallidos los que ya agotaron intentos.
  - `complete_job` / `fail_job`: solo el worker que tomó el job; reintento con espera exponencial (30 s, 60 s, 120 s…, máximo 1 h) hasta `max_attempts`.
- Los payloads se validan con esquemas Zod compartidos (`@inmogest/shared`, `jobPayloadSchemas`). `last_error` guarda un código, nunca datos personales.
- El worker (`backend/worker`) toma lotes, despacha a handlers tipados y espera cuando la cola está vacía.

## Alternativas consideradas

- **Servicio de colas externo (Redis/BullMQ, SQS):** otro componente para operar y pagar, y la transacción que crea un dato no puede encolar el job en el mismo commit.
- **pg_cron / pgmq de Supabase:** atan la lógica a extensiones del proveedor y no cubren el worker en el VPS que habla con Evolution.

## Consecuencias

- Encolar en la misma transacción que el cambio que lo origina (triggers en la Fase 1).
- El volumen esperado (cientos de inmobiliarias) entra cómodo en Postgres; si crece, se agregan workers.
- Limpieza de jobs terminados pendiente de definir retención ([A CONFIRMAR], `docs/DATABASE.md`).

## Referencias

- `backend/supabase/migrations/20261031200600_jobs.sql`, `backend/worker/`, `docs/OPERATIONS.md`.
