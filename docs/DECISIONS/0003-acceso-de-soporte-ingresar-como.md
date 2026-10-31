# ADR 0003 — «Ingresar como» mediante sesión de soporte reconocida por RLS

- Estado: accepted
- Fecha: 2026-10-31

## Contexto

PRD v0.3 §6: el superadministrador principal puede entrar a cualquier inmobiliaria y operar sin restricciones, sin duración máxima, una inmobiliaria por vez, con entrada y salida claras. La única regla que lo limita es conservar al menos un dueño activo. El aislamiento entre inmobiliarias se garantiza con RLS.

## Decisión

- Tabla `support_sessions (user_id, organization_id, started_at, ended_at)` con a lo sumo una sesión abierta por usuario.
- `public.start_support_session(org)` y `public.end_support_session()`: solo ejecutables por el usuario marcado `is_principal` en `platform_admins`.
- Las funciones de permisos (`app.is_member`, `app.is_owner`, `app.can_read`, `app.can_write`) devuelven verdadero para la inmobiliaria de la sesión abierta, ignorando el estado efectivo de la cuenta.
- El usuario opera con su propia sesión de Supabase Auth (no se suplanta la identidad de otro usuario): lo que crea o modifica queda a su nombre.
- El trigger del último dueño aplica igual.
- La sesión no se muestra a la inmobiliaria; es un registro técnico.

## Alternativas consideradas

- **Usar la clave secreta desde el panel admin:** saltea RLS para todas las inmobiliarias a la vez; un error en la app expondría todas las cuentas.
- **Suplantar al dueño (iniciar sesión como él):** las acciones quedarían a nombre del dueño y requiere manipular sesiones de Auth.
- **Agregar al superadministrador como miembro de cada inmobiliaria:** aparecería en la lista de usuarios y contaría para el límite del plan.

## Consecuencias

- Fuera de una sesión de soporte, el superadministrador no ve datos de ninguna inmobiliaria desde la app.
- Los tests pgTAP deben cubrir: acceso con sesión abierta, sin sesión, con sesión en otra inmobiliaria, cuenta en solo lectura y bloqueada, y el último dueño.

## Referencias

- PRD §3, §6 y §8 (F-30); `docs/SECURITY.md`.
