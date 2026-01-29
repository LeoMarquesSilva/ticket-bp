-- =====================================================
-- Permitir roles customizadas na tabela de usuários
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- O CHECK antigo em app_c009c0e4f1_users(role) só aceitava
-- 'admin', 'lawyer', 'support', 'user'. Este script remove
-- esse CHECK para aceitar qualquer role da tabela app_c009c0e4f1_roles.
--
-- Se o DROP falhar (nome da constraint diferente), descubra o nome com:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'app_c009c0e4f1_users'::regclass AND contype = 'c';
-- e use: ALTER TABLE app_c009c0e4f1_users DROP CONSTRAINT <conname>;
-- =====================================================

-- 1. Remover o CHECK antigo que restringe role a valores fixos
ALTER TABLE app_c009c0e4f1_users
  DROP CONSTRAINT IF EXISTS app_c009c0e4f1_users_role_check;

-- 2. (Opcional) Garantir que role só aceite chaves existentes em app_c009c0e4f1_roles
--    Descomente as linhas abaixo se quiser validar no banco:
-- ALTER TABLE app_c009c0e4f1_users
--   ADD CONSTRAINT app_c009c0e4f1_users_role_fkey
--   FOREIGN KEY (role) REFERENCES app_c009c0e4f1_roles(key);

-- Se já existir algum usuário com role que não está em app_c009c0e4f1_roles,
-- a FK acima falhará. Nesse caso, deixe a FK comentada; apenas o DROP do CHECK
-- já permite usar roles customizadas.
