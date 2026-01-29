-- =====================================================
-- Adicionar permissão "Criar ticket em nome de usuário"
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Nova permissão: create_ticket_for_user (suporte cria ticket para o usuário).
-- create_ticket = usuário cria seu próprio ticket.
-- Execute este script se já rodou SQL_CREATE_ROLES_AND_PERMISSIONS antes.
-- =====================================================

INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, 'create_ticket_for_user' FROM app_c009c0e4f1_roles r
WHERE r.key IN ('admin', 'lawyer', 'support')
ON CONFLICT (role_id, permission_key) DO NOTHING;
