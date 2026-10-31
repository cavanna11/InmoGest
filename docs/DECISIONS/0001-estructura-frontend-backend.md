# ADR 0001 — Next.js en frontend/, datos e integraciones en backend/

- Estado: accepted
- Fecha: 2026-10-30

## Contexto

La plantilla del estándar separa `frontend/` y `backend/`. El stack acordado usa Next.js (App Router), que incluye pantallas y lógica de servidor (Server Actions, Route Handlers) en la misma aplicación, y Supabase como base de datos, autenticación y almacenamiento.

## Decisión

- `frontend/`: la aplicación Next.js completa (panel CRM, autenticación, Server Actions, Route Handlers, webhooks HTTP). Se despliega en Vercel.
- `backend/`: lo que no es la app web:
  - `backend/supabase/`: migraciones SQL, políticas RLS, funciones, seed de desarrollo y tests pgTAP.
  - `backend/worker/`: consumidor de la cola de jobs (matching, mensajes automáticos, envíos de WhatsApp).
  - Integración con Evolution API (cliente y contrato del proveedor de WhatsApp) compartida por la app y el worker.
- `infrastructure/`: docker-compose de Evolution API y del worker, y documentación del VPS.

## Alternativas consideradas

- **API propia separada (Node/NestJS) en backend/:** capas más marcadas, pero duplica validación y autenticación, agrega un deploy y costo de hosting, y no aporta seguridad extra porque el aislamiento está en RLS.
- **Una sola app en la raíz:** rompe la plantilla del estándar.

## Consecuencias

- La lógica de negocio que corre en el servidor de Next.js vive en `frontend/`, aunque no sea "frontend" en sentido estricto. Se organiza por módulo de dominio para que sea claro qué corre en servidor.
- El código compartido entre la app y el worker vive en `backend/shared` (ver ADR 0002).

## Referencias

- `docs/PRD.md`, `docs/STACK.md`.
