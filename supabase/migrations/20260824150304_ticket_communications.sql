alter table public.app_c009c0e4f1_chat_messages
  add column if not exists is_system boolean not null default false;

create table public.app_c009c0e4f1_ticket_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.app_c009c0e4f1_tickets(id) on delete cascade,
  notification_type text not null check (
    notification_type in ('resolved_feedback_invite', 'awaiting_requester', 'awaiting_feedback')
  ),
  channel text not null check (channel in ('email', 'teams')),
  cycle_key text not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, notification_type, channel, cycle_key)
);

create unique index ticket_notification_one_unsent_cycle
  on public.app_c009c0e4f1_ticket_notification_deliveries (
    ticket_id,
    notification_type,
    channel
  )
  where status in ('pending', 'processing', 'failed');

alter table public.app_c009c0e4f1_ticket_notification_deliveries
  enable row level security;

revoke all
  on table public.app_c009c0e4f1_ticket_notification_deliveries
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.app_c009c0e4f1_ticket_notification_deliveries
  to service_role;

insert into public.app_c009c0e4f1_integration_settings (key, value, updated_at)
values ('ticket_communications_enabled_at', now()::text, now())
on conflict (key) do nothing;

create function public.helpdesk_list_ticket_communication_candidates(
  p_after_id uuid default null,
  p_limit integer default 500,
  p_ticket_id uuid default null
)
returns table (
  ticket_id uuid,
  enabled_at timestamptz,
  ticket jsonb,
  requester jsonb,
  last_human_message jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    settings.enabled_at,
    pg_catalog.jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'status', t.status,
      'created_by', t.created_by,
      'category', t.category,
      'subcategory', t.subcategory,
      'resolved_at', t.resolved_at,
      'feedback_submitted_at', t.feedback_submitted_at
    ),
    case when requester.id is null then null else pg_catalog.jsonb_build_object(
      'id', requester.id,
      'name', requester.name,
      'email', requester.email
    ) end,
    latest.message
  from public.app_c009c0e4f1_tickets t
  cross join lateral (
    select value::timestamptz as enabled_at
    from public.app_c009c0e4f1_integration_settings
    where key = 'ticket_communications_enabled_at'
  ) settings
  left join public.app_c009c0e4f1_users requester on requester.id = t.created_by
  left join lateral (
    select pg_catalog.jsonb_build_object(
      'user_id', message.user_id,
      'created_at', message.created_at
    ) as message
    from public.app_c009c0e4f1_chat_messages message
    where message.ticket_id = t.id
      and message.is_system = false
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where (p_ticket_id is null or t.id = p_ticket_id)
    and (p_after_id is null or t.id > p_after_id)
    and (
      t.status in ('open', 'assigned', 'in_progress')
      or (
        t.status = 'resolved'
        and t.feedback_submitted_at is null
        and t.resolved_at >= settings.enabled_at
      )
    )
  order by t.id
  limit least(greatest(coalesce(p_limit, 0), 0), 500);
$$;

create function public.helpdesk_get_ticket_communication_contexts(
  p_ticket_ids uuid[]
)
returns table (
  ticket_id uuid,
  enabled_at timestamptz,
  ticket jsonb,
  requester jsonb,
  last_human_message jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    settings.enabled_at,
    pg_catalog.jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'status', t.status,
      'created_by', t.created_by,
      'category', t.category,
      'subcategory', t.subcategory,
      'resolved_at', t.resolved_at,
      'feedback_submitted_at', t.feedback_submitted_at
    ),
    case when requester.id is null then null else pg_catalog.jsonb_build_object(
      'id', requester.id,
      'name', requester.name,
      'email', requester.email
    ) end,
    latest.message
  from public.app_c009c0e4f1_tickets t
  cross join lateral (
    select value::timestamptz as enabled_at
    from public.app_c009c0e4f1_integration_settings
    where key = 'ticket_communications_enabled_at'
  ) settings
  left join public.app_c009c0e4f1_users requester on requester.id = t.created_by
  left join lateral (
    select pg_catalog.jsonb_build_object(
      'user_id', message.user_id,
      'created_at', message.created_at
    ) as message
    from public.app_c009c0e4f1_chat_messages message
    where message.ticket_id = t.id
      and message.is_system = false
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where t.id = any(coalesce(p_ticket_ids, '{}'::uuid[]));
$$;

create function public.helpdesk_enqueue_ticket_notification(
  p_ticket_id uuid,
  p_notification_type text,
  p_channel text,
  p_cycle_key text,
  p_next_attempt_at timestamptz
)
returns public.app_c009c0e4f1_ticket_notification_deliveries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.app_c009c0e4f1_ticket_notification_deliveries%rowtype;
begin
  if p_ticket_id is null then
    raise exception using
      errcode = '22023',
      message = 'ticket_id is required';
  end if;

  if p_notification_type is null
    or p_notification_type not in (
      'resolved_feedback_invite',
      'awaiting_requester',
      'awaiting_feedback'
    ) then
    raise exception using
      errcode = '22023',
      message = 'invalid notification_type';
  end if;

  if p_channel is null or p_channel not in ('email', 'teams') then
    raise exception using
      errcode = '22023',
      message = 'invalid channel';
  end if;

  if p_cycle_key is null or pg_catalog.btrim(p_cycle_key) = '' then
    raise exception using
      errcode = '22023',
      message = 'cycle_key is required';
  end if;

  if p_next_attempt_at is null then
    raise exception using
      errcode = '22023',
      message = 'next_attempt_at is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat_ws(
        ':',
        p_ticket_id::text,
        p_notification_type,
        p_channel
      ),
      0
    )
  );

  select delivery.*
  into v_delivery
  from public.app_c009c0e4f1_ticket_notification_deliveries delivery
  where delivery.ticket_id = p_ticket_id
    and delivery.notification_type = p_notification_type
    and delivery.channel = p_channel
    and delivery.cycle_key = p_cycle_key;

  if found then
    return v_delivery;
  end if;

  if p_notification_type = 'resolved_feedback_invite' then
    update public.app_c009c0e4f1_ticket_notification_deliveries delivery
    set
      status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = 'stale_cycle',
      processing_started_at = null,
      claim_token = null,
      updated_at = pg_catalog.now()
    where delivery.ticket_id = p_ticket_id
      and delivery.notification_type = p_notification_type
      and delivery.channel = p_channel
      and delivery.cycle_key <> p_cycle_key
      and delivery.status in ('pending', 'processing', 'failed');
  end if;

  select delivery.*
  into v_delivery
  from public.app_c009c0e4f1_ticket_notification_deliveries delivery
  where delivery.ticket_id = p_ticket_id
    and delivery.notification_type = p_notification_type
    and delivery.channel = p_channel
    and p_notification_type <> 'resolved_feedback_invite'
    and delivery.status in ('pending', 'processing', 'failed')
  order by delivery.created_at, delivery.id
  limit 1;

  if found then
    return v_delivery;
  end if;

  insert into public.app_c009c0e4f1_ticket_notification_deliveries (
    ticket_id,
    notification_type,
    channel,
    cycle_key,
    next_attempt_at
  )
  values (
    p_ticket_id,
    p_notification_type,
    p_channel,
    p_cycle_key,
    p_next_attempt_at
  )
  on conflict (ticket_id, notification_type, channel, cycle_key) do nothing
  returning * into v_delivery;

  if found then
    return v_delivery;
  end if;

  select delivery.*
  into strict v_delivery
  from public.app_c009c0e4f1_ticket_notification_deliveries delivery
  where delivery.ticket_id = p_ticket_id
    and delivery.notification_type = p_notification_type
    and delivery.channel = p_channel
    and delivery.cycle_key = p_cycle_key;

  return v_delivery;
end;
$$;

create function public.helpdesk_claim_ticket_notifications(
  p_limit integer,
  p_now timestamptz,
  p_ticket_id uuid default null,
  p_notification_type text default null
)
returns setof public.app_c009c0e4f1_ticket_notification_deliveries
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if (p_ticket_id is null) <> (p_notification_type is null) then
    raise exception using errcode = '22023', message = 'claim filters must be paired';
  end if;

  if p_notification_type is not null and p_notification_type not in (
    'resolved_feedback_invite', 'awaiting_requester', 'awaiting_feedback'
  ) then
    raise exception using errcode = '22023', message = 'invalid notification_type';
  end if;

  update public.app_c009c0e4f1_ticket_notification_deliveries delivery
  set
    status = 'cancelled',
    cancelled_at = p_now,
    cancellation_reason = 'stale_cycle',
    processing_started_at = null,
    claim_token = null,
    updated_at = p_now
  from public.app_c009c0e4f1_tickets ticket
  where delivery.ticket_id = ticket.id
    and delivery.notification_type = 'resolved_feedback_invite'
    and delivery.status in ('pending', 'processing', 'failed')
    and (
      ticket.status <> 'resolved'
      or ticket.resolved_at is null
      or delivery.cycle_key <> ticket.resolved_at::text
    );

  return query
  with claimable as (
    select delivery.id
    from public.app_c009c0e4f1_ticket_notification_deliveries delivery
    where (
      (
        delivery.status in ('pending', 'failed')
        and delivery.next_attempt_at <= p_now
      ) or (
        delivery.status = 'processing'
        and delivery.processing_started_at < p_now - interval '15 minutes'
      )
    )
      and (p_ticket_id is null or delivery.ticket_id = p_ticket_id)
      and (p_notification_type is null or delivery.notification_type = p_notification_type)
      and (
        delivery.notification_type <> 'resolved_feedback_invite'
        or exists (
          select 1
          from public.app_c009c0e4f1_tickets ticket
          where ticket.id = delivery.ticket_id
            and ticket.status = 'resolved'
            and ticket.resolved_at is not null
            and delivery.cycle_key = ticket.resolved_at::text
        )
      )
    order by delivery.next_attempt_at, delivery.created_at, delivery.id
    for update skip locked
    limit greatest(coalesce(p_limit, 0), 0)
  )
  update public.app_c009c0e4f1_ticket_notification_deliveries delivery
  set
    status = 'processing',
    attempt_count = delivery.attempt_count + 1,
    claim_token = pg_catalog.gen_random_uuid(),
    processing_started_at = p_now,
    updated_at = p_now
  from claimable
  where delivery.id = claimable.id
  returning delivery.*;
end;
$$;

create function public.helpdesk_complete_ticket_notification(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_attempt_count integer,
  p_outcome text,
  p_error text,
  p_next_attempt_at timestamptz
)
returns public.app_c009c0e4f1_ticket_notification_deliveries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.app_c009c0e4f1_ticket_notification_deliveries%rowtype;
begin
  if p_delivery_id is null then
    raise exception using
      errcode = '22023',
      message = 'delivery_id is required';
  end if;

  if p_claim_token is null then
    raise exception using
      errcode = '22023',
      message = 'claim_token is required';
  end if;

  if p_attempt_count is null or p_attempt_count <= 0 then
    raise exception using
      errcode = '22023',
      message = 'attempt_count must be positive';
  end if;

  if p_outcome is null or p_outcome not in ('sent', 'failed', 'cancelled') then
    raise exception using
      errcode = '22023',
      message = 'invalid outcome';
  end if;

  if p_outcome = 'failed' and p_next_attempt_at is null then
    raise exception using
      errcode = '22023',
      message = 'next_attempt_at is required after a failure';
  end if;

  update public.app_c009c0e4f1_ticket_notification_deliveries delivery
  set
    status = p_outcome,
    sent_at = case when p_outcome = 'sent' then pg_catalog.now() else null end,
    cancelled_at = case when p_outcome = 'cancelled' then pg_catalog.now() else null end,
    cancellation_reason = case
      when p_outcome = 'cancelled' then pg_catalog.left(p_error, 500)
      else null
    end,
    last_error = case
      when p_outcome = 'failed' then pg_catalog.left(p_error, 500)
      else null
    end,
    next_attempt_at = case
      when p_outcome = 'failed' then p_next_attempt_at
      else delivery.next_attempt_at
    end,
    processing_started_at = null,
    claim_token = null,
    updated_at = pg_catalog.now()
  where delivery.id = p_delivery_id
    and delivery.status = 'processing'
    and delivery.claim_token = p_claim_token
    and delivery.attempt_count = p_attempt_count
  returning delivery.* into v_delivery;

  if not found then
    return null;
  end if;

  return v_delivery;
end;
$$;

create function public.helpdesk_count_ready_ticket_notifications(
  p_now timestamptz,
  p_ticket_id uuid default null,
  p_notification_type text default null
)
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if (p_ticket_id is null) <> (p_notification_type is null) then
    raise exception using errcode = '22023', message = 'count filters must be paired';
  end if;

  if p_notification_type is not null and p_notification_type not in (
    'resolved_feedback_invite', 'awaiting_requester', 'awaiting_feedback'
  ) then
    raise exception using errcode = '22023', message = 'invalid notification_type';
  end if;

  select pg_catalog.count(*)
  into v_count
  from public.app_c009c0e4f1_ticket_notification_deliveries delivery
  where (
    (
      delivery.status in ('pending', 'failed')
      and delivery.next_attempt_at <= p_now
    ) or (
      delivery.status = 'processing'
      and delivery.processing_started_at < p_now - interval '15 minutes'
    )
  )
    and (p_ticket_id is null or delivery.ticket_id = p_ticket_id)
    and (p_notification_type is null or delivery.notification_type = p_notification_type)
    and (
      delivery.notification_type <> 'resolved_feedback_invite'
      or exists (
        select 1
        from public.app_c009c0e4f1_tickets ticket
        where ticket.id = delivery.ticket_id
          and ticket.status = 'resolved'
          and ticket.resolved_at is not null
          and delivery.cycle_key = ticket.resolved_at::text
      )
    );

  return v_count;
end;
$$;

create function public.helpdesk_finish_ticket(
  p_ticket_id uuid,
  p_assigned_to uuid,
  p_assigned_to_name text,
  p_assigned_at timestamptz,
  p_evidencia_enviada boolean,
  p_evidencia_decidido_por uuid,
  p_evidencia_decidido_em timestamptz
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_ticket jsonb;
begin
  if p_ticket_id is null then
    raise exception using errcode = '22023', message = 'ticket_id is required';
  end if;

  if p_assigned_to is not null and (
    p_assigned_to_name is null
    or pg_catalog.btrim(p_assigned_to_name) = ''
    or p_assigned_at is null
  ) then
    raise exception using errcode = '22023', message = 'assignment data is incomplete';
  end if;

  update public.app_c009c0e4f1_tickets ticket
  set
    status = 'resolved',
    resolved_at = pg_catalog.now(),
    assigned_to = case when p_assigned_to is not null then p_assigned_to else ticket.assigned_to end,
    assigned_to_name = case
      when p_assigned_to is not null then p_assigned_to_name
      else ticket.assigned_to_name
    end,
    assigned_at = case when p_assigned_to is not null then p_assigned_at else ticket.assigned_at end,
    evidencia_enviada = case
      when p_evidencia_enviada is not null
        and ticket.category = 'validacao_de_indicadores'
        and ticket.subcategory = 'auditoria_de_excludentes_envio_de_evidencia'
        and ticket.evidencia_enviada is null
        then p_evidencia_enviada
      else ticket.evidencia_enviada
    end,
    evidencia_decidido_por = case
      when p_evidencia_enviada is not null
        and ticket.category = 'validacao_de_indicadores'
        and ticket.subcategory = 'auditoria_de_excludentes_envio_de_evidencia'
        and ticket.evidencia_enviada is null
        then p_evidencia_decidido_por
      else ticket.evidencia_decidido_por
    end,
    evidencia_decidido_em = case
      when p_evidencia_enviada is not null
        and ticket.category = 'validacao_de_indicadores'
        and ticket.subcategory = 'auditoria_de_excludentes_envio_de_evidencia'
        and ticket.evidencia_enviada is null
        then p_evidencia_decidido_em
      else ticket.evidencia_decidido_em
    end,
    updated_at = pg_catalog.now()
  where ticket.id = p_ticket_id
    and ticket.status <> 'resolved'
  returning pg_catalog.to_jsonb(ticket.*) into v_ticket;

  if found then
    return pg_catalog.jsonb_build_object('changed', true, 'ticket', v_ticket);
  end if;

  select pg_catalog.to_jsonb(ticket.*)
  into v_ticket
  from public.app_c009c0e4f1_tickets ticket
  where ticket.id = p_ticket_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'ticket not found';
  end if;

  return pg_catalog.jsonb_build_object('changed', false, 'ticket', v_ticket);
end;
$$;

create function public.helpdesk_get_ticket_communication_email_templates()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select settings.value
  from public.app_c009c0e4f1_integration_settings settings
  where settings.key = 'ticket_communication_email_templates_v1'
  limit 1;
$$;

revoke all
  on function public.helpdesk_get_ticket_communication_email_templates()
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_list_ticket_communication_candidates(uuid, integer, uuid)
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_get_ticket_communication_contexts(uuid[])
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_enqueue_ticket_notification(uuid, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_claim_ticket_notifications(integer, timestamptz, uuid, text)
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_complete_ticket_notification(uuid, uuid, integer, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_count_ready_ticket_notifications(timestamptz, uuid, text)
  from public, anon, authenticated, service_role;
revoke all
  on function public.helpdesk_finish_ticket(uuid, uuid, text, timestamptz, boolean, uuid, timestamptz)
  from public, anon, authenticated, service_role;

grant execute
  on function public.helpdesk_get_ticket_communication_email_templates()
  to service_role;
grant execute
  on function public.helpdesk_list_ticket_communication_candidates(uuid, integer, uuid)
  to service_role;
grant execute
  on function public.helpdesk_get_ticket_communication_contexts(uuid[])
  to service_role;
grant execute
  on function public.helpdesk_enqueue_ticket_notification(uuid, text, text, text, timestamptz)
  to service_role;
grant execute
  on function public.helpdesk_claim_ticket_notifications(integer, timestamptz, uuid, text)
  to service_role;
grant execute
  on function public.helpdesk_complete_ticket_notification(uuid, uuid, integer, text, text, timestamptz)
  to service_role;
grant execute
  on function public.helpdesk_count_ready_ticket_notifications(timestamptz, uuid, text)
  to service_role;
grant execute
  on function public.helpdesk_finish_ticket(uuid, uuid, text, timestamptz, boolean, uuid, timestamptz)
  to authenticated, service_role;
