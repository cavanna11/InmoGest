# ADR 0008 — Slugs de inmobiliarias con historial reservado

- Estado: accepted
- Fecha: 2026-11-02

## Contexto

Las páginas públicas de propiedades usan `/p/<slug-inmobiliaria>/<slug-propiedad>` (F-10). El dueño puede querer cambiar el nombre de su inmobiliaria, pero los links ya compartidos por WhatsApp no deberían romperse ni, peor, empezar a apuntar a otra inmobiliaria.

## Decisión

- El slug se **genera del nombre** (`slugify` en `@inmogest/shared`: sin tildes, minúsculas, guiones, máximo 60) y la base garantiza la unicidad: `app.available_organization_slug(base)` devuelve `base`, `base-2`, `base-3`… salteando los reservados.
- El **dueño puede cambiarlo**; la interfaz avisa que cambia la URL pública.
- Cada slug anterior queda en `organization_slug_history` y está **reservado para siempre**: ninguna otra inmobiliaria puede usarlo (error IG005), ni siquiera después de que la dueña original se elimine. La misma inmobiliaria sí puede volver a un slug suyo anterior.
- `public.resolve_organization_slug(slug)` devuelve el slug actual de la inmobiliaria a la que pertenece un slug actual o histórico, para **redirigir** las URLs viejas (lo usan las páginas públicas desde el incremento 1.3). No resuelve inmobiliarias eliminadas.
- Cada cambio queda auditado (`organization.slug_changed`).

## Alternativas consideradas

- **Slug fijo:** más simple, pero obliga a convivir con un nombre viejo en todos los links.
- **Liberar slugs viejos:** un link compartido podría terminar mostrando propiedades de otra inmobiliaria.

## Consecuencias

- El historial crece con cada cambio; es una tabla chica sin datos personales.
- La redirección es "cuando es técnicamente posible": si la inmobiliaria se eliminó, el slug no resuelve pero sigue reservado.

## Referencias

- `backend/supabase/migrations/20261102100000_organization_slugs.sql`, `backend/supabase/tests/08_slugs_legal.sql`.
