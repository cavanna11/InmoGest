-- Slugs con historial reservado (ADR 0008) y publicación explícita de documentos legales (ADR 0009).
select no_plan();

-- =============================================================================
-- Slugs
-- =============================================================================
select tests.create_user('80000000-0000-4000-a000-000000000001', 'owner-a@slug.test');
select tests.create_user('80000000-0000-4000-a000-000000000002', 'agent-a@slug.test');
select tests.create_user('80000000-0000-4000-a000-000000000003', 'owner-b@slug.test');
select tests.create_org('80000000-0000-4000-b000-00000000000a', 'slug-a');
select tests.create_org('80000000-0000-4000-b000-00000000000b', 'slug-b');
select tests.add_member('80000000-0000-4000-b000-00000000000a', '80000000-0000-4000-a000-000000000001', 'owner');
select tests.add_member('80000000-0000-4000-b000-00000000000a', '80000000-0000-4000-a000-000000000002', 'agent');
select tests.add_member('80000000-0000-4000-b000-00000000000b', '80000000-0000-4000-a000-000000000003', 'owner');

select is(app.available_organization_slug('slug-libre'), 'slug-libre', 'un slug libre se usa tal cual');
select is(app.available_organization_slug('slug-a'), 'slug-a-2', 'un slug en uso recibe sufijo');

-- El dueño cambia el slug; el agente no.
select tests.authenticate_as('80000000-0000-4000-a000-000000000002');
select is(tests.affected($$ update public.organizations set slug = 'slug-agente' where id = '80000000-0000-4000-b000-00000000000a' $$),
  0::bigint, 'el agente no cambia el slug');
select tests.authenticate_as('80000000-0000-4000-a000-000000000001');
select is(tests.affected($$ update public.organizations set slug = 'slug-a-nuevo' where id = '80000000-0000-4000-b000-00000000000a' $$),
  1::bigint, 'el dueño cambia el slug');
select is(public.resolve_organization_slug('slug-a'), 'slug-a-nuevo', 'el slug anterior redirige al actual');
select is(public.resolve_organization_slug('slug-a-nuevo'), 'slug-a-nuevo', 'el actual se resuelve a sí mismo');
select is(public.resolve_organization_slug('no-existe'), null::text, 'un slug inexistente no resuelve');
select isnt_empty($$ select 1 from public.audit_logs where action = 'organization.slug_changed'
                    and organization_id = '80000000-0000-4000-b000-00000000000a' $$, 'el cambio queda auditado');
select throws_ok($$ select 1 from public.organization_slug_history $$, '42501', null,
  'los usuarios no leen el historial directamente');

-- Otra inmobiliaria no puede tomar un slug reservado.
select tests.authenticate_as('80000000-0000-4000-a000-000000000003');
select is(tests.error_of($$ update public.organizations set slug = 'slug-a' where id = '80000000-0000-4000-b000-00000000000b' $$) ->> 'sqlstate',
  'IG005', 'otra inmobiliaria no puede usar un slug histórico');
select is(tests.error_of($$ update public.organizations set slug = 'slug-a-nuevo' where id = '80000000-0000-4000-b000-00000000000b' $$) ->> 'sqlstate',
  '23505', 'ni el slug actual de otra');
select tests.clear_authentication();
select is(tests.error_of($$ select tests.create_org('80000000-0000-4000-b000-00000000000c', 'slug-a') $$) ->> 'sqlstate',
  'IG005', 'una inmobiliaria nueva tampoco');
select is(app.available_organization_slug('slug-a'), 'slug-a-2', 'available_organization_slug saltea los reservados');

-- La dueña original puede volver a su slug anterior.
select tests.authenticate_as('80000000-0000-4000-a000-000000000001');
select is(tests.affected($$ update public.organizations set slug = 'slug-a' where id = '80000000-0000-4000-b000-00000000000a' $$),
  1::bigint, 'puede volver a su slug anterior');
select is(public.resolve_organization_slug('slug-a-nuevo'), 'slug-a', 'y el intermedio queda redirigiendo');

-- Al eliminar la inmobiliaria, su slug queda reservado y deja de resolver.
select tests.clear_authentication();
delete from public.organizations where id = '80000000-0000-4000-b000-00000000000b';
select is(public.resolve_organization_slug('slug-b'), null::text, 'el slug de una inmobiliaria eliminada no resuelve');
select is(tests.error_of($$ select tests.create_org('80000000-0000-4000-b000-00000000000d', 'slug-b') $$) ->> 'sqlstate',
  'IG005', 'y no lo puede tomar otra');

select tests.authenticate_as_anon();
select is(public.resolve_organization_slug('slug-a'), 'slug-a', 'anon puede resolver slugs (páginas públicas)');
select tests.clear_authentication();

-- =============================================================================
-- Documentos legales
-- =============================================================================
insert into public.legal_documents (id, kind, version, title, content, published_at, is_draft) values
  ('81000000-0000-4000-c000-000000000001', 'terms',   'v-final', 'Términos', 'texto', now(), false),
  ('81000000-0000-4000-c000-000000000002', 'privacy', 'v-final', 'Privacidad', 'texto', now(), false),
  ('81000000-0000-4000-c000-000000000003', 'terms',   'v-borrador', 'Términos — No válido — solo desarrollo', 'texto', now(), true),
  ('81000000-0000-4000-c000-000000000004', 'terms',   'v-sin-publicar', 'Términos', 'texto', null, false),
  ('81000000-0000-4000-c000-000000000005', 'terms',   'v-vieja', 'Términos viejos', 'texto', now(), false);

-- Sin configuración explícita, el registro queda bloqueado aunque haya textos en la base.
update public.platform_settings
set current_terms_id = null, current_privacy_id = null, allow_draft_legal_documents = false where id;
select is_empty($$ select * from public.registration_legal_documents() $$,
  'sin documentos vigentes configurados no hay registro');
update public.platform_settings set current_terms_id = '81000000-0000-4000-c000-000000000001' where id;
select is_empty($$ select * from public.registration_legal_documents() $$,
  'con solo términos (sin privacidad) tampoco');

-- Publicación válida.
update public.platform_settings set current_privacy_id = '81000000-0000-4000-c000-000000000002' where id;
select results_eq($$ select kind::text, is_draft from public.registration_legal_documents() $$,
  $$ values ('terms', false), ('privacy', false) $$, 'con ambos publicados el registro se habilita');

-- Configuraciones inválidas.
select is(tests.error_of($$ update public.platform_settings set current_terms_id = '81000000-0000-4000-c000-000000000003' where id $$) ->> 'sqlstate',
  'IG006', 'un borrador no puede quedar vigente sin habilitarlo explícitamente');
select is(tests.error_of($$ update public.platform_settings set current_terms_id = '81000000-0000-4000-c000-000000000004' where id $$) ->> 'sqlstate',
  'IG006', 'un documento sin publicar no puede quedar vigente');
select is(tests.error_of($$ update public.platform_settings set current_terms_id = '81000000-0000-4000-c000-000000000002' where id $$) ->> 'sqlstate',
  'IG006', 'la privacidad no puede configurarse como términos');

-- Borradores solo con habilitación explícita (seed de desarrollo).
update public.platform_settings
set allow_draft_legal_documents = true, current_terms_id = '81000000-0000-4000-c000-000000000003' where id;
select results_eq($$ select is_draft from public.registration_legal_documents() where kind = 'terms' $$,
  $$ values (true) $$, 'con la habilitación de desarrollo, el borrador se informa como borrador');
select is(tests.error_of($$ update public.platform_settings set allow_draft_legal_documents = false where id $$) ->> 'sqlstate',
  'IG006', 'no se puede quitar la habilitación con un borrador vigente');

-- Aceptaciones.
select tests.authenticate_as('80000000-0000-4000-a000-000000000001');
select lives_ok($$ insert into public.legal_acceptances (user_id, legal_document_id, document_is_draft)
                   values ('80000000-0000-4000-a000-000000000001', '81000000-0000-4000-c000-000000000003', false) $$,
  'se puede aceptar el borrador vigente en desarrollo');
select is((select document_is_draft from public.legal_acceptances
           where user_id = '80000000-0000-4000-a000-000000000001' and legal_document_id = '81000000-0000-4000-c000-000000000003'),
  true, 'pero queda registrada como aceptación de un borrador (no se confía en el valor enviado)');
select is(tests.error_of($$ insert into public.legal_acceptances (user_id, legal_document_id)
                           values ('80000000-0000-4000-a000-000000000001', '81000000-0000-4000-c000-000000000005') $$) ->> 'sqlstate',
  'IG006', 'no se puede aceptar un documento que no está vigente');
select lives_ok($$ insert into public.legal_acceptances (user_id, legal_document_id)
                   values ('80000000-0000-4000-a000-000000000001', '81000000-0000-4000-c000-000000000002') $$,
  'se acepta la privacidad vigente');
select is((select document_is_draft from public.legal_acceptances
           where user_id = '80000000-0000-4000-a000-000000000001' and legal_document_id = '81000000-0000-4000-c000-000000000002'),
  false, 'y queda como aceptación válida');

-- Un documento aceptado no se modifica.
select tests.clear_authentication();
select is(tests.error_of($$ update public.legal_documents set content = 'otro texto' where id = '81000000-0000-4000-c000-000000000002' $$) ->> 'sqlstate',
  'IG006', 'un documento aceptado no cambia su contenido');
select is(tests.error_of($$ update public.legal_documents set is_draft = false where id = '81000000-0000-4000-c000-000000000003' $$) ->> 'sqlstate',
  'IG006', 'un borrador aceptado no puede convertirse en vigente');
select is(tests.error_of($$ update public.legal_documents set published_at = null where id = '81000000-0000-4000-c000-000000000001' $$) ->> 'sqlstate',
  null, 'un documento sin aceptaciones y no vigente se puede corregir');
update public.legal_documents set published_at = now() where id = '81000000-0000-4000-c000-000000000001';
update public.platform_settings set current_terms_id = '81000000-0000-4000-c000-000000000001' where id;
select is(tests.error_of($$ update public.legal_documents set published_at = null where id = '81000000-0000-4000-c000-000000000001' $$) ->> 'sqlstate',
  'IG006', 'un documento vigente no puede despublicarse');

select tests.authenticate_as_anon();
select isnt_empty($$ select * from public.registration_legal_documents() $$, 'anon consulta los documentos del registro');
select tests.clear_authentication();

select * from finish();
