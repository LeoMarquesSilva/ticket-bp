# Contexto do Sistema - Help Desk

## Visão Geral
Sistema de Help Desk desenvolvido em React/TypeScript com Supabase, focado em atendimento jurídico e suporte técnico. O sistema oferece gestão completa de tickets, chat em tempo real, dashboard analítico e sistema de feedback.

## Arquitetura Técnica

### Frontend
- **Framework**: React 18 com TypeScript
- **Roteamento**: React Router DOM
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Gerenciamento de Estado**: Context API + Hooks
- **Build Tool**: Vite

### Backend
- **Database**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Storage**: Supabase Storage (para anexos)
- **Real-time**: Supabase Realtime (para chat)

### Estrutura de Pastas
src/ ├── components/ # Componentes reutilizáveis │ ├── ui/ # Componentes base (shadcn/ui) │ ├── chat/ # Componentes do sistema de chat │ └── layout/ # Componentes de layout ├── pages/ # Páginas da aplicação ├── services/ # Serviços e APIs ├── contexts/ # Context providers ├── hooks/ # Custom hooks ├── lib/ # Utilitários e configurações └── types/ # Definições de tipos TypeScript


## Funcionalidades Principais

### 1. Sistema de Autenticação
- **Roles**: user, support, admin, lawyer
- **Permissões**: Controle granular por role
- **Sessão**: Gerenciamento automático via Supabase Auth

### 2. Gestão de Tickets
- **Status**: open, in_progress, resolved, closed
- **Prioridades**: low, medium, high, urgent
- **Categorias**: protocolo, cadastro, agendamento, publicacoes, assinatura_digital, outros
- **Subcategorias**: Específicas por categoria com SLA definido
- **Atribuição**: Manual ou automática para suporte/advogados
- **Anexos**: Upload de arquivos via Supabase Storage
- **Histórico**: Log completo de alterações

### 3. Sistema de Chat
- **Real-time**: Mensagens instantâneas via Supabase Realtime
- **Anexos**: Suporte a imagens e documentos
- **Participantes**: Usuário criador + atendentes atribuídos
- **Status**: Indicadores de mensagem lida/não lida

### 4. Dashboard Analítico
- **Métricas Gerais**: Total de tickets, distribuição por status
- **Performance**: Tempo médio de resolução, taxa de resolução
- **Satisfação**: NPS, avaliação de serviço, cumprimento de solicitações
- **Gráficos**: Tickets ao longo do tempo, distribuição por categoria
- **Filtros**: Por período, usuário, categoria

### 5. Sistema de Feedback
- **NPS Score**: Escala 0-10 para recomendação
- **Service Score**: Avaliação da qualidade do atendimento
- **Request Fulfilled**: Se a solicitação foi atendida
- **Comentários**: Feedback textual opcional

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
- created_at: timestamp
- updated_at: timestamp

#### app_c009c0e4f1_tickets
- id: uuid (PK)
- title: text
- description: text
- status: text (open|in_progress|resolved|closed)
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
- nps_score: integer
- service_score: integer
- request_fulfilled: boolean
- comment: text
- nps_feedback: text
- feedback_submitted_at: timestamp

#### app_c009c0e4f1_chat_messages
- id: uuid (PK)
- ticket_id: uuid (FK tickets)
- sender_id: uuid (FK users)
- sender_name: text
- sender_role: text
- message: text
- attachments: jsonb
- created_at: timestamp
- read_by: jsonb

#### app_c009c0e4f1_ticket_history

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
Sistema atribui automaticamente ou permite seleção manual
Ticket criado com status 'open'
Notificação enviada ao atendente (se atribuído)
2. Atendimento
Atendente visualiza ticket na lista
Pode alterar status para 'in_progress'
Comunicação via chat em tempo real
Upload de anexos quando necessário
Resolução com status 'resolved'
3. Feedback
Após resolução, usuário recebe solicitação de feedback
Avaliação via NPS, qualidade do serviço e cumprimento
Comentários opcionais
Dados integrados ao dashboard para análise
4. Fechamento
Ticket pode ser fechado automaticamente após feedback
Ou manualmente pelo atendente/admin
Status final: 'closed'
Configurações de SLA
Mapeamento Categoria → Subcategoria → SLA
const CATEGORIES_CONFIG = {
  'protocolo': {
    'pedido_urgencia': 2h,
    'inconsistencia': 2h,
    'duvidas': 2h
  },
  'cadastro': {
    'senhas_outros_tribunais': 1h,
    'senha_tribunal_expirada': 1h,
    'duvidas': 24h,
    'atualizacao_cadastro': 24h,
    'correcao_cadastro': 24h
  },
  'agendamento': {
    'duvidas': 4h
  },
  'publicacoes': {
    'problemas_central_publi': 1h,
    'duvidas': 2h
  },
  'assinatura_digital': {
    'pedido_urgencia': 3h,
    'duvidas': 3h
  },
  'outros': {
    'outros': 24h
  }
}


Métricas e KPIs
Performance
Tempo Médio de Resolução: Média em dias para resolver tickets
Taxa de Resolução: % de tickets resolvidos vs total
Primeiro Tempo de Resposta: Tempo até primeira resposta do atendente
Cumprimento de SLA: % de tickets resolvidos dentro do prazo
Satisfação
NPS (Net Promoter Score): Baseado em escala 0-10
Promotores: 9-10
Neutros: 7-8
Detratores: 0-6
Qualidade do Serviço: Média das avaliações 1-10
Taxa de Atendimento: % de solicitações efetivamente atendidas
Operacionais
Volume de Tickets: Total por período
Distribuição por Status: Abertos, em progresso, resolvidos, fechados
Distribuição por Categoria: Análise dos tipos de solicitação
Carga de Trabalho: Tickets por atendente
Integrações
Supabase Services
Database: PostgreSQL para persistência
Auth: Autenticação e autorização
Storage: Armazenamento de anexos
Realtime: Chat em tempo real
Edge Functions: Processamento serverless (se necessário)
External Services (Futuro)
Email: Notificações por email
SMS: Alertas críticos
Webhooks: Integrações com sistemas externos
API REST: Exposição de dados para terceiros
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
Uptime: Monitoramento de disponibilidade
Database: Query performance no Supabase
Métricas de Negócio
Satisfação do Cliente: NPS tracking
Eficiência Operacional: SLA compliance
Volume de Atendimento: Tickets por período
Qualidade: Feedback scores
Roadmap Futuro
Funcionalidades Planejadas
Notificações Push: Alertas em tempo real
Mobile App: Versão nativa para iOS/Android
Automação: Chatbots para triagem inicial
Relatórios Avançados: Exportação PDF/Excel
API Pública: Integrações com terceiros
Multi-tenancy: Suporte a múltiplas organizações
Melhorias Técnicas
Cache: Redis para performance
Queue System: Processamento assíncrono
Microservices: Separação de responsabilidades
GraphQL: API mais flexível
Testing: Cobertura de testes automatizados
CI/CD: Pipeline de deployment automatizado