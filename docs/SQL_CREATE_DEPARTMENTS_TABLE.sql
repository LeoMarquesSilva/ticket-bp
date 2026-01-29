-- =====================================================
-- Tabela de Departamentos (catálogo)
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- IMPORTANTE: O departamento do usuário continua na coluna "department"
-- da tabela app_c009c0e4f1_users (TEXT), armazenando o NOME do departamento.
-- Esta tabela (departments) é apenas um CATÁLOGO de opções: o admin cria/edita
-- departamentos aqui; ao criar ou editar usuário, escolhe um e gravamos o
-- nome em users.department. Não há FK: users.department não é alterada.
--
-- Permite criar e gerenciar departamentos/áreas (ex.: Operações Legais,
-- Trabalhista, Cível). Usado em usuários e filtros.
-- Acesso à gestão: apenas admin (controlado no frontend).
-- =====================================================

CREATE TABLE IF NOT EXISTS app_c009c0e4f1_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON app_c009c0e4f1_departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_order ON app_c009c0e4f1_departments("order");
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON app_c009c0e4f1_departments(is_active);

ALTER TABLE app_c009c0e4f1_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir SELECT departments" ON app_c009c0e4f1_departments FOR SELECT USING (true);
CREATE POLICY "Permitir INSERT departments" ON app_c009c0e4f1_departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir UPDATE departments" ON app_c009c0e4f1_departments FOR UPDATE USING (true);
CREATE POLICY "Permitir DELETE departments" ON app_c009c0e4f1_departments FOR DELETE USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_departments_updated_at_trigger ON app_c009c0e4f1_departments;
CREATE TRIGGER update_departments_updated_at_trigger
  BEFORE UPDATE ON app_c009c0e4f1_departments
  FOR EACH ROW
  EXECUTE PROCEDURE update_departments_updated_at();

-- Seed com os valores atuais do enum (idempotente)
INSERT INTO app_c009c0e4f1_departments (name, "order") VALUES
  ('Geral', 0),
  ('Operações Legais', 1),
  ('Trabalhista', 2),
  ('Distressed Deals - Special Situations', 3),
  ('Tributário', 4),
  ('Cível', 5),
  ('Reestruturação', 6),
  ('Societário e Contratos', 7)
ON CONFLICT (name) DO NOTHING;
