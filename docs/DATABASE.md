# Datos y base de datos

- **Versión:** 0.1 — 31/10/2026. Basada en `docs/PRD.md` v0.3.
- Motor: PostgreSQL 17 en Supabase. Migraciones en `backend/supabase/migrations/`.

## Convenciones

- Claves primarias `uuid` (`gen_random_uuid()`); `created_at` y `updated_at` (`timestamptz`, trigger de actualización).
- Toda tabla de una inmobiliaria tiene `organization_id not null` y `unique (organization_id, id)`. Las referencias entre tablas de una inmobiliaria son **claves foráneas compuestas** `(organization_id, x_id)`: la base rechaza vincular datos de dos inmobiliarias distintas.
- RLS habilitada y forzada en todas las tablas expuestas. Funciones auxiliares de permisos en el esquema `app` (no expuesto por la API); funciones llamables (RPC) en `public` con `execute` otorgado explícitamente.
- Montos: `numeric(14,2)` + columna `currency` (`ARS` | `USD`). Nunca un monto sin moneda.
- Teléfonos: E.164; los argentinos como móvil (`+549…`). Se guarda también el valor tal como se cargó.
- Emails: `citext`.
- Fechas en UTC; la zona horaria de presentación es America/Argentina/Buenos_Aires.
- Enums de Postgres para estados estables; tablas de configuración para lo que el dueño o C&C editan (etapas, planes).
- Asignación: columna `assigned_user_id` (nullable) con clave foránea compuesta a la membresía. **No se usa en ninguna política de acceso**; solo para filtrar y notificar.

## Entidades

### Plataforma (C&C)

| Tabla | Propósito |
|---|---|
| `plans` | Planes comerciales: código, nombre, precio de referencia USD, `max_users`, `max_properties`, `max_whatsapp_numbers` (nullable = sin definir), `includes_automations`. Editable solo por el superadministrador. |
| `platform_settings` | Configuración global: límites de WhatsApp (30/día, 10/hora, 15 s, 2 reintentos), horario permitido de automáticos, ventana de anti-abuso del registro. Una fila, versionada. |
| `platform_admins` | Usuarios de C&C con acceso al panel. `is_principal` marca al superadministrador principal (único). |
| `support_sessions` | Sesiones de «Ingresar como»: usuario, inmobiliaria, inicio, fin. Una abierta por usuario como máximo. |
| `legal_documents` | Versiones de términos y política de privacidad. |
| `payment_reports` | Pagos por transferencia informados por las inmobiliarias: plan, período, monto informado, comprobante (Storage privado), estado (pendiente, aprobado, rechazado), quién lo revisó. |

### Inmobiliaria, usuarios y cuenta

| Tabla | Propósito |
|---|---|
| `organizations` | Inmobiliaria: nombre comercial, slug, logo, contacto, moneda por defecto, configuración (cotización USD/ARS habilitada y valor, si los agentes pueden reasignar), `plan_code`, `trial_ends_at`, `paid_until`, `suspended_at`, `deleted_at`. |
| `profiles` | Datos del usuario (nombre, teléfono, avatar), 1 a 1 con `auth.users`. |
| `memberships` | Usuario ↔ inmobiliaria con rol (`owner`, `agent`; reservados `admin`, `supervisor`, `staff`) y estado (activa, desactivada). |
| `invitations` | Invitaciones por email con token (hash), vencimiento y rol. |
| `legal_acceptances` | Qué versión de términos y privacidad aceptó cada usuario, cuándo. |
| `onboarding_progress` | Pasos del asistente completados por inmobiliaria. |

### CRM

| Tabla | Propósito |
|---|---|
| `contacts` | Persona: nombre, notas, origen, `is_owner` / `is_prospect` (derivados), `do_not_contact` (baja), `assigned_user_id`, `merged_into_id`. |
| `contact_phones` | Teléfonos de un contacto (E.164, etiqueta, si es WhatsApp). Único por inmobiliaria. |
| `contact_emails` | Emails de un contacto. Único por inmobiliaria. |
| `duplicate_reports` | Posibles duplicados (contactos o propiedades) reportados por un agente o detectados por el sistema; estado (abierto, unificado, descartado). |
| `merge_log` | Registro de unificaciones y fusiones: qué registro absorbió a cuál, quién, cuándo, snapshot del absorbido. |
| `locations` | Zonas jerárquicas (provincia → ciudad → barrio) por inmobiliaria. |
| `feature_catalog` | Características globales (cochera, pileta, apto crédito…). |
| `properties` | Propiedad: código (PRO-000123), slug, operación, tipo, ubicación, dirección y visibilidad, precio y moneda, ambientes, dormitorios, baños, superficies, características, estado (borrador, disponible, reservada, vendida, alquilada, pausada), `assigned_user_id`, `merged_into_id`. |
| `property_owners` | Propiedad ↔ contacto propietario. |
| `property_images` | Fotos (ruta en Storage, orden, portada). |
| `property_changes` | Historial de precio y estado. |
| `client_searches` | Búsqueda de un contacto: operación, tipos, presupuesto mínimo y máximo con moneda, `budget_tolerance_pct` (default 10), ambientes/dormitorios mínimos, características obligatorias y deseables, etapa del embudo, `assigned_user_id`. |
| `client_search_locations` | Zonas de una búsqueda. |
| `pipeline_stages` | Etapas del embudo por inmobiliaria: nombre, posición, `kind` (`open`, `won`, `lost`), activa. |
| `stage_changes` | Historial de cambios de etapa. |
| `match_results` | Coincidencia búsqueda ↔ propiedad: puntaje, deseables cumplidos/total, `over_budget`, cotización usada, explicación, estado (nueva, vista, enviada, descartada), versión del algoritmo. |
| `appointments` | Visitas (requieren contacto y propiedad) y otras citas; estado; `assigned_user_id`. |
| `tasks` | Tareas con vencimiento, prioridad, estado; contacto/propiedad opcionales; `assigned_user_id`. |
| `activities` | Historial unificado por contacto y propiedad (nota, llamada, mensaje enviado, cambio de etapa, ficha enviada…), con autor. |
| `notifications` | Notificaciones internas por usuario, con clave de deduplicación. |

### WhatsApp

| Tabla | Propósito |
|---|---|
| `whatsapp_connections` | Número conectado: proveedor (`evolution` / `cloud_api`), nombre de instancia, número E.164, estado (conectando, conectado, desconectado, requiere QR), `automations_paused_at` y motivo, aceptación de pautas (quién, cuándo), secreto del webhook (hash). |
| `conversations` | Chat entre un número de la inmobiliaria y un contacto: último mensaje, no leídos, `assigned_user_id`, asignado al abrir. |
| `messages` | Mensaje: dirección (entrante, saliente), `kind` (`human`, `automated`, `system`), `author_user_id` (respuestas humanas), tipo (texto, imagen, audio, documento), contenido, medio en Storage, id externo (único por conexión), estado de entrega. |
| `whatsapp_outbox` | Cola de salida: conexión, contacto, contenido, `kind`, `dedupe_key` (única por inmobiliaria), `scheduled_for`, estado (en cola, enviando, enviado, fallido, cancelado), intentos, último error, origen (automatización, recordatorio, respuesta). |
| `automation_settings` | Automatizaciones predefinidas activadas por inmobiliaria y sus parámetros (P1). |
| `reminder_templates` | Plantillas y anticipación de recordatorios por WhatsApp (P1). |
| `whatsapp_api_requests` | Pedidos de API oficial a C&C. |

### Operación

| Tabla | Propósito |
|---|---|
| `jobs` | Cola de trabajos: tipo, payload, `idempotency_key`, estado, intentos, `run_after`, lock. |
| `webhook_events` | Eventos recibidos (fuente + id externo únicos) para idempotencia y diagnóstico. |
| `import_batches` / `import_rows` | Importaciones CSV: archivo, tipo, estado; filas con datos, errores y duplicados detectados. |
| `api_tokens` | Tokens del feed de propiedades (P1), guardados como hash. |
| `audit_logs` | Auditoría de acciones sensibles dentro de la inmobiliaria (miembros, roles, unificaciones, fusiones, configuración de WhatsApp, importaciones). |
| `rate_limits` | Contadores para limitar abuso (registro, invitaciones, endpoints públicos). |

## Relaciones

```text
plans
└── organizations ── legal_acceptances, onboarding_progress, payment_reports
    ├── memberships ── profiles ── auth.users
    ├── invitations
    ├── pipeline_stages
    ├── locations (jerárquica)
    ├── contacts
    │   ├── contact_phones / contact_emails
    │   ├── client_searches ── client_search_locations, stage_changes ── pipeline_stages
    │   │   └── match_results ── properties
    │   ├── property_owners ── properties
    │   ├── conversations ── messages
    │   ├── appointments ── properties
    │   ├── tasks, activities
    │   └── duplicate_reports, merge_log
    ├── properties ── property_images, property_changes
    ├── whatsapp_connections ── conversations, whatsapp_outbox
    ├── automation_settings, reminder_templates
    ├── notifications ── memberships
    ├── import_batches ── import_rows
    └── audit_logs, api_tokens, jobs

platform_admins ── support_sessions ── organizations
platform_settings, legal_documents (globales)
```

## Restricciones e índices

### Aislamiento y permisos
- Claves foráneas compuestas en todas las relaciones dentro de una inmobiliaria.
- `assigned_user_id` y `author_user_id` referencian `memberships (organization_id, user_id)`: no se puede asignar a alguien de otra inmobiliaria.
- Políticas RLS (detalle en `docs/SECURITY.md`):
  - Lectura: miembro activo de la inmobiliaria (o sesión de soporte abierta) y cuenta no bloqueada.
  - Escritura de datos comerciales: miembro activo, cualquier rol, con estado efectivo `trial` o `active`.
  - Escritura de configuración, miembros, etapas, conexiones de WhatsApp, unificaciones, fusiones e importaciones: solo dueño.
  - Planes, estados de cuenta, pagos aprobados y configuración global: solo superadministrador.

### Reglas en la base
- **Último dueño:** trigger que impide desactivar, cambiar de rol o eliminar al último dueño activo. Aplica a todos, incluido el superadministrador.
- **Estado efectivo** (`app.organization_state(org)`):
  - `suspended_at` no nulo → `blocked`.
  - `now() < greatest(trial_ends_at, paid_until)` → `trial` o `active`.
  - hasta 30 días después → `read_only`.
  - hasta 120 días después (30 + 90) → `blocked`.
  - después → `pending_deletion` (lo elimina el job de retención).
- **Límites de plan:** triggers `before insert` en `memberships`/`invitations`, `properties` y `whatsapp_connections` que cuentan los existentes y rechazan con un código propio si se supera el límite del plan. Si `max_whatsapp_numbers` es nulo, solo se permite 1 hasta que el superadministrador lo defina.
- **Automatizaciones por plan:** trigger que impide activar automatizaciones o recordatorios por WhatsApp, y que la outbox acepte mensajes `automated`, si el plan no las incluye.
- **Embudo:** trigger que impide desactivar la última etapa activa de tipo `won` o `lost`; el `kind` de una etapa no se puede cambiar si tiene búsquedas.
- **Unicidad:**
  - `contact_phones (organization_id, phone_e164)` y `contact_emails (organization_id, email)`.
  - `properties (organization_id, code)` y `(organization_id, slug)`; `organizations (slug)`.
  - `messages (connection_id, external_id)`; `whatsapp_outbox (organization_id, dedupe_key)`.
  - `webhook_events (source, external_id)`; `jobs (idempotency_key)` mientras esté pendiente.
  - `support_sessions (user_id) where ended_at is null`; `platform_admins where is_principal`.
- **Matching:** `match_results` solo admite filas que cumplan los obligatorios; la tolerancia es `0 ≤ budget_tolerance_pct ≤ 100` **[A CONFIRMAR tope]**.

### Índices principales
- `(organization_id, …)` como prefijo en todos los listados: contactos por nombre (trigram), propiedades por estado/operación/tipo/ubicación/precio, búsquedas por etapa, conversaciones por último mensaje, mensajes por conversación y fecha, agenda por fecha, tareas por vencimiento.
- `(organization_id, assigned_user_id)` para los filtros "mis …".
- Outbox: `(connection_id, status, scheduled_for)` para que el worker tome lo próximo de cada número.
- Jobs: `(status, run_after)`.

## Migraciones, auditoría y retención

### Migraciones
- Archivos SQL versionados `AAAAMMDDHHMMSS_descripcion.sql` en `backend/supabase/migrations/`; nunca se edita una migración ya aplicada en un ambiente compartido.
- Se aplican con `npm run db:push` contra el proyecto de desarrollo; producción solo con aprobación explícita.
- Cada migración que toca permisos va acompañada de tests pgTAP en `backend/supabase/tests/`.
- Los tipos TypeScript se generan desde la base y se versionan en `backend/shared`.

### Auditoría
- `audit_logs` registra acciones sensibles dentro de la inmobiliaria: altas, bajas y cambios de rol de miembros, invitaciones, unificaciones de contactos, fusiones de propiedades, conexión y desconexión de WhatsApp, importaciones y cambios de configuración.
- Las respuestas humanas de WhatsApp registran autor y fecha en `messages`.
- `property_changes` y `stage_changes` guardan el historial comercial.
- `support_sessions` es un registro técnico necesario para que «Ingresar como» funcione; no se muestra a la inmobiliaria (PRD §6).

### Retención
| Dato | Retención |
|---|---|
| Cuenta en solo lectura | 30 días, todos los datos disponibles. |
| Cuenta bloqueada | 90 días más; luego se eliminan todos los datos de la inmobiliaria (filas y archivos de Storage). |
| Registros absorbidos por unificación/fusión | Se conservan como snapshot en `merge_log` mientras exista la inmobiliaria. |
| `webhook_events`, `jobs` terminados | **[A CONFIRMAR]** (propuesta técnica: 30 días). |
| Backups de Supabase | Según el plan contratado de Supabase; los datos eliminados pueden persistir en backups hasta su rotación (se informa en la política de privacidad). |
