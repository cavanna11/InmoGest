# Tests

| Carpeta | Herramienta | Comando |
|---|---|---|
| `integration/` | Vitest contra el Supabase de desarrollo (requiere `.env.local`; sin él falla) | `npm run test:integration` |
| `e2e/` | Playwright contra el build de producción en el puerto 3100 | `npm run build` y `npm run test:e2e` |

Los tests unitarios viven junto al código (`*.test.ts` en `backend/shared`, `backend/worker` y `frontend`) y corren con `npm test`. Los de base de datos (pgTAP) están en `backend/supabase/tests/`. Estrategia completa en `docs/TESTING.md`.
