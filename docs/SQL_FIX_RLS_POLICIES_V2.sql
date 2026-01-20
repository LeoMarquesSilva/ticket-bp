-- =====================================================
-- Correção Adicional das Políticas RLS para Ativar/Desativar
-- O problema: Ao desativar (is_active = false), a política de SELECT bloqueia
-- =====================================================

-- Adicionar política para permitir SELECT de TODAS as subcategorias (não apenas ativas)
-- Isso é necessário para que o UPDATE funcione quando mudamos is_active
CREATE POLICY IF NOT EXISTS "Permitir SELECT de todas subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR SELECT
  USING (true);

-- Similar para categorias
CREATE POLICY IF NOT EXISTS "Permitir SELECT de todas categorias"
  ON app_c009c0e4f1_categories
  FOR SELECT
  USING (true);

-- Nota: As políticas "Todos podem ler categorias ativas" continuam existindo
-- mas a política mais permissiva acima terá prioridade (ou podemos removê-las)

-- Opcional: Remover políticas de SELECT restritivas se quiser (descomente se necessário)
-- DROP POLICY IF EXISTS "Todos podem ler categorias ativas" ON app_c009c0e4f1_categories;
-- DROP POLICY IF EXISTS "Todos podem ler subcategorias ativas" ON app_c009c0e4f1_subcategories;

-- Verificar políticas existentes
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
ORDER BY tablename, policyname;
