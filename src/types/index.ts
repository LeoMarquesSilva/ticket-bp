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
}

export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

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
  closedAt?: string;
  category: string;
  subcategory?: string;
  npsScore?: number;
  npsComment?: string;
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  createdAt: string;
}

export interface TicketStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
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