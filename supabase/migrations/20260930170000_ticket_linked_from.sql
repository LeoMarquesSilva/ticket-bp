-- Chamado vinculado: permite abrir a continuação de um chamado finalizado.
--
-- linked_from_ticket_id aponta para o chamado original. O chamado vinculado
-- nasce atribuído ao responsável do original, então o aviso no Teams passa a
-- cobrir também o INSERT de chamados vinculados (com texto de "continuação").

alter table public.app_c009c0e4f1_tickets
  add column if not exists linked_from_ticket_id uuid
    references public.app_c009c0e4f1_tickets(id) on delete set null;

create index if not exists app_c009c0e4f1_tickets_linked_from_idx
  on public.app_c009c0e4f1_tickets (linked_from_ticket_id)
  where linked_from_ticket_id is not null;

alter table public.app_c009c0e4f1_ticket_assignment_notifications
  add column if not exists reason text not null default 'assigned'
    check (reason in ('assigned', 'linked'));

drop function if exists public.helpdesk_claim_ticket_assignment_notification(uuid);

create function public.helpdesk_claim_ticket_assignment_notification(p_notification_id uuid)
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
  requester_name text,
  reason text,
  linked_from_title text
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
    t.created_by_name,
    c.reason,
    src.title
  from claimed c
  join public.app_c009c0e4f1_tickets t on t.id = c.ticket_id
  left join public.app_c009c0e4f1_tickets src on src.id = t.linked_from_ticket_id
  left join public.app_c009c0e4f1_users a on a.id = c.assignee_id
  left join public.app_c009c0e4f1_users b on b.id = c.assigned_by_id;
$$;

revoke all on function public.helpdesk_claim_ticket_assignment_notification(uuid) from public, anon, authenticated;
grant execute on function public.helpdesk_claim_ticket_assignment_notification(uuid) to service_role;

create or replace function public.helpdesk_enqueue_ticket_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_previous_id uuid;
  v_reason text := 'assigned';
  v_notification_id uuid;
  v_token text;
begin
  if tg_op = 'INSERT' then
    -- No INSERT, só chamados vinculados já atribuídos geram aviso.
    if new.assigned_to is null or new.linked_from_ticket_id is null then
      return new;
    end if;
    v_reason := 'linked';
  else
    if new.assigned_to is null or new.assigned_to is not distinct from old.assigned_to then
      return new;
    end if;
    v_previous_id := old.assigned_to;
  end if;

  select u.id into v_actor_id
  from public.app_c009c0e4f1_users u
  where u.auth_user_id = auth.uid()
  limit 1;

  -- Quem assume (ou abre para si) o próprio ticket não precisa ser avisado.
  if v_actor_id is not null and v_actor_id = new.assigned_to then
    return new;
  end if;

  insert into public.app_c009c0e4f1_ticket_assignment_notifications
    (ticket_id, assignee_id, previous_assignee_id, assigned_by_id, reason)
  values (new.id, new.assigned_to, v_previous_id, v_actor_id, v_reason)
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
  -- O aviso nunca pode impedir a criação ou transferência do ticket.
  raise warning '[ticket_assignment_notify] falha ao enfileirar aviso: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists ticket_linked_teams_notification on public.app_c009c0e4f1_tickets;

create trigger ticket_linked_teams_notification
after insert on public.app_c009c0e4f1_tickets
for each row
when (new.linked_from_ticket_id is not null and new.assigned_to is not null)
execute function public.helpdesk_enqueue_ticket_assignment_notification();
