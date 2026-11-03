-- Garantías estructurales: RLS forzada en todo, permisos mínimos para anon y funciones seguras.
select no_plan();

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and not (c.relrowsecurity and c.relforcerowsecurity) $$,
  'todas las tablas de public tienen RLS habilitada y forzada'
);

select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
       and not (table_name = 'legal_documents' and privilege_type = 'SELECT') $$,
  'anon solo puede leer documentos legales'
);

select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public'
       and table_name in ('jobs', 'rate_limits') $$,
  'authenticated no tiene acceso a jobs ni rate_limits'
);

select ok(
  (select r.rolbypassrls from pg_roles r
   where r.oid = (select proowner from pg_proc where oid = 'app.is_member(uuid)'::regprocedure)),
  'el dueño de las funciones de permisos tiene BYPASSRLS (sin recursión en las políticas)'
);

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'app') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%') $$,
  'toda función SECURITY DEFINER fija search_path'
);

select results_eq(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     order by 1 $$,
  $$ values ('health()'), ('invitation_preview(text)'), ('registration_legal_documents()'), ('resolve_organization_slug(text)') $$,
  'anon solo puede ejecutar health() y las RPC públicas previstas'
);

select set_eq(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array[
    'current_support_organization()', 'end_support_session()', 'health()', 'my_organizations()',
    'registration_legal_documents()', 'resolve_organization_slug(text)', 'start_support_session(uuid)',
    'accept_invitation(text)', 'create_organization(text,text,uuid[])', 'invitation_preview(text)',
    'organization_members(uuid)',
    'create_contact(uuid,text,text[],text[],text,boolean,boolean,uuid,contact_source)', 'merge_contacts(uuid,uuid)'
  ],
  'authenticated solo ejecuta las RPC previstas'
);

select set_eq(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('service_role', p.oid, 'execute')
       and p.proname in ('claim_jobs', 'complete_job', 'fail_job', 'enqueue_job', 'hit_rate_limit') $$,
  array[
    'claim_jobs(text,integer,integer)', 'complete_job(uuid,text)', 'enqueue_job(text,jsonb,uuid,text,timestamp with time zone,integer)',
    'fail_job(uuid,text,text,integer)', 'hit_rate_limit(text,integer,integer)'
  ],
  'service_role ejecuta las RPC de jobs y rate limiting'
);

select is(
  (select count(*)::int from public.platform_settings), 1,
  'platform_settings tiene una sola fila'
);

select results_eq(
  $$ select code, max_users, max_properties, max_whatsapp_numbers, includes_automations
     from public.plans order by sort_order $$,
  $$ values ('initial', 2, 100, 1, false), ('professional', 5, 500, 1, true), ('enterprise', 10, 1500, null::int, true) $$,
  'planes iniciales según PRD §6'
);

select * from finish();
