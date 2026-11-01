# ADR 0002 — npm workspaces con paquete compartido en backend/shared

- Estado: accepted
- Fecha: 2026-10-31

## Contexto

La app Next.js (`frontend/`) y el worker (`backend/worker/`) necesitan el mismo código: esquemas Zod, tipos generados de la base, contrato del proveedor de WhatsApp y su cliente para Evolution, y utilidades de teléfonos, dinero y fechas. ADR 0001 dejó pendiente dónde vive.

## Decisión

- Un `package.json` raíz con **npm workspaces**: `frontend`, `backend/worker`, `backend/shared`.
- `backend/shared` es el paquete `@inmogest/shared`, en TypeScript, sin dependencias de Next.js ni de APIs propias de Node que no estén en el runtime de Vercel.
- La app lo consume vía `transpilePackages`; el worker, compilado con `tsc`/`tsx`.
- Un único lockfile en la raíz.

## Alternativas consideradas

- **Copiar código entre app y worker:** se desincroniza (por ejemplo, la normalización de teléfonos, que define los duplicados).
- **Worker dentro de `frontend/`:** mezcla un proceso de larga duración con la app desplegada en Vercel.
- **pnpm / Turborepo:** más herramientas sin necesidad para tres paquetes.

## Consecuencias

- `npm install` se corre una sola vez en la raíz.
- En Windows, la ruta del proyecto contiene `&` (`C&C`), que rompe los atajos `.cmd` de npm: se configura `script-shell` con Git Bash y se usa siempre `npm run`.
- **Actualización 02/11/2026:** `script-shell` se configura en el npm **de usuario** de cada máquina Windows (`npm config set script-shell "C:/Program Files/Git/bin/bash.exe" --location=user`), no en el `.npmrc` del repo. Con la ruta de Windows en el repo, todo `npm run` fallaba en Linux (`spawn … ENOENT`) y rompía el build de Vercel. El `.npmrc` del repo solo lleva configuración portable.

## Referencias

- ADR 0001, `docs/ARCHITECTURE.md`.
