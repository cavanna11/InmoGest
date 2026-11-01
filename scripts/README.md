# Scripts

Automatizaciones versionadas. Se ejecutan con `npm run <script>` desde la raíz (nunca con `npx`: la ruta contiene `&`).

| Script | Comando | Qué hace |
|---|---|---|
| `db-push.mjs` | `npm run db:push [-- --seed] [-- --dry-run]` | Aplica migraciones (y el seed) al proyecto de desarrollo con la CLI de Supabase. Solo con `APP_ENV=local` o `ci`. |
| `run-pgtap.mjs` | `npm run test:db [-- 02 06]` | Corre los tests pgTAP contra `SUPABASE_DB_URL` sin Docker; todo se revierte. |
| `db-types.mjs` | `npm run db:types` | Genera los tipos TypeScript de la base en `backend/shared`. |
| `check-public-env.mjs` | `npm run check:env` | Falla si una variable secreta usa `NEXT_PUBLIC_` o hay claves `sb_secret_` en el código. |
| `lib/env.mjs` | — | Carga `.env.local` sin imprimir valores y valida el ambiente. |
