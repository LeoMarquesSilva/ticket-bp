begin;

create extension if not exists pgtap with schema extensions;

select plan(54);

select has_table(
  'public',
  'app_c009c0e4f1_ticket_notification_deliveries',
  'a tabela de entregas existe'
);

select has_function(
  'public',
  'helpdesk_enqueue_ticket_notification',
  array['uuid', 'text', 'text', 'text', 'timestamp with time zone'],
  'a RPC de enfileiramento existe'
);

select has_function(
  'public',
  'helpdesk_claim_ticket_notifications',
  array['integer', 'timestamp with time zone', 'uuid', 'text'],
  'a RPC de reserva existe'
);

select has_function(
  'public',
  'helpdesk_complete_ticket_notification',
  array['uuid', 'text', 'text', 'timestamp with time zone'],
  'a RPC de conclusao existe'
);

select has_function(
  'public',
  'helpdesk_list_ticket_communication_candidates',
  array['uuid', 'integer', 'uuid'],
  'a RPC paginada de candidatos existe'
);

select has_function(
  'public',
  'helpdesk_get_ticket_communication_contexts',
  array['uuid[]'],
  'a RPC de revalidacao existe'
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
        'helpdesk_complete_ticket_notification',
        'helpdesk_list_ticket_communication_candidates',
        'helpdesk_get_ticket_communication_contexts'
      )
    order by p.proname
  $$,
  array[true, true, true, true, true],
  'as RPCs executam com os privilegios do chamador'
);

-- Fixtures validos preservam e exercitam a FK da entrega. Os campos refletem
-- os inserts reais de AuthContext/UserService e TicketService. A transacao do
-- teste remove usuario, ticket e entregas no rollback final.
insert into public.app_c009c0e4f1_users (
  id,
  email,
  name,
  role,
  department,
  is_active,
  is_online,
  first_login,
  must_change_password,
  ticket_view_preference,
  created_at,
  updated_at
)
values (
  '40000000-0000-0000-0000-000000000002',
  'ticket-communications-pgtap@example.invalid',
  'Ticket Communications pgTAP',
  'user',
  'Geral',
  true,
  false,
  false,
  false,
  'list',
  '2099-08-24 11:00:00+00',
  '2099-08-24 11:00:00+00'
);

-- O trigger de webhook e um trigger de usuario e nao participa da FK. Ele e
-- suspenso somente durante o insert da fixture para o teste nunca enfileirar
-- uma chamada HTTP; os triggers internos de integridade continuam ativos.
alter table public.app_c009c0e4f1_tickets
  disable trigger notification_push_tickets;

insert into public.app_c009c0e4f1_tickets (
  id,
  title,
  description,
  status,
  priority,
  category,
  subcategory,
  created_by,
  created_by_name,
  created_at,
  updated_at,
  attachments
)
values (
  '40000000-0000-0000-0000-000000000001',
  'Ticket Communications pgTAP',
  'Fixture transacional para validar a FK da fila',
  'open',
  'medium',
  'testes',
  'comunicacoes',
  '40000000-0000-0000-0000-000000000002',
  'Ticket Communications pgTAP',
  '2099-08-24 11:00:00+00',
  '2099-08-24 11:00:00+00',
  '[]'::jsonb
);

alter table public.app_c009c0e4f1_tickets
  enable trigger notification_push_tickets;

alter table public.app_c009c0e4f1_chat_messages disable trigger user;

insert into public.app_c009c0e4f1_chat_messages (
  ticket_id,
  user_id,
  user_name,
  message,
  attachments,
  created_at,
  read
)
values (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  'Ticket Communications pgTAP',
  'Mensagem UUID valida para a RPC lateral',
  '[]'::jsonb,
  '2099-08-24 11:30:00+00',
  false
);

alter table public.app_c009c0e4f1_chat_messages enable trigger user;

create temporary table ticket_communication_test_enqueues (
  call_no integer primary key,
  id uuid not null
) on commit drop;

grant select, insert on table pg_temp.ticket_communication_test_enqueues to service_role;

set local role anon;

select throws_ok(
  $$select count(*) from public.app_c009c0e4f1_ticket_notification_deliveries$$,
  '42501'::char(5),
  null::text,
  'anon nao consegue consultar a tabela'
);

select throws_ok(
  $$select public.helpdesk_enqueue_ticket_notification('40000000-0000-0000-0000-000000000001', 'awaiting_requester', 'email', '2026-08-24', '2099-08-24 11:59:59+00')$$,
  '42501'::char(5),
  null::text,
  'anon nao executa a RPC de enfileiramento'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  '42501'::char(5),
  null::text,
  'anon nao executa a RPC de reserva'
);

select throws_ok(
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', 'sent', null, null)$$,
  '42501'::char(5),
  null::text,
  'anon nao executa a RPC de conclusao'
);

select throws_ok(
  $$select * from public.helpdesk_list_ticket_communication_candidates(null, 10, null)$$,
  '42501'::char(5), null::text,
  'anon nao executa a RPC de candidatos'
);

select throws_ok(
  $$select * from public.helpdesk_get_ticket_communication_contexts(array['40000000-0000-0000-0000-000000000001'::uuid])$$,
  '42501'::char(5), null::text,
  'anon nao executa a RPC de contextos'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select count(*) from public.app_c009c0e4f1_ticket_notification_deliveries$$,
  '42501'::char(5),
  null::text,
  'authenticated nao consegue consultar a tabela'
);

select throws_ok(
  $$select public.helpdesk_enqueue_ticket_notification('40000000-0000-0000-0000-000000000001', 'awaiting_requester', 'email', '2026-08-24', '2099-08-24 11:59:59+00')$$,
  '42501'::char(5),
  null::text,
  'authenticated nao executa a RPC de enfileiramento'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  '42501'::char(5),
  null::text,
  'authenticated nao executa a RPC de reserva'
);

select throws_ok(
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', 'sent', null, null)$$,
  '42501'::char(5),
  null::text,
  'authenticated nao executa a RPC de conclusao'
);

select throws_ok(
  $$select * from public.helpdesk_list_ticket_communication_candidates(null, 10, null)$$,
  '42501'::char(5), null::text,
  'authenticated nao executa a RPC de candidatos'
);

select throws_ok(
  $$select * from public.helpdesk_get_ticket_communication_contexts(array['40000000-0000-0000-0000-000000000001'::uuid])$$,
  '42501'::char(5), null::text,
  'authenticated nao executa a RPC de contextos'
);

reset role;
set local role service_role;

select results_eq(
  $$select count(*)::bigint from public.helpdesk_list_ticket_communication_candidates(null, 500, null)$$,
  array[1::bigint],
  'a RPC paginada retorna o candidato elegivel'
);

select results_eq(
  $$
    select (last_human_message ->> 'user_id')::uuid
    from public.helpdesk_list_ticket_communication_candidates(null, 500, '40000000-0000-0000-0000-000000000001')
  $$,
  array['40000000-0000-0000-0000-000000000002'::uuid],
  'a ultima mensagem preserva user_id UUID sem sentinela textual'
);

select results_eq(
  $$
    select (requester ->> 'id')::uuid
    from public.helpdesk_get_ticket_communication_contexts(array['40000000-0000-0000-0000-000000000001'::uuid])
  $$,
  array['40000000-0000-0000-0000-000000000002'::uuid],
  'a RPC de contexto hidrata o solicitante para revalidacao'
);

select throws_ok(
  $$
    select public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000098',
      'awaiting_requester',
      'email',
      '2026-08-24',
      '2099-08-24 11:59:59+00'
    )
  $$,
  '23503'::char(5),
  null::text,
  'a FK rejeita uma entrega sem ticket correspondente'
);

insert into pg_temp.ticket_communication_test_enqueues (call_no, id)
select 1, id
from public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'awaiting_requester',
  'email',
  '2026-08-24',
  '2099-08-24 11:59:59+00'
);

insert into pg_temp.ticket_communication_test_enqueues (call_no, id)
select 2, id
from public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'awaiting_requester',
  'email',
  '2026-08-24',
  '2099-08-24 11:59:59+00'
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
      '2026-08-25',
      '2099-08-24 11:59:59+00'
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
      '2026-08-24',
      '2099-08-24 11:59:59+00'
    )
  $$,
  '22023'::char(5),
  'invalid notification_type',
  'a RPC rejeita um tipo de notificacao invalido'
);

select throws_ok(
  $$
    select public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_requester',
      'chat',
      '2026-08-24',
      '2099-08-24 11:59:59+00'
    )
  $$,
  '22023'::char(5),
  'invalid channel',
  'a RPC rejeita um canal invalido'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2099-08-24 12:00:00+00',
      '40000000-0000-0000-0000-000000000098',
      'awaiting_requester'
    )
  $$,
  array[0::bigint],
  'o filtro de ticket nao invade entregas de outro chamado'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2099-08-24 12:00:00+00',
      '40000000-0000-0000-0000-000000000001',
      'resolved_feedback_invite'
    )
  $$,
  array[0::bigint],
  'o filtro de tipo nao invade outra notificacao do mesmo chamado'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00', '40000000-0000-0000-0000-000000000001', 'unknown')$$,
  '22023'::char(5),
  'invalid notification_type',
  'a reserva rejeita filtro de tipo invalido'
);

select throws_ok(
  $$select * from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00', '40000000-0000-0000-0000-000000000001', null)$$,
  '22023'::char(5),
  'claim filters must be paired',
  'a reserva exige ticket e tipo juntos'
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
      'failed',
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
      'sent',
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
      '2026-08-24',
      '2099-08-25 12:00:00+00'
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
      '2026-08-25',
      '2099-08-25 12:00:00+00'
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

set local role service_role;

select public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'awaiting_feedback',
  'teams',
  'cancel-test',
  '2099-08-25 12:00:00+00'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2099-08-25 12:00:00+00',
      '40000000-0000-0000-0000-000000000001',
      'awaiting_feedback'
    )
  $$,
  array[1::bigint],
  'a reserva filtrada seleciona somente a entrega solicitada'
);

select lives_ok(
  $$
    select public.helpdesk_complete_ticket_notification(
      (
        select id from public.app_c009c0e4f1_ticket_notification_deliveries
        where cycle_key = 'cancel-test'
      ),
      'cancelled',
      'no_longer_eligible',
      null
    )
  $$,
  'service_role cancela terminalmente uma entrega inelegivel'
);

reset role;

select results_eq(
  $$
    select status, cancelled_at is not null, cancellation_reason, last_error is null
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where cycle_key = 'cancel-test'
  $$,
  $$values ('cancelled'::text, true, 'no_longer_eligible'::text, true)$$,
  'o cancelamento fica auditavel e nao e mascarado como envio ou falha'
);

set local role service_role;

select results_ne(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'awaiting_feedback',
      'teams',
      'after-cancel',
      '2200-08-25 12:00:00+00'
    )
  $$,
  $$
    select id from public.app_c009c0e4f1_ticket_notification_deliveries
    where cycle_key = 'cancel-test'
  $$,
  'o indice parcial libera um novo ciclo depois do cancelamento'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2100-08-25 12:00:00+00',
      '40000000-0000-0000-0000-000000000001',
      'awaiting_feedback'
    )
  $$,
  array[0::bigint],
  'uma entrega cancelada nao volta em retries futuros'
);

reset role;

select * from finish();
rollback;
