# Feature: Preferência de Visualização de Tickets

## Data: 2026

## Resumo
Implementação de funcionalidade que permite aos usuários definir e persistir sua preferência de visualização de tickets (Lista, Quadro/Kanban, ou Por Usuário) no banco de dados. A preferência é carregada automaticamente ao acessar a página de tickets.

## Alterações Realizadas

### 1. Banco de Dados
- **Coluna adicionada**: `ticket_view_preference` na tabela `app_c009c0e4f1_users`
  - Tipo: `TEXT`
  - Valores possíveis: `'list'`, `'board'`, `'users'`
  - Valor padrão: `'list'`

**SQL necessário:**
```sql
ALTER TABLE app_c009c0e4f1_users 
ADD COLUMN ticket_view_preference TEXT DEFAULT 'list';
```

### 2. Tipos TypeScript
**Arquivo**: `src/types/index.ts`
- Adicionado campo `ticketViewPreference?: 'list' | 'board' | 'users'` na interface `User`

### 3. Serviços
**Arquivo**: `src/services/userService.tsx`
- Método `updateTicketViewPreference()`: Salva a preferência no banco de dados
- Atualizado `mapFromDatabase()`: Inclui `ticket_view_preference` no mapeamento

### 4. Contexto de Autenticação
**Arquivo**: `src/contexts/AuthContext.tsx`
- Atualizado `loadUserProfile()`: Carrega `ticket_view_preference` do banco
- Atualizado `refreshUserProfile()`: Obtém `authUserId` da sessão atual (correção de bug)
- Corrigido validação de `authUserId` para evitar erros com valores `null` ou `"null"`
- Corrigido fluxo de login: Carrega perfil imediatamente após login bem-sucedido
- Melhorado listener de auth: Processa eventos corretamente

### 5. Página de Tickets
**Arquivo**: `src/pages/Tickets.tsx`
- Estado inicial carrega preferência do usuário: `user?.ticketViewPreference || 'list'`
- Função `setView()`: Salva automaticamente a preferência no banco ao mudar visualização
- `useEffect`: Carrega preferência quando usuário muda

### 6. Página de Perfil
**Arquivo**: `src/pages/Profile.tsx`
- Nova seção "Preferências de Visualização"
- Radio buttons para escolher entre:
  - **Lista**: Visualização em lista de cards (todos os usuários)
  - **Quadro (Kanban)**: Organização por status em colunas (todos os usuários)
  - **Por Usuário**: Organização por usuário atribuído (apenas admin, support, lawyer)
- Preferência é salva automaticamente no banco ao selecionar
- Feedback visual durante salvamento
- Atualização automática do contexto após salvar

### 7. Rotas
**Arquivo**: `src/App.tsx`
- Removido redirecionamento automático para `/dashboard` para admins
- Todos os usuários (incluindo admins) são redirecionados para `/tickets` após login

## Correções de Bugs

### Bug 1: Erro ao atualizar perfil
**Problema**: `refreshUserProfile` tentava usar `currentAuthUserId.current` que podia ser `null`, causando erro 400 no Supabase.

**Solução**: Função agora obtém `authUserId` diretamente da sessão atual do Supabase.

### Bug 2: Sistema travado em "Carregando" após login
**Problema**: Após login bem-sucedido, o perfil não era carregado, deixando o sistema em estado de loading infinito.

**Solução**: 
- Função `login()` agora chama `loadUserProfile()` imediatamente após autenticação
- Melhorado listener de auth para processar eventos corretamente

### Bug 3: Preferência não carregada corretamente
**Problema**: Preferência salva no banco não era aplicada ao abrir página de tickets.

**Solução**: 
- Corrigido SELECT no `AuthContext` para incluir `ticket_view_preference`
- Ajustado `useEffect` em `Tickets.tsx` para recarregar quando usuário muda

## Como Funciona

1. **Ao acessar perfil**: Preferência atual é carregada e exibida
2. **Ao selecionar opção**: Preferência é salva no banco e contexto é atualizado
3. **Ao abrir tickets**: Preferência salva é aplicada automaticamente
4. **Ao mudar visualização**: Preferência é atualizada automaticamente no banco

## Interface do Usuário

A seção de preferências inclui:
- Ícones visuais para cada tipo de visualização
- Descrições curtas explicando cada opção
- Feedback visual durante salvamento
- Design consistente com o resto do sistema Responsum

## Compatibilidade

- ✅ Funciona mesmo se a coluna não existir no banco (usa 'list' como padrão)
- ✅ Tratamento de erros robusto
- ✅ Fallback para 'list' se preferência for inválida
- ✅ Compatível com todas as roles (user, support, admin, lawyer)

## Testes Recomendados

1. ✅ Login como diferentes tipos de usuários
2. ✅ Alterar preferência no perfil
3. ✅ Verificar se preferência é aplicada na página de tickets
4. ✅ Verificar persistência após refresh da página
5. ✅ Testar mudança de visualização pelos botões no header de tickets

## Arquivos Modificados

- `src/types/index.ts`
- `src/services/userService.tsx`
- `src/contexts/AuthContext.tsx`
- `src/pages/Tickets.tsx`
- `src/pages/Profile.tsx`
- `src/App.tsx`
