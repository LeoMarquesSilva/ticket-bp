begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_table(
  'public',
  'app_c009c0e4f1_ticket_notification_deliveries',
  'a tabela de entregas existe'
);

select has_function(
  'public',
  'helpdesk_enqueue_ticket_notification',
  array['uuid', 'text', 'text', 'text'],
  'a RPC de enfileiramento existe'
);

select has_function(
  'public',
  'helpdesk_claim_ticket_notifications',
  array['integer', 'timestamp with time zone'],
  'a RPC de reserva existe'
);

select has_function(
  'public',
  'helpdesk_complete_ticket_notification',
  array['uuid', 'boolean', 'text', 'timestamp with time zone'],
  'a RPC de conclusao existe'
);

select results_eq(
  $$
    select c.relrowsecurity
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'app_c009c0e4f1_ticket_notification_deliveries'
  $$,
  array[true],
  'RLS esta habilitado na tabela de entregas'
);

select results_eq(
  $$
    select not p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'helpdesk_enqueue_ticket_notification',
        'helpdesk_claim_ticket_notifications',
        'helpdesk_complete_ticket_notification'
      )
    order by p.proname
  $$,
  array[true, true, true],
  'as RPCs executam com os privilegios do chamador'
);

-- A fila depende apenas do UUID do ticket. Desabilitar os triggers nesta
-- transacao evita acoplar o teste aos dados/seed da tabela de tickets; o
-- rollback restaura os triggers e remove todas as entregas criadas aqui.
alter table public.app_c009c0e4f1_ticket_notification_deliveries disable trigger all;

create temporary table ticket_communication_test_enqueues (
  call_no integer primary key,
  id uuid not null
) on commit drop;

grant select, insert on table pg_temp.ticket_communication_test_enqueues to service_role;

set local role anon;

select throws_ok(
  $$select count(*) from public.app_c009c0e4f1_ticket_notification_deliveries$$,
  '42501',
  'anon nao consegue consultar a tabela'
);

select throws_ok(
  $$select public.helpdesk_enqueue_ticket_notification('40000000-0000-0000-0000-000000000001', 'awaiting_requester', 'email', '2026-08-24')$$,
  '42501',
  'anon nao executa a RPC de enfileiramento'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  '42501',
  'anon nao executa a RPC de reserva'
);

select throws_ok(
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', true, null, null)$$,
  '42501',
  'anon nao executa a RPC de conclusao'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select count(*) from public.app_c009c0e4f1_ticket_notification_deliveries$$,
  '42501',
  'authenticated nao consegue consultar a tabela'
);

select throws_ok(
  $$select public.helpdesk_enqueue_ticket_notification('40000000-0000-0000-0000-000000000001', 'awaiting_requester', 'email', '2026-08-24')$$,
  '42501',
  'authenticated nao executa a RPC de enfileiramento'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  '42501',
  'authenticated nao executa a RPC de reserva'
);

select throws_ok(
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', true, null, null)$$,
  '42501',
  'authenticated nao executa a RPC de conclusao'
);

reset role;
set local role service_role;

insert into pg_temp.ticket_communication_test_enqueues (call_no, id)
select 1, id
from public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'awaiting_requester',
  'email',
  '2026-08-24'
);

insert into pg_temp.ticket_communication_test_enqueues (call_no, id)
select 2, id
from public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'awaiting_requester',
  'email',
  '2026-08-24'
);

select results_eq(
  $$select id from pg_temp.ticket_communication_test_enqueues order by call_no$$,
  $$
    select first_call.id
    from pg_temp.ticket_communication_test_enqueues first_call
    cross join generate_series(1, 2)
    where first_call.call_no = 1
  $$,
  'duas tentativas do mesmo ciclo devolvem a mesma entrega'
);

reset role;

select is(
  (
    select count(*)
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where ticket_id = '40000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'duas tentativas do mesmo ciclo persistem uma unica entrega'
);

set local role service_role;

select results_eq(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_requester',
      'email',
      '2026-08-25'
    )
  $$,
  $$select id from pg_temp.ticket_communication_test_enqueues where call_no = 1$$,
  'um novo ciclo reaproveita a entrega ainda nao enviada'
);

select throws_ok(
  $$
    select public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'unknown',
      'email',
      '2026-08-24'
    )
  $$,
  '22023',
  'a RPC rejeita um tipo de notificacao invalido'
);

select throws_ok(
  $$
    select public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_requester',
      'chat',
      '2026-08-24'
    )
  $$,
  '22023',
  'a RPC rejeita um canal invalido'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  array[1::bigint],
  'service_role reserva a entrega vencida'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  array[0::bigint],
  'uma entrega reservada nao aparece em uma segunda reserva'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:14:59+00')$$,
  array[0::bigint],
  'o lease continua valido antes de quinze minutos'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:15:00+00')$$,
  array[0::bigint],
  'o lease nao expira enquanto nao ultrapassa quinze minutos'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:15:01+00')$$,
  array[1::bigint],
  'uma entrega com lease expirado pode ser reservada novamente'
);

reset role;

select results_eq(
  $$
    select status, attempt_count, processing_started_at
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where ticket_id = '40000000-0000-0000-0000-000000000001'
  $$,
  $$values ('processing'::text, 2, '2099-08-24 12:15:01+00'::timestamptz)$$,
  'a nova reserva renova o lease e incrementa a tentativa'
);

set local role service_role;

select lives_ok(
  $$
    select public.helpdesk_complete_ticket_notification(
      (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1),
      false,
      repeat('x', 650),
      '2099-08-25 12:00:00+00'
    )
  $$,
  'service_role registra uma falha para retry'
);

reset role;

select results_eq(
  $$
    select status, length(last_error), next_attempt_at, processing_started_at is null
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
  $$,
  $$values ('failed'::text, 500, '2099-08-25 12:00:00+00'::timestamptz, true)$$,
  'a falha trunca o erro, agenda o retry e libera o lease'
);

set local role service_role;

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-25 11:59:59+00')$$,
  array[0::bigint],
  'a entrega com falha nao retorna antes do retry'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-25 12:00:00+00')$$,
  array[1::bigint],
  'a entrega com falha retorna quando o retry vence'
);

reset role;

select is(
  (
    select attempt_count
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
  ),
  3,
  'o retry incrementa o numero de tentativas'
);

set local role service_role;

select lives_ok(
  $$
    select public.helpdesk_complete_ticket_notification(
      (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1),
      true,
      null,
      null
    )
  $$,
  'service_role conclui uma entrega com sucesso'
);

reset role;

select results_eq(
  $$
    select status, sent_at is not null, last_error is null, processing_started_at is null
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
  $$,
  $$values ('sent'::text, true, true, true)$$,
  'a conclusao marca envio, limpa erro e libera o lease'
);

set local role service_role;

select results_eq(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_requester',
      'email',
      '2026-08-24'
    )
  $$,
  $$select id from pg_temp.ticket_communication_test_enqueues where call_no = 1$$,
  'repetir um ciclo enviado devolve a entrega original'
);

select results_ne(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_requester',
      'email',
      '2026-08-25'
    )
  $$,
  $$select id from pg_temp.ticket_communication_test_enqueues where call_no = 1$$,
  'um novo ciclo cria uma nova entrega depois do envio'
);

reset role;

select is(
  (
    select count(*)
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where ticket_id = '40000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'a fila preserva exatamente uma entrega por ciclo enviado'
);

select * from finish();
rollback;
