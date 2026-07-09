-- Alerta WhatsApp para tickets sem qualquer resposta do suporte há N dias
-- Execute no SQL Editor do Supabase ou via CLI: supabase db push

ALTER TABLE app_c009c0e4f1_tickets
  ADD COLUMN IF NOT EXISTS stale_whatsapp_notified_at timestamptz;

COMMENT ON COLUMN app_c009c0e4f1_tickets.stale_whatsapp_notified_at IS 'Data em que o alerta de "ticket parado" foi enviado ao grupo do WhatsApp. Nulo enquanto não notificado.';

-- Retorna tickets ainda em aberto, criados há mais de p_days dias, que nunca
-- receberam nenhuma mensagem de alguém diferente do solicitante (ou seja,
-- sem qualquer resposta do suporte) e que ainda não geraram alerta.
CREATE OR REPLACE FUNCTION public.helpdesk_get_stale_tickets(p_days integer DEFAULT 3)
RETURNS SETOF app_c009c0e4f1_tickets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM app_c009c0e4f1_tickets t
  WHERE t.status IN ('open', 'assigned', 'in_progress')
    AND t.created_at <= now() - (GREATEST(p_days, 1) || ' days')::interval
    AND t.stale_whatsapp_notified_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM app_c009c0e4f1_chat_messages m
      WHERE m.ticket_id = t.id
        AND m.user_id <> t.created_by
    );
$$;

REVOKE ALL ON FUNCTION public.helpdesk_get_stale_tickets(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.helpdesk_get_stale_tickets(integer) TO service_role;
