-- Aviso no Teams ao novo responsável quando um ticket é transferido.
--
-- O push web (notification_push_tickets → /api/send-push) só alcança quem
-- ativou as notificações no Perfil, e o toast em tempo real só aparece com o
-- sistema aberto. Este trigger garante que toda troca de responsável gere uma
-- mensagem no chat individual do Teams, independentemente de onde a troca
-- aconteceu (transferência, auto-atribuição, edição direta).
--
-- Fluxo: trigger em assigned_to → linha em app_c009c0e4f1_ticket_assignment_notifications
-- (auditoria + idempotência) → pg_net chama notify-ticket-communications com
-- action "ticket_assigned", autenticado por um token aleatório guardado no Vault.

create table if not exists public.app_c009c0e4f1_ticket_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.app_c009c0e4f1_tickets(id) on delete cascade,
  assignee_id uuid not null,
  previous_assignee_id uuid,
  assigned_by_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists app_c009c0e4f1_ticket_assignment_notifications_ticket_idx
  on public.app_c009c0e4f1_ticket_assignment_notifications (ticket_id, created_at desc);

alter table public.app_c009c0e4f1_ticket_assignment_notifications enable row level security;
revoke all on public.app_c009c0e4f1_ticket_assignment_notifications from anon, authenticated;

-- Token compartilhado entre o trigger e a Edge Function. Gerado uma única vez.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ticket_assignment_notify_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'ticket_assignment_notify_token',
      'Autentica o trigger de troca de responsável na Edge Function notify-ticket-communications'
    );
  end if;
end $$;

create or replace function public.helpdesk_verify_ticket_assignment_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(p_token) > 0 and p_token = (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'ticket_assignment_notify_token'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.helpdesk_verify_ticket_assignment_token(text) from public, anon, authenticated;
grant execute on function public.helpdesk_verify_ticket_assignment_token(text) to service_role;

-- Reivindica uma notificação pendente e devolve o contexto para montar a mensagem.
create or replace function public.helpdesk_claim_ticket_assignment_notification(p_notification_id uuid)
returns table (
  id uuid,
  ticket_id uuid,
  ticket_title text,
  ticket_current_assignee_id uuid,
  assignee_id uuid,
  assignee_name text,
  assignee_email text,
  assignee_is_active boolean,
  assigned_by_name text,
  requester_name text
)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.app_c009c0e4f1_ticket_assignment_notifications n
    set status = 'processing', attempt_count = n.attempt_count + 1
    where n.id = p_notification_id and n.status = 'pending'
    returning n.*
  )
  select
    c.id,
    c.ticket_id,
    t.title,
    t.assigned_to,
    c.assignee_id,
    a.name,
    a.email,
    coalesce(a.is_active, false),
    b.name,
    t.created_by_name
  from claimed c
  join public.app_c009c0e4f1_tickets t on t.id = c.ticket_id
  left join public.app_c009c0e4f1_users a on a.id = c.assignee_id
  left join public.app_c009c0e4f1_users b on b.id = c.assigned_by_id;
$$;

revoke all on function public.helpdesk_claim_ticket_assignment_notification(uuid) from public, anon, authenticated;
grant execute on function public.helpdesk_claim_ticket_assignment_notification(uuid) to service_role;

create or replace function public.helpdesk_complete_ticket_assignment_notification(
  p_notification_id uuid,
  p_status text,
  p_error text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.app_c009c0e4f1_ticket_assignment_notifications n
    set status = p_status,
        last_error = left(p_error, 200),
        sent_at = case when p_status = 'sent' then now() else n.sent_at end
    where n.id = p_notification_id
      and n.status = 'processing'
      and p_status in ('sent', 'failed', 'skipped')
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.helpdesk_complete_ticket_assignment_notification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.helpdesk_complete_ticket_assignment_notification(uuid, text, text) to service_role;

create or replace function public.helpdesk_enqueue_ticket_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_notification_id uuid;
  v_token text;
begin
  if new.assigned_to is null or new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  select u.id into v_actor_id
  from public.app_c009c0e4f1_users u
  where u.auth_user_id = auth.uid()
  limit 1;

  -- Quem assume o próprio ticket não precisa ser avisado.
  if v_actor_id is not null and v_actor_id = new.assigned_to then
    return new;
  end if;

  insert into public.app_c009c0e4f1_ticket_assignment_notifications
    (ticket_id, assignee_id, previous_assignee_id, assigned_by_id)
  values (new.id, new.assigned_to, old.assigned_to, v_actor_id)
  returning id into v_notification_id;

  select s.decrypted_secret into v_token
  from vault.decrypted_secrets s
  where s.name = 'ticket_assignment_notify_token'
  limit 1;

  if v_token is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://jhgbrbarfpvgdaaznldj.supabase.co/functions/v1/notify-ticket-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-assignment-token', v_token
    ),
    body := jsonb_build_object('action', 'ticket_assigned', 'notificationId', v_notification_id),
    timeout_milliseconds := 15000
  );

  return new;
exception when others then
  -- O aviso nunca pode impedir a transferência do ticket.
  raise warning '[ticket_assignment_notify] falha ao enfileirar aviso: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists ticket_assignment_teams_notification on public.app_c009c0e4f1_tickets;

create trigger ticket_assignment_teams_notification
after update of assigned_to on public.app_c009c0e4f1_tickets
for each row execute function public.helpdesk_enqueue_ticket_assignment_notification();
