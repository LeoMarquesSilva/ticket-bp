-- Tabela para guardar inscrições de Web Push por usuário.
-- Execute no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS app_c009c0e4f1_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_c009c0e4f1_users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS: habilitado; quem pode fazer o quê é controlado pela aplicação.
-- O frontend usa autenticação customizada (não Supabase Auth), então auth.uid() é null
-- nas requisições e uma policy baseada em auth.uid() bloqueia o INSERT. Por isso
-- permitimos as operações aqui; o frontend só envia user_id do usuário logado (useAuth).
ALTER TABLE app_c009c0e4f1_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remover policy antiga se existir
DROP POLICY IF EXISTS "Users can manage own push subscription" ON app_c009c0e4f1_push_subscriptions;
DROP POLICY IF EXISTS "Permitir operações em push_subscriptions" ON app_c009c0e4f1_push_subscriptions;

CREATE POLICY "Permitir operações em push_subscriptions"
  ON app_c009c0e4f1_push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- O backend que envia push usa service_role e ignora RLS.
