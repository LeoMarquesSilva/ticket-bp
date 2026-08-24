begin;

create extension if not exists pgtap with schema extensions;

select plan(76);

select has_table(
  'public',
  'app_c009c0e4f1_ticket_notification_deliveries',
  'a tabela de entregas existe'
);

select has_column(
  'public',
  'app_c009c0e4f1_chat_messages',
  'is_system',
  'mensagens automaticas possuem representacao booleana com user_id UUID'
);

select has_column(
  'public',
  'app_c009c0e4f1_ticket_notification_deliveries',
  'claim_token',
  'cada lease possui token de fencing'
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
  array['uuid', 'uuid', 'integer', 'text', 'text', 'timestamp with time zone'],
  'a RPC de conclusao existe'
);

select has_function(
  'public',
  'helpdesk_release_ticket_notification',
  array['uuid', 'uuid', 'integer', 'timestamp with time zone'],
  'a RPC de liberacao de claim existe'
);

select has_function(
  'public',
  'helpdesk_count_ready_ticket_notifications',
  array['timestamp with time zone', 'uuid', 'text'],
  'a RPC de backlog existe'
);

select has_function(
  'public',
  'helpdesk_finish_ticket',
  array['uuid', 'uuid', 'text', 'timestamp with time zone', 'boolean', 'uuid', 'timestamp with time zone'],
  'a RPC de finalizacao atomica existe'
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
        'helpdesk_release_ticket_notification',
        'helpdesk_count_ready_ticket_notifications',
        'helpdesk_finish_ticket',
        'helpdesk_list_ticket_communication_candidates',
        'helpdesk_get_ticket_communication_contexts'
      )
    order by p.proname
  $$,
  array[true, true, true, true, true, true, true, true],
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
  read,
  is_system
)
values (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  'Ticket Communications pgTAP',
  'Mensagem UUID valida para a RPC lateral',
  '[]'::jsonb,
  '2099-08-24 11:30:00+00',
  false,
  false
), (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  'Sistema',
  'Mensagem automatica mais recente',
  '[]'::jsonb,
  '2099-08-24 11:45:00+00',
  false,
  true
);

alter table public.app_c009c0e4f1_chat_messages enable trigger user;

create temporary table ticket_communication_test_enqueues (
  call_no integer primary key,
  id uuid not null
) on commit drop;

grant select, insert on table pg_temp.ticket_communication_test_enqueues to service_role;

create temporary table ticket_communication_test_claims (
  call_no integer primary key,
  claim_token uuid not null,
  attempt_count integer not null
) on commit drop;

grant select, insert on table pg_temp.ticket_communication_test_claims to service_role;

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
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000097', 1, 'sent', null, null)$$,
  '42501'::char(5),
  null::text,
  'anon nao executa a RPC de conclusao'
);

select throws_ok(
  $$select public.helpdesk_count_ready_ticket_notifications('2099-08-24 12:00:00+00', null, null)$$,
  '42501'::char(5), null::text,
  'anon nao executa a RPC de backlog'
);

select throws_ok(
  $$select public.helpdesk_finish_ticket('40000000-0000-0000-0000-000000000001', null, null, null, null, null, null)$$,
  '42501'::char(5), null::text,
  'anon nao executa a RPC de finalizacao'
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
  $$select public.helpdesk_complete_ticket_notification('40000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000097', 1, 'sent', null, null)$$,
  '42501'::char(5),
  null::text,
  'authenticated nao executa a RPC de conclusao'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.helpdesk_finish_ticket(uuid,uuid,text,timestamptz,boolean,uuid,timestamptz)',
    'execute'
  ),
  'authenticated executa a finalizacao central sob RLS'
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
    select (last_human_message ->> 'created_at')::timestamptz
    from public.helpdesk_list_ticket_communication_candidates(null, 500, '40000000-0000-0000-0000-000000000001')
  $$,
  array['2099-08-24 11:30:00+00'::timestamptz],
  'a ultima mensagem humana ignora uma mensagem automatica mais recente'
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
  $$select public.helpdesk_count_ready_ticket_notifications('2099-08-24 12:00:00+00', null, null)$$,
  array[1::bigint],
  'o backlog contabiliza a entrega pronta antes da reserva'
);

select results_eq(
  $$select count(*)::bigint from public.helpdesk_claim_ticket_notifications(1, '2099-08-24 12:00:00+00')$$,
  array[1::bigint],
  'service_role reserva a entrega vencida'
);

insert into pg_temp.ticket_communication_test_claims (call_no, claim_token, attempt_count)
select 1, claim_token, attempt_count
from public.app_c009c0e4f1_ticket_notification_deliveries
where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1);

select results_eq(
  $$select public.helpdesk_count_ready_ticket_notifications('2099-08-24 12:00:00+00', null, null)$$,
  array[0::bigint],
  'o backlog nao contabiliza um lease ainda valido'
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

insert into pg_temp.ticket_communication_test_claims (call_no, claim_token, attempt_count)
select 2, claim_token, attempt_count
from public.app_c009c0e4f1_ticket_notification_deliveries
where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1);

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

select isnt(
  (select claim_token from pg_temp.ticket_communication_test_claims where call_no = 1),
  (select claim_token from pg_temp.ticket_communication_test_claims where call_no = 2),
  'uma nova reserva renova o token de fencing'
);

set local role service_role;

select is(
  (
    select public.helpdesk_complete_ticket_notification(
      (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1),
      (select claim_token from pg_temp.ticket_communication_test_claims where call_no = 1),
      (select attempt_count from pg_temp.ticket_communication_test_claims where call_no = 1),
      'sent',
      null,
      null
    )
  ) is null,
  true,
  'um worker antigo nao conclui o lease renovado'
);

select results_eq(
  $$
    select status, claim_token, attempt_count
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
  $$,
  $$
    select 'processing'::text, claim_token, attempt_count
    from pg_temp.ticket_communication_test_claims
    where call_no = 2
  $$,
  'a conclusao stale nao sobrescreve o claim atual'
);

select lives_ok(
  $$
    select public.helpdesk_complete_ticket_notification(
      (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1),
      (select claim_token from pg_temp.ticket_communication_test_claims where call_no = 2),
      (select attempt_count from pg_temp.ticket_communication_test_claims where call_no = 2),
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
      (
        select claim_token
        from public.app_c009c0e4f1_ticket_notification_deliveries
        where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
      ),
      (
        select attempt_count
        from public.app_c009c0e4f1_ticket_notification_deliveries
        where id = (select id from pg_temp.ticket_communication_test_enqueues where call_no = 1)
      ),
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
      (
        select claim_token from public.app_c009c0e4f1_ticket_notification_deliveries
        where cycle_key = 'cancel-test'
      ),
      (
        select attempt_count from public.app_c009c0e4f1_ticket_notification_deliveries
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

alter table public.app_c009c0e4f1_tickets
  disable trigger notification_push_tickets;

update public.app_c009c0e4f1_tickets
set status = 'resolved', resolved_at = '2099-08-25 13:00:00+00'
where id = '40000000-0000-0000-0000-000000000001';

set local role service_role;

select public.helpdesk_enqueue_ticket_notification(
  '40000000-0000-0000-0000-000000000001',
  'resolved_feedback_invite',
  'email',
  '2099-08-25 13:00:00+00',
  '2099-08-25 13:00:00+00'
);

reset role;

update public.app_c009c0e4f1_tickets
set status = 'open'
where id = '40000000-0000-0000-0000-000000000001';

set local role service_role;

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2099-08-25 13:01:00+00',
      '40000000-0000-0000-0000-000000000001',
      'resolved_feedback_invite'
    )
  $$,
  array[0::bigint],
  'reabrir cancela o convite do ciclo resolvido antigo'
);

select results_eq(
  $$
    select status, cancellation_reason
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where cycle_key = '2099-08-25 13:00:00+00'
  $$,
  $$values ('cancelled'::text, 'stale_cycle'::text)$$,
  'o ciclo antigo fica terminal e auditavel'
);

reset role;

update public.app_c009c0e4f1_tickets
set status = 'resolved', resolved_at = '2099-08-25 14:00:00+00'
where id = '40000000-0000-0000-0000-000000000001';

set local role service_role;

select results_ne(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'resolved_feedback_invite',
      'email',
      '2099-08-25 14:00:00+00',
      '2099-08-25 14:00:00+00'
    )
  $$,
  $$
    select id
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where cycle_key = '2099-08-25 13:00:00+00'
  $$,
  'uma nova resolucao cria convite para o cycle_key atual'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.helpdesk_claim_ticket_notifications(
      1,
      '2099-08-25 14:00:00+00',
      '40000000-0000-0000-0000-000000000001',
      'resolved_feedback_invite'
    )
  $$,
  array[1::bigint],
  'somente o convite do resolved_at atual e reservado'
);

select lives_ok(
  $$
    select public.helpdesk_complete_ticket_notification(
      (select id from public.app_c009c0e4f1_ticket_notification_deliveries where cycle_key = '2099-08-25 14:00:00+00'),
      (select claim_token from public.app_c009c0e4f1_ticket_notification_deliveries where cycle_key = '2099-08-25 14:00:00+00'),
      (select attempt_count from public.app_c009c0e4f1_ticket_notification_deliveries where cycle_key = '2099-08-25 14:00:00+00'),
      'sent',
      null,
      null
    )
  $$,
  'o convite do novo ciclo conclui normalmente'
);

select results_eq(
  $$
    select id
    from public.helpdesk_enqueue_ticket_notification(
      '40000000-0000-0000-0000-000000000001',
      'resolved_feedback_invite',
      'email',
      '2099-08-25 14:00:00+00',
      '2099-08-25 14:01:00+00'
    )
  $$,
  $$
    select id
    from public.app_c009c0e4f1_ticket_notification_deliveries
    where cycle_key = '2099-08-25 14:00:00+00'
  $$,
  'um prepare posterior deduplica o convite enviado do ciclo atual'
);

reset role;

update public.app_c009c0e4f1_tickets
set status = 'open'
where id = '40000000-0000-0000-0000-000000000001';

create temporary table ticket_communication_finish_results (
  call_no integer primary key,
  changed boolean not null,
  resolved_at timestamptz not null
) on commit drop;

grant select, insert on table pg_temp.ticket_communication_finish_results to service_role;

set local role service_role;

insert into pg_temp.ticket_communication_finish_results (call_no, changed, resolved_at)
select
  1,
  (finish_result.value ->> 'changed')::boolean,
  (finish_result.value #>> '{ticket,resolved_at}')::timestamptz
from (
  select public.helpdesk_finish_ticket(
    '40000000-0000-0000-0000-000000000001', null, null, null, null, null, null
  ) as value
) finish_result;

insert into pg_temp.ticket_communication_finish_results (call_no, changed, resolved_at)
select
  2,
  (finish_result.value ->> 'changed')::boolean,
  (finish_result.value #>> '{ticket,resolved_at}')::timestamptz
from (
  select public.helpdesk_finish_ticket(
    '40000000-0000-0000-0000-000000000001', null, null, null, null, null, null
  ) as value
) finish_result;

select results_eq(
  $$select changed from pg_temp.ticket_communication_finish_results order by call_no$$,
  $$values (true), (false)$$,
  'apenas uma chamada vence a transicao para resolvido'
);

select is(
  (select count(distinct resolved_at) from pg_temp.ticket_communication_finish_results),
  1::bigint,
  'a chamada perdedora preserva o resolved_at atomico do vencedor'
);

reset role;

alter table public.app_c009c0e4f1_tickets
  enable trigger notification_push_tickets;

select * from finish();
rollback;
