# ADR 0007 — Emails de Auth, emails propios y enlaces de invitación

- Estado: accepted
- Fecha: 2026-11-02

## Contexto

El registro, la recuperación de contraseña y las invitaciones a agentes (CU-01, CU-02) necesitan emails. El SMTP incluido en Supabase solo sirve para desarrollo: envía únicamente a los emails del equipo del proyecto y con un límite muy bajo por hora. El dominio definitivo todavía no está decidido (PRD §11).

## Decisión

- **Desarrollo:** confirmación de email y recuperación de contraseña con el SMTP por defecto de Supabase.
- **Antes de la beta:** configurar un proveedor transaccional (por ejemplo Resend) como **SMTP de Supabase Auth**, con dominio verificado (SPF, DKIM, DMARC). Los emails de Auth siguen saliendo de Supabase, no de la app.
- **Emails propios de la aplicación** (los que no son flujos de Auth: avisos de vencimiento, notificaciones por email): se envían con la API HTTP del proveedor usando `fetch`, desde el servidor, sin SDK. Ningún flujo de Auth se reimplementa con esa API.
- **Invitaciones:**
  - Al crear una invitación, el servidor genera un token aleatorio de 32 bytes y guarda solo su hash SHA-256 (`invitations.token_hash`), con vencimiento de 7 días.
  - El dueño recibe el **enlace copiable** en la pantalla de equipo, además del envío por email.
  - Si el envío del email falla, la invitación igual queda creada y el enlace copiable sigue disponible; la interfaz informa que el email no salió.
  - Como solo se guarda el hash, el enlace se muestra al crearla. Para verlo de nuevo, el dueño lo **regenera**: se crea un token nuevo y el anterior deja de servir.
  - La aceptación verifica el hash, el vencimiento, que no esté revocada ni aceptada, y que el email del usuario coincida.
- **Los enlaces son credenciales temporales** (invitación, confirmación, recuperación): nunca se escriben en logs, auditoría, URLs de analítica, reportes de error ni respuestas de API ajenas al dueño. En los E2E se leen de Mailpit sin imprimirlos.

## Alternativas consideradas

- **`auth.admin.inviteUserByEmail` de Supabase:** crea el usuario de Auth antes de que acepte y no sirve para personas que ya tienen cuenta (una persona puede estar en varias inmobiliarias).
- **Guardar el token en claro para poder mostrarlo siempre:** una filtración de la base expondría invitaciones vigentes.
- **SDK del proveedor:** una dependencia más para un único POST.

## Consecuencias

- Pendiente antes de la beta (checklist en `docs/DEPLOYMENT.md`): dominio, proveedor transaccional, SMTP de Supabase y plantillas en español.
- La implementación de la pantalla de equipo y de `accept_invitation` es parte del incremento 1.1.

## Referencias

- PRD CU-01, CU-02; `docs/SECURITY.md`; `docs/OBSERVABILITY.md`.
