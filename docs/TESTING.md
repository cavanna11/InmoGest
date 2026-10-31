# Estrategia de testing

- **Versión:** 0.1 — 31/10/2026.
- Regla general: una tarea no está terminada si alguna compuerta aplicable falla o no se ejecutó. Nunca se desactiva un test ni una validación para obtener un resultado verde.

## Compuertas

| Compuerta | Herramienta | Comando | Cuándo |
|---|---|---|---|
| Typecheck / compile | TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) + `next typegen` | `npm run typecheck` | Local antes de cada entrega y en CI. |
| Lint | ESLint (config de Next.js + TypeScript) | `npm run lint` | Local y CI. |
| Unit | Vitest | `npm test` | Local y CI. |
| Integration | Vitest contra el proyecto Supabase de desarrollo (Server Actions, worker, webhooks) | `npm run test:integration` | Local y CI con base de pruebas. |
| Base de datos | pgTAP en `backend/supabase/tests/`, dentro de una transacción que se revierte | `npm run test:db` | Toda migración que toque tablas, permisos o reglas. |
| E2E | Playwright (locale es-AR, zona America/Argentina/Buenos_Aires, viewport escritorio y 360 px) | `npm run test:e2e` | Antes de cerrar cada fase y en CI sobre la rama principal. |
| Build | `next build` y compilación del worker | `npm run build` | Local y CI. |
| Security | `npm audit --audit-level=high`; tests de aislamiento pgTAP; revisión de que ninguna variable secreta use prefijo `NEXT_PUBLIC_` | CI | Cada PR. |
| QA específico | Prueba manual de WhatsApp con un número de prueba real (conexión QR, entrante, saliente, desconexión) | Lista de verificación | Antes de cerrar cada fase que toque WhatsApp. |

Integraciones externas: los tests unitarios e integración usan un `WhatsAppProvider` falso que cumple el contrato. Que una integración "funciona" solo se afirma después de probarla contra el servicio real; si no se probó, se informa como no verificada.

## Qué se testea en cada capa

| Capa | Foco |
|---|---|
| Unit | Normalización de teléfonos (+549), dinero y monedas, cálculo de matching (obligatorios, deseables, tolerancia, cotización), cálculo del estado de cuenta, límites de envío de WhatsApp (por día, por hora, separación, horario), deduplicación de la outbox, parseo de CSV, permisos de la app por rol. |
| Base de datos (pgTAP) | Aislamiento entre inmobiliarias en lectura, inserción, actualización y borrado; claves foráneas compuestas; agentes con acceso a todo sin importar la asignación; acciones exclusivas del dueño; estados de cuenta (solo lectura rechaza escrituras, bloqueada rechaza lecturas); límites de plan; automatizaciones bloqueadas en plan Inicial; último dueño; «Ingresar como» (con sesión, sin sesión, en otra inmobiliaria, cuenta vencida); funciones públicas sin datos internos; anónimos sin acceso a tablas. |
| Integration | Webhook de Evolution idempotente; mensaje entrante crea o vincula contacto; worker respeta límites, reintenta como máximo 2 veces y pausa ante errores; matching genera y deja de generar coincidencias según estado; importación con filas inválidas; unificación y fusión conservan relaciones. |
| E2E | Recorridos críticos (abajo). |

## Datos de prueba

- `backend/supabase/seed.sql` solo para desarrollo: dos inmobiliarias (una sirve como "intrusa" en los tests de aislamiento), dueños, agentes, un superadministrador principal, contactos, propiedades, búsquedas y conversaciones ficticias.
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
