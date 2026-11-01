# Observabilidad

- **Versión:** 0.1 — 31/10/2026.
- Herramientas: logs de Vercel, logs de Supabase, logs de Docker en el VPS. Servicio externo de errores y alertas (por ejemplo Sentry) **[A CONFIRMAR: si se usa y con qué plan]**.

## Logs técnicos

Formato JSON estructurado con: fecha, nivel, componente (`web`, `worker`, `webhook`), `request_id` / `job_id`, `organization_id`, acción, duración, resultado y código de error.

**Se registra:**
- Errores de Server Actions y Route Handlers (código, no datos de entrada).
- Ciclo de vida de jobs: tomado, terminado, fallido, reintento.
- Envíos de WhatsApp: id de outbox, conexión, tipo (humano/automático), resultado, error del proveedor.
- Eventos de conexión de WhatsApp (conectado, desconectado, requiere QR).
- Webhooks recibidos: fuente, id externo, resultado (procesado, duplicado, rechazado por secreto inválido).

**Se excluye siempre:**
- Contenido de mensajes de WhatsApp, notas, nombres, teléfonos y emails de contactos.
- Contraseñas, tokens, claves, cookies, cabeceras `Authorization`, secretos de webhook.
- Enlaces de invitación, confirmación de email y recuperación de contraseña (completos o con su token), y URLs con parámetros `token`, `code` o `token_hash` (ADR 0007).
- Contenido de archivos CSV.

Cuando hace falta identificar un registro se usa su `id`, nunca el dato personal.

## Auditoría

Trazabilidad de negocio, guardada en la base (`docs/DATABASE.md`):

| Operación | Dónde |
|---|---|
| Altas, bajas, cambios de rol, invitaciones | `audit_logs` |
| Unificación de contactos y fusión de propiedades | `merge_log` + `audit_logs` |
| Conexión, desconexión y pausa de WhatsApp | `audit_logs` |
| Importaciones | `import_batches` + `audit_logs` |
| Cambios de configuración de la inmobiliaria y del embudo | `audit_logs` |
| Respuestas humanas por WhatsApp (quién, qué conversación, cuándo) | `messages` |
| Precio, estado y etapa | `property_changes`, `stage_changes` |
| Plan, estado de cuenta, pagos aprobados, límites globales (acciones del superadministrador) | `audit_logs` de plataforma |
| Sesiones de «Ingresar como» | `support_sessions` (registro técnico, no visible para la inmobiliaria) |

## Métricas / health checks

**Health checks**
- `GET /api/health` (app): responde si puede consultar la base.
- Health del worker: último ciclo procesado y tamaño de la cola, expuesto en un endpoint interno o en una tabla de latidos.
- Evolution: healthcheck de Docker + estado de cada instancia.

**Métricas técnicas** (PRD §1 y §8)

| Métrica | Fuente |
|---|---|
| Disponibilidad mensual (objetivo ≥ 99,5%) | Monitor externo sobre `/api/health` **[A CONFIRMAR servicio]** |
| Errores de procesamiento de mensajes (objetivo < 1%) | `webhook_events` y `whatsapp_outbox` por estado |
| Demora de coincidencias (< 60 s) | Diferencia entre el cambio y la creación de `match_results` |
| Demora de conversación entrante (< 10 s) | Diferencia entre recepción del webhook y disponibilidad del mensaje |
| Demora de aviso de desconexión (< 2 min) | Diferencia entre el evento del proveedor y la notificación |
| Tamaño y antigüedad de la cola de jobs y de la outbox | `jobs`, `whatsapp_outbox` |

**Métricas comerciales** (panel de superadministrador): onboarding completado, WhatsApp conectado, tiempo al primer contacto, inmobiliarias activas a 30 días, conversión de prueba a pago.

## Alertas

| Condición | Severidad | Acción |
|---|---|---|
| `/api/health` falla 3 veces seguidas | Crítica | Revisar Vercel y Supabase; procedimiento de incidentes. |
| Worker sin latido por más de 5 minutos | Alta | Reiniciar el contenedor; revisar logs. |
| Jobs pendientes con más de 5 minutos de antigüedad | Alta | Revisar el worker y errores repetidos. |
| Webhooks rechazados por secreto inválido en ráfaga | Alta | Posible intento de abuso; revisar origen. |
| Más del 1% de mensajes fallidos en una hora | Alta | Revisar Evolution y las conexiones afectadas. |
| Evolution caído o todas las instancias desconectadas | Alta | Revisar el VPS y Evolution. |
| Un número pausado automáticamente | Media | Notificación al dueño de la inmobiliaria (PRD §6); C&C revisa si se repite. |
| Backup propio diario no generado | Media | Revisar la tarea de backup. |

Los umbrales son iniciales y se ajustan con datos reales. Canal de alertas **[A CONFIRMAR: email, WhatsApp o Telegram de C&C]**.
