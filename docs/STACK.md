# Stack tecnológico

Versiones verificadas el 29–30/10/2026. Se fijan exactas en `package.json` al iniciar el código.

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

## Política de dependencias

- Cada dependencia nueva se justifica por necesidad, mantenimiento activo, licencia compatible con uso comercial e impacto en tamaño y seguridad.
- Versiones exactas en `package.json`; el lockfile se versiona.
- Actualizaciones de versión mayor en una rama aparte con todas las compuertas de `docs/TESTING.md` en verde.
- Evolution API: solo versiones estables (no RC); revisar notas de versión antes de actualizar.
- Nada de dependencias para lo que resuelve la plataforma (fetch, Intl, crypto).
