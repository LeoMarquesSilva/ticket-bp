-- =====================================================
-- Sistema de Roles e Permissões Configuráveis
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Permite: alterar role do usuário, configurar o que cada role vê,
-- e criar novas roles personalizadas.
-- =====================================================

-- 1. Tabela de roles (papéis)
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de permissões por role
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES app_c009c0e4f1_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_roles_key ON app_c009c0e4f1_roles(key);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON app_c009c0e4f1_roles(is_system);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON app_c009c0e4f1_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON app_c009c0e4f1_role_permissions(permission_key);

-- RLS (opcional: permitir leitura para todos autenticados, escrita só via service)
ALTER TABLE app_c009c0e4f1_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_c009c0e4f1_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir SELECT roles" ON app_c009c0e4f1_roles FOR SELECT USING (true);
CREATE POLICY "Permitir INSERT roles" ON app_c009c0e4f1_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir UPDATE roles" ON app_c009c0e4f1_roles FOR UPDATE USING (true);
CREATE POLICY "Permitir DELETE roles" ON app_c009c0e4f1_roles FOR DELETE USING (true);

CREATE POLICY "Permitir SELECT role_permissions" ON app_c009c0e4f1_role_permissions FOR SELECT USING (true);
CREATE POLICY "Permitir INSERT role_permissions" ON app_c009c0e4f1_role_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir UPDATE role_permissions" ON app_c009c0e4f1_role_permissions FOR UPDATE USING (true);
CREATE POLICY "Permitir DELETE role_permissions" ON app_c009c0e4f1_role_permissions FOR DELETE USING (true);

-- 3. Inserir roles do sistema (idempotente)
INSERT INTO app_c009c0e4f1_roles (key, label, description, is_system, "order") VALUES
  ('admin', 'Gestor (Admin)', 'Acesso total: dashboard, tickets, usuários, categorias e roles', true, 1),
  ('lawyer', 'Advogado', 'Dashboard, tickets, atribuir e finalizar', true, 2),
  ('support', 'Suporte (Op. Legais)', 'Dashboard, tickets, atribuir e finalizar', true, 3),
  ('user', 'Usuário (Jurídico)', 'Criar e ver próprios tickets, dar feedback', true, 4)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, updated_at = NOW();

-- 4. Inserir permissões padrão para cada role (via subquery para pegar IDs)
-- Admin: todas as permissões
INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM app_c009c0e4f1_roles r
CROSS JOIN (VALUES ('dashboard'), ('tickets'), ('view_all_tickets'), ('manage_users'), ('manage_categories'), ('manage_roles'), ('delete_ticket'), ('assign_ticket'), ('finish_ticket'), ('create_ticket'), ('create_ticket_for_user')) AS p(key)
WHERE r.key = 'admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Lawyer: dashboard, tickets, view_all, assign, finish, create_ticket (não manage_*, não delete)
INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM app_c009c0e4f1_roles r
CROSS JOIN (VALUES ('dashboard'), ('tickets'), ('view_all_tickets'), ('assign_ticket'), ('finish_ticket'), ('create_ticket'), ('create_ticket_for_user')) AS p(key)
WHERE r.key = 'lawyer'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Support: mesmo que lawyer
INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM app_c009c0e4f1_roles r
CROSS JOIN (VALUES ('dashboard'), ('tickets'), ('view_all_tickets'), ('assign_ticket'), ('finish_ticket'), ('create_ticket'), ('create_ticket_for_user')) AS p(key)
WHERE r.key = 'support'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- User: tickets (próprios), create_ticket, finish_ticket (feedback)
INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM app_c009c0e4f1_roles r
CROSS JOIN (VALUES ('tickets'), ('create_ticket'), ('finish_ticket')) AS p(key)
WHERE r.key = 'user'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Trigger updated_at para roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_roles_updated_at_trigger ON app_c009c0e4f1_roles;
CREATE TRIGGER update_roles_updated_at_trigger
  BEFORE UPDATE ON app_c009c0e4f1_roles
  FOR EACH ROW
  EXECUTE PROCEDURE update_roles_updated_at();
