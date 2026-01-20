-- =====================================================
-- Script de Criação de Tabelas de Categorias e Subcategorias
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================

-- 1. Criar tabela de categorias
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sla_hours INTEGER,
  default_assigned_to UUID REFERENCES app_c009c0e4f1_users(id) ON DELETE SET NULL,
  default_assigned_to_name TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de subcategorias
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES app_c009c0e4f1_categories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sla_hours INTEGER NOT NULL,
  default_assigned_to UUID REFERENCES app_c009c0e4f1_users(id) ON DELETE SET NULL,
  default_assigned_to_name TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, key)
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_categories_key ON app_c009c0e4f1_categories(key);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON app_c009c0e4f1_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON app_c009c0e4f1_categories("order");
CREATE INDEX IF NOT EXISTS idx_categories_default_assigned_to ON app_c009c0e4f1_categories(default_assigned_to);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON app_c009c0e4f1_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_key ON app_c009c0e4f1_subcategories(key);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active ON app_c009c0e4f1_subcategories(is_active);
CREATE INDEX IF NOT EXISTS idx_subcategories_order ON app_c009c0e4f1_subcategories("order");
CREATE INDEX IF NOT EXISTS idx_subcategories_default_assigned_to ON app_c009c0e4f1_subcategories(default_assigned_to);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE app_c009c0e4f1_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_c009c0e4f1_subcategories ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de segurança - Todos podem ler categorias/subcategorias ativas
CREATE POLICY "Todos podem ler categorias ativas"
  ON app_c009c0e4f1_categories
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Todos podem ler subcategorias ativas"
  ON app_c009c0e4f1_subcategories
  FOR SELECT
  USING (is_active = true);

-- 6. Políticas de segurança - Admins podem gerenciar tudo
CREATE POLICY "Admins podem gerenciar categorias"
  ON app_c009c0e4f1_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_c009c0e4f1_users
      WHERE id::text = (SELECT auth.uid()::text)
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins podem gerenciar subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_c009c0e4f1_users
      WHERE id::text = (SELECT auth.uid()::text)
      AND role = 'admin'
      AND is_active = true
    )
  );

-- 7. Migrar dados existentes (opcional - apenas se quiser migrar as categorias hardcoded)
-- Descomente as linhas abaixo para migrar as categorias existentes

/*
-- Inserir categorias existentes
INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, is_active, "order") VALUES
  ('protocolo', 'Protocolo', NULL, true, 1),
  ('cadastro', 'Cadastro', NULL, true, 2),
  ('agendamento', 'Agendamento', NULL, true, 3),
  ('publicacoes', 'Publicações', NULL, true, 4),
  ('assinatura_digital', 'Assinatura Digital', NULL, true, 5),
  ('outros', 'Outros', 24, true, 6)
ON CONFLICT (key) DO NOTHING;

-- Inserir subcategorias existentes
-- Protocolo
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'pedido_urgencia', 'Pedido de urgência', 2, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'protocolo'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'inconsistencia', 'Inconsistência', 2, true, 2 FROM app_c009c0e4f1_categories WHERE key = 'protocolo'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'duvidas', 'Dúvidas', 2, true, 3 FROM app_c009c0e4f1_categories WHERE key = 'protocolo'
ON CONFLICT (category_id, key) DO NOTHING;

-- Cadastro
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'senhas_outros_tribunais', 'Senhas Outros Tribunais', 1, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'cadastro'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'senha_tribunal_expirada', 'Senha Tribunal Expirada', 1, true, 2 FROM app_c009c0e4f1_categories WHERE key = 'cadastro'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'duvidas', 'Dúvidas', 24, true, 3 FROM app_c009c0e4f1_categories WHERE key = 'cadastro'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'atualizacao_cadastro', 'Atualização de Cadastro', 24, true, 4 FROM app_c009c0e4f1_categories WHERE key = 'cadastro'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'correcao_cadastro', 'Correção de Cadastro', 24, true, 5 FROM app_c009c0e4f1_categories WHERE key = 'cadastro'
ON CONFLICT (category_id, key) DO NOTHING;

-- Agendamento
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'duvidas', 'Dúvidas', 4, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'agendamento'
ON CONFLICT (category_id, key) DO NOTHING;

-- Publicações
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'problemas_central_publi', 'Problemas na central de publi', 1, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'publicacoes'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'duvidas', 'Dúvidas', 2, true, 2 FROM app_c009c0e4f1_categories WHERE key = 'publicacoes'
ON CONFLICT (category_id, key) DO NOTHING;

-- Assinatura Digital
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'pedido_urgencia', 'Pedido de urgência', 3, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'assinatura_digital'
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'duvidas', 'Dúvidas', 3, true, 2 FROM app_c009c0e4f1_categories WHERE key = 'assinatura_digital'
ON CONFLICT (category_id, key) DO NOTHING;

-- Outros
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT id, 'outros', 'Outros', 24, true, 1 FROM app_c009c0e4f1_categories WHERE key = 'outros'
ON CONFLICT (category_id, key) DO NOTHING;
*/

-- 8. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON app_c009c0e4f1_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at 
  BEFORE UPDATE ON app_c009c0e4f1_subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Trigger para atualizar default_assigned_to_name quando usuário for atribuído
CREATE OR REPLACE FUNCTION update_category_assigned_to_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.default_assigned_to IS NOT NULL THEN
    SELECT name INTO NEW.default_assigned_to_name
    FROM app_c009c0e4f1_users
    WHERE id = NEW.default_assigned_to;
  ELSE
    NEW.default_assigned_to_name = NULL;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_category_assigned_to_name_trigger
  BEFORE INSERT OR UPDATE ON app_c009c0e4f1_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_assigned_to_name();

CREATE TRIGGER update_subcategory_assigned_to_name_trigger
  BEFORE INSERT OR UPDATE ON app_c009c0e4f1_subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_assigned_to_name();
