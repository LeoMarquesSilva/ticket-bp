-- O cron diário da presença dos certificados recebia 401 todo dia: ele mandava
-- a anon key antiga (JWT do Vault notify_stale_tickets_anon_key), mas a Edge
-- Function compara com SUPABASE_ANON_KEY, que depois da migração de chaves do
-- projeto virou a chave "publishable". A presença só entrava pelo botão.
--
-- Em vez de trocar aquele segredo (o notify-stale-tickets-daily também usa),
-- o cron passa a ter um token próprio no Vault. A função confere o token pela
-- RPC abaixo, no mesmo padrão do ticket_assignment_notify_token
-- (20260930150000_ticket_assignment_teams_notification.sql).

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'orquestrai_presenca_cron_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'orquestrai_presenca_cron_token',
      'Autentica o cron diário na Edge Function orquestrai-certificados-presenca'
    );
  end if;
end $$;

create or replace function public.helpdesk_verify_orquestrai_presenca_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(p_token) > 0 and p_token = (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'orquestrai_presenca_cron_token'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.helpdesk_verify_orquestrai_presenca_token(text) from public, anon, authenticated;

create or replace function public.helpdesk_run_orquestrai_presenca_daily()
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
  where s.name = 'orquestrai_presenca_cron_token'
  limit 1;

  if v_token is null then
    raise warning '[orquestrai_presenca_daily] token ausente no Vault';
    return null;
  end if;

  -- A função lê três listas do SharePoint antes de responder; o padrão de 5 s
  -- do pg_net não dá.
  return net.http_post(
    url := 'https://jhgbrbarfpvgdaaznldj.supabase.co/functions/v1/orquestrai-certificados-presenca',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', v_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.helpdesk_run_orquestrai_presenca_daily() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'orquestrai-certificados-presenca-daily') then
    perform cron.unschedule('orquestrai-certificados-presenca-daily');
  end if;
end $$;

-- 09:00 em America/Sao_Paulo, como antes.
select cron.schedule(
  'orquestrai-certificados-presenca-daily',
  '0 12 * * *',
  'select public.helpdesk_run_orquestrai_presenca_daily();'
);
