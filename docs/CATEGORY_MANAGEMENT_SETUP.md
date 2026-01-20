# Configuração de Gerenciamento de Categorias

## Visão Geral

Este documento descreve como configurar o sistema de gerenciamento de categorias e subcategorias no banco de dados do Supabase.

## Estrutura das Tabelas

### 1. Tabela `app_c009c0e4f1_categories`

Armazena as categorias principais do sistema.

```sql
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sla_hours INTEGER,
  default_assigned_to UUID REFERENCES app_c009c0e4f1_users(id),
  default_assigned_to_name TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_categories_key ON app_c009c0e4f1_categories(key);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON app_c009c0e4f1_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON app_c009c0e4f1_categories("order");
```

### 2. Tabela `app_c009c0e4f1_subcategories`

Armazena as subcategorias vinculadas às categorias.

```sql
CREATE TABLE IF NOT EXISTS app_c009c0e4f1_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES app_c009c0e4f1_categories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sla_hours INTEGER NOT NULL,
  default_assigned_to UUID REFERENCES app_c009c0e4f1_users(id),
  default_assigned_to_name TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON app_c009c0e4f1_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_key ON app_c009c0e4f1_subcategories(key);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active ON app_c009c0e4f1_subcategories(is_active);
CREATE INDEX IF NOT EXISTS idx_subcategories_order ON app_c009c0e4f1_subcategories("order");
```

## Migração dos Dados Existentes

Se você já tem categorias hardcoded no sistema, você pode migrar os dados usando o seguinte script:

```sql
-- Inserir categorias existentes
INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, is_active, "order") VALUES
  ('protocolo', 'Protocolo', NULL, true, 1),
  ('cadastro', 'Cadastro', NULL, true, 2),
  ('agendamento', 'Agendamento', NULL, true, 3),
  ('publicacoes', 'Publicações', NULL, true, 4),
  ('assinatura_digital', 'Assinatura Digital', NULL, true, 5),
  ('outros', 'Outros', 24, true, 6)
ON CONFLICT (key) DO NOTHING;

-- Inserir subcategorias existentes
INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT 
  c.id,
  subcat_data.key,
  subcat_data.label,
  subcat_data.sla_hours,
  true,
  subcat_data."order"
FROM app_c009c0e4f1_categories c,
LATERAL (
  VALUES
    -- Protocolo
    ('pedido_urgencia', 'Pedido de urgência', 2, 1),
    ('inconsistencia', 'Inconsistência', 2, 2),
    ('duvidas', 'Dúvidas', 2, 3),
    -- Cadastro
    ('senhas_outros_tribunais', 'Senhas Outros Tribunais', 1, 1),
    ('senha_tribunal_expirada', 'Senha Tribunal Expirada', 1, 2),
    ('duvidas', 'Dúvidas', 24, 3),
    ('atualizacao_cadastro', 'Atualização de Cadastro', 24, 4),
    ('correcao_cadastro', 'Correção de Cadastro', 24, 5),
    -- Agendamento
    ('duvidas', 'Dúvidas', 4, 1),
    -- Publicações
    ('problemas_central_publi', 'Problemas na central de publi', 1, 1),
    ('duvidas', 'Dúvidas', 2, 2),
    -- Assinatura Digital
    ('pedido_urgencia', 'Pedido de urgência', 3, 1),
    ('duvidas', 'Dúvidas', 3, 2),
    -- Outros
    ('outros', 'Outros', 24, 1)
) AS subcat_data(key, label, sla_hours, "order")
WHERE c.key = CASE 
  WHEN subcat_data.key IN ('pedido_urgencia', 'inconsistencia') AND subcat_data.sla_hours = 2 THEN 'protocolo'
  WHEN subcat_data.key IN ('senhas_outros_tribunais', 'senha_tribunal_expirada', 'atualizacao_cadastro', 'correcao_cadastro') THEN 'cadastro'
  WHEN subcat_data.key = 'problemas_central_publi' THEN 'publicacoes'
  WHEN subcat_data.sla_hours = 3 THEN 'assinatura_digital'
  WHEN subcat_data.sla_hours = 4 AND c.key = 'agendamento' THEN 'agendamento'
  WHEN subcat_data.key = 'outros' THEN 'outros'
  ELSE NULL
END
ON CONFLICT (category_id, key) DO NOTHING;
```

## Permissões RLS (Row Level Security)

```sql
-- Permitir que admins vejam e gerenciem todas as categorias
ALTER TABLE app_c009c0e4f1_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_c009c0e4f1_subcategories ENABLE ROW LEVEL SECURITY;

-- Política para categorias: admins podem tudo
CREATE POLICY "Admins podem gerenciar categorias"
  ON app_c009c0e4f1_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_c009c0e4f1_users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  );

-- Política para subcategorias: admins podem tudo
CREATE POLICY "Admins podem gerenciar subcategorias"
  ON app_c009c0e4f1_subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_c009c0e4f1_users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  );

-- Todos podem ler categorias ativas
CREATE POLICY "Todos podem ler categorias ativas"
  ON app_c009c0e4f1_categories
  FOR SELECT
  USING (is_active = true);

-- Todos podem ler subcategorias ativas
CREATE POLICY "Todos podem ler subcategorias ativas"
  ON app_c009c0e4f1_subcategories
  FOR SELECT
  USING (is_active = true);
```

## Funcionalidades

### Criar Categoria

1. Acesse `/categories` (apenas admins)
2. Clique em "Nova Categoria"
3. Preencha:
   - **Chave**: Identificador único (ex: `protocolo`)
   - **Nome**: Nome exibido (ex: `Protocolo`)
   - **SLA Padrão**: SLA em horas (opcional)
   - **Atribuição Automática**: Usuário que receberá tickets desta categoria automaticamente

### Criar Subcategoria

1. Expanda a categoria desejada
2. Clique em "Adicionar Subcategoria"
3. Preencha:
   - **Chave**: Identificador único (ex: `pedido_urgencia`)
   - **Nome**: Nome exibido (ex: `Pedido de urgência`)
   - **SLA**: SLA em horas (obrigatório)
   - **Atribuição Automática**: Usuário que receberá tickets desta subcategoria (opcional, usa da categoria se não especificado)

### Editar/Excluir

- Clique nos botões de editar para modificar categoria/subcategoria
- Clique em desativar para ocultar sem excluir
- Clique em excluir para remover permanentemente (apenas se não houver tickets usando)

## Atribuição Automática

O sistema de atribuição automática funciona em cascata:

1. **Prioridade 1**: Atribuição definida na subcategoria
2. **Prioridade 2**: Atribuição definida na categoria
3. **Prioridade 3**: Atribuição manual ou algoritmo padrão

## Integração com Criação de Tickets

Ao criar um ticket, o sistema:
1. Verifica se a subcategoria tem atribuição automática
2. Se não, verifica se a categoria tem atribuição automática
3. Se não, usa o algoritmo padrão (próximo advogado disponível)

## Notas Importantes

- A chave (`key`) não pode ser alterada após a criação
- Categorias/subcategorias com tickets em uso não podem ser excluídas (apenas desativadas)
- A ordem (`order`) controla a exibição na interface
- SLAs são definidos em horas
