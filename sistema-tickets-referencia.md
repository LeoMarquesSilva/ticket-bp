# Sistema de Tickets Bismarchi Pires - Documentação de Referência

## Visão Geral do Sistema

O sistema de tickets da Bismarchi Pires é uma aplicação web para gerenciamento de solicitações jurídicas internas. Ele permite que usuários de diferentes departamentos criem tickets que são atendidos por advogados e equipe de suporte operacional.

## Arquitetura

- **Frontend**: React com TypeScript
- **Backend**: Supabase (PostgreSQL)
- **UI**: Componentes personalizados com TailwindCSS
- **Autenticação**: Gerenciada pelo Supabase Auth

## Papéis de Usuário

1. **User (Jurídico)**: Usuários regulares que podem criar tickets e interagir com o suporte
2. **Lawyer (Advogado)**: Podem ser atribuídos a tickets e resolvê-los
3. **Support (Op. Legais)**: Equipe de suporte que gerencia tickets
4. **Admin (Gestor Op. Legais)**: Acesso completo ao sistema, incluindo gerenciamento de usuários e dashboard

## Ciclo de Vida do Ticket

1. **Criação**: Usuário cria um ticket com título, descrição, categoria e subcategoria
2. **Atribuição**: O ticket é automaticamente atribuído a um advogado disponível ou permanece aberto
3. **Em Progresso**: O advogado/suporte trabalha no ticket e o marca como "em progresso"
4. **Resolução**: Quando resolvido, o ticket é marcado como "resolvido"
5. **Feedback**: O usuário fornece feedback sobre a resolução (avaliação de serviço)
6. **Fechamento**: O ticket é fechado

## Status dos Tickets

- `open`: Ticket aberto, ainda não atribuído
- `assigned`: Ticket atribuído a um advogado/suporte
- `in_progress`: Ticket em andamento
- `resolved`: Ticket resolvido, aguardando feedback
- `closed`: Ticket fechado após feedback

## Estrutura de Dados

### Ticket

```typescript
interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  subcategory: string;
  status: string;
  createdBy: string;
  createdByName: string;
  createdByDepartment: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  npsScore: number | null;
  npsFeedback: string | null;
  npsSubmittedAt: string | null;
  requestFulfilled: boolean | null;
  notFulfilledReason: string | null;
  serviceScore: number | null;
  comment: string | null;
  feedbackSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  attachments: any[];
  createdAt: string;
  read: boolean;
  isTemp?: boolean;
}
```

### TicketFeedbackData

```typescript
interface TicketFeedbackData {
  requestFulfilled: boolean;
  notFulfilledReason?: string;
  serviceScore: number;
  comment?: string;
}
```

## Principais Serviços

### TicketService

Gerencia todas as operações relacionadas a tickets:

#### Métodos Principais:

- `getTickets(userId, userRole)`: Obtém tickets com base no papel do usuário
- `getTicket(ticketId)`: Obtém um ticket específico
- `createTicket(ticketData)`: Cria um novo ticket
- `updateTicket(ticketId, updates)`: Atualiza um ticket existente
- `finishTicket(ticketId)`: Marca um ticket como resolvido
- `submitTicketFeedback(ticketId, feedbackData)`: Envia feedback para um ticket
- `hasUnsubmittedFeedback(userId)`: Verifica se o usuário tem tickets com feedback pendente
- `getUserTicketsWithPendingFeedback(userId)`: Obtém tickets do usuário com feedback pendente
- `deleteTicket(ticketId)`: Exclui um ticket
- `getTicketMessages(ticketId)`: Obtém mensagens de chat de um ticket
- `sendChatMessage(ticketId, userId, userName, message, attachments)`: Envia mensagem para um ticket
- `markMessagesAsRead(ticketId, userId)`: Marca mensagens como lidas
- `transferTicket(ticketId, newSupportId, newSupportName)`: Transfere ticket para outro suporte
- `subscribeToTickets(userId, userRole, callback)`: Inscreve-se para atualizações em tempo real
- `subscribeToChatMessages(ticketId, callback)`: Inscreve-se para novas mensagens de chat

### UserService

Gerencia usuários e autenticação:

- `getNextAvailableLawyer()`: Obtém o próximo advogado disponível para atribuição
- `getUserProfile(userId)`: Obtém perfil do usuário
- `updateUserStatus(userId, isOnline)`: Atualiza status online/offline do usuário

### TicketEventService

Sistema de eventos para comunicação entre componentes:

- `emitFeedbackSubmitted(ticketId, status, userId)`: Emite evento quando feedback é enviado
- `onFeedbackSubmitted(callback)`: Registra callback para evento de feedback

## Componentes Principais

### Header

Barra de navegação principal com:
- Logo
- Menu de navegação
- Controle de status online/offline
- Perfil do usuário

### TicketChat

Interface de chat para comunicação dentro de tickets:
- Exibição de mensagens
- Envio de novas mensagens
- Suporte para anexos
- Indicador de status online

### TicketChatPanel

Painel que contém o chat e controles adicionais:
- Chat
- Informações do ticket
- Controles de status
- Formulário de feedback

### NPSChatFeedback

Componente para coletar feedback dos usuários:
- Avaliação de cumprimento da solicitação
- Motivo de não cumprimento (quando aplicável)
- Pontuação de serviço
- Comentários

## Funcionalidades Especiais

### Suporte Offline

O sistema pode armazenar mensagens localmente quando o usuário está offline:
- `saveForLater(action, data)`: Salva ação para executar quando online
- `processPendingActions()`: Processa ações pendentes quando volta online

### Sistema de Notificações

Notificações em tempo real usando Supabase:
- Novas mensagens
- Alterações de status de tickets
- Feedback submetido

### Controle de Leitura de Mensagens

Rastreamento de mensagens lidas/não lidas:
- `markMessagesAsRead(ticketId, userId)`: Marca mensagens como lidas
- `getUnreadMessageCounts(userId)`: Obtém contagem de mensagens não lidas

## Mapeamento de Dados

### mapToDatabase

Converte dados do frontend para o formato do banco de dados:

```typescript
const mapToDatabase = (data: any): any => {
  const mapped: any = {};
  
  if (data.title !== undefined) mapped.title = data.title;
  if (data.description !== undefined) mapped.description = data.description;
  if (data.priority !== undefined) mapped.priority = data.priority;
  if (data.category !== undefined) mapped.category = data.category;
  if (data.subcategory !== undefined) mapped.subcategory = data.subcategory;
  if (data.status !== undefined) mapped.status = data.status;
  if (data.createdBy !== undefined) mapped.created_by = data.createdBy;
  if (data.createdByName !== undefined) mapped.created_by_name = data.createdByName;
  if (data.createdByDepartment !== undefined) mapped.created_by_department = data.createdByDepartment;
  if (data.assignedTo !== undefined) mapped.assigned_to = data.assignedTo;
  if (data.assignedToName !== undefined) mapped.assigned_to_name = data.assignedToName;
  if (data.assignedBy !== undefined) mapped.assigned_by = data.assignedBy;
  if (data.assignedAt !== undefined) mapped.assigned_at = data.assignedAt;
  if (data.startedAt !== undefined) mapped.started_at = data.startedAt;
  if (data.resolvedAt !== undefined) mapped.resolved_at = data.resolvedAt;
  if (data.closedAt !== undefined) mapped.closed_at = data.closedAt;
  if (data.reopenedAt !== undefined) mapped.reopened_at = data.reopenedAt;
  if (data.npsScore !== undefined) mapped.nps_score = data.npsScore;
  if (data.npsFeedback !== undefined) mapped.nps_feedback = data.npsFeedback;
  if (data.npsSubmittedAt !== undefined) mapped.nps_submitted_at = data.npsSubmittedAt;
  if (data.requestFulfilled !== undefined) mapped.request_fulfilled = data.requestFulfilled;
  if (data.notFulfilledReason !== undefined) mapped.not_fulfilled_reason = data.notFulfilledReason;
  if (data.serviceScore !== undefined) mapped.service_score = data.serviceScore;
  if (data.comment !== undefined) mapped.comment = data.comment;
  if (data.feedbackSubmittedAt !== undefined) mapped.feedback_submitted_at = data.feedbackSubmittedAt;
  
  return mapped;
};
```

### mapFromDatabase

Converte dados do banco de dados para o formato do frontend:

```typescript
const mapFromDatabase = (data: any): Ticket => {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category,
    subcategory: data.subcategory,
    status: data.status,
    createdBy: data.created_by,
    createdByName: data.created_by_name,
    createdByDepartment: data.created_by_department,
    assignedTo: data.assigned_to,
    assignedToName: data.assigned_to_name,
    assignedBy: data.assigned_by,
    assignedAt: data.assigned_at,
    startedAt: data.started_at,
    resolvedAt: data.resolved_at,
    closedAt: data.closed_at,
    reopenedAt: data.reopened_at,
    npsScore: data.nps_score,
    npsFeedback: data.nps_feedback,
    npsSubmittedAt: data.nps_submitted_at,
    requestFulfilled: data.request_fulfilled,
    notFulfilledReason: data.not_fulfilled_reason,
    serviceScore: data.service_score,
    comment: data.comment,
    feedbackSubmittedAt: data.feedback_submitted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};
```

### mapMessageFromDatabase

Converte mensagens de chat do banco de dados para o formato do frontend:

```typescript
const mapMessageFromDatabase = (data: any): ChatMessage => {
  return {
    id: data.id,
    ticketId: data.ticket_id,
    userId: data.user_id,
    userName: data.user_name,
    message: data.message,
    attachments: data.attachments || [],
    createdAt: data.created_at,
    read: data.read || false
  };
};
```

## Tabelas do Banco de Dados

```javascript
const TABLES = {
  TICKETS: 'tickets',
  CHAT_MESSAGES: 'chat_messages',
  USERS: 'users',
  USER_STATUS: 'user_status'
};
```

## Fluxo de Trabalho de Feedback

1. Ticket é marcado como "resolvido" pelo advogado/suporte
2. Usuário recebe notificação para fornecer feedback
3. Usuário não pode criar novos tickets até fornecer feedback para tickets resolvidos
4. Usuário fornece feedback (avaliação de serviço)
5. Ticket é marcado como "fechado"
6. Evento de feedback é emitido para atualizar a interface

## Gerenciamento de Departamentos

Os usuários são organizados por departamentos:
- Contencioso
- Consultivo
- Trabalhista
- Tributário
- Contratos

Cada departamento tem cores específicas na interface para facilitar identificação.

## Recursos de Acessibilidade

- Cores com contraste adequado
- Elementos interativos claramente identificáveis
- Suporte para navegação por teclado
- Mensagens de erro claras e informativas