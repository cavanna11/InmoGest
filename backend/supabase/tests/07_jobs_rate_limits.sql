-- Cola de jobs y rate limiting (solo service_role).
select no_plan();

select tests.authenticate_as_service();

-- Encolar es idempotente mientras el job esté abierto.
select is(
  public.enqueue_job('system.ping', '{"note":"a"}', null, 'ping:1'),
  public.enqueue_job('system.ping', '{"note":"b"}', null, 'ping:1'),
  'la misma clave de idempotencia devuelve el mismo job'
);
select is((select count(*)::int from public.jobs where idempotency_key = 'ping:1'), 1, 'y no lo duplica');
select throws_ok($$ select public.enqueue_job('Ping invalido') $$, '23514', null, 'rechaza tipos inválidos');
select throws_ok($$ select * from public.claim_jobs('', 10, 600) $$, '22023', null, 'exige identificador de worker');

-- Tomar, completar.
select results_eq(
  $$ select type, attempts from public.claim_jobs('w1', 10, 600) $$,
  $$ values ('system.ping', 1) $$,
  'w1 toma el job y cuenta el intento'
);
select results_eq($$ select status::text, locked_by from public.jobs where idempotency_key = 'ping:1' $$,
  $$ values ('running', 'w1') $$, 'queda en curso y bloqueado por w1');
select is_empty($$ select * from public.claim_jobs('w2', 10, 600) $$, 'un job tomado no se vuelve a tomar');
select ok(not public.complete_job((select id from public.jobs where idempotency_key = 'ping:1'), 'w2'),
  'otro worker no puede completarlo');
select ok(public.complete_job((select id from public.jobs where idempotency_key = 'ping:1'), 'w1'),
  'el worker que lo tomó lo completa');
select is((select status::text from public.jobs where idempotency_key = 'ping:1'), 'succeeded', 'queda terminado');
select isnt(
  public.enqueue_job('system.ping', '{}', null, 'ping:1'),
  (select id from public.jobs where idempotency_key = 'ping:1' and status = 'succeeded'),
  'terminado, la misma clave puede volver a encolarse'
);
update public.jobs set status = 'cancelled' where idempotency_key = 'ping:1' and status = 'pending';

-- Fallar con reintentos y espera.
select public.enqueue_job('system.ping', '{}', null, 'ping:retry', null, 2);
select is((select count(*)::int from public.claim_jobs('w1', 10, 600)), 1, 'toma el job con 2 intentos');
select is(public.fail_job((select id from public.jobs where idempotency_key = 'ping:retry'), 'w1', 'boom'),
  'pending', 'primer fallo: vuelve a la cola');
select ok((select run_after > now() from public.jobs where idempotency_key = 'ping:retry'), 'con espera antes del reintento');
select is_empty($$ select * from public.claim_jobs('w1', 10, 600) $$, 'no se toma antes de la espera');
update public.jobs set run_after = now() where idempotency_key = 'ping:retry';
select is((select attempts from public.claim_jobs('w1', 10, 600)), 2, 'segundo intento');
select is(public.fail_job((select id from public.jobs where idempotency_key = 'ping:retry'), 'w1', 'boom'),
  'failed', 'sin intentos restantes: fallido');
select is((select last_error from public.jobs where idempotency_key = 'ping:retry'), 'boom', 'guarda el error');

-- Worker caído: el lock vence y el job se recupera; si ya agotó intentos, se marca fallido.
insert into public.jobs (type, idempotency_key, status, attempts, max_attempts, locked_by, locked_at)
values ('system.ping', 'ping:stale', 'running', 1, 3, 'w-caido', now() - interval '1 hour'),
       ('system.ping', 'ping:stale-agotado', 'running', 3, 3, 'w-caido', now() - interval '1 hour');
select results_eq($$ select attempts from public.claim_jobs('w3', 10, 600) $$,
  $$ values (2) $$, 'recupera el job con lock vencido');
select results_eq($$ select status::text, locked_by from public.jobs where idempotency_key = 'ping:stale' $$,
  $$ values ('running', 'w3') $$, 'ahora lo tiene w3');
select results_eq($$ select status::text, last_error from public.jobs where idempotency_key = 'ping:stale-agotado' $$,
  $$ values ('failed', 'lock_timeout') $$, 'el agotado queda fallido');

-- Rate limiting de ventana fija.
select ok(public.hit_rate_limit('test:k', 60, 2), 'primer pedido');
select ok(public.hit_rate_limit('test:k', 60, 2), 'segundo pedido');
select ok(not public.hit_rate_limit('test:k', 60, 2), 'el tercero excede el límite');
select ok(public.hit_rate_limit('test:otra', 60, 2), 'otra clave tiene su propio contador');
select throws_ok($$ select public.hit_rate_limit('test:k', 0, 2) $$, '22023', null, 'ventana inválida');

select tests.clear_authentication();
select * from finish();
