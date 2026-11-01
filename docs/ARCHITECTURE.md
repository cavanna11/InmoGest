# Arquitectura

- **Versión:** 0.1 — 31/10/2026. Basada en `docs/PRD.md` v0.3 y `docs/STACK.md`.
- Lo marcado **[A CONFIRMAR]** depende de una pregunta abierta del PRD.

## Diagrama

```text
                Navegador (panel CRM, páginas públicas de propiedades)
                                   │ HTTPS
                                   ▼
┌───────────────────────── Vercel ─────────────────────────┐
│ frontend/  Next.js App Router                            │
│  • Páginas (RSC) y Server Actions del panel              │
│  • Panel de superadministrador                           │
│  • Páginas públicas /p/<inmobiliaria>/<propiedad>        │
│  • Route Handlers: webhooks de Evolution, exportaciones, │
│    feed de propiedades (P1), health                      │
└───────┬──────────────────────────────────────┬───────────┘
        │ supabase-js (sesión del usuario → RLS)│ webhooks HTTPS
        ▼                                       │
┌──────────── Supabase (nube) ───────────┐      │
│ PostgreSQL 17 + RLS                    │      │
│  • datos de todas las inmobiliarias    │      │
│  • cola de jobs y outbox de WhatsApp   │      │
│ Auth · Storage · Realtime              │      │
└───────▲─────────────────────▲──────────┘      │
        │ realtime (RLS)      │ clave secreta    │
        │                     │ (solo servidor)  │
   Navegador            ┌─────┴──────── VPS (Docker) ─────────────┐
                        │ backend/worker  consumidor de jobs y    │
                        │                 envíos de WhatsApp      │
                        │ Evolution API v2.3.7 (+ Postgres, Redis)│──┐
                        └─────────────────────────────────────────┘  │
                                                           WhatsApp (QR / Baileys)
```

## Componentes

| Componente | Ubicación | Responsabilidad | Límites |
|---|---|---|---|
| App web | `frontend/` | Interfaz del panel, Server Actions (validación con Zod + autorización), páginas públicas de propiedades, webhooks, exportación CSV, panel de superadministrador. | No usa la clave secreta de Supabase salvo en Route Handlers de webhooks y en acciones del superadministrador que lo requieran explícitamente. Nunca en el navegador. |
| Base de datos | `backend/supabase/` | Esquema, RLS, funciones, triggers, cola de jobs, outbox de WhatsApp, seed de desarrollo y tests pgTAP. Es la **fuente de verdad de los permisos**. | La lógica que garantiza aislamiento, estados de cuenta y límites de plan vive acá, no solo en la app. |
| Worker | `backend/worker/` | Consume jobs: matching, importación CSV, procesamiento de medios de WhatsApp, envío de mensajes de la outbox respetando límites, cálculo de estados de cuenta y eliminación de datos vencidos. | Proceso Node de larga duración en el VPS. Usa la clave secreta (sin RLS) y por eso **cada operación filtra por `organization_id` explícitamente**. |
| Código compartido | `backend/shared/` | Esquemas Zod, tipos generados de la base, contrato `WhatsAppProvider` y su implementación para Evolution, utilidades (teléfonos, dinero, fechas). | Sin dependencias de Next.js ni de Node específicas del worker. Ver [ADR 0002](DECISIONS/0002-workspaces-y-codigo-compartido.md). |
| Evolution API | `infrastructure/evolution/` | Mantener las sesiones de WhatsApp por QR (una instancia lógica por número conectado), enviar y recibir mensajes. | Solo accesible desde el worker y la app con su API key; webhooks hacia la app con secreto por instancia. |
| Supabase Auth | servicio | Usuarios, sesiones, confirmación de email, recuperación de contraseña. | Registro abierto vía la app (CU-01), no directo contra Auth. |
| Supabase Storage | servicio | Fotos de propiedades (público), logos (público), adjuntos de WhatsApp, CSV de importación y exportación (privados). | Rutas con prefijo `<organization_id>/`; políticas de Storage por ese prefijo. |
| Supabase Realtime | servicio | Actualizar bandeja, conversaciones y cambios del CRM en otras sesiones abiertas. | Suscripciones filtradas por RLS. |

### Estructura de carpetas

```text
frontend/                  app Next.js (paquete npm "@inmogest/web")
├── app/
│   ├── (auth)/            registro, login, recuperación, invitaciones
│   ├── (panel)/           CRM de la inmobiliaria
│   ├── admin/             panel de superadministrador
│   ├── p/[org]/[slug]/    página pública de propiedad
│   └── api/               webhooks, exportaciones, feed (P1), health
├── modules/<dominio>/     actions.ts · queries.ts · components/  (por dominio del PRD)
├── components/            UI compartida (shadcn/ui + design system)
└── lib/                   supabase (server/browser/admin), auth, tenant, permisos
backend/
├── supabase/              config.toml · migrations/ · seed.sql · tests/ (pgTAP)
├── worker/                paquete "@inmogest/worker"
└── shared/                paquete "@inmogest/shared"
infrastructure/
└── evolution/             docker-compose (Evolution + worker), .env.example, guía del VPS
tests/                     unit/ · integration/ · e2e/ (Playwright)
scripts/                   db-push, run-pgtap, generación de tipos
```

Dominios (`modules/`): `auth`, `onboarding`, `organization`, `members`, `contacts`, `properties`, `searches`, `matching`, `pipeline`, `inbox` (WhatsApp), `automations`, `agenda`, `activity`, `notifications`, `import-export`, `billing` (planes, pagos informados), `admin` (superadministrador).

## Flujos principales

### 1. Pedido autenticado del panel
```text
Navegador → Server Action → Zod (entrada) → sesión (Supabase Auth)
  → inmobiliaria activa (cookie, validada contra memberships)
  → verificación de permiso en la app (UX y mensajes claros)
  → supabase-js con la sesión del usuario → RLS + triggers (verificación real)
  → resultado tipado (ok | error con código) → revalidación / Realtime
```
- El `organization_id` nunca se toma del cliente sin validar: se resuelve de la membresía del usuario o de la sesión de soporte (flujo 7).
- Las reglas que no dependen de la pantalla (aislamiento, solo lectura, límites de plan, último dueño, permisos de dueño) se aplican en la base. La app las repite solo para dar buenos mensajes.

### 2. Registro self-service (CU-01)
```text
Formulario → Server Action → Supabase Auth signUp (email + contraseña)
  → confirmación de email → primer ingreso → función create_organization
     (crea inmobiliaria en prueba 14 días, membresía de dueño, embudo predefinido,
      registra versión de términos aceptada) → asistente de configuración
```
La función de creación verifica que el usuario confirmó el email y limita cuántas inmobiliarias puede crear por usuario y por ventana de tiempo (anti-abuso) **[A CONFIRMAR valor]**.

- El formulario de registro solo se muestra si `registration_legal_documents()` devuelve términos y privacidad vigentes (ADR 0009); si no, la página informa que el registro no está disponible.
- El slug se genera del nombre con `slugify` y `available_organization_slug` (ADR 0008).
- Confirmación y recuperación usan los emails de Supabase Auth (ADR 0007).

### 3. Estado de cuenta (prueba, activa, solo lectura, bloqueada)
- La base calcula el **estado efectivo** a partir de fechas (`trial_ends_at`, `paid_until`) y de una suspensión manual; no depende de que un job corra a tiempo.
- Las políticas de escritura de RLS exigen estado efectivo `trial` o `active`. En `read_only` solo pasan lecturas, exportaciones y la escritura de mensajes entrantes (que hace el servidor, no el usuario).
- En `blocked`, la app cierra el acceso y RLS niega también las lecturas.
- Un job diario elimina las inmobiliarias cuyo plazo de conservación venció.

### 4. Mensaje entrante de WhatsApp (CU-04)
```text
WhatsApp → Evolution → POST /api/webhooks/evolution/<secreto de instancia>
  → valida secreto → guarda webhook_event (idempotente por id de mensaje)
  → upsert de contacto por teléfono normalizado → upsert de conversación
  → insert de mensaje → Realtime notifica a la bandeja (objetivo < 10 s)
  → si trae medios: job "whatsapp.media" descarga y guarda en Storage
  → responde 200 rápido
```
Funciona también en solo lectura (el webhook escribe con la clave secreta). Si en solo lectura un número nuevo crea el contacto está pendiente en el PRD **[A CONFIRMAR]**; el diseño soporta ambas opciones.

### 5. Respuesta humana y envíos automáticos
```text
Agente responde → Server Action → insert en whatsapp_outbox (kind = human, autor = agente)
  → worker lo toma de inmediato (sin límites de automáticos) → Evolution → estado

Automatización / recordatorio → insert en whatsapp_outbox (kind = automated, dedupe_key)
  → worker: horario permitido? tope diario/horario del número? 15 s desde el último?
     consentimiento (conversación previa, sin baja)? número no pausado? plan con automatizaciones?
  → envía o reprograma → registra resultado; error → reintento (máx. 2)
  → error relevante → pausa los automáticos del número y notifica al dueño
```
- La `dedupe_key` única (ej. `match:<búsqueda>:<propiedad>`, `reminder:<visita>:<anticipación>`) impide duplicados aunque haya reintentos.
- Los límites se leen de la configuración global en cada ciclo, así un cambio del superadministrador aplica a los envíos siguientes.
- El worker serializa los envíos por número (un solo consumidor por conexión a la vez) para respetar la separación mínima.

### 6. Matching (CU-07)
```text
Cambio en propiedad o búsqueda → trigger encola job "matching.property" / "matching.search"
  (idempotente, con pequeña demora para agrupar ediciones seguidas)
  → worker calcula coincidencias (obligatorios, deseables, tolerancia, moneda)
  → upsert de match_results → notificación al agente asignado → Realtime
```
Objetivo: < 60 s desde el cambio. Si una propiedad deja de estar disponible o una búsqueda pasa a etapa terminal, el job no genera coincidencias nuevas y conserva las anteriores.

### 7. «Ingresar como» (CU-16)
```text
Superadministrador principal → panel admin → "Ingresar como" (inmobiliaria X)
  → función start_support_session(X): verifica que es el superadministrador principal,
     cierra cualquier sesión de soporte anterior y abre una para X
  → la app cambia la inmobiliaria activa a X y muestra el aviso permanente
  → RLS: las funciones de membresía tratan al superadministrador como dueño de X
     mientras su sesión de soporte esté abierta, ignorando el estado de la cuenta
  → "Salir" → end_support_session() → vuelve al panel admin
```
Una sola inmobiliaria por vez y sin duración máxima (PRD §6). La regla del último dueño se mantiene. Ver [ADR 0003](DECISIONS/0003-acceso-de-soporte-ingresar-como.md).

### 8. Importación CSV (CU-12)
```text
Subida del CSV a Storage privado → job "import.parse" valida fila por fila
  (mismas reglas que la carga manual) → filas en import_rows con errores y duplicados
  → vista previa → el dueño confirma → job "import.apply" inserta las válidas
  respetando límites del plan → reporte descargable de filas rechazadas
```

### 9. Página pública de propiedad (F-10)
- URL: `https://<dominio>/p/<slug-inmobiliaria>/<slug-propiedad>` (dominio previsto `inmopanel.com.ar`, todavía no comprado).
- Se sirve con funciones públicas de la base que devuelven solo campos publicables (sin datos del propietario, dirección exacta solo si la inmobiliaria lo eligió).
- Caché por propiedad, invalidada al editar la propiedad.
- La web institucional por subdominio o dominio propio (Fase 3) reutiliza estas mismas funciones.

### 10. Feed de propiedades para webs propias (F-33, P1)
Endpoint de solo lectura por inmobiliaria, autenticado con un token generado por el dueño, que devuelve las propiedades publicadas en un formato genérico. Formato y alcance **[A CONFIRMAR al diseñar F-33]**.

## Requisitos transversales

### Rendimiento (PRD §8)
| Objetivo | Cómo se logra |
|---|---|
| Panel < 3 s | Server Components, consultas con índices por `organization_id`, paginación, imágenes optimizadas. |
| Cambios del CRM < 3 s | Supabase Realtime sobre las tablas de la bandeja, agenda y fichas abiertas. |
| Conversación entrante < 10 s | Webhook que solo persiste y responde; medios en segundo plano. |
| Coincidencia < 60 s | Cola de jobs con demora corta y worker siempre activo. |
| Desconexión < 2 min | Evento de conexión de Evolution por webhook + chequeo periódico del estado de cada instancia desde el worker. |

### Errores
- Las Server Actions devuelven un resultado tipado (`ok` / `error` con código y mensaje en español); los errores de Postgres se traducen (permiso, duplicado, referencia inválida, límite de plan, cuenta en solo lectura).
- Ningún error expone SQL, stack traces ni datos de otra inmobiliaria.

### Observabilidad
Detalle en `docs/OBSERVABILITY.md`. Mínimo: logs estructurados sin datos personales, registro de cada envío de WhatsApp, estado de las conexiones, health check de app y worker.

### Escalabilidad
- Una base compartida con `organization_id` en todas las tablas e índices compuestos.
- El worker escala con más procesos; la toma de jobs usa `FOR UPDATE SKIP LOCKED`.
- Evolution: un despliegue compartido con una instancia lógica por número; si crece, se reparte en más VPS por grupos de inmobiliarias.

## Decisiones relevantes

| ADR | Decisión |
|---|---|
| [0001](DECISIONS/0001-estructura-frontend-backend.md) | Next.js completo en `frontend/`; base, worker e integraciones en `backend/`. |
| [0002](DECISIONS/0002-workspaces-y-codigo-compartido.md) | npm workspaces con paquete compartido `backend/shared`. |
| [0003](DECISIONS/0003-acceso-de-soporte-ingresar-como.md) | «Ingresar como» mediante sesión de soporte reconocida por RLS. |
| [0004](DECISIONS/0004-aislamiento-multi-tenant-en-la-base.md) | Aislamiento multi-tenant en la base: RLS forzada, funciones de permisos y claves foráneas compuestas. |
| [0005](DECISIONS/0005-cola-de-jobs-en-postgres.md) | Cola de jobs en PostgreSQL (`claim_jobs` con `SKIP LOCKED`). |
| [0006](DECISIONS/0006-dinero-telefonos-y-fechas.md) | Dinero en centavos con moneda, teléfonos E.164 (+549) y fechas en hora de Argentina. |
| [0007](DECISIONS/0007-emails-y-enlaces-de-invitacion.md) | Emails de Auth por el SMTP de Supabase (proveedor transaccional antes de la beta); invitaciones con enlace copiable. |
| [0008](DECISIONS/0008-slugs-de-inmobiliarias.md) | Slugs generados del nombre, modificables, con historial reservado y redirección. |
| [0009](DECISIONS/0009-publicacion-de-documentos-legales.md) | Registro habilitado solo con términos y privacidad publicados explícitamente; borradores solo en desarrollo. |

Decisión heredada del diseño anterior que se documentará como ADR al implementarla:
- Evolution API v2.3.7 compartido, una instancia lógica por número.
