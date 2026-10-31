# InmoGest (nombre provisional)

CRM inmobiliario SaaS multi-tenant de **C&C** para inmobiliarias argentinas: contactos, propiedades, matching automático, embudo comercial, agenda y WhatsApp centralizado. Las inmobiliarias se registran solas y prueban gratis 14 días.

Proyecto creado a partir del Estándar de Vibe Coding 1.0 (ver `STANDARD.md`).

## Estado (31/10/2026)

Etapa de documentación. Todavía no hay código.

| Paso | Estado |
|---|---|
| 1. Completar `STANDARD.md` | ✅ |
| 2. PRD y arquitectura | ✅ `docs/PRD.md` v0.3, `docs/ARCHITECTURE.md` (con preguntas abiertas) |
| 3. Stack y versiones | ✅ `docs/STACK.md` (versiones exactas se fijan al iniciar el código) |
| 4. Seguridad y datos | ✅ `docs/SECURITY.md`, `docs/DATABASE.md` |
| 5. Materiales en `materials/` | ⏳ sin materiales cargados |
| 6. Design System | ⏳ pendiente de la marca (`docs/BRAND.md`, `docs/DESIGN-SYSTEM.md`, `docs/UX-RULES.md`) |
| 7. Git y pipeline de validación | ⏳ repositorio sin commits; CI se arma con el código (`docs/TESTING.md`, `docs/DEPLOYMENT.md`) |

## Documentación

| Documento | Contenido |
|---|---|
| [PRD](docs/PRD.md) | Qué se construye, reglas de negocio, criterios de aceptación |
| [Arquitectura](docs/ARCHITECTURE.md) | Componentes y flujos |
| [Base de datos](docs/DATABASE.md) | Entidades, restricciones, retención |
| [Seguridad](docs/SECURITY.md) | Acceso, datos sensibles, secretos, riesgos |
| [Stack](docs/STACK.md) | Tecnologías y política de dependencias |
| [Testing](docs/TESTING.md) | Compuertas y recorridos críticos |
| [Deploy](docs/DEPLOYMENT.md) | Ambientes, pipeline, rollback |
| [Operación](docs/OPERATIONS.md) | Backups, actualizaciones, incidentes |
| [Observabilidad](docs/OBSERVABILITY.md) | Logs, auditoría, métricas, alertas |
| [Decisiones](docs/DECISIONS/) | ADRs |

## Árbol

```text
InmoGest/
├── README.md · STANDARD.md · AGENTS.md · .env.example · .gitignore
├── docs/                 documentación oficial
├── materials/            insumos de referencia (no son especificación)
├── .ai/                  reglas, prompts, contexto y workflows para IA
├── .claude/skills/       skills de Claude Code
├── .agents/skills/       skills de Codex
├── frontend/             app Next.js (panel, páginas públicas, API)
├── backend/              supabase/ (migraciones, RLS, seed, pgTAP) · worker/ · shared/
├── infrastructure/       Evolution API + worker en el VPS (Docker)
├── scripts/              automatizaciones (db-push, pgTAP, tipos)
├── tests/                unit/ · integration/ · e2e/
└── .github/workflows/    CI
```

## Requisitos (cuando haya código)

- Node.js ≥ 22 y npm ≥ 10.
- Git; en Windows, Git Bash. La ruta del proyecto contiene `&` (`C&C`), que rompe los atajos `.cmd` de npm: el `.npmrc` raíz configura Git Bash como shell de scripts y se usa siempre `npm run <script>`, nunca `npx`.
- Un proyecto de Supabase de desarrollo (nube).
- Docker solo para Evolution API (VPS o pruebas locales).
