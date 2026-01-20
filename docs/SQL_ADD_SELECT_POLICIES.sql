-- =====================================================
-- Adicionar Políticas de SELECT Permissivas para Toggle
-- Este SQL adiciona políticas que permitem ver TODAS as subcategorias/categorias
-- (incluindo inativas), necessárias para o toggle funcionar
-- =====================================================

-- Remover políticas antigas se existirem (para evitar duplicação)
DROP POLICY IF EXISTS "Permitir SELECT de todas subcategorias" ON app_c009c0e4f1_subcategories;
DROP POLICY IF EXISTS "Permitir SELECT de todas categorias" ON app_c009c0e4f1_categories;

-- Adicionar política para permitir SELECT de TODAS as subcategorias (não apenas ativas)
-- Isso é necessário para que o UPDATE funcione quando mudamos is_active
CREATE POLICY "Permitir SELECT de todas subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR SELECT
  USING (true);

-- Similar para categorias
CREATE POLICY "Permitir SELECT de todas categorias"
  ON app_c009c0e4f1_categories
  FOR SELECT
  USING (true);

-- Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('app_c009c0e4f1_categories', 'app_c009c0e4f1_subcategories')
  AND policyname LIKE '%SELECT%'
ORDER BY tablename, policyname;
