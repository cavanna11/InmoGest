# ADR 0010 — Beta cerrada sobre el proyecto de desarrollo

- Estado: accepted
- Fecha: 2026-11-03

## Contexto

C&C quiere ofrecer pruebas a inmobiliarias antes de tener el dominio `inmopanel.com.ar`. Sin dominio no hay proveedor de email transaccional verificado (ADR 0007), y el SMTP por defecto de Supabase solo envía a los miembros del equipo del proyecto: los emails de confirmación y de recuperación no llegan a usuarios reales. Tampoco existe todavía un proyecto de Supabase de producción.

## Decisión

- **La beta corre sobre el proyecto de Supabase de desarrollo** (decisión del dueño de C&C, 03/11/2026). La app de la beta es el deploy de producción de Vercel (`inmopanel-beta.vercel.app`) apuntando a ese proyecto.
- **Beta cerrada:** el registro público queda cerrado (`REGISTRATION_OPEN` vacío). C&C da de alta cada cuenta con `npm run beta -- access <email>`, que genera un enlace de acceso de un solo uso sin enviar emails; C&C lo manda por WhatsApp y la persona elige su contraseña. El mismo comando reemplaza a "Olvidé mi contraseña".
- **Usuarios del seed bloqueados:** su contraseña está en el repositorio. `npm run beta -- secure` les pone una contraseña aleatoria, los suspende y les quita el rol de plataforma. `db:push --seed` solo se aplica a un Supabase local.
- **Textos legales de la beta** (`backend/supabase/legal/beta-1`): redactados para la beta y publicados como vigentes (`npm run beta -- legal beta-1`) por decisión del dueño de C&C, **sin revisión profesional**. Deben revisarse antes del lanzamiento comercial (PRD §10).

## Alternativas consideradas

- **Proyecto de Supabase de producción nuevo:** separa datos reales de los de prueba; se posterga por decisión de C&C.
- **Desactivar la confirmación de email:** permitiría el registro público, pero cualquiera podría registrarse con un email ajeno.

## Consecuencias

- Datos reales de la beta conviven con datos ficticios de desarrollo (aislados por RLS). El plan gratuito de Supabase no tiene backups: una pérdida del proyecto pierde los datos de la beta.
- Los pgTAP siguen corriendo contra este proyecto, siempre en transacciones revertidas.
- Al comprar el dominio: email transaccional, plantillas, reapertura del registro y, de ser posible, migración a un proyecto de producción (docs/DEPLOYMENT.md).

## Referencias

- `scripts/beta.mjs`, `frontend/lib/env.server.ts` (`isRegistrationOpen`), ADR 0007, ADR 0009.
