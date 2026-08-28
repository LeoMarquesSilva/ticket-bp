create function public.helpdesk_get_ticket_communication_schedule()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select settings.value
  from public.app_c009c0e4f1_integration_settings settings
  where settings.key = 'ticket_communication_schedule_v1'
  limit 1;
$$;

revoke all
  on function public.helpdesk_get_ticket_communication_schedule()
  from public, anon, authenticated, service_role;

grant execute
  on function public.helpdesk_get_ticket_communication_schedule()
  to service_role;
