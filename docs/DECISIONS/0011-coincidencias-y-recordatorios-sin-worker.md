# ADR 0011 — Coincidencias, recordatorios e importación sin worker durante la beta

- Estado: accepted (provisorio, revisar al tener el VPS)
- Fecha: 2026-11-03

## Contexto

`docs/ARCHITECTURE.md` (flujos 6 y 8) define coincidencias e importación como jobs del worker. El worker corre en el VPS junto con Evolution API, y C&C todavía no definió dónde va a correr (ADR 0010). Sin worker, una beta con esos flujos asíncronos no tendría coincidencias, recordatorios ni importación.

## Decisión

- **Coincidencias:** el cálculo vive en funciones de la base (`app.evaluate_match`, `app.refresh_matches_for_property`, `app.refresh_matches_for_search`) y se dispara al guardar una propiedad o una búsqueda, dentro de la misma transacción.
- **Recordatorios:** `public.sync_my_reminders()` se llama al abrir el panel y genera, sin repetir, los avisos de tareas vencidas y de visitas de las próximas 24 horas de quien lo abre.
- **Importación:** se valida y se aplica en Server Actions, con tope de 1000 filas por archivo, en vez de `import_rows` y jobs.

## Alternativas consideradas

- **Esperar al VPS:** deja sin función lo que más distingue al producto en la beta.
- **Worker en otro servicio solo para esto:** suma un componente nuevo que C&C todavía no decidió pagar.
- **`pg_cron`:** resolvería los recordatorios, pero la coincidencia seguiría sin tener quién la ejecute fuera de la base y agrega configuración específica por ambiente.

## Consecuencias

- Guardar una propiedad tarda más cuantas más búsquedas activas haya; con el tamaño de una inmobiliaria del plan (hasta 1500 propiedades) es aceptable, pero hay que medirlo.
- Un recordatorio aparece recién cuando la persona abre el panel: no hay aviso con el panel cerrado.
- Al tener worker, los triggers pasan a encolar jobs que llaman a las mismas funciones, sin cambiar el cálculo ni las pantallas.

## Referencias

- `backend/supabase/migrations/20261103130000_searches_matching.sql`, `20261103140000_agenda.sql`, `frontend/modules/import/`, ADR 0005, ADR 0010.
