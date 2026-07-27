-- Categoria: Plano de Saúde (Pessoas e Cultura)
-- Subcategoria: Inclusão

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
  'plano_saude',
  'Plano de Saúde',
  t.id,
  true,
  COALESCE((SELECT MAX(c."order") FROM app_c009c0e4f1_categories c WHERE c.tag_id = t.id), 0) + 1,
  48,
  now(),
  now()
FROM app_c009c0e4f1_tags t
WHERE t.key = 'recursos_humanos'
  AND NOT EXISTS (
    SELECT 1 FROM app_c009c0e4f1_categories WHERE key = 'plano_saude'
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
  'inclusao',
  'Inclusão',
  48,
  true,
  1,
  now(),
  now()
FROM app_c009c0e4f1_categories c
WHERE c.key = 'plano_saude'
  AND NOT EXISTS (
    SELECT 1
    FROM app_c009c0e4f1_subcategories s
    WHERE s.category_id = c.id AND s.key = 'inclusao'
  );
