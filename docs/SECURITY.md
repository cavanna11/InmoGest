# Seguridad

- **Versión:** 0.1 — 31/10/2026. Basada en `docs/PRD.md` v0.3, `docs/ARCHITECTURE.md` y `docs/DATABASE.md`.

## Modelo de acceso

### Autenticación
- Supabase Auth con email y contraseña; confirmación de email obligatoria antes de crear la inmobiliaria.
- Contraseña de al menos 10 caracteres con mayúsculas, minúsculas y números.
- Sesión en cookies httpOnly gestionadas por `@supabase/ssr`; en el servidor la identidad se valida con `getUser()` (nunca solo con la cookie decodificada).
- Recuperación de contraseña e invitaciones con tokens de un solo uso y vencimiento (invitaciones: 7 días).
- Segundo factor (MFA) para el superadministrador principal: **[A CONFIRMAR]** (recomendado por tener acceso a todas las cuentas).
- `backend/supabase/config.toml` fija estas reglas (contraseña ≥ 10 con mayúsculas, minúsculas y números; confirmación de email) solo para Supabase local y CI. En los proyectos en la nube se configuran a mano en Authentication → Providers → Email y Policies, y hay que mantenerlas iguales.

### Autorización (RBAC + tenancy)

| Actor | Alcance |
|---|---|
| Agente | Lectura y escritura de todos los datos comerciales de su inmobiliaria (contactos, conversaciones, propiedades, búsquedas, agenda, tareas), sin importar la asignación. Reasignar solo si el dueño lo habilitó. |
| Dueño | Lo del agente + configuración, miembros, embudo, WhatsApp, unificación, fusión, importación, reportes. |
| Superadministrador principal | Panel de plataforma + «Ingresar como» con acceso de dueño sin restricciones de estado de cuenta, en una inmobiliaria por vez. Única regla que lo limita: el último dueño activo. |
| Otros usuarios de C&C | **[A CONFIRMAR si existen]**. Sin «Ingresar como». |
| Servidor (webhooks, worker) | Clave secreta de Supabase, sin RLS. Cada operación filtra por `organization_id` derivado de un dato confiable (secreto de la instancia de WhatsApp, payload del job). |
| Anónimo | Solo funciones públicas de páginas de propiedades y del feed (P1, con token). |

### Tenancy
- La inmobiliaria activa se guarda en una cookie, pero **se valida en cada pedido** contra `memberships` o contra la sesión de soporte abierta. Nunca se confía en un `organization_id` enviado por el cliente.
- RLS forzada en todas las tablas. Funciones auxiliares `SECURITY DEFINER` en el esquema `app` con `search_path` fijo:
  - `app.is_member(org)`: membresía activa, o sesión de soporte abierta del superadministrador principal para `org`.
  - `app.is_owner(org)`: rol dueño, o sesión de soporte abierta.
  - `app.can_read(org)`: `is_member` y estado efectivo distinto de `blocked` (la sesión de soporte ignora el estado).
  - `app.can_write(org)`: `is_member` y estado efectivo `trial` o `active` (la sesión de soporte ignora el estado).
- Claves foráneas compuestas: aunque una política tuviera un error, la base rechaza vincular registros de dos inmobiliarias.
- La asignación (`assigned_user_id`) no participa de ninguna política.

## Datos sensibles

| Dato | Dónde | Protección |
|---|---|---|
| Datos personales de clientes y propietarios (nombre, teléfonos, emails, notas, búsquedas) | Postgres | RLS por inmobiliaria; nunca en logs; exportación solo por miembros. |
| Conversaciones y adjuntos de WhatsApp | Postgres + Storage privado | RLS; URLs firmadas de corta duración para adjuntos. |
| Comprobantes de pago | Storage privado | Solo el dueño de la inmobiliaria y el superadministrador. |
| CSV de importación y exportación | Storage privado | Prefijo `<organization_id>/`; borrado automático tras el proceso **[A CONFIRMAR plazo]**. |
| Credenciales de usuarios | Supabase Auth | Gestionadas por Supabase; la app nunca ve contraseñas. |
| Sesiones de WhatsApp | Evolution API (VPS) | Volumen Docker sin exposición pública; acceso solo con API key. |
| Tokens (invitaciones, feed, secretos de webhook) | Postgres | Guardados como hash SHA-256; se muestran una sola vez. |
| Fotos de propiedades y logos | Storage público | Solo contenido destinado a publicarse; rutas no adivinables por inmobiliaria. |

La página pública de una propiedad nunca expone propietario, notas internas ni la dirección exacta salvo que la inmobiliaria lo elija. Las coordenadas aproximadas se redondean.

## Secrets

| Secreto | Dónde vive | Nunca |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Vercel (server), VPS (worker) | En variables `NEXT_PUBLIC_*`, en el navegador, en Git. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel, navegador | Es pública por diseño; la seguridad depende de RLS. |
| `EVOLUTION_API_KEY` | Vercel (server), VPS | En el navegador. |
| Secretos de webhook por instancia | Generados por la app; hash en la base | Reutilizados entre instancias. |
| `SUPABASE_DB_URL` | `.env.local` del desarrollador | En producción ni en el repositorio. |

- `.env.example` solo con nombres de variables y comentarios, sin valores reales ni de ejemplo que parezcan reales.
- Ambientes separados (desarrollo, producción) con proyectos de Supabase y claves distintas.
- Rotación: ante sospecha de filtración se rota la clave en Supabase/Evolution y se actualizan Vercel y el VPS **[A CONFIRMAR procedimiento en OPERATIONS.md]**.

## Controles

```text
Entrada → Validación → Autorización → Dominio → Persistencia
```

| Etapa | Control |
|---|---|
| Entrada | HTTPS; `proxy.ts` refresca la sesión; rate limiting en registro, login, invitaciones, endpoints públicos y webhooks; tamaño máximo de archivos por bucket. |
| Validación | Esquemas Zod compartidos en Server Actions, Route Handlers y worker; normalización de teléfonos y emails; validación de CSV fila por fila; tipo MIME y tamaño de imágenes y adjuntos. |
| Autorización | Sesión válida + inmobiliaria activa validada + permiso de la acción en la app (para mensajes claros) → **RLS y triggers en la base (control real)**. Webhooks: secreto por instancia comparado en tiempo constante. Feed: token por inmobiliaria. |
| Dominio | Reglas del PRD en funciones y triggers: estados de cuenta, límites de plan, último dueño, automatizaciones por plan, consentimiento y límites de envío de WhatsApp. |
| Persistencia | Claves foráneas compuestas, unicidades, `check` constraints, auditoría de acciones sensibles. |

Además:
- Cabeceras de seguridad (CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, HSTS).
- Server Actions protegidas contra CSRF por Next.js (verificación de origen).
- Sin SQL dinámico con datos del usuario; las funciones `SECURITY DEFINER` fijan `search_path` y validan sus parámetros.
- Escape de contenido de WhatsApp y de campos libres al renderizar (sin HTML crudo).
- Dependencias: `npm audit` en CI y actualización según `docs/STACK.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Acceso entre inmobiliarias por error en la app | RLS forzada + claves foráneas compuestas + tests pgTAP que intentan leer, crear y modificar datos de otra inmobiliaria y de otra sesión de soporte. |
| Uso indebido de la clave secreta en el worker o webhooks | Filtrado explícito por `organization_id` en cada consulta, derivado de datos confiables; tests de integración del worker; la clave nunca llega al navegador. |
| Compromiso de la cuenta del superadministrador principal (acceso total) | MFA recomendado **[A CONFIRMAR]**; contraseña fuerte; único usuario con ese privilegio; sesiones de soporte registradas técnicamente; alerta al iniciar sesión desde un dispositivo nuevo **[A CONFIRMAR]**. |
| Webhooks falsificados hacia la app | Secreto por instancia en la URL, comparación en tiempo constante, idempotencia por id de evento, Evolution no expuesto públicamente salvo por proxy con TLS. |
| Registro masivo / abuso de la prueba gratis | Confirmación de email, rate limiting por IP y por email, límite de inmobiliarias por usuario. |
| Envío de spam desde la plataforma (daño a números y reclamos) | Límites globales por número, consentimiento obligatorio en la base, baja respetada, plan Inicial sin automatizaciones, pausa automática ante errores. |
| Filtración de datos por la página pública | Funciones públicas que devuelven solo campos publicables; tests que verifican que borradores, pausadas y datos del propietario no salen. |
| Pérdida de datos | Backups de Supabase, soft delete donde aplica, eliminación definitiva solo por el job de retención, exportación disponible para las inmobiliarias. |
| Inyección en importaciones CSV (fórmulas al reabrir en Excel) | Al exportar, prefijar con `'` los valores que empiezan con `=`, `+`, `-`, `@`. |
| Sesión de Evolution comprometida en el VPS | VPS con firewall, solo puertos 80/443 y SSH con clave; Evolution, su Postgres y Redis sin puertos públicos; actualizaciones de seguridad del sistema. |
