# Scripts

Automatizaciones versionadas. Se ejecutan con `npm run <script>` desde la raíz (nunca con `npx`: la ruta contiene `&`).

| Script | Comando | Qué hace |
|---|---|---|
| `db-push.mjs` | `npm run db:push [-- --seed] [-- --dry-run]` | Aplica migraciones con la CLI de Supabase y, con `--seed`, corre `seed.sql` con `pg` en una transacción (idempotente). Solo con `APP_ENV=local` o `ci`; `--seed` solo contra un Supabase local (ADR 0010). |
| `beta.mjs` | `npm run beta -- secure` · `access <email> [--name "…"] [--admin] [--url …]` · `legal <versión>` | Beta cerrada (ADR 0010; en el día a día, el súper panel hace lo mismo desde `/plataforma`): bloquea los usuarios del seed, crea cuentas o genera un enlace de acceso sin enviar emails, y publica los textos legales de `backend/supabase/legal/<versión>`. |
| `ci-supabase-env.mjs` | (solo GitHub Actions) | Exporta y enmascara las credenciales del Supabase local efímero del runner. |
| `run-pgtap.mjs` | `npm run test:db [-- 02 06]` | Corre los tests pgTAP contra `SUPABASE_DB_URL` sin Docker; todo se revierte. |
| `db-types.mjs` | `npm run db:types` | Genera los tipos TypeScript de la base en `backend/shared`. |
| `check-public-env.mjs` | `npm run check:env` | Falla si una variable secreta usa `NEXT_PUBLIC_` o hay claves `sb_secret_` en el código. |
| `lib/env.mjs` | — | Carga `.env.local` sin imprimir valores y valida el ambiente. |
