-- Agenda os avisos diários de comunicação (awaiting_requester / awaiting_feedback).
--
-- O runbook previa este cron, mas ele nunca tinha sido criado: os avisos só
-- rodaram uma vez, manualmente, em 2026-08-28. Disparos de 12:00 a 12:50 UTC
-- (09:00 em America/Sao_Paulo); o primeiro abre o ciclo do dia e os demais
-- drenam backlog. O mesmo dia gera o mesmo cycle_key, então as continuações
-- são idempotentes.
--
-- Autentica com o token interno do Vault (ticket_assignment_notify_token),
-- criado em 20260930150000_ticket_assignment_teams_notification.sql.

create or replace function public.helpdesk_run_ticket_communications_daily()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select s.decrypted_secret into v_token
  from vault.decrypted_secrets s
  where s.name = 'ticket_assignment_notify_token'
  limit 1;

  if v_token is null then
    raise warning '[ticket_communications_daily] token interno ausente no Vault';
    return null;
  end if;

  return net.http_post(
    url := 'https://jhgbrbarfpvgdaaznldj.supabase.co/functions/v1/notify-ticket-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-assignment-token', v_token
    ),
    body := jsonb_build_object('action', 'daily'),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.helpdesk_run_ticket_communications_daily() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ticket-communications-daily') then
    perform cron.unschedule('ticket-communications-daily');
  end if;
end $$;

select cron.schedule(
  'ticket-communications-daily',
  '0,10,20,30,40,50 12 * * *',
  'select public.helpdesk_run_ticket_communications_daily();'
);
