create function public.helpdesk_list_ticket_communication_deliveries(
  p_limit integer default 200
)
returns table (
  id uuid,
  ticket_id uuid,
  ticket_title text,
  requester_name text,
  requester_email text,
  notification_type text,
  channel text,
  cycle_key text,
  status text,
  sent_at timestamptz,
  last_error text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    delivery.id,
    delivery.ticket_id,
    ticket.title,
    requester.name,
    requester.email,
    delivery.notification_type,
    delivery.channel,
    delivery.cycle_key,
    delivery.status,
    delivery.sent_at,
    delivery.last_error,
    delivery.updated_at
  from public.app_c009c0e4f1_ticket_notification_deliveries delivery
  left join public.app_c009c0e4f1_tickets ticket
    on ticket.id = delivery.ticket_id
  left join public.app_c009c0e4f1_users requester
    on requester.id = ticket.created_by
  where delivery.status in ('sent', 'pending', 'processing', 'failed')
  order by
    case
      when delivery.status = 'sent' then delivery.sent_at
      else delivery.updated_at
    end desc nulls last,
    delivery.id desc
  limit least(greatest(coalesce(p_limit, 0), 0), 200);
$$;

revoke all
  on function public.helpdesk_list_ticket_communication_deliveries(integer)
  from public, anon, authenticated, service_role;

grant execute
  on function public.helpdesk_list_ticket_communication_deliveries(integer)
  to service_role;
