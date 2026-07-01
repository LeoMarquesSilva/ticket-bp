-- Corrige lacuna: notificações push só disparavam para novas mensagens de chat
-- (trigger "notfication_push" em app_c009c0e4f1_chat_messages), mas nunca para
-- tickets criados ou reatribuídos. Isso fazia com que atendentes só vissem um
-- ticket novo/atribuído a eles quando já estavam com a aba do sistema aberta.
--
-- Cria o mesmo tipo de Database Webhook (via supabase_functions.http_request)
-- para app_c009c0e4f1_tickets, cobrindo INSERT (novo ticket) e UPDATE
-- (reatribuição de responsável). O endpoint /api/send-push já sabia tratar
-- INSERT; o tratamento de UPDATE foi adicionado em api/send-push.js.

DROP TRIGGER IF EXISTS notification_push_tickets ON public.app_c009c0e4f1_tickets;

CREATE TRIGGER notification_push_tickets
AFTER INSERT OR UPDATE ON public.app_c009c0e4f1_tickets
FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
  'https://ticket-bp.vercel.app/api/send-push',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
