# ADR 0006 — Representación de dinero, teléfonos y fechas

- Estado: accepted
- Fecha: 2026-10-31

## Contexto

PRD §6: montos siempre con moneda y sin mezclar monedas; teléfonos argentinos canonicalizados como móvil para detectar duplicados; fechas DD/MM/AAAA en hora de Argentina. Decisiones heredadas que `docs/ARCHITECTURE.md` dejó para documentar al implementarlas (Fase 0).

## Decisión

- **Dinero:** `numeric(14,2)` + columna `currency` (`ARS` | `USD`) en la base; en TypeScript, centavos enteros `bigint` en un objeto `{ cents, currency }`. Suma y comparación devuelven error si las monedas difieren. Formato `"USD 100.000"` / `"ARS 1.234,50"`. Interpretación de montos escritos a la argentina (punto de miles, coma decimal).
- **Teléfonos:** E.164 con `libphonenumber-js` (metadata `min`); los argentinos siempre `+549…`, quitando el 0 y el 15. Regla propia para el 15 con característica de 4 dígitos, que la librería no resuelve; sin característica se rechaza. Se guarda también el valor original.
- **Fechas:** `timestamptz` en UTC; presentación y entrada en America/Argentina/Buenos_Aires con `Intl` (sin dependencias ni desfase fijo).
- Todo vive en `@inmogest/shared` para que la app, el worker y la importación usen exactamente las mismas reglas.

## Alternativas consideradas

- **Montos como `number`:** errores de redondeo en sumas y comparaciones.
- **Normalizar teléfonos a mano:** las reglas de característica, 0 y 15 son fáciles de romper y definen los duplicados.
- **date-fns-tz / Luxon:** `Intl` alcanza para formatear y convertir.

## Consecuencias

- `libphonenumber-js` (MIT, mantenida) suma unos 80 kB a los bundles que la usen: importarla solo donde se normalizan teléfonos.
- Cualquier cambio en estas reglas cambia la detección de duplicados: requiere tests y migración de datos.

## Referencias

- `backend/shared/src/money.ts`, `phone.ts`, `dates.ts` y sus tests.
