# InmoGest (nombre provisional)

CRM inmobiliario SaaS multi-tenant de **C&C** para inmobiliarias argentinas: contactos, propiedades, matching automático, embudo comercial, agenda y WhatsApp centralizado. Las inmobiliarias se registran solas y prueban gratis 14 días.

Proyecto creado a partir del Estándar de Vibe Coding 1.0 (ver `STANDARD.md`).

## Estado (31/10/2026)

**Fase 0 (fundamentos) implementada y verificada** (01/11/2026): monorepo, base de plataforma y tenancy con RLS (aplicada al proyecto de desarrollo), utilidades compartidas, worker mínimo y CI. Compuertas: typecheck, lint, 96 tests unitarios, build, 170 aserciones pgTAP, 2 tests de integración y 8 E2E en verde. El workflow de CI todavía no corrió en GitHub. Todavía no hay funcionalidades del CRM (Fase 1).

| Paso | Estado |
|---|---|
| 1. Completar `STANDARD.md` | ✅ |
| 2. PRD y arquitectura | ✅ `docs/PRD.md` v0.3, `docs/ARCHITECTURE.md` (con preguntas abiertas) |
| 3. Stack y versiones | ✅ versiones fijadas en `docs/STACK.md` |
| 4. Seguridad y datos | ✅ `docs/SECURITY.md`, `docs/DATABASE.md`; ADR 0004–0006 |
| 5. Materiales en `materials/` | ⏳ sin materiales cargados |
| 6. Design System | ⏳ pendiente de la marca (`docs/BRAND.md`, `docs/DESIGN-SYSTEM.md`, `docs/UX-RULES.md`) |
| 7. Git y pipeline de validación | ✅ repositorio en GitHub; CI en `.github/workflows/ci.yml` |

## Requisitos

- Node.js ≥ 22 y npm ≥ 10.
- Git; en Windows, Git Bash. La ruta del proyecto contiene `&` (`C&C`), que rompe los atajos `.cmd` de npm: el `.npmrc` raíz configura Git Bash como shell de scripts y se usa siempre `npm run <script>`, nunca `npx`.
- Un proyecto de Supabase de desarrollo (nube). No hace falta Docker para desarrollar: las migraciones y los tests de base corren contra ese proyecto.
- Docker solo para Evolution API (VPS o pruebas locales).

## Puesta en marcha

1. Instalar dependencias (una sola vez, en la raíz):

   ```bash
   npm install
   ```

2. Crear `.env.local` en la raíz a partir de `.env.example` y completar, del proyecto de **desarrollo**:
   - `APP_ENV=local`.
   - `NEXT_PUBLIC_SUPABASE_URL`: solo el origen, `https://<ref>.supabase.co` (sin `/rest/v1`).
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` (Project Settings → API Keys).
   - `SUPABASE_DB_URL`: Connect → Connection String → Method **Session pooler** (si no aparece, la URL del Transaction pooler cambiando el puerto 6543 por 5432). Caracteres especiales de la contraseña codificados para URL.
   - Certificado TLS para `test:db`: Project Settings → Database → SSL Configuration → Download certificate, guardado en `certs/supabase-dev-ca.crt` (carpeta ignorada por Git), y `SUPABASE_DB_CA_PATH=certs/supabase-dev-ca.crt`.
3. En el panel de Supabase (Authentication), configurar contraseña mínima de 10 caracteres con mayúsculas, minúsculas y números, y confirmación de email obligatoria (`docs/SECURITY.md`).
4. Aplicar migraciones y seed, y correr los tests de base:

   ```bash
   npm run db:push -- --seed
   npm run test:db
   ```

5. Levantar la app (http://localhost:3000) y, si hace falta, el worker:

   ```bash
   npm run dev
   npm run dev:worker
   ```

Usuarios de prueba del seed: ver el encabezado de `backend/supabase/seed.sql` (dominio `.test`, contraseña solo de desarrollo).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm run dev:worker` | App Next.js / worker en desarrollo |
| `npm run typecheck` | TypeScript estricto en los tres paquetes y en los tests (`next typegen && tsc --noEmit` en la app) |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios (Vitest) |
| `npm run build` | Compila `shared`, el worker y la app |
| `npm run test:integration` | Worker contra la cola real (requiere `.env.local`) |
| `npm run test:e2e` | Playwright contra el build (puerto 3100; antes `npm run build` y, la primera vez, `npm run e2e:install`) |
| `npm run db:push` | Migraciones al proyecto de desarrollo (`-- --seed`, `-- --dry-run`) |
| `npm run test:db` | Tests pgTAP (aislamiento, estados de cuenta, último dueño, límites de plan, «Ingresar como», jobs) |
| `npm run db:types` | Tipos TypeScript de la base |
| `npm run check:env` | Ninguna variable secreta con `NEXT_PUBLIC_` |

## Documentación

| Documento | Contenido |
|---|---|
| [PRD](docs/PRD.md) | Qué se construye, reglas de negocio, criterios de aceptación |
| [Arquitectura](docs/ARCHITECTURE.md) | Componentes y flujos |
| [Base de datos](docs/DATABASE.md) | Entidades, restricciones, retención, lo implementado |
| [Seguridad](docs/SECURITY.md) | Acceso, datos sensibles, secretos, riesgos |
| [Stack](docs/STACK.md) | Tecnologías, versiones fijadas y política de dependencias |
| [Testing](docs/TESTING.md) | Compuertas, comandos y cobertura |
| [Deploy](docs/DEPLOYMENT.md) | Ambientes, pipeline, rollback |
| [Operación](docs/OPERATIONS.md) | Backups, actualizaciones, incidentes |
| [Observabilidad](docs/OBSERVABILITY.md) | Logs, auditoría, métricas, alertas |
| [Decisiones](docs/DECISIONS/) | ADRs 0001–0006 |

## Árbol

```text
InmoGest/
├── README.md · STANDARD.md · AGENTS.md · .env.example · .gitignore · .gitattributes · .npmrc
├── package.json          workspaces: frontend, backend/worker, backend/shared
├── tsconfig.base.json · eslint.config.mjs · vitest.config.ts · playwright.config.ts
├── docs/                 documentación oficial
├── materials/            insumos de referencia (no son especificación)
├── .ai/                  reglas, prompts, contexto y workflows para IA
├── .claude/skills/       skills de Claude Code
├── .agents/skills/       skills de Codex
├── frontend/             @inmogest/web: app Next.js (app/, lib/, proxy.ts)
├── backend/
│   ├── supabase/         config.toml · migrations/ · seed.sql · tests/ (pgTAP)
│   ├── worker/           @inmogest/worker: consumidor de jobs
│   └── shared/           @inmogest/shared: utilidades y contratos compartidos
├── infrastructure/       Evolution API + worker en el VPS (Docker)
├── scripts/              db-push, run-pgtap, db-types, check-public-env
├── tests/                integration/ · e2e/
└── .github/workflows/    CI
```
