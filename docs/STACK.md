# Stack tecnológico

Versiones verificadas el 29–30/10/2026 y fijadas exactas en los `package.json` el 31/10/2026 (Fase 0).

| Capa | Tecnología | Versión/rango | Motivo |
|---|---|---|---|
| Frontend | Next.js (App Router, RSC, Server Actions) + React | 16.4.x / 19.3.x | Pantallas y servidor en un solo deploy; buen soporte en Vercel. |
| Frontend | TypeScript estricto | 5.9.x | Tipos en todo el código, incluidos los de la base. |
| Frontend | Tailwind CSS + shadcn/ui | 4.3.x / última | Sistema de diseño propio sin depender de una librería cerrada. |
| Backend | Server Actions y Route Handlers de Next.js | — | Validación y autorización en servidor (ver ADR 0001). |
| Backend | Worker Node.js para la cola de jobs | Node 22 LTS | Matching, mensajes automáticos y envíos sin bloquear pedidos web. |
| Backend | Evolution API (Baileys) | v2.3.7 | Conexión de WhatsApp por QR; una instancia lógica por inmobiliaria. |
| Database | Supabase: PostgreSQL + RLS, Auth, Storage, Realtime | Postgres 17 | Aislamiento multi-tenant en la base, auth y archivos incluidos. |
| Validación | Zod | 4.x | Mismos esquemas en formularios, servidor y worker. |
| Runtime | Node.js | ≥ 22 | LTS vigente. |
| Web server | Vercel (app) · VPS Hostinger con Docker (Evolution, worker) | — | Vercel para la app; el VPS mantiene WhatsApp conectado 24 h. |
| Testing | Vitest · pgTAP · Playwright | 5.x · — · 1.6x | Unitarios, aislamiento en base de datos y flujos E2E. |

Más adelante (fuera del MVP): Mercado Pago (cobros), API oficial de WhatsApp de Meta, Anthropic u OpenAI (IA), Leaflet + OpenStreetMap (mapas), `@react-pdf/renderer` y `qrcode`.

## Versiones fijadas (31/10/2026)

| Paquete | Versión | Dónde | Para qué |
|---|---|---|---|
| next · react · react-dom | 16.4.3 · 19.3.1 · 19.3.1 | frontend | App, con `cacheComponents` y `partialPrefetching`. |
| @supabase/supabase-js · @supabase/ssr | 2.118.0 · 0.12.7 | frontend, worker | Clientes de Supabase; sesión en cookies refrescada en `proxy.ts`. |
| zod | 4.6.7 | frontend, shared | Validación de entradas, variables de entorno y payloads de jobs. |
| tailwindcss · @tailwindcss/postcss | 4.3.3 | frontend (dev) | Estilos con tokens semánticos (`frontend/styles/tokens.css`). |
| clsx · tailwind-merge | 2.1.1 · 3.7.0 | frontend | Utilidad `cn` de shadcn/ui. MIT, sin dependencias. Los paquetes de cada componente de shadcn/ui (Radix, íconos) se agregan cuando una pantalla los usa. |
| server-only | 0.0.1 | frontend | Hace fallar el build si código con secretos llega al navegador. Paquete oficial de React, sin dependencias. |
| libphonenumber-js | 1.13.15 | shared | Normalización de teléfonos (ADR 0006). MIT, mantenida; metadata `min` (~80 kB). |
| typescript | 5.9.3 | raíz (dev) | Se mantiene 5.9 aunque existe 7.0: no está verificado con `next typegen` ni con typescript-eslint. |
| eslint · eslint-config-next · typescript-eslint | 9.39.5 · 16.4.3 · 8.72.1 | raíz (dev) | ESLint 9 y no 10: algunos plugins de eslint-config-next todavía no declaran soporte de ESLint 10. |
| vitest · @types/node | 5.0.5 · 22.20.5 | raíz (dev) | Vitest 5 exige @types/node ^22 o ≥ 24. |
| @playwright/test | 1.64.1 | raíz (dev) | E2E. |
| supabase (CLI) | 2.122.0 | raíz (dev) | `db push`, `gen types` y `start` (CI). Se invoca con `node`: la ruta con `&` rompe el atajo `.cmd`. MIT. |
| pg · @types/pg | 8.23.1 | raíz (dev) | Runner de pgTAP sin Docker (`scripts/run-pgtap.mjs`). MIT. |
| tsx | 4.23.15 | worker (dev) | Ejecutar el worker en desarrollo sin compilar. MIT. |

Las variables de entorno se cargan con `process.loadEnvFile` de Node (sin `dotenv`).

`npm audit` (31/10/2026): 0 vulnerabilidades en dependencias de producción; 16 moderadas en dependencias de desarrollo (`minimatch`, que traen los plugins de `eslint-config-next`). La compuerta de CI (`--audit-level=high`) pasa.

## Política de dependencias

- Cada dependencia nueva se justifica por necesidad, mantenimiento activo, licencia compatible con uso comercial e impacto en tamaño y seguridad.
- Versiones exactas en `package.json`; el lockfile se versiona.
- Actualizaciones de versión mayor en una rama aparte con todas las compuertas de `docs/TESTING.md` en verde.
- Evolution API: solo versiones estables (no RC); revisar notas de versión antes de actualizar.
- Nada de dependencias para lo que resuelve la plataforma (fetch, Intl, crypto).
