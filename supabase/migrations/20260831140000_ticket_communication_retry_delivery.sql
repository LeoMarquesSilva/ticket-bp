create function public.helpdesk_requeue_ticket_notification(
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
    raise exception using errcode = '22023', message = 'ticket_id is required';
  end if;

  if p_notification_type is null
    or p_notification_type not in (
      'resolved_feedback_invite',
      'awaiting_requester',
      'awaiting_feedback'
    ) then
    raise exception using errcode = '22023', message = 'invalid notification_type';
  end if;

  if p_channel is null or p_channel not in ('email', 'teams') then
    raise exception using errcode = '22023', message = 'invalid channel';
  end if;

  if p_cycle_key is null or pg_catalog.btrim(p_cycle_key) = '' then
    raise exception using errcode = '22023', message = 'cycle_key is required';
  end if;

  if p_next_attempt_at is null then
    raise exception using errcode = '22023', message = 'next_attempt_at is required';
  end if;

  update public.app_c009c0e4f1_ticket_notification_deliveries delivery
  set
    status = 'pending',
    next_attempt_at = p_next_attempt_at,
    processing_started_at = null,
    claim_token = null,
    last_error = null,
    updated_at = pg_catalog.now()
  where delivery.ticket_id = p_ticket_id
    and delivery.notification_type = p_notification_type
    and delivery.channel = p_channel
    and delivery.cycle_key = p_cycle_key
    and delivery.status in ('failed', 'pending')
  returning delivery.* into v_delivery;

  return v_delivery;
end;
$$;

revoke all
  on function public.helpdesk_requeue_ticket_notification(uuid, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;

grant execute
  on function public.helpdesk_requeue_ticket_notification(uuid, text, text, text, timestamptz)
  to service_role;
