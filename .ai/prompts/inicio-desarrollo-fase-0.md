# Prompt para iniciar el desarrollo (Fase 0) en una sesión nueva de Claude Code

Copiar desde "Prompt" hasta el final y pegarlo como primer mensaje de la sesión nueva, abierta en la carpeta `InmoGest`.

---

## Prompt

Vas a empezar a programar InmoGest, un CRM inmobiliario SaaS multi-tenant de mi estudio C&C. Actuá como CTO, arquitecto y desarrollador full-stack senior. Hablame en español rioplatense.

### 1. Antes de proponer nada, leé completo

- `AGENTS.md` y `STANDARD.md`
- `docs/PRD.md` (v0.3) — qué se construye y criterios de aceptación
- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/STACK.md`
- `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/OBSERVABILITY.md`
- `docs/DECISIONS/` (ADR 0001, 0002, 0003)
- `.ai/workflows/new-feature.md`

La documentación es la especificación. No inventes requisitos ni amplíes alcance. Si algo está marcado [A CONFIRMAR] y bloquea, preguntame; si no bloquea, dejalo configurable y seguí.

### 2. Objetivo de esta sesión: Fase 0 — fundamentos

Proponeme un plan para la Fase 0 y **esperá mi aprobación antes de escribir código**. El plan tiene que incluir: qué vas a construir, archivos y carpetas, migraciones, decisiones que necesitás de mí, dependencias externas y cómo lo vas a verificar.

Alcance esperado de la Fase 0 (ajustalo si la documentación indica otra cosa y explicame por qué):

1. **Monorepo con npm workspaces** (ADR 0002): `frontend/` (Next.js), `backend/worker/`, `backend/shared/`. `.npmrc`, `.gitattributes` (finales de línea LF), `tsconfig` base estricto, ESLint, Vitest, Playwright.
2. **App Next.js** en `frontend/` con lo mínimo: layout, clientes de Supabase (servidor, navegador, admin solo servidor), `proxy.ts` que refresca la sesión, `/api/health`, página inicial sin botones sin acción.
3. **Base de datos** en `backend/supabase/`: migraciones de la base de plataforma y tenancy según `docs/DATABASE.md` y `docs/SECURITY.md` — organizaciones, perfiles, membresías, invitaciones, planes, configuración global, administradores de plataforma, sesiones de soporte, aceptación de términos, estado efectivo de cuenta, funciones de permisos (`app.is_member`, `app.is_owner`, `app.can_read`, `app.can_write`), trigger del último dueño, límites de plan, auditoría, cola de jobs y rate limit. RLS habilitada y forzada en todo. Las tablas del CRM (contactos, propiedades, WhatsApp…) son de la Fase 1, salvo que me propongas adelantar alguna con motivo.
4. **Seed de desarrollo** con dos inmobiliarias (una "intrusa" para tests), dueños, agentes y un superadministrador principal. Sin datos personales ni credenciales reales.
5. **Tests pgTAP** de aislamiento, estados de cuenta, último dueño, límites de plan e «Ingresar como» (ADR 0003).
6. **`backend/shared`** con utilidades y sus tests: teléfonos (E.164, argentinos siempre +549), dinero (centavos en bigint, moneda explícita), fechas (DD/MM/AAAA, America/Argentina/Buenos_Aires), resultado tipado y traducción de errores de Postgres.
7. **Worker** mínimo: toma jobs con `claim_jobs` y los completa/falla, con un handler de prueba.
8. **Scripts** `db:push` y `test:db`, y workflow de CI en `.github/workflows/` con las compuertas de `docs/TESTING.md`.

### 3. Particularidades del entorno (aprendidas en un intento anterior)

- **Windows, y la ruta contiene `&` (`C&C`).** Eso rompe los atajos `.cmd` de npm y `npx`. Solución probada: `.npmrc` con `script-shell=C:/Program Files/Git/bin/bash.exe` (barras normales). Usá siempre `npm run <script>`, nunca `npx`. En Vitest, resolver rutas con `fileURLToPath`, no con `.pathname` (el `&` queda codificado).
- **Next.js 16** tiene cambios incompatibles con lo que conocés: leé las guías en `node_modules/next/dist/docs/` antes de escribir código de Next. Puntos ya detectados: `proxy.ts` reemplaza a `middleware.ts`; con `cacheComponents` los `params` dinámicos se leen dentro de `<Suspense>`; `LayoutProps`/`PageProps` vienen de `next typegen` (el typecheck es `next typegen && tsc --noEmit`); para rutas dinámicas sin caché, `await connection()` de `next/server`.
- **No hay Docker instalado.** El Supabase de desarrollo es un proyecto en la nube. Las migraciones se aplican con la CLI de Supabase usando `--db-url` (el binario está en `node_modules/supabase/dist/supabase.js`, invocarlo con `node`), y los tests pgTAP se corren con un script propio que se conecta con `pg` a `SUPABASE_DB_URL`, porque `supabase test db` requiere Docker.
- **Claves de Supabase nuevas:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_…) y `SUPABASE_SECRET_KEY` (sb_secret_…).
- `@types/node` tiene que ser ^22 o superior por compatibilidad con Vitest 5.
- El `.env.local` todavía **no existe**. Cuando necesites aplicar migraciones o correr pgTAP, pedime que lo cree a partir de `.env.example`. No me pidas las claves por el chat ni las escribas vos; al verificar, chequeá que las variables tengan valor sin imprimirlas.
- Hasta que exista `.env.local`, todo lo que no dependa de la base (typecheck, lint, unit, build) tiene que pasar igual.

### 4. Reglas que no se negocian

- Nunca exponer la clave secreta al navegador ni usar `NEXT_PUBLIC_` para secretos. Nunca secretos en Git.
- No confiar en un `organization_id` enviado por el cliente; el aislamiento se garantiza en la base (RLS + claves foráneas compuestas), no solo en la app.
- No simular integraciones ni afirmar que algo funciona sin haberlo probado. No inventar resultados de tests.
- No dejar botones sin acción ni migraciones sin ejecutar o verificar (si no se pudieron ejecutar por falta de credenciales, decilo explícitamente).
- No desactivar tests ni validaciones para que den verde.
- No agregar dependencias sin justificar necesidad, mantenimiento, licencia e impacto.
- No tocar producción ni desplegar. No hacer commit ni push salvo que yo lo pida.
- No avanzar a la Fase 1 sin mostrarme el plan y obtener mi aprobación.

### 5. Al terminar la fase

Corré: install, typecheck, lint, tests unitarios, build y, si hay `.env.local`, `db:push -- --seed` y `test:db`. Después dame un resumen con: funcionalidades, archivos creados, migraciones, tests y sus resultados reales, verificaciones que no se pudieron hacer y por qué, errores pendientes, cómo correrlo localmente y variables externas que faltan. Actualizá `README.md` y la documentación que haya cambiado.

Empezá leyendo los documentos y presentándome el plan de la Fase 0.
