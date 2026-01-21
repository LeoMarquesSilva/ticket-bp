-- =====================================================
-- Script de Criação de Tabela de Tags para Categorias
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================

-- 1. Criar tabela de tags
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6', -- Cor padrão azul
  icon TEXT, -- Ícone opcional (ex: 'briefcase', 'monitor', 'dollar-sign')
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar coluna tag_id na tabela de categorias
ALTER TABLE app_c009c0e4f1_categories 
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES app_c009c0e4f1_tags(id) ON DELETE SET NULL;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tags_key ON app_c009c0e4f1_tags(key);
CREATE INDEX IF NOT EXISTS idx_tags_is_active ON app_c009c0e4f1_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_tags_order ON app_c009c0e4f1_tags("order");
CREATE INDEX IF NOT EXISTS idx_categories_tag_id ON app_c009c0e4f1_categories(tag_id);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE app_c009c0e4f1_tags ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS para tags (permissivas para aplicação controlar acesso)
CREATE POLICY "Permitir SELECT de todas tags"
  ON app_c009c0e4f1_tags
  FOR SELECT
  USING (true);

CREATE POLICY "Permitir INSERT em tags"
  ON app_c009c0e4f1_tags
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir UPDATE em tags"
  ON app_c009c0e4f1_tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir DELETE em tags"
  ON app_c009c0e4f1_tags
  FOR DELETE
  USING (true);

-- 6. Inserir tags padrão (exemplos)
INSERT INTO app_c009c0e4f1_tags (key, label, color, icon, description, "order") VALUES
  ('juridico', 'Jurídico', '#3B82F6', 'briefcase', 'Questões jurídicas e legais', 1),
  ('ti', 'T.I', '#10B981', 'monitor', 'Questões de tecnologia da informação', 2),
  ('marketing', 'Marketing', '#8B5CF6', 'megaphone', 'Questões de marketing e comunicação', 3),
  ('financeiro', 'Financeiro', '#F59E0B', 'dollar-sign', 'Questões financeiras e contábeis', 4)
ON CONFLICT (key) DO NOTHING;

-- 7. Atualizar timestamp na atualização
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tags_updated_at_trigger
  BEFORE UPDATE ON app_c009c0e4f1_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();
