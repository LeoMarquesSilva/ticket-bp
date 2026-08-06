-- Decisão de auditoria FATAL (SIOE) ao finalizar ticket de
-- Validação de Indicadores / Auditoria de Excludentes/Envio de Evidência.
-- Separado de NPS/feedback (request_fulfilled, service_score, etc.).

ALTER TABLE app_c009c0e4f1_tickets
  ADD COLUMN IF NOT EXISTS evidencia_enviada boolean,
  ADD COLUMN IF NOT EXISTS evidencia_decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS evidencia_decidido_por uuid,
  ADD COLUMN IF NOT EXISTS evidencia_sioe_notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS evidencia_sioe_erro text;

COMMENT ON COLUMN app_c009c0e4f1_tickets.evidencia_enviada IS
  'Auditoria SIOE FATAL: true = evidencia_ok (excludente mantida); false = evidencia_nao_ok (incluído no FATAL). Null se ainda não decidido.';

COMMENT ON COLUMN app_c009c0e4f1_tickets.evidencia_decidido_em IS
  'Quando a decisão de evidência FATAL foi gravada no RESPONSUM.';

COMMENT ON COLUMN app_c009c0e4f1_tickets.evidencia_decidido_por IS
  'Usuário RESPONSUM (app_c009c0e4f1_users.id) que decidiu a evidência FATAL.';

COMMENT ON COLUMN app_c009c0e4f1_tickets.evidencia_sioe_notificado_em IS
  'Quando o callback SIOE (receber-decisao-evidencia-fatal) respondeu 2xx.';

COMMENT ON COLUMN app_c009c0e4f1_tickets.evidencia_sioe_erro IS
  'Último erro do callback SIOE; limpo após notificação bem-sucedida.';
