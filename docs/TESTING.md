# Estrategia de testing

- **Versión:** 0.2 — 31/10/2026 (comandos reales desde la Fase 0).
- Regla general: una tarea no está terminada si alguna compuerta aplicable falla o no se ejecutó. Nunca se desactiva un test ni una validación para obtener un resultado verde.

## Compuertas

| Compuerta | Herramienta | Comando | Cuándo |
|---|---|---|---|
| Typecheck / compile | TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) + `next typegen` | `npm run typecheck` | Local antes de cada entrega y en CI. |
| Lint | ESLint (config de Next.js + TypeScript) | `npm run lint` | Local y CI. |
| Unit | Vitest | `npm test` | Local y CI. |
| Integration | Vitest contra el proyecto Supabase de desarrollo (Server Actions, worker, webhooks), en `tests/integration/`. Sin `.env.local` falla (no se saltea) | `npm run test:integration` | Local y CI con base de pruebas. |
| Base de datos | pgTAP en `backend/supabase/tests/`. `scripts/run-pgtap.mjs` se conecta con `pg` a `SUPABASE_DB_URL` (sin Docker), corre cada archivo junto con `_helpers.sql` en una transacción que siempre se revierte | `npm run test:db` (o `npm run test:db -- 02 06` para algunos archivos) | Toda migración que toque tablas, permisos o reglas. |
| E2E | Playwright (locale es-AR, zona America/Argentina/Buenos_Aires, viewport escritorio y 360 px) contra el build de producción en el puerto 3100 (`E2E_PORT`), sin reutilizar servidores existentes | `npm run build` y `npm run test:e2e` (la primera vez, `npm run e2e:install`) | Antes de cerrar cada fase y en CI sobre la rama principal. |
| Build | `next build` y compilación del worker | `npm run build` | Local y CI. |
| Security | `npm audit --audit-level=high`; tests de aislamiento pgTAP; `npm run check:env` (ninguna variable secreta con prefijo `NEXT_PUBLIC_` ni claves `sb_secret_` en el código) | CI | Cada PR. |
| QA específico | Prueba manual de WhatsApp con un número de prueba real (conexión QR, entrante, saliente, desconexión) | Lista de verificación | Antes de cerrar cada fase que toque WhatsApp. |

Integraciones externas: los tests unitarios e integración usan un `WhatsAppProvider` falso que cumple el contrato. Que una integración "funciona" solo se afirma después de probarla contra el servicio real; si no se probó, se informa como no verificada.

En CI (`.github/workflows/ci.yml`) la base es un Supabase local efímero levantado con `supabase start` en el runner (con Docker), que aplica migraciones y seed; `test:db` y `test:integration` corren contra esa base con `APP_ENV=ci`.

### E2E con autenticación

- Los tests que registran usuarios, leen emails o inician sesión se etiquetan **`@auth`** y corren **solo en CI**, con `E2E_AUTH=1`, contra el Supabase local del runner (Auth + Mailpit para los emails). Nunca contra un proyecto en la nube: `playwright.config.ts` se niega a arrancar con `E2E_AUTH=1` si `NEXT_PUBLIC_SUPABASE_URL` no es `localhost`/`127.0.0.1`.
- Datos aislados por corrida: emails únicos `e2e-<etiqueta>-<run>-…@inmogest.test` y contraseñas aleatorias que no se imprimen. Los enlaces de los emails se leen de Mailpit (`tests/e2e/support/mailpit.ts`) sin escribirlos en logs.
- Sin `E2E_AUTH`, `npm run test:e2e` excluye los `@auth`: localmente corren solo los E2E públicos, sin Docker.
- Correrlos localmente para depurar es una posibilidad futura (requiere Docker y `supabase start`), no una condición de desarrollo.
- `tests/e2e/auth-infra.spec.ts` verifica la infraestructura: confirmación obligatoria por email, link de Mailpit, ingreso y política de contraseñas. Los recorridos de registro e invitación por la interfaz llegan con el incremento 1.1.

## Qué se testea en cada capa

| Capa | Foco |
|---|---|
| Unit | Normalización de teléfonos (+549), dinero y monedas, cálculo de matching (obligatorios, deseables, tolerancia, cotización), cálculo del estado de cuenta, límites de envío de WhatsApp (por día, por hora, separación, horario), deduplicación de la outbox, parseo de CSV, permisos de la app por rol. |
| Base de datos (pgTAP) | Aislamiento entre inmobiliarias en lectura, inserción, actualización y borrado; claves foráneas compuestas; agentes con acceso a todo sin importar la asignación; acciones exclusivas del dueño; estados de cuenta (solo lectura rechaza escrituras, bloqueada rechaza lecturas); límites de plan; automatizaciones bloqueadas en plan Inicial; último dueño; «Ingresar como» (con sesión, sin sesión, en otra inmobiliaria, cuenta vencida); funciones públicas sin datos internos; anónimos sin acceso a tablas. |
| Integration | Webhook de Evolution idempotente; mensaje entrante crea o vincula contacto; worker respeta límites, reintenta como máximo 2 veces y pausa ante errores; matching genera y deja de generar coincidencias según estado; importación con filas inválidas; unificación y fusión conservan relaciones. |
| E2E | Recorridos críticos (abajo). |

### Resultados al cerrar la Fase 0 (01/11/2026)

typecheck y lint OK · unit 96/96 · build OK · pgTAP 170 aserciones, 0 fallas (7 archivos) · integración 2/2 · E2E 8/8 · `npm audit --audit-level=high` OK. CI en GitHub: los 3 jobs en verde (commit 5a6adb7).

### Resultados tras las decisiones de diseño, slugs y documentos legales (02/11/2026)

typecheck y lint OK · unit 151/151 (incluye contraste WCAG de los tokens) · build OK · pgTAP 206 aserciones, 0 fallas (8 archivos) · integración 2/2 · E2E públicos 8/8. Los E2E `@auth` todavía no corrieron: corren en CI en el próximo push a `main`.

### Resultados de los incrementos 1.4, 1.5, 1.6 y 1.8 (03/11/2026)

typecheck y lint OK · unit 235/235 · build OK · pgTAP 391 aserciones, 0 fallas (14 archivos) · E2E públicos 14/14 · pgTAP nuevos: `12_searches_matching.sql` (criterios F-12 y F-31 del PRD, embudo, notificaciones, aislamiento, unificaciones), `13_agenda.sql`, `14_payments_platform.sql` · recorrido manual en local: contacto → propiedad → búsqueda → coincidencia 67 % con motivo y aviso, tablero del embudo, visita y tarea con recordatorios, importación con errores por fila, exportación, plan y pago. No verificado en pantalla: el panel /plataforma con rol de administrador (sus RPC están cubiertas por pgTAP).

### Resultados del incremento 1.3 — propiedades y página pública (03/11/2026)

typecheck y lint OK · unit 203/203 · build OK · pgTAP 313 aserciones, 0 fallas (11 archivos; `11_properties.sql`: código y slug estables, historial de precio y estado, publicar exige precio, propietarios, duplicados por dirección o por propietario+operación+tipo, aislamiento, fotos fuera de la carpeta de la inmobiliaria, fusión solo del dueño, página pública sin borradores ni pausadas y sin dirección si no se eligió, límite del plan) · E2E públicos 14/14 · recorrido manual en local: alta, fotos subidas desde el navegador y página pública. No verificado en pantalla: el aviso de duplicado en vivo del formulario (cubierto por pgTAP).

### Resultados del incremento 1.2 — contactos y nueva paleta (03/11/2026)

typecheck y lint OK · unit 197/197 (contraste WCAG de la paleta nueva, esquemas de contactos, teléfonos) · build OK · pgTAP 284 aserciones, 0 fallas (10 archivos; `10_contacts.sql`: duplicados por teléfono y email, aislamiento, asignación y reasignación, no contactar, historial, reportes, unificación solo del dueño, agente desactivado, solo lectura) · E2E públicos 14/14 · recorrido manual en local: alta, duplicado detectado, nota, reporte y unificación.

### Cobertura actual (Fase 0)

| Archivo | Cubre |
|---|---|
| `backend/shared/src/*.test.ts` | Teléfonos (+549, 0 y 15, característica de 4 dígitos), dinero (centavos, monedas, formato, conversión a `numeric(14,2)`), fechas (DD/MM/AAAA, hora de Argentina), traducción de errores de Postgres. |
| `backend/worker/src/runner.test.ts` | Toma y completa jobs, tipos desconocidos, payload inválido, errores de handlers, bucle resistente a fallas y apagado. |
| `frontend/lib/health.test.ts` | Health check con y sin configuración, base caída. |
| `backend/supabase/tests/01_schema_security.sql` | RLS forzada en todas las tablas, permisos de `anon`/`authenticated`, `SECURITY DEFINER` con `search_path`, `BYPASSRLS` del dueño de las funciones, planes iniciales. |
| `…/02_isolation.sql` | Aislamiento A/B en lectura, alta, modificación y borrado; acciones solo del dueño; plan y estado solo de C&C; cola y rate limit inaccesibles; claves inmutables; anónimos. |
| `…/03_account_states.sql` | Estado efectivo por fechas (día 15, 45, 135, bordes), solo lectura, bloqueada, reactivación, suspensión, agente desactivado. |
| `…/04_last_owner.sql` | Último dueño activo para todos los roles, cambio de dueño, borrado completo de la inmobiliaria. |
| `…/05_plan_limits.sql` | Límite de usuarios (miembros + invitaciones abiertas), mensaje con límite y plan, cambio de límite sin desplegar, números de WhatsApp sin definir, sesión de soporte sin límites. |
| `…/06_support_session.sql` | «Ingresar como»: sin sesión, con sesión, cambio de inmobiliaria, solo lectura y bloqueada, último dueño, salida, nadie más puede usarlo. |
| `…/08_slugs_legal.sql` | Slugs: sufijos, cambio por el dueño, historial reservado, redirección, vuelta al slug propio, inmobiliaria eliminada. Documentos legales: registro bloqueado sin configuración explícita, borradores solo con habilitación, aceptaciones solo de vigentes y marcadas, documentos aceptados inmutables. |
| `frontend/styles/tokens.test.ts` | Contraste WCAG AA de los tokens de diseño (claro y oscuro). |
| `backend/shared/src/slug.test.ts` | Generación y validación de slugs. |
| `tests/e2e/auth-infra.spec.ts` (`@auth`, solo CI) | Confirmación de email por Mailpit, ingreso, política de contraseñas. |
| `…/07_jobs_rate_limits.sql` | Idempotencia, toma única, reintentos con espera, lock vencido, rate limiting. |
| `tests/integration/worker-queue.test.ts` | Worker real contra la cola de Supabase; la clave publicable no accede a la cola. |
| `tests/e2e/smoke.spec.ts` | Página inicial (sin botones ni enlaces), sin desplazamiento horizontal a 360 px, cabeceras de seguridad, `/api/health`. |

Pendiente de la Fase 1 (llega con las tablas del CRM): claves foráneas compuestas entre tablas de una inmobiliaria, agentes con acceso a todo sin importar la asignación, automatizaciones bloqueadas en plan Inicial y funciones públicas de propiedades.

## Datos de prueba

- `backend/supabase/seed.sql` solo para desarrollo: dos inmobiliarias (una sirve como "intrusa" en los tests de aislamiento), dueños, agentes y un superadministrador principal. Desde la Fase 1 se suman contactos, propiedades, búsquedas y conversaciones ficticias.
- Los tests pgTAP no dependen del seed: cada archivo crea sus propios datos dentro de la transacción que se revierte.
- Sin datos personales reales ni credenciales reales. Emails en dominios `.test`; teléfonos de rangos ficticios.
- Las contraseñas de los usuarios de prueba se documentan en el encabezado del seed y no valen en ningún otro ambiente.

## Recorridos críticos

1. Registro → confirmación de email → asistente de configuración → panel.
2. Invitar agente → aceptar invitación → el agente edita un contacto y una propiedad asignados a otro.
3. Desactivar agente → pierde acceso → sus pendientes quedan sin asignar.
4. Cargar propiedad → coincide con una búsqueda → notificación al agente → enviar ficha por WhatsApp.
5. Mensaje entrante de número nuevo → contacto creado → primer agente que abre queda asignado → otro agente responde → se registra quién respondió.
6. Importar CSV con filas válidas e inválidas → vista previa → confirmar → descargar rechazadas.
7. Reportar duplicado → el dueño unifica → el contacto conserva conversaciones, búsquedas y notas.
8. Vencimiento de prueba → solo lectura (exporta, no edita, recibe mensajes, no responde) → activación por C&C → vuelve a operar.
9. Límite de plan: superar propiedades o usuarios; plan Inicial sin automatizaciones; segundo número rechazado en Inicial y Profesional.
10. «Ingresar como» → operar en la inmobiliaria → salir → no ver más sus datos.
11. Página pública de propiedad visible sin sesión; borrador y pausada no encontradas.
12. Mensaje automático (P1): respeta consentimiento, baja, horario y topes; no se duplica.
