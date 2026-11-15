-- =============================================================================
-- RLS de lectura: el conjunto de inmobiliarias legibles se calcula UNA vez por consulta.
-- (supabase-postgres-best-practices, security-rls-performance; ADR 0004)
--
-- Antes: USING (app.can_read(organization_id)) → la función (SECURITY DEFINER, no se puede inlinear)
-- corría por cada fila con 3-4 subconsultas. Un count(*) sobre miles de contactos la evaluaba miles
-- de veces.
-- Ahora: USING (organization_id in (select app.readable_organization_ids())) → subconsulta no
-- correlacionada: Postgres la evalúa una vez y compara contra el conjunto.
--
-- Misma semántica que app.can_read: sesión de soporte abierta del principal (ignora el estado) o
-- membresía activa con la cuenta no bloqueada ni en baja. Solo se cambian las políticas SELECT cuya
-- condición es exactamente app.can_read(organization_id) (o app.can_read(id) en organizations);
-- las de escritura y Storage quedan igual. app.can_read sigue existiendo y la usan RPC y Storage.
-- =============================================================================

create function app.readable_organization_ids() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.organization_id
  from (select app.support_organization_id() as organization_id) s
  where s.organization_id is not null
  union
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and app.organization_state(m.organization_id) not in ('blocked', 'pending_deletion');
$$;

revoke all on function app.readable_organization_ids() from public;
grant execute on function app.readable_organization_ids() to authenticated, service_role;

do $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and (
        qual = 'app.can_read(organization_id)'
        or (tablename = 'organizations' and qual = 'app.can_read(id)')
      )
  loop
    execute format(
      'alter policy %I on %I.%I using (%I in (select app.readable_organization_ids()))',
      r.policyname, r.schemaname, r.tablename,
      case when r.qual = 'app.can_read(id)' then 'id' else 'organization_id' end
    );
    v_count := v_count + 1;
  end loop;
  -- Si no convirtió ninguna, el texto de las políticas cambió: mejor fallar que dejarlo a medias.
  if v_count = 0 then
    raise exception 'rls_readable_organization_ids: no se encontraron políticas para convertir';
  end if;
  raise notice 'rls_readable_organization_ids: % políticas convertidas', v_count;
end;
$$;
