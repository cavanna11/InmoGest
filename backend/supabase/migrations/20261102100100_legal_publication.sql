-- =============================================================================
-- Publicación explícita de términos y privacidad (ADR 0009).
-- - El registro solo se habilita cuando platform_settings apunta a un documento de términos Y uno de
--   privacidad publicados. Que existan textos en la base no habilita nada.
-- - Un borrador (is_draft) solo puede configurarse como vigente si allow_draft_legal_documents = true,
--   algo que únicamente hace el seed de desarrollo. Sus aceptaciones quedan marcadas como de borrador.
-- - Un documento ya aceptado no se modifica: los cambios van en una versión nueva.
-- Código de error propio: IG006 documento legal no válido para esta operación.
-- =============================================================================

alter table public.legal_documents
  add column is_draft boolean not null default true;

alter table public.platform_settings
  add column current_terms_id uuid references public.legal_documents (id),
  add column current_privacy_id uuid references public.legal_documents (id),
  add column allow_draft_legal_documents boolean not null default false;

alter table public.legal_acceptances
  add column document_is_draft boolean not null default false;

-- Aceptaciones existentes (seed de desarrollo): se marcan según su documento.
update public.legal_acceptances a
set document_is_draft = d.is_draft
from public.legal_documents d
where d.id = a.legal_document_id;

-- -----------------------------------------------------------------------------
-- Validación de la configuración de publicación. Se llama al cambiar platform_settings y al
-- modificar un documento.
-- -----------------------------------------------------------------------------
create function app.assert_legal_publication_valid() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.platform_settings;
  v_kind text;
  v_id uuid;
begin
  select * into s from public.platform_settings where id;
  foreach v_kind in array array['terms', 'privacy'] loop
    v_id := case v_kind when 'terms' then s.current_terms_id else s.current_privacy_id end;
    if v_id is null then
      continue;
    end if;
    if not exists (
      select 1 from public.legal_documents d
      where d.id = v_id
        and d.kind::text = v_kind
        and d.published_at is not null
        and (not d.is_draft or s.allow_draft_legal_documents)
    ) then
      raise exception using
        errcode = 'IG006',
        message = 'legal_document_not_publishable',
        detail = v_kind;
    end if;
  end loop;
end;
$$;

create function app.validate_platform_legal_settings() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_legal_publication_valid();
  return null;
end;
$$;

-- AFTER: valida la fila ya actualizada (incluye apagar allow_draft con un borrador vigente).
create trigger platform_settings_validate_legal
  after update of current_terms_id, current_privacy_id, allow_draft_legal_documents
  on public.platform_settings
  for each row execute function app.validate_platform_legal_settings();

-- -----------------------------------------------------------------------------
-- Documentos: inmutables una vez aceptados; y un documento vigente no puede quedar inválido.
-- -----------------------------------------------------------------------------
create function app.protect_legal_document() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.legal_acceptances where legal_document_id = old.id)
     and (new.kind, new.version, new.title, new.content, new.is_draft)
         is distinct from (old.kind, old.version, old.title, old.content, old.is_draft) then
    raise exception using
      errcode = 'IG006',
      message = 'legal_document_accepted_is_immutable',
      hint = 'Publicá una versión nueva.';
  end if;
  return new;
end;
$$;

create trigger legal_documents_protect
  before update on public.legal_documents
  for each row execute function app.protect_legal_document();

create trigger legal_documents_revalidate_publication
  after update on public.legal_documents
  for each row execute function app.validate_platform_legal_settings();

-- -----------------------------------------------------------------------------
-- Aceptaciones: solo de los documentos vigentes al momento de aceptar.
-- -----------------------------------------------------------------------------
create function app.check_legal_acceptance() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.platform_settings;
  v_is_draft boolean;
begin
  select * into s from public.platform_settings where id;
  if new.legal_document_id is distinct from s.current_terms_id
     and new.legal_document_id is distinct from s.current_privacy_id then
    raise exception using errcode = 'IG006', message = 'legal_document_not_current';
  end if;

  select is_draft into v_is_draft from public.legal_documents where id = new.legal_document_id;
  if v_is_draft and not s.allow_draft_legal_documents then
    raise exception using errcode = 'IG006', message = 'legal_document_not_publishable';
  end if;

  -- Nunca se confía en el valor enviado: se toma del documento.
  new.document_is_draft := v_is_draft;
  new.accepted_at := now();
  return new;
end;
$$;

create trigger legal_acceptances_check
  before insert on public.legal_acceptances
  for each row execute function app.check_legal_acceptance();

-- -----------------------------------------------------------------------------
-- RPC pública: documentos vigentes para el registro. Devuelve filas solo si están configurados
-- AMBOS (términos y privacidad); si no, el registro debe quedar bloqueado.
-- -----------------------------------------------------------------------------
create function public.registration_legal_documents()
returns table (
  id uuid,
  kind public.legal_document_kind,
  version text,
  title text,
  is_draft boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.kind, d.version, d.title, d.is_draft
  from public.platform_settings s
  join public.legal_documents d on d.id in (s.current_terms_id, s.current_privacy_id)
  where s.id
    and s.current_terms_id is not null
    and s.current_privacy_id is not null
  order by d.kind;
$$;

revoke all on function
  app.assert_legal_publication_valid(), app.validate_platform_legal_settings(),
  app.protect_legal_document(), app.check_legal_acceptance()
from public;
revoke all on function public.registration_legal_documents() from public;
grant execute on function public.registration_legal_documents() to anon, authenticated;
