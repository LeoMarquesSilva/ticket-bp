-- =====================================================
-- Adicionar coluna avatar_url na tabela de usuários
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Suporta: URL externa (ex: WordPress) ou URL do Supabase Storage
-- =====================================================

ALTER TABLE app_c009c0e4f1_users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN app_c009c0e4f1_users.avatar_url IS 'URL da foto do usuário (WordPress, Supabase Storage ou qualquer URL pública)';
