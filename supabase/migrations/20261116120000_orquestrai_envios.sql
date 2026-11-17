-- Histórico dos envios de tickets de Desenvolvimento Contínuo para o ORQESTRAI.
--
-- Até aqui o envio não deixava rastro no Responsum: a única proteção contra
-- duplicidade era a edge function procurar o "Ticket ID" na descrição dos cards
-- do ORQESTRAI. Quem abria o ticket não sabia se já tinha enviado, quando, nem
-- se a última tentativa tinha falhado.
--
-- Cada tentativa grava uma linha por tipo de card (PPT / Certificados):
--   created          → o card foi criado agora;
--   already_existed  → o card já existia e não foi duplicado;
--   failed           → a criação falhou (error_message traz o motivo).
--
-- Só a edge function orquestrai-treinamento (service role) lê e grava. O front
-- consulta pelo mesmo endpoint, que confere se o usuário pode enviar.

create table if not exists public.app_c009c0e4f1_orquestrai_envios (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.app_c009c0e4f1_tickets(id) on delete cascade,
  request_type text not null check (request_type in ('PPT', 'Certificados')),
  send_mode text not null check (send_mode in ('ppt', 'certificados', 'ppt_e_certificados')),
  outcome text not null check (outcome in ('created', 'already_existed', 'failed')),
  marketing_request_id text,
  error_message text,
  sent_by uuid,
  sent_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists orquestrai_envios_ticket_created_idx
  on public.app_c009c0e4f1_orquestrai_envios (ticket_id, created_at desc);

alter table public.app_c009c0e4f1_orquestrai_envios
  enable row level security;

revoke all
  on table public.app_c009c0e4f1_orquestrai_envios
  from public, anon, authenticated;

grant select, insert
  on table public.app_c009c0e4f1_orquestrai_envios
  to service_role;
