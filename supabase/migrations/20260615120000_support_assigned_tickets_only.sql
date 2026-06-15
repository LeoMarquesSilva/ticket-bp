-- Suporte (Op. Legais): vê somente tickets atribuídos a si, não a frente inteira
DELETE FROM app_c009c0e4f1_role_permissions rp
USING app_c009c0e4f1_roles r
WHERE rp.role_id = r.id
  AND lower(r.key) IN ('support', 'suporte')
  AND rp.permission_key = 'view_frente_tickets';
