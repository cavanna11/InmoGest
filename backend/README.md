# Backend

Implementación backend según `docs/ARCHITECTURE.md` y ADR 0001/0002.

```text
backend/
├── supabase/   config.toml · migrations/ · seed.sql (solo desarrollo) · tests/ (pgTAP)
├── worker/     @inmogest/worker: consumidor de la cola de jobs (Node, corre en el VPS)
└── shared/     @inmogest/shared: teléfonos, dinero, fechas, resultado tipado, errores de Postgres, contrato de jobs
```

La base es la fuente de verdad de los permisos (RLS, ADR 0004). El worker usa la clave secreta: toda consulta filtra por `organization_id` explícitamente.

## Base de datos

- Migraciones: `npm run db:push` (agregar `-- --seed` para el seed de desarrollo, `-- --dry-run` para ver qué aplicaría). Requiere `APP_ENV=local` y `SUPABASE_DB_URL` en `.env.local`.
- Tests pgTAP: `npm run test:db`. Cada archivo `NN_*.sql` corre con `tests/_helpers.sql` en una transacción que se revierte.
- Tipos TypeScript: `npm run db:types` → `backend/shared/src/database.types.ts`.
- Nunca editar una migración ya aplicada en un ambiente compartido: crear una nueva.

## Worker

- Desarrollo: `npm run dev:worker` (lee `.env.local` de la raíz).
- Producción: `npm run build -w @inmogest/worker` y `node backend/worker/dist/index.js`.
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `WORKER_ID` (opcional).
- Nuevos tipos de job: esquema del payload en `backend/shared/src/jobs.ts` y handler en `backend/worker/src/handlers.ts`.
