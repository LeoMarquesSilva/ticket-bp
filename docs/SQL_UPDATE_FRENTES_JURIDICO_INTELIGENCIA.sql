-- =====================================================
-- Atualizar Frentes de Atuação: Jurídico → Controladoria Jurídica
-- e adicionar Inteligência de Dados
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Execute no Supabase (SQL Editor). Idempotente.
-- =====================================================

-- 1. Renomear "Jurídico" para "Controladoria Jurídica"
UPDATE app_c009c0e4f1_tags
SET label = 'Controladoria Jurídica',
    description = COALESCE(description, 'Questões jurídicas e legais')
WHERE key = 'juridico';

-- 2. Inserir "Inteligência de Dados" (se não existir)
INSERT INTO app_c009c0e4f1_tags (key, label, color, icon, description, "order") VALUES
  ('inteligencia_dados', 'Inteligência de Dados', '#14B8A6', 'database', 'Área de inteligência de dados e analytics', 6)
ON CONFLICT (key) DO NOTHING;
