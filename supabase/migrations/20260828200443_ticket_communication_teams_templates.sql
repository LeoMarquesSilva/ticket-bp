create function public.helpdesk_get_ticket_communication_teams_templates()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select settings.value
  from public.app_c009c0e4f1_integration_settings settings
  where settings.key = 'ticket_communication_teams_templates_v1'
  limit 1;
$$;

revoke all
  on function public.helpdesk_get_ticket_communication_teams_templates()
  from public, anon, authenticated, service_role;

grant execute
  on function public.helpdesk_get_ticket_communication_teams_templates()
  to service_role;
