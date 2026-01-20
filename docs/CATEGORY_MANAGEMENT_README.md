# Gerenciamento de Categorias e Subcategorias

## Visão Geral

Sistema completo de gerenciamento de categorias e subcategorias para administradores, permitindo criar, editar e configurar SLAs e atribuições automáticas para tickets.

## Funcionalidades Implementadas

### 1. **Criação de Categorias**
- Criar novas categorias com chave única
- Definir SLA padrão para a categoria
- Configurar atribuição automática por categoria
- Definir ordem de exibição

### 2. **Criação de Subcategorias**
- Criar subcategorias vinculadas a categorias
- Definir SLA específico por subcategoria
- Configurar atribuição automática por subcategoria
- Definir ordem de exibição dentro da categoria

### 3. **Atribuição Automática**
- Sistema em cascata:
  1. **Prioridade 1**: Atribuição definida na subcategoria
  2. **Prioridade 2**: Atribuição definida na categoria
  3. **Prioridade 3**: Algoritmo padrão (próximo advogado disponível)

### 4. **Gerenciamento**
- Editar categorias e subcategorias
- Ativar/Desativar (preserva histórico)
- Excluir (apenas se não houver tickets usando)
- Visualização organizada por Accordion

## Estrutura do Banco de Dados

### Tabelas

1. **app_c009c0e4f1_categories**
   - `id` (UUID, PK)
   - `key` (TEXT, UNIQUE) - Chave única (ex: 'protocolo')
   - `label` (TEXT) - Nome exibido (ex: 'Protocolo')
   - `sla_hours` (INTEGER, NULL) - SLA padrão em horas
   - `default_assigned_to` (UUID, FK users) - Usuário padrão
   - `default_assigned_to_name` (TEXT) - Nome do usuário (cache)
   - `is_active` (BOOLEAN) - Status ativo/inativo
   - `order` (INTEGER) - Ordem de exibição
   - `created_at`, `updated_at` (TIMESTAMP)

2. **app_c009c0e4f1_subcategories**
   - `id` (UUID, PK)
   - `category_id` (UUID, FK categories) - Categoria pai
   - `key` (TEXT) - Chave única dentro da categoria
   - `label` (TEXT) - Nome exibido
   - `sla_hours` (INTEGER) - SLA em horas (obrigatório)
   - `default_assigned_to` (UUID, FK users) - Usuário padrão
   - `default_assigned_to_name` (TEXT) - Nome do usuário (cache)
   - `is_active` (BOOLEAN) - Status ativo/inativo
   - `order` (INTEGER) - Ordem de exibição
   - `created_at`, `updated_at` (TIMESTAMP)
   - UNIQUE(category_id, key)

## Como Usar

### 1. Configurar Banco de Dados

Execute o script SQL em `docs/SQL_CREATE_CATEGORIES_TABLES.sql` no Supabase.

### 2. Acessar a Página de Gerenciamento

1. Faça login como administrador
2. Acesse o menu lateral
3. Clique em "Gerenciar Categorias"
4. Ou acesse diretamente: `/categories`

### 3. Criar uma Categoria

1. Clique em "Nova Categoria"
2. Preencha:
   - **Chave**: Identificador único (ex: `protocolo`)
   - **Nome**: Nome exibido (ex: `Protocolo`)
   - **SLA Padrão**: SLA em horas (opcional)
   - **Atribuição Automática**: Escolha um usuário da equipe (opcional)
3. Clique em "Criar Categoria"

### 4. Criar uma Subcategoria

1. Expanda a categoria desejada
2. Clique em "Adicionar Subcategoria"
3. Preencha:
   - **Chave**: Identificador único (ex: `pedido_urgencia`)
   - **Nome**: Nome exibido (ex: `Pedido de urgência`)
   - **SLA**: SLA em horas (obrigatório)
   - **Atribuição Automática**: Escolha um usuário da equipe (opcional)
4. Clique em "Criar Subcategoria"

### 5. Editar/Excluir

- **Editar**: Clique no botão de editar (ícone de lápis)
- **Ativar/Desativar**: Clique no botão de status
- **Excluir**: Clique no botão de excluir (ícone de lixeira)

**Nota**: Categorias/subcategorias com tickets em uso não podem ser excluídas permanentemente, apenas desativadas.

## Integração com Sistema de Tickets

### Atribuição Automática

Ao criar um ticket, o sistema:

1. Verifica se a subcategoria tem atribuição automática definida
2. Se não, verifica se a categoria tem atribuição automática definida
3. Se não, usa o algoritmo padrão (próximo advogado disponível)

### Exemplo

```
Categoria: Protocolo
  └─ Subcategoria: Pedido de urgência
      ├─ SLA: 2 horas
      └─ Atribuição: João Silva (Advogado)

Quando um ticket é criado com:
  - Categoria: Protocolo
  - Subcategoria: Pedido de urgência

Resultado:
  - Ticket atribuído automaticamente para: João Silva
  - SLA definido: 2 horas
```

## Arquivos Criados

1. **src/services/categoryService.ts** - Serviço completo de gerenciamento
2. **src/pages/CategoryManagement.tsx** - Página de interface
3. **docs/SQL_CREATE_CATEGORIES_TABLES.sql** - Script SQL para criação das tabelas
4. **docs/CATEGORY_MANAGEMENT_SETUP.md** - Documentação completa
5. **docs/CATEGORY_MANAGEMENT_README.md** - Este arquivo

## Compatibilidade

O sistema mantém compatibilidade com o `CATEGORIES_CONFIG` hardcoded:
- Se as tabelas não existirem, usa o fallback hardcoded
- Se as tabelas existirem mas não tiverem dados, usa o fallback hardcoded
- Você pode migrar gradualmente as categorias para o banco

## Próximos Passos

1. Execute o script SQL no Supabase
2. (Opcional) Migre as categorias existentes usando o script de migração
3. Teste criando uma nova categoria/subcategoria
4. Configure atribuições automáticas conforme necessário
