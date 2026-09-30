-- Toast "Ticket transferido para você" a partir da fila de avisos de atribuição.
--
-- O Layout deduzia a transferência comparando assigned_to novo x antigo no
-- UPDATE em tempo real de app_c009c0e4f1_tickets. Com RLS ativo, o Realtime só
-- envia a chave primária no registro antigo, então todo UPDATE de um ticket
-- atribuído ao usuário (mensagem, status, vínculo...) disparava o toast.
--
-- app_c009c0e4f1_ticket_assignment_notifications já tem exatamente uma linha
-- por troca real de responsável (sem autoatribuição). O novo responsável passa
-- a poder ler as próprias linhas, e a tabela entra na publicação do Realtime.

grant select on public.app_c009c0e4f1_ticket_assignment_notifications to authenticated;

drop policy if exists "Responsável lê os próprios avisos de atribuição"
  on public.app_c009c0e4f1_ticket_assignment_notifications;

create policy "Responsável lê os próprios avisos de atribuição"
  on public.app_c009c0e4f1_ticket_assignment_notifications
  for select
  to authenticated
  using (
    assignee_id in (
      select u.id from public.app_c009c0e4f1_users u where u.auth_user_id = (select auth.uid())
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_c009c0e4f1_ticket_assignment_notifications'
  ) then
    alter publication supabase_realtime add table public.app_c009c0e4f1_ticket_assignment_notifications;
  end if;
end $$;
