-- Templates de resposta rápida do chat, editáveis pela tela de Gerenciamento de Categorias

CREATE TABLE IF NOT EXISTS app_c009c0e4f1_quick_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  message text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_c009c0e4f1_quick_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_reply_templates_select ON app_c009c0e4f1_quick_reply_templates;
CREATE POLICY quick_reply_templates_select
ON app_c009c0e4f1_quick_reply_templates
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS quick_reply_templates_write ON app_c009c0e4f1_quick_reply_templates;
CREATE POLICY quick_reply_templates_write
ON app_c009c0e4f1_quick_reply_templates
FOR ALL TO authenticated
USING (helpdesk_has_manage_categories())
WITH CHECK (helpdesk_has_manage_categories());

-- Preserva os templates padrão que já existiam fixos no código
INSERT INTO app_c009c0e4f1_quick_reply_templates (label, message, "order") VALUES
  ('Saudação inicial', 'Olá! Recebi sua solicitação e vou verificar para você. Retorno em breve.', 1),
  ('Verificando', 'Vou verificar e retorno em breve com as informações solicitadas.', 2),
  ('Aguarde', 'Aguarde um momento enquanto verifico sua solicitação.', 3),
  ('Agradecimento', 'Obrigado pela sua solicitação. Estamos trabalhando para resolver o mais rápido possível.', 4),
  ('Resolvido', 'Sua solicitação foi resolvida! Por favor, confirme se está tudo ok ou se precisa de mais alguma coisa.', 5),
  ('Precisa de informações', 'Para prosseguir com sua solicitação, preciso de algumas informações adicionais. Poderia me fornecer?', 6),
  ('Encerramento', 'Fico à disposição para qualquer outra dúvida. Tenha um ótimo dia!', 7),
  ('Acompanhamento', 'Estou acompanhando sua solicitação. Assim que tiver novidades, retorno o contato.', 8);
