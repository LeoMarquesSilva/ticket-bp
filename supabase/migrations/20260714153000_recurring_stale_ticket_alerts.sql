-- Reenvia o alerta diariamente enquanto o ticket continuar sem interacao.
-- Uma interacao e uma mudanca no fluxo de atendimento ou mensagem nova no chat.

CREATE OR REPLACE FUNCTION public.helpdesk_get_stale_tickets(p_days integer DEFAULT 3)
RETURNS SETOF app_c009c0e4f1_tickets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM app_c009c0e4f1_tickets t
  CROSS JOIN LATERAL (
    SELECT GREATEST(
      t.created_at,
      COALESCE(t.assigned_at, t.created_at),
      COALESCE(t.started_at, t.created_at),
      COALESCE(t.reopened_at, t.created_at),
      COALESCE(MAX(m.created_at), t.created_at)
    ) AS last_activity_at
    FROM app_c009c0e4f1_chat_messages m
    WHERE m.ticket_id = t.id
  ) activity
  WHERE t.status IN ('open', 'assigned', 'in_progress')
    AND activity.last_activity_at <= now() - (GREATEST(p_days, 1) || ' days')::interval
    AND (
      t.stale_whatsapp_notified_at IS NULL
      OR activity.last_activity_at > t.stale_whatsapp_notified_at
      OR t.stale_whatsapp_notified_at <= now() - interval '1 day'
    )
  ORDER BY activity.last_activity_at ASC;
$$;

REVOKE ALL ON FUNCTION public.helpdesk_get_stale_tickets(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.helpdesk_get_stale_tickets(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_get_stale_tickets(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.helpdesk_get_unanswered_tickets()
RETURNS SETOF app_c009c0e4f1_tickets
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM app_c009c0e4f1_tickets t
  CROSS JOIN LATERAL (
    SELECT GREATEST(
      t.created_at,
      COALESCE(t.assigned_at, t.created_at),
      COALESCE(t.started_at, t.created_at),
      COALESCE(t.reopened_at, t.created_at),
      COALESCE(MAX(m.created_at), t.created_at)
    ) AS last_activity_at
    FROM app_c009c0e4f1_chat_messages m
    WHERE m.ticket_id = t.id
  ) activity
  WHERE t.status IN ('open', 'assigned', 'in_progress')
    AND public.helpdesk_has_manage_categories()
  ORDER BY activity.last_activity_at ASC;
$$;

REVOKE ALL ON FUNCTION public.helpdesk_get_unanswered_tickets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.helpdesk_get_unanswered_tickets() FROM anon;
GRANT EXECUTE ON FUNCTION public.helpdesk_get_unanswered_tickets() TO authenticated;

COMMENT ON COLUMN app_c009c0e4f1_tickets.stale_whatsapp_notified_at IS
  'Data do ultimo alerta de ticket parado. O alerta pode ser reenviado apos 24 horas sem nova interacao.';
