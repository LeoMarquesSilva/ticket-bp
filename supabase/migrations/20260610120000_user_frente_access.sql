-- Frente de atuação por usuário (suporte/advogado veem só tickets da sua frente)
ALTER TABLE app_c009c0e4f1_users
ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES app_c009c0e4f1_tags(id) ON DELETE SET NULL;

-- Preencher a partir de categorias onde o usuário é responsável padrão
UPDATE app_c009c0e4f1_users u
SET tag_id = sub.tag_id
FROM (
  SELECT DISTINCT ON (c.default_assigned_to)
    c.default_assigned_to AS user_id,
    c.tag_id
  FROM app_c009c0e4f1_categories c
  WHERE c.default_assigned_to IS NOT NULL
    AND c.tag_id IS NOT NULL
  ORDER BY c.default_assigned_to, c."order"
) sub
WHERE u.id = sub.user_id
  AND u.tag_id IS NULL;

-- Advogados e suporte operacional → Controladoria Jurídica
UPDATE app_c009c0e4f1_users u
SET tag_id = t.id
FROM app_c009c0e4f1_tags t
WHERE u.tag_id IS NULL
  AND lower(u.role) IN ('lawyer', 'advogado', 'support', 'suporte')
  AND t.key = 'juridico';

-- T.I → frente de tecnologia
UPDATE app_c009c0e4f1_users u
SET tag_id = t.id
FROM app_c009c0e4f1_tags t
WHERE u.tag_id IS NULL
  AND lower(u.role) = 'ti'
  AND t.key = 'tecnologia_informacao';

-- Permissão: ver tickets da frente de atuação (sem ver todas as frentes)
INSERT INTO app_c009c0e4f1_role_permissions (role_id, permission_key)
SELECT r.id, 'view_frente_tickets'
FROM app_c009c0e4f1_roles r
WHERE lower(r.key) IN ('lawyer', 'support', 'ti', 'suporte_administrativo')
  AND NOT EXISTS (
    SELECT 1
    FROM app_c009c0e4f1_role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_key = 'view_frente_tickets'
  );
