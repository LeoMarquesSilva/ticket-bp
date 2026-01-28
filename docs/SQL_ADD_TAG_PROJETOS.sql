-- =====================================================
-- Adicionar Tag "Projetos" (Área de negócio)
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Execute este script no Supabase (SQL Editor) para criar
-- a tag "Projetos" utilizada em categorias.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================

INSERT INTO app_c009c0e4f1_tags (key, label, color, icon, description, "order") VALUES
  ('projetos', 'Projetos', '#6366F1', 'folder', 'Área de projetos', 5)
ON CONFLICT (key) DO NOTHING;
