-- Lista de tickets abertos sem nenhuma resposta do suporte, para acompanhamento
-- de quais tickets estao proximos de disparar o alerta de "ticket parado".
-- Somente usuarios com a permissao manage_categories podem chamar esta funcao.

CREATE OR REPLACE FUNCTION public.helpdesk_get_unanswered_tickets()
RETURNS SETOF app_c009c0e4f1_tickets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM app_c009c0e4f1_tickets t
  WHERE t.status IN ('open', 'assigned', 'in_progress')
    AND public.helpdesk_has_manage_categories()
    AND NOT EXISTS (
      SELECT 1
      FROM app_c009c0e4f1_chat_messages m
      WHERE m.ticket_id = t.id
        AND m.user_id <> t.created_by
    )
  ORDER BY t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.helpdesk_get_unanswered_tickets() TO authenticated;
