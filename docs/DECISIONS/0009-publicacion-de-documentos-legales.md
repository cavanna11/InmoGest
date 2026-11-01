# ADR 0009 — Publicación explícita de términos y política de privacidad

- Estado: accepted
- Fecha: 2026-11-02

## Contexto

El registro exige aceptar términos y privacidad, y se registra la versión aceptada (CU-01, PRD §10). Los textos definitivos requieren revisión profesional. En desarrollo hace falta poder registrarse igual, sin que un borrador quede aceptado como si fuera un documento legal vigente.

## Decisión

- `legal_documents.is_draft` (por defecto `true`) distingue borradores de versiones revisadas.
- **La publicación es una configuración explícita:** `platform_settings.current_terms_id` y `current_privacy_id`. El registro se habilita solo si **ambos** están configurados (`public.registration_legal_documents()` devuelve vacío en otro caso). Que existan textos en la base no habilita nada.
- Un documento vigente tiene que estar publicado (`published_at`), ser del tipo correcto y no ser borrador. **Excepción:** `allow_draft_legal_documents = true` permite un borrador vigente; solo lo activa el seed de desarrollo, nunca una migración. La base rechaza (IG006) apagar esa habilitación mientras haya un borrador vigente.
- **Aceptaciones:** solo de los documentos vigentes al momento de aceptar. La base marca `document_is_draft` a partir del documento (no confía en el valor enviado): una aceptación de borrador nunca cuenta como aceptación legal válida.
- **Un documento aceptado es inmutable:** cualquier cambio requiere una versión nueva.
- En desarrollo, el seed publica la versión `dev-1`, titulada "No válido — solo desarrollo", y la interfaz debe mostrar esa marca cuando `is_draft` es verdadero.

## Alternativas consideradas

- **Bloquear según el ambiente (`APP_ENV`):** la base no conoce el ambiente y un error de configuración podría habilitar borradores en producción.
- **Habilitar el registro si existe cualquier documento publicado:** un borrador cargado por error quedaría vigente.

## Consecuencias

- Producción arranca con el registro bloqueado hasta publicar los textos revisados y configurarlos como vigentes (acción del superadministrador; la pantalla llega en el incremento 1.8, mientras tanto por SQL con aprobación).
- Las aceptaciones de borrador hechas en desarrollo quedan identificadas.

## Referencias

- `backend/supabase/migrations/20261102100100_legal_publication.sql`, `backend/supabase/tests/08_slugs_legal.sql`, PRD §10.
