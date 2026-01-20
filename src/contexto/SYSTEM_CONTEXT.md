# Contexto do Sistema - Help Desk

## Visão Geral
Sistema de Help Desk desenvolvido em React/TypeScript com Supabase, focado em atendimento jurídico e suporte técnico. O sistema oferece gestão completa de tickets, chat em tempo real, dashboard analítico e sistema de feedback obrigatório.

## Arquitetura Técnica

### Frontend
- **Framework**: React 18 com TypeScript
- **Roteamento**: React Router DOM
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Gerenciamento de Estado**: Context API + Hooks
- **Build Tool**: Vite
- **Notificações**: Sonner (toast notifications)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Storage**: Supabase Storage (para anexos)
- **Real-time**: Supabase Realtime (para chat e atualizações)

### Estrutura de Pastas
src/ ├── components/ # Componentes reutilizáveis │ ├── ui/ # Componentes base (shadcn/ui) │ ├── PendingFeedbackHandler.tsx # Aviso de feedback pendente │ ├── NPSChatFeedback.tsx # Modal de feedback NPS │ ├── TicketChatPanel.tsx # Painel de chat dos tickets │ └── ... # Outros componentes ├── pages/ # Páginas da aplicação ├── services/ # Serviços e APIs │ ├── ticketService.ts # Serviço principal de tickets │ └── ticketEventService.ts # Eventos de feedback ├── contexts/ # Context providers ├── hooks/ # Custom hooks ├── lib/ # Utilitários e configurações └── types/ # Definições de tipos TypeScript



## Funcionalidades Principais

### 1. Sistema de Autenticação
- **Roles**: user, support, admin, lawyer
- **Permissões**: Controle granular por role
- **Sessão**: Gerenciamento automático via Supabase Auth
- **Status de Usuário**: Campo `is_active` para ativar/desativar usuários sem excluir dados históricos
- **Bloqueio de Login**: Usuários inativos não conseguem fazer login no sistema
- **Preservação de Dados**: Desativar usuários preserva histórico de tickets, métricas e relacionamentos

### 2. Gestão de Tickets
- **Status**: open, in_progress, resolved *(removido "closed")*
- **Prioridades**: low, medium, high, urgent
- **Categorias**: Protocolo, Cadastro, Agendamento, Publicacoes, Assinatura Digital, Outros
- **Subcategorias**: Específicas por categoria com SLA definido
- **Atribuição**: Manual ou automática para suporte/advogados
- **Anexos**: Upload de arquivos via Supabase Storage
- **Histórico**: Log completo de alterações

### 3. Sistema de Chat em Tempo Real
- **Real-time**: Mensagens instantâneas via Supabase Realtime
- **Anexos**: Suporte a imagens e documentos
- **Participantes**: Usuário criador + atendentes atribuídos
- **Status**: Indicadores de mensagem lida/não lida
- **Typing Indicators**: Mostra quando usuários estão digitando
- **Presença**: Status online/offline dos atendentes

### 4. Sistema de Feedback Obrigatório
- **Aviso Compacto**: Barra horizontal no topo para tickets pendentes de avaliação
- **Bloqueio**: Usuários não podem criar novos tickets sem avaliar os resolvidos
- **Modal Integrado**: Feedback acessível diretamente no chat do ticket
- **Componentes**:
  - `PendingFeedbackHandler`: Aviso compacto de feedback pendente
  - `NPSChatFeedback`: Modal de avaliação integrado ao chat
- **Métricas Coletadas**:
  - **Request Fulfilled**: Se a solicitação foi atendida (Sim/Não)
  - **Service Score**: Avaliação da qualidade do atendimento (1-10)
  - **Comment**: Feedback textual - **OBRIGATÓRIO apenas para notas 1-6, OPCIONAL para notas 7-10**
  - **Timestamp**: Data/hora da submissão

### 5. Dashboard Analítico
- **Métricas Gerais**: Total de tickets, distribuição por status
- **Performance**: Tempo médio de resolução, taxa de resolução
- **Satisfação**: Avaliação de serviço, cumprimento de solicitações
- **Gráficos**: Tickets ao longo do tempo, distribuição por categoria
- **Filtros**: Por período, usuário, categoria

### 6. Sistema de SLA
- **Definição por Categoria/Subcategoria**:
  - Protocolo: 2h (pedido urgência, inconsistência, dúvidas)
  - Cadastro: 1h (senhas), 24h (atualizações)
  - Agendamento: 4h (dúvidas)
  - Publicações: 1h (problemas), 2h (dúvidas)
  - Assinatura Digital: 3h
  - Outros: 24h
- **Monitoramento**: Alertas visuais para tickets próximos ao vencimento
- **Relatórios**: Métricas de cumprimento de SLA

## Estrutura do Banco de Dados

### Tabelas Principais

#### app_c009c0e4f1_users
```sql
- id: uuid (PK)
- email: text
- name: text
- role: text (user|support|admin|lawyer)
- department: text
- is_active: boolean (default: true) -- Novo campo para ativar/desativar usuários
- is_online: boolean
- last_active_at: timestamp
- first_login: boolean
- must_change_password: boolean
- password_changed_at: timestamp
- ticket_view_preference: text (list|board|users)
- created_at: timestamp
- updated_at: timestamp

app_c009c0e4f1_tickets

- id: uuid (PK)
- title: text
- description: text
- status: text (open|in_progress|resolved) -- Removido 'closed'
- priority: text (low|medium|high|urgent)
- category: text
- subcategory: text
- created_by: uuid (FK users)
- created_by_name: text
- assigned_to: uuid (FK users)
- assigned_to_name: text
- created_at: timestamp
- updated_at: timestamp
- resolved_at: timestamp
- first_response_at: timestamp
- attachments: jsonb
- -- Campos de Feedback
- service_score: integer (1-10)
- request_fulfilled: boolean
- not_fulfilled_reason: text
- comment: text -- Opcional para notas 7-10, obrigatório para 1-6
- feedback_submitted_at: timestamp

app_c009c0e4f1_chat_messages

- id: uuid (PK)
- ticket_id: uuid (FK tickets)
- user_id: uuid (FK users)
- user_name: text
- message: text
- attachments: jsonb
- created_at: timestamp
- read: boolean

app_c009c0e4f1_ticket_history
- id: uuid (PK)
- ticket_id: uuid (FK tickets)
- action: text
- old_value: text
- new_value: text
- changed_by: uuid (FK users)
- changed_by_name: text
- created_at: timestamp

Fluxo de Trabalho
1. Criação de Ticket
Usuário preenche formulário (título, descrição, categoria, prioridade)
Validação: Sistema verifica se há tickets resolvidos sem feedback
Bloqueio: Se houver feedback pendente, exibe aviso e impede criação
Sistema atribui automaticamente ou permite seleção manual
Ticket criado com status 'open'
Notificação enviada ao atendente (se atribuído)
2. Atendimento
Atendente visualiza ticket na lista
Pode alterar status para 'in_progress'
Comunicação via chat em tempo real
Upload de anexos quando necessário
Resolução com status 'resolved'
3. Feedback Obrigatório
Após resolução, usuário vê aviso compacto no topo da tela
PendingFeedbackHandler mostra quantidade de tickets pendentes
Botão "Avaliar Agora" abre diretamente o primeiro ticket
No chat do ticket, botão flutuante "Avaliar atendimento"
Modal NPSChatFeedback coleta:
Solicitação atendida? (Sim/Não + motivo se não)
Qualidade do atendimento (1-10 estrelas)
Comentário - REGRA NOVA: Obrigatório apenas para notas 1-6, opcional para 7-10
Após submissão, ticket sai da lista de pendentes
Usuário pode criar novos tickets apenas após avaliar todos
4. Finalização
Ticket permanece com status 'resolved' após feedback
Dados integrados ao dashboard para análise
Histórico completo mantido para auditoria
Configurações de SLA
Mapeamento Categoria → Subcategoria → SLA
const CATEGORIES_CONFIG = {
  'protocolo': {
    'pedido_urgencia': '2h',
    'inconsistencia': '2h',
    'duvidas': '2h'
  },
  'cadastro': {
    'senhas_outros_tribunais': '1h',
    'senha_tribunal_expirada': '1h',
    'duvidas': '24h',
    'atualizacao_cadastro': '24h',
    'correcao_cadastro': '24h'
  },
  'agendamento': {
    'duvidas': '4h'
  },
  'publicacoes': {
    'problemas_central_publi': '1h',
    'duvidas': '2h'
  },
  'assinatura_digital': {
    'pedido_urgencia': '3h',
    'duvidas': '3h'
  },
  'outros': {
    'outros': '24h'
  }
}
Métricas e KPIs
Performance
Tempo Médio de Resolução: Média em dias para resolver tickets
Taxa de Resolução: % de tickets resolvidos vs total
Primeiro Tempo de Resposta: Tempo até primeira resposta do atendente
Cumprimento de SLA: % de tickets resolvidos dentro do prazo
Satisfação
Qualidade do Serviço: Média das avaliações 1-10
Taxa de Atendimento: % de solicitações efetivamente atendidas
Taxa de Feedback: % de tickets resolvidos com feedback submetido
Motivos de Não Atendimento: Análise dos motivos mais frequentes
Operacionais
Volume de Tickets: Total por período
Distribuição por Status: Abertos, em progresso, resolvidos
Distribuição por Categoria: Análise dos tipos de solicitação
Carga de Trabalho: Tickets por atendente
Componentes de Feedback
PendingFeedbackHandler
// Aviso compacto no topo da tela
interface PendingFeedbackHandlerProps {
  tickets: Ticket[];
  onFeedbackSubmitted: () => void;
  onOpenTicket?: (ticket: Ticket) => void;
}
Design: Barra horizontal compacta (~60px altura)
Funcionalidade: Mostra quantidade de tickets pendentes
Ação: Botão "Avaliar Agora" abre primeiro ticket da lista
Visibilidade: Apenas para usuários com role 'user'
NPSChatFeedback
// Modal de feedback integrado ao chat
interface NPSChatFeedbackProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: TicketFeedbackData) => void;
  ticket: Ticket;
}
Design: Modal centralizado com formulário estruturado
Campos: Atendimento (Sim/Não), Qualidade (1-10), Comentário (condicional)
Validação: Comentário obrigatório apenas para notas 1-6
Integração: Acessível via botão flutuante no chat
Integrações
Supabase Services
Database: PostgreSQL para persistência
Auth: Autenticação e autorização
Storage: Armazenamento de anexos
Realtime: Chat em tempo real + eventos de feedback
Real-time Events
Mensagens: Notificação instantânea de novas mensagens
Feedback: Atualização automática quando feedback é submetido
Presença: Status online/offline dos usuários
Typing: Indicadores de digitação
Segurança
Autenticação
JWT tokens via Supabase Auth
Refresh tokens automáticos
Logout em múltiplas abas
Autorização
Row Level Security (RLS) no Supabase
Políticas por role:
Users: Apenas seus próprios tickets
Support/Lawyers: Tickets atribuídos + não atribuídos
Admins: Todos os tickets + configurações
Dados Sensíveis
Anexos com acesso controlado
Logs de auditoria para alterações
Criptografia em trânsito e repouso
Deployment
Ambiente de Desenvolvimento
Frontend: Vite dev server (localhost:5173)
Backend: Supabase local ou cloud
Hot reload: Automático via Vite
Ambiente de Produção
Frontend: Build estático via Vite
Hosting: Vercel, Netlify ou similar
Backend: Supabase Cloud
CDN: Para assets estáticos
Monitoramento
Métricas Técnicas
Performance: Core Web Vitals
Erros: Error boundaries + logging

Uptime: Monitoramento de disponibilidade Database: Query performance no Supabase Métricas de Negócio Satisfação do Cliente: Tracking de avaliações Eficiência Operacional: SLA compliance Volume de Atendimento: Tickets por período Qualidade: Feedback scores e comentários Mudanças Recentes Remoção do Status "Closed" Antes: open → in_progress → resolved → closed Agora: open → in_progress → resolved Motivo: Simplificação do fluxo, feedback obrigatório antes do fechamento Impacto: Tickets permanecem "resolved" após feedback Sistema de Feedback Obrigatório Implementação: PendingFeedbackHandler + NPSChatFeedback Bloqueio: Usuários não podem criar tickets sem avaliar resolvidos UX: Aviso compacto + acesso direto ao primeiro ticket pendente Dados: Coleta estruturada de satisfação e motivos NOVA REGRA - Comentário Condicional (Dezembro 2024)

Notas 1-6: Comentário OBRIGATÓRIO (para entender problemas)
Notas 7-10: Comentário OPCIONAL (satisfação alta)
Validação: isCommentRequired() = serviceScore < 7
UX: Indicadores visuais claros sobre obrigatoriedade
Componentes Atualizados: NPSChatFeedback + NPSModal Melhorias de UI/UX Chat Responsivo: Otimização do espaço quando feedback está pendente Aviso Compacto: Redução de ~300px para ~60px de altura Navegação Direta: Botão leva direto ao ticket para avaliação Feedback Integrado: Modal acessível diretamente no chat Comentário Inteligente: Obrigatório apenas quando necessário (notas baixas) Roadmap Futuro Funcionalidades Planejadas Notificações Push: Alertas em tempo real Mobile App: Versão nativa para iOS/Android Automação: Chatbots para triagem inicial Relatórios Avançados: Exportação PDF/Excel API Pública: Integrações com terceiros Multi-tenancy: Suporte a múltiplas organizações Melhorias Técnicas Cache: Redis para performance Queue System: Processamento assíncrono Microservices: Separação de responsabilidades GraphQL: API mais flexível Testing: Cobertura de testes automatizados CI/CD: Pipeline de deployment automatizado
Regras de Negócio - Feedback
Validação de Comentário por Nota
// Função implementada nos componentes NPSChatFeedback e NPSModal
const isCommentRequired = () => {
  return serviceScore !== null && serviceScore < 7;
};

// Lógica de validação no submit
const handleSubmit = () => {
  if (isCommentRequired() && !comment.trim()) {
    setErrors(prev => ({ ...prev, comment: true }));
    return;
  }
  // ... resto da lógica
};
Indicadores Visuais
Título do Campo: Muda dinamicamente entre "Deixe seu comentário" e "Deixe seu comentário (opcional)"
Placeholder: Texto específico para cada caso
Aviso Verde: Para notas 7-10, mostra "Como sua avaliação foi boa (7-10), o comentário é opcional!"
Resumo: Mostra "Obrigatório" ou "Opcional" no resumo da avaliação
Botão Submit: Desabilitado apenas se comentário obrigatório estiver vazio
Benefícios da Implementação
Redução de Friction: Usuários satisfeitos (7-10) podem finalizar mais rapidamente
Foco em Melhorias: Comentários obrigatórios apenas quando há problemas (1-6)
Dados Qualitativos: Mantém qualidade dos feedbacks para análise
UX Melhorada: Interface mais inteligente e responsiva às avaliações
✅ Implementação Concluída:
Mudanças Realizadas:
NPSChatFeedback.tsx

✅ Adicionada função isCommentRequired()
✅ Validação condicional no handleSubmit()
✅ Títulos e placeholders dinâmicos
✅ Aviso visual para notas altas
✅ Resumo com status de obrigatoriedade
✅ Botão desabilitado condicionalmente
NPSModal.tsx

✅ Mesma lógica implementada
✅ Consistência entre componentes
✅ Validação condicional
✅ Indicadores visuais
SYSTEM_CONTEXT.md

✅ Documentação atualizada
✅ Nova regra de negócio documentada
✅ Benefícios explicados
✅ Código de exemplo incluído
Regra Implementada:
"Quando o chamado é avaliado com nota 7 até 10, o campo de observações não é obrigatório"

Notas 1-6: Comentário obrigatório
Notas 7-10: Comentário opcional
UX: Indicadores visuais claros
Validação: Condicional baseada na nota

## Gerenciamento de Usuários

### Sistema de Ativar/Desativar Usuários (Janeiro 2025)

**Funcionalidade**: Permite desativar usuários sem excluir dados históricos, preservando métricas e relacionamentos.

**Implementação**:
- **Campo `is_active`**: Novo campo booleano na tabela `users` (padrão: `true`)
- **Método `toggleUserActiveStatus()`**: No `UserService` para alternar status
- **Filtros Automáticos**: Usuários inativos não aparecem nas listagens de suporte/advogados
- **Bloqueio de Login**: `AuthContext` verifica `is_active` e bloqueia login de usuários inativos
- **Preservação de Dados**: Todos os dados históricos (tickets, mensagens, métricas) são mantidos

**Interface de Gerenciamento**:
- **Modal de Confirmação**: Dialog customizado seguindo identidade visual do sistema
- **Ícones Visuais**: `UserX` (laranja) para desativar, `UserCheck` (verde) para ativar
- **Informações Detalhadas**: Explica o que acontece ao ativar/desativar
- **Lista de Consequências**: Card informativo com bullets explicando impactos

**Filtros Avançados na Tabela de Usuários**:
- **Busca**: Por nome ou email (tempo real)
- **Departamento**: Filtro por todos os departamentos disponíveis
- **Função (Role)**: Filtro por user, support, lawyer, admin
- **Status**: Filtro por ativo/inativo
- **Status Online**: Filtro por online/offline
- **Combináveis**: Todos os filtros podem ser usados simultaneamente
- **Contador**: Mostra quantidade de resultados filtrados
- **Limpar Filtros**: Botão para resetar todos os filtros de uma vez

**Componentes**:
- `UserManagement.tsx`: Página principal com tabela e filtros
- `AlertDialog`: Modal de confirmação customizado
- `UserService.toggleUserActiveStatus()`: Método de serviço para alterar status

**Migração do Banco de Dados**:
```sql
ALTER TABLE app_c009c0e4f1_users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE app_c009c0e4f1_users 
SET is_active = true 
WHERE is_active IS NULL;
```

**Benefícios**:
- ✅ Preservação de dados históricos e métricas
- ✅ Usuários podem ser reativados a qualquer momento
- ✅ Não afeta relatórios e análises do dashboard
- ✅ Interface intuitiva e profissional
- ✅ Filtros poderosos para gerenciamento eficiente