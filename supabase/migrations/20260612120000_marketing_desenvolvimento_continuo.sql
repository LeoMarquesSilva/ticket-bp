-- Categoria especial: Desenvolvimento Contínuo da Equipe (Marketing)
-- Subcategorias: Treinamento, Workshop

INSERT INTO app_c009c0e4f1_categories (
  key,
  label,
  tag_id,
  is_active,
  "order",
  sla_hours,
  created_at,
  updated_at
)
SELECT
  'desenvolvimento_continuo_equipe',
  'Desenvolvimento Contínuo da Equipe',
  t.id,
  true,
  COALESCE((SELECT MAX(c."order") FROM app_c009c0e4f1_categories c WHERE c.tag_id = t.id), 0) + 1,
  48,
  now(),
  now()
FROM app_c009c0e4f1_tags t
WHERE t.key = 'marketing'
  AND NOT EXISTS (
    SELECT 1 FROM app_c009c0e4f1_categories WHERE key = 'desenvolvimento_continuo_equipe'
  );

INSERT INTO app_c009c0e4f1_subcategories (
  category_id,
  key,
  label,
  sla_hours,
  is_active,
  "order",
  created_at,
  updated_at
)
SELECT
  c.id,
  'treinamento',
  'Treinamento',
  48,
  true,
  1,
  now(),
  now()
FROM app_c009c0e4f1_categories c
WHERE c.key = 'desenvolvimento_continuo_equipe'
  AND NOT EXISTS (
    SELECT 1
    FROM app_c009c0e4f1_subcategories s
    WHERE s.category_id = c.id AND s.key = 'treinamento'
  );

INSERT INTO app_c009c0e4f1_subcategories (
  category_id,
  key,
  label,
  sla_hours,
  is_active,
  "order",
  created_at,
  updated_at
)
SELECT
  c.id,
  'workshop',
  'Workshop',
  48,
  true,
  2,
  now(),
  now()
FROM app_c009c0e4f1_categories c
WHERE c.key = 'desenvolvimento_continuo_equipe'
  AND NOT EXISTS (
    SELECT 1
    FROM app_c009c0e4f1_subcategories s
    WHERE s.category_id = c.id AND s.key = 'workshop'
  );
