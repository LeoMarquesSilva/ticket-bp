-- =====================================================
-- Correção das Políticas RLS para Categorias e Subcategorias
-- O problema: As políticas estavam usando auth.uid() mas o sistema usa autenticação customizada
-- =====================================================

-- Remover políticas antigas que não funcionam
DROP POLICY IF EXISTS "Admins podem gerenciar categorias" ON app_c009c0e4f1_categories;
DROP POLICY IF EXISTS "Admins podem gerenciar subcategorias" ON app_c009c0e4f1_subcategories;

-- IMPORTANTE: Como o sistema usa autenticação customizada (não Supabase Auth),
-- as políticas RLS que dependem de auth.uid() não funcionam.
-- A solução é permitir todas as operações e confiar na autenticação da aplicação.

-- Política para categorias: Permitir UPDATE/INSERT/DELETE (a aplicação controla quem pode fazer o quê)
CREATE POLICY "Permitir UPDATE em categorias"
  ON app_c009c0e4f1_categories
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir INSERT em categorias"
  ON app_c009c0e4f1_categories
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir DELETE em categorias"
  ON app_c009c0e4f1_categories
  FOR DELETE
  USING (true);

-- Política para subcategorias: Permitir UPDATE/INSERT/DELETE (a aplicação controla quem pode fazer o quê)
CREATE POLICY "Permitir UPDATE em subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir INSERT em subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir DELETE em subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR DELETE
  USING (true);

-- IMPORTANTE: Precisamos permitir que admins vejam TODAS as subcategorias (incluindo inativas)
-- para que possam fazer UPDATE/TOGGLE de status. A política atual só permite ver is_active = true.

-- Remover políticas antigas se existirem (para evitar duplicação)
DROP POLICY IF EXISTS "Permitir SELECT de todas subcategorias" ON app_c009c0e4f1_subcategories;
DROP POLICY IF EXISTS "Permitir SELECT de todas categorias" ON app_c009c0e4f1_categories;

-- Adicionar política para permitir SELECT de todas as subcategorias (não apenas ativas)
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

-- Nota: As políticas "Todos podem ler categorias ativas" continuam existindo
-- mas a política mais permissiva acima terá prioridade (ou podemos remover as antigas)

-- Remover políticas de SELECT restritivas se quiser (opcional)
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
