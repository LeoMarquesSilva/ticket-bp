// Enum para departamentos
export enum Department {
  OPERACOES_LEGAIS = 'Operações Legais',
  TRABALHISTA = 'Trabalhista',
  DISTRESSED_DEALS = 'Distressed Deals - Special Situations',
  TRIBUTARIO = 'Tributário',
  CIVEL = 'Cível',
  REESTRUTURACAO = 'Reestruturação',
  SOCIETARIO = 'Societário e Contratos',
  GERAL = 'Geral'
}

export type UserRole = 'user' | 'support' | 'admin' | 'lawyer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department | string; // Agora usando o enum Department
  isOnline?: boolean;
  lastActiveAt?: string;
  firstLogin?: boolean; // ✅ Novo campo - indica se é primeiro login
  mustChangePassword?: boolean; // ✅ Novo campo - indica se deve alterar senha
  passwordChangedAt?: string; // ✅ Novo campo - data da última alteração de senha
  ticketViewPreference?: 'list' | 'board' | 'users'; // ✅ Preferência de visualização de tickets
  isActive?: boolean; // ✅ Novo campo - indica se o usuário está ativo
  createdAt?: string;
}

export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved'; // Removido 'closed'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string;
  createdByName: string;
  createdByDepartment?: string; // Adicionando o departamento do criador
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  // Removido closedAt?: string;
  category: string;
  feedbackSubmittedAt?: string;
  subcategory?: string;
  npsScore?: number;
  npsComment?: string;
  // Adicionando as propriedades necessárias para o feedback
  serviceScore?: number;
  requestFulfilled?: boolean;
  notFulfilledReason?: string;
  comment?: string;
  needsFeedback?: boolean;
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
  attachments?: any[];
  read?: boolean;
  isTemp?: boolean;
  isSystem?: boolean;
}

export interface TicketStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  // Removido closed: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  averageNps: number;
  averageResolutionTime: number; // in hours
  averageResponseTime: number; // in hours
}

// ✅ Novos tipos para gerenciamento de senha
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetData {
  email: string;
  token?: string;
  newPassword: string;
}

export interface FirstLoginCheck {
  isFirstLogin: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: string;
}