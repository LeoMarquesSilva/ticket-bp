# Sistema de Tickets - Escritório de Advocacia

## MVP Features
1. **Autenticação e Tipos de Usuário**
   - Login simples com seleção de tipo de usuário
   - 3 tipos: User (Jurídico), Support (Op. Legais), Admin (Gestores)

2. **Gestão de Tickets**
   - Criação de tickets (User/Admin)
   - Lista de tickets com filtros por status
   - Atribuição de tickets (Support/Admin)
   - Atualização de status dos tickets

3. **Dashboard Administrativo**
   - Métricas de atendimento
   - Gráficos de performance
   - Visão geral dos tickets

## Arquivos a Criar
1. **src/types/index.ts** - Tipos TypeScript
2. **src/contexts/AuthContext.tsx** - Contexto de autenticação
3. **src/components/Layout.tsx** - Layout principal
4. **src/components/TicketCard.tsx** - Card de ticket
5. **src/components/TicketForm.tsx** - Formulário de criação
6. **src/pages/Login.tsx** - Página de login
7. **src/pages/Dashboard.tsx** - Dashboard admin
8. **src/pages/Tickets.tsx** - Lista de tickets

## Funcionalidades por Tipo de Usuário
- **User**: Criar tickets, ver próprios tickets
- **Support**: Ver todos tickets, assumir/resolver tickets
- **Admin**: Todas funcionalidades + dashboard + reatribuir tickets

## Tecnologias
- React + TypeScript
- Shadcn/ui components
- Context API para estado global
- Local Storage para persistência