# ADR 0004 — Aislamiento multi-tenant en la base: RLS forzada, funciones de permisos y claves foráneas compuestas

- Estado: accepted
- Fecha: 2026-10-31

## Contexto

PRD §6 y §8: ningún usuario de una inmobiliaria puede ver, crear ni modificar datos de otra, "ni siquiera manipulando pedidos al servidor", y eso se verifica con tests sobre la base. Decisión heredada del diseño anterior que `docs/ARCHITECTURE.md` dejó para documentar al implementarla (Fase 0).

## Decisión

- Una base compartida. Toda tabla de una inmobiliaria lleva `organization_id not null` y `unique (organization_id, id)`; las relaciones internas usan **claves foráneas compuestas** `(organization_id, x_id)`. `memberships` tiene `unique (organization_id, user_id)` como destino de `assigned_user_id` / `author_user_id`.
- **RLS habilitada y forzada** (`force row level security`) en todas las tablas de `public`. Las políticas solo llaman a funciones del esquema `app` (no expuesto por la API): `is_member`, `is_owner`, `can_read`, `can_write`, `is_platform_admin`, `is_principal`, `organization_state`.
- Esas funciones son `SECURITY DEFINER` con `search_path` vacío y su dueño tiene `BYPASSRLS`, lo que evita recursión entre políticas. Un test pgTAP verifica ambas cosas.
- Permisos de tabla explícitos: `anon` solo lee documentos legales publicados; `authenticated` recibe solo las operaciones que alguna política permite; `jobs` y `rate_limits` son exclusivos de `service_role`. Los defaults de Supabase se revocan para tablas y funciones nuevas de `public`.
- Reglas que no dependen de la pantalla viven en triggers: último dueño (IG003), límites de plan (IG001), plan y estado de cuenta solo modificables por C&C (IG004), claves `organization_id` / `user_id` inmutables.
- Errores propios con SQLSTATE de clase `IG`, traducidos a español en `@inmogest/shared` (`translateDbError`).

## Alternativas consideradas

- **Esquema o base por inmobiliaria:** aislamiento físico, pero migraciones, conexiones y costos multiplicados; no escala con registro self-service.
- **Filtrar solo en la app:** un error en una consulta expone datos de otra inmobiliaria; no cumple el criterio de aceptación.
- **RLS sin claves foráneas compuestas:** una política con un error permitiría vincular registros de dos inmobiliarias; la clave compuesta lo impide en la base.

## Consecuencias

- Cada tabla nueva necesita `organization_id`, claves compuestas, RLS forzada, grants explícitos y tests pgTAP de aislamiento (`backend/supabase/tests/`).
- El worker y los webhooks usan la clave secreta (sin RLS): toda consulta filtra por `organization_id` derivado de un dato confiable.
- Las funciones de permisos se evalúan en cada consulta; las políticas usan `(select …)` para que Postgres las evalúe una vez por sentencia.

## Referencias

- `docs/DATABASE.md`, `docs/SECURITY.md`, ADR 0003.
- `backend/supabase/migrations/20261031200300_permissions.sql`, `…200400_rules.sql`, `…200500_rls.sql`.
