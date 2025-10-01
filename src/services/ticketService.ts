import { supabase, TABLES } from '@/lib/supabase';
import { UserService } from './userService';
import { executeWithRetry, isOnline } from '../utils/supabaseHelpers';
import { saveForLater } from '../utils/offlineStorage';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  subcategory?: string; // Adicionando a propriedade subcategory como opcional
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  createdBy: string;
  createdByName: string;
  createdByDepartment?: string; // Adicionando o departamento do criador como opcional
  assignedTo?: string;
  assignedToName?: string; // Adicionando assignedToName que também está sendo usado
  assignedBy?: string;
  assignedAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  npsScore?: number;
  npsFeedback?: string;
  npsSubmittedAt?: string;
  requestFulfilled?: boolean;
  notFulfilledReason?: string;
  serviceScore?: number;
  comment?: string;
  feedbackSubmittedAt?: string;
  createdAt: string;
  attachments?: any[]; // Adicionando suporte para anexos
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
  attachments?: any[]; // Adicionando suporte para anexos
  read?: boolean; // Adicionando campo para controle de leitura
  isTemp?: boolean;
}

export interface CreateTicketData {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  createdBy: string;
  createdByName: string;
  createdByDepartment?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  subcategory?: string;
  status?: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedBy?: string;
  assignedToName?: string;
  assignedAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  npsScore?: number;
  npsFeedback?: string;
  npsSubmittedAt?: string;
  requestFulfilled?: boolean;
  notFulfilledReason?: string;
  serviceScore?: number;
  comment?: string;
  feedbackSubmittedAt?: string;
}

export interface TicketFeedbackData {
  requestFulfilled: boolean;
  notFulfilledReason?: string;
  serviceScore: number;
  comment: string;
}
// Map frontend field names to database field names
const mapToDatabase = (data: any) => {
  const mapped: any = {};
  
  // Direct mappings
  if (data.title !== undefined) mapped.title = data.title;
  if (data.description !== undefined) mapped.description = data.description;
  if (data.priority !== undefined) mapped.priority = data.priority;
  if (data.category !== undefined) mapped.category = data.category;
  if (data.subcategory !== undefined) mapped.subcategory = data.subcategory;
  if (data.status !== undefined) mapped.status = data.status;
  
  // Field name mappings
  if (data.createdBy !== undefined) mapped.created_by = data.createdBy;
  if (data.createdByName !== undefined) mapped.created_by_name = data.createdByName;
  if (data.createdByDepartment !== undefined) mapped.created_by_department = data.createdByDepartment; // Corrigido: com "n"
  if (data.assignedTo !== undefined) mapped.assigned_to = data.assignedTo;
  if (data.assignedBy !== undefined) mapped.assigned_by = data.assignedBy;
  if (data.assignedToName !== undefined) mapped.assigned_to_name = data.assignedToName;
  if (data.assignedAt !== undefined) mapped.assigned_at = data.assignedAt;
  if (data.startedAt !== undefined) mapped.started_at = data.startedAt;
  if (data.resolvedAt !== undefined) mapped.resolved_at = data.resolvedAt;
  if (data.closedAt !== undefined) mapped.closed_at = data.closedAt;
  if (data.reopenedAt !== undefined) mapped.reopened_at = data.reopenedAt;
  if (data.npsScore !== undefined) mapped.nps_score = data.npsScore;
  if (data.npsFeedback !== undefined) mapped.nps_feedback = data.npsFeedback;
  if (data.npsSubmittedAt !== undefined) mapped.nps_submitted_at = data.npsSubmittedAt;
  
  // Novos campos para feedback
  if (data.requestFulfilled !== undefined) mapped.request_fulfilled = data.requestFulfilled;
  if (data.notFulfilledReason !== undefined) mapped.not_fulfilled_reason = data.notFulfilledReason;
  if (data.serviceScore !== undefined) mapped.service_score = data.serviceScore;
  if (data.comment !== undefined) mapped.comment = data.comment;
  if (data.feedbackSubmittedAt !== undefined) mapped.feedback_submitted_at = data.feedbackSubmittedAt;
  
  return mapped;
};

const mapFromDatabase = (data: any): Ticket => {
  // Adicionando log para depuração
  console.log('Dados do ticket do banco:', {
    id: data.id,
    department_field: data.created_by_department, // Corrigido: com "n"
  });

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
    createdByDepartment: data.created_by_department, // Corrigido: com "n"
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

// Mapear mensagem do banco de dados para o formato frontend
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

export class TicketService {
  // Get tickets based on user role
static async getTickets(userId: string, userRole: string): Promise<Ticket[]> {
  return executeWithRetry(async () => {
    try {
      console.log('Getting tickets for user:', userId, 'role:', userRole);
      
      let query = supabase
        .from(TABLES.TICKETS)
        .select('*')
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (userRole === 'user') {
        query = query.eq('created_by', userId);
      }
      // For support and admin, show all tickets (no additional filter)

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }

      console.log('Raw tickets data:', data);

      // Map database fields to frontend fields
      const tickets = data ? data.map(mapFromDatabase) : [];
      console.log('Mapped tickets:', tickets);
      
      return tickets;
    } catch (error) {
      console.error('Error in getTickets:', error);
      throw error;
    }
  });
}

  // Get all tickets (para a página de tickets)
  static async getAllTickets(): Promise<Ticket[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all tickets:', error);
        throw error;
      }

      // Map database fields to frontend fields
      const tickets = data ? data.map(mapFromDatabase) : [];
      return tickets;
    } catch (error) {
      console.error('Error in getAllTickets:', error);
      throw error;
    }
  }

  // Get user tickets (para a página de tickets)
  static async getUserTickets(userId: string): Promise<Ticket[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user tickets:', error);
        throw error;
      }

      // Map database fields to frontend fields
      const tickets = data ? data.map(mapFromDatabase) : [];
      return tickets;
    } catch (error) {
      console.error('Error in getUserTickets:', error);
      throw error;
    }
  }

  // Get ticket statistics
  static async getTicketStats(userId: string, userRole: string) {
    try {
      console.log('Getting ticket stats for user:', userId, 'role:', userRole);
      
      const tickets = await this.getTickets(userId, userRole);
      
      const stats = {
        open: tickets.filter(t => t && t.status === 'open').length,
        assigned: tickets.filter(t => t && t.status === 'assigned').length,
        in_progress: tickets.filter(t => t && t.status === 'in_progress').length,
        resolved: tickets.filter(t => t && t.status === 'resolved').length,
        closed: tickets.filter(t => t && t.status === 'closed').length,
        total: tickets.length,
      };

      console.log('Calculated stats:', stats);
      return stats;
    } catch (error) {
      console.error('Error in getTicketStats:', error);
      throw error;
    }
  }

  // Update a ticket
  static async updateTicket(ticketId: string, updates: UpdateTicketData): Promise<Ticket> {
    try {
      console.log('Updating ticket:', ticketId, 'with updates:', updates);
      
      const dbUpdates = {
        ...mapToDatabase(updates),
        updated_at: new Date().toISOString(),
      };

      // Adicionar timestamps conforme o status
      if (updates.status === 'in_progress' && !updates.startedAt) {
        dbUpdates.started_at = new Date().toISOString();
      } else if (updates.status === 'resolved' && !updates.resolvedAt) {
        dbUpdates.resolved_at = new Date().toISOString();
      } else if (updates.status === 'closed' && !updates.closedAt) {
        dbUpdates.closed_at = new Date().toISOString();
      }
      
      // Adicionar timestamp de atribuição se for atribuído
      if (updates.assignedTo && !updates.assignedAt) {
        dbUpdates.assigned_at = new Date().toISOString();
      }

      console.log('Database update data:', dbUpdates);

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .update(dbUpdates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Error updating ticket:', error);
        throw error;
      }

      console.log('Updated ticket data:', data);
      return mapFromDatabase(data);
    } catch (error) {
      console.error('Error in updateTicket:', error);
      throw error;
    }
  }

  // Finalizar um ticket (marcar como resolvido)
  static async finishTicket(ticketId: string): Promise<Ticket> {
    try {
      console.log('Finalizando ticket:', ticketId);
      
      const now = new Date().toISOString();
      
      const updates = {
        status: 'resolved',
        resolved_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Error finishing ticket:', error);
        throw error;
      }

      console.log('Finished ticket data:', data);
      return mapFromDatabase(data);
    } catch (error) {
      console.error('Error in finishTicket:', error);
      throw error;
    }
  }

  // Enviar feedback para um ticket
  static async submitTicketFeedback(ticketId: string, feedbackData: TicketFeedbackData): Promise<Ticket> {
    try {
      console.log('Submitting feedback for ticket:', ticketId, feedbackData);
      
      const now = new Date().toISOString();
      
      const updates = {
        request_fulfilled: feedbackData.requestFulfilled,
        not_fulfilled_reason: feedbackData.notFulfilledReason || null,
        service_score: feedbackData.serviceScore,
        comment: feedbackData.comment,
        feedback_submitted_at: now,
        updated_at: now,
        // Também definimos o status como fechado após o feedback
        status: 'closed',
        closed_at: now,
      };

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Error submitting feedback:', error);
        throw error;
      }

      console.log('Ticket with feedback data:', data);
      return mapFromDatabase(data);
    } catch (error) {
      console.error('Error in submitTicketFeedback:', error);
      throw error;
    }
  }

  // Delete a ticket
  static async deleteTicket(ticketId: string): Promise<boolean> {
    try {
      console.log('Deleting ticket:', ticketId);
      
      // Primeiro, excluir todas as mensagens de chat relacionadas ao ticket
      const { error: chatError } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .delete()
        .eq('ticket_id', ticketId);
      
      if (chatError) {
        console.error('Error deleting chat messages:', chatError);
        throw chatError;
      }
      
      // Depois, excluir o ticket
      const { error } = await supabase
        .from(TABLES.TICKETS)
        .delete()
        .eq('id', ticketId);
      
      if (error) {
        console.error('Error deleting ticket:', error);
        throw error;
      }
      
      console.log('Ticket deleted successfully');
      return true;
    } catch (error) {
      console.error('Error in deleteTicket:', error);
      throw error;
    }
  }

  // Get chat messages for a ticket
  static async getTicketMessages(ticketId: string): Promise<ChatMessage[]> {
    try {
      console.log('Getting chat messages for ticket:', ticketId);
      
      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
      }

      // Map database fields to frontend fields
      const messages: ChatMessage[] = data ? data.map(mapMessageFromDatabase) : [];
      return messages;
    } catch (error) {
      console.error('Error in getTicketMessages:', error);
      throw error;
    }
  }

  // Get chat messages for a ticket com suporte a paginação
  static async getChatMessages(ticketId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    try {
      console.log('Getting chat messages for ticket:', ticketId, 'limit:', limit, 'offset:', offset);
      
      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
      }

      // Map database fields to frontend fields
      const messages: ChatMessage[] = data ? data.map(mapMessageFromDatabase) : [];
      return messages;
    } catch (error) {
      console.error('Error in getChatMessages:', error);
      throw error;
    }
  }

  // Enviar mensagem para um ticket
  static async sendMessage(messageData: {
    ticketId: string;
    userId: string;
    userName: string;
    message: string;
    attachments?: any[];
  }): Promise<ChatMessage> {
    try {
      console.log('Sending message:', messageData);
      
      const dbData = {
        ticket_id: messageData.ticketId,
        user_id: messageData.userId,
        user_name: messageData.userName,
        message: messageData.message,
        attachments: messageData.attachments || [],
        created_at: new Date().toISOString(),
        read: false
      };

      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .insert([dbData])
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      return mapMessageFromDatabase(data);
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  static async sendChatMessage(
  ticketId: string, 
  userId: string, 
  userName: string, 
  message: string,
  attachments: any[] = []
): Promise<ChatMessage> {
  try {
    console.log('Sending chat message:', { ticketId, userId, userName, message, attachments });
    
    // Verificar se estamos online
    const online = await isOnline();
    
    // Criar o objeto de mensagem
    const messageData = {
      ticket_id: ticketId,
      user_id: userId,
      user_name: userName,
      message: message,
      attachments: attachments.length > 0 ? attachments : null,
      created_at: new Date().toISOString(),
      read: false
    };
    
    // Se estiver offline, salvar para enviar depois
    if (!online) {
      console.log('Offline: Salvando mensagem para envio posterior');
      
      // Salvar para enviar depois
      saveForLater('sendChatMessage', {
        ticketId,
        userId,
        userName,
        message,
        attachments: attachments.length > 0 ? attachments : null
      });
      
      // Retornar uma mensagem temporária para mostrar na UI
      return {
        id: `temp-${Date.now()}`,
        ticketId,
        userId,
        userName,
        message,
        createdAt: new Date().toISOString(),
        attachments: attachments.length > 0 ? attachments : [],
        read: false,
        isTemp: true
      };
    }

    console.log('Chat message insert data:', messageData);

    const { data, error } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .insert([messageData])
      .select()
      .single();

    if (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }

    console.log('Sent chat message data:', data);

    return mapMessageFromDatabase(data);
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    
    // Em caso de erro, salvar para enviar depois
    saveForLater('sendChatMessage', {
      ticketId,
      userId,
      userName,
      message,
      attachments: attachments.length > 0 ? attachments : null
    });
    
    // Retornar uma mensagem temporária para mostrar na UI
    return {
      id: `temp-${Date.now()}`,
      ticketId,
      userId,
      userName,
      message,
      createdAt: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : [],
      read: false,
      isTemp: true
    };
  }
}
// Obter contagem de mensagens não lidas
static async getUnreadMessageCounts(userId: string): Promise<Record<string, number>> {
  try {
    console.log('Getting unread message counts for user:', userId);
    
    // Buscar todas as mensagens não lidas que não foram enviadas pelo usuário atual
    const { data, error } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .select('ticket_id')
      .eq('read', false)
      .neq('user_id', userId);

    if (error) {
      console.error('Error getting unread message counts:', error);
      throw error;
    }

    // Contar manualmente as mensagens por ticket_id
    const counts: Record<string, number> = {};
    if (data) {
      data.forEach((msg: any) => {
        counts[msg.ticket_id] = (counts[msg.ticket_id] || 0) + 1;
      });
    }

    return counts;
  } catch (error) {
    console.error('Error in getUnreadMessageCounts:', error);
    return {};
  }
}

  // Obter usuários de suporte
  static async getSupportUsers(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('id, name, email, role')
        .in('role', ['support', 'admin', 'lawyer']);

      if (error) {
        console.error('Error fetching support users:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSupportUsers:', error);
      throw error;
    }
  }

 // Create a new ticket with automatic lawyer assignment
static async createTicket(ticketData: CreateTicketData): Promise<Ticket> {
  try {
    console.log('Creating ticket with data:', ticketData);
    console.log('Department from user:', ticketData.createdByDepartment); // Log para verificar
    
    // Preparar os dados básicos do ticket
    const dbData = {
      ...mapToDatabase(ticketData),
      priority: 'medium', // Definindo prioridade padrão como média
      status: 'open', // Sempre iniciar como "open" (em aberto)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('Database insert data:', dbData); // Log para verificar o mapeamento

    // Verificar se há um advogado disponível
    const availableLawyer = await UserService.getNextAvailableLawyer();
    
    // Se houver um advogado online, atribuir o ticket a ele, mas manter status como "open"
    if (availableLawyer) {
      // Não alterar o status aqui, mantê-lo como "open"
      dbData.assigned_to = availableLawyer.id;
      dbData.assigned_to_name = availableLawyer.name;
      dbData.assigned_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(TABLES.TICKETS)
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }

    console.log('Created ticket data from DB:', data); // Log para verificar o resultado
    return mapFromDatabase(data);
  } catch (error) {
    console.error('Error in createTicket:', error);
    throw error;
  }
}

  // Adicionar método para atribuir ticket a um advogado
  static async assignToLawyer(ticketId: string): Promise<Ticket> {
    try {
      // Verificar se há um advogado disponível
      const availableLawyer = await UserService.getNextAvailableLawyer();
      
      if (!availableLawyer) {
        throw new Error('Nenhum advogado disponível no momento');
      }
      
      const now = new Date().toISOString();
      
      const updates = {
        status: 'assigned',
        assigned_to: availableLawyer.id,
        // Remover esta linha se a coluna assigned_to_name não existir no banco de dados
        // Se a coluna existe, mantenha esta linha
        assigned_to_name: availableLawyer.name,
        assigned_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Error assigning ticket to lawyer:', error);
        throw error;
      }

      return mapFromDatabase(data);
    } catch (error) {
      console.error('Error in assignToLawyer:', error);
      throw error;
    }
  }

  // Marcar mensagens como lidas
static async markMessagesAsRead(ticketId: string, userId: string): Promise<boolean> {
  try {
    console.log('Marcando mensagens como lidas para ticket:', ticketId, 'e usuário:', userId);
    
    // Atualizar todas as mensagens não lidas que não foram enviadas pelo usuário atual
    const { data, error } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .update({ read: true })
      .eq('ticket_id', ticketId)
      .neq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
      throw error;
    }

    console.log('Mensagens marcadas como lidas:', data);
    return true;
  } catch (error) {
    console.error('Erro em markMessagesAsRead:', error);
    return false;
  }
}

// Marcar uma mensagem específica como lida
static async markMessageAsRead(messageId: string): Promise<boolean> {
  try {
    console.log('Marcando mensagem como lida:', messageId);
    
    const { error } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .update({ read: true })
      .eq('id', messageId);

    if (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro em markMessageAsRead:', error);
    return false;
  }
}

// Marcar todas as mensagens de um ticket como lidas
static async markAllMessagesAsRead(ticketId: string): Promise<boolean> {
  try {
    console.log('Marcando todas as mensagens como lidas para ticket:', ticketId);
    
    const { error } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .update({ read: true })
      .eq('ticket_id', ticketId)
      .eq('read', false);

    if (error) {
      console.error('Erro ao marcar todas as mensagens como lidas:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro em markAllMessagesAsRead:', error);
    return false;
  }
}

// Adicionar método para transferir ticket para outro suporte
static async transferTicket(ticketId: string, newSupportId: string, newSupportName: string): Promise<Ticket> {
  try {
    console.log('Transferindo ticket:', ticketId, 'para suporte:', newSupportId, 'nome:', newSupportName);
    
    const now = new Date().toISOString();
    
    // Garantir que o nome não seja undefined ou vazio
    let supportName = newSupportName; // Criar uma nova variável para evitar reatribuir o parâmetro
    
    if (!supportName) {
      console.warn('Nome do suporte não fornecido, buscando do banco de dados...');
      const { data: userData } = await supabase
        .from(TABLES.USERS)
        .select('name')
        .eq('id', newSupportId)
        .single();
      
      if (userData && typeof userData.name === 'string') {
        supportName = userData.name;
        console.log('Nome obtido do banco de dados:', supportName);
      } else {
        console.warn('Não foi possível obter o nome do usuário, usando ID como nome');
        supportName = newSupportId;
      }
    }
    
    const updates = {
      assigned_to: newSupportId,
      assigned_to_name: supportName,
      assigned_at: now,
      updated_at: now,
    };

    console.log('Dados de atualização para transferência:', updates);

    const { data, error } = await supabase
      .from(TABLES.TICKETS)
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao transferir ticket:', error);
      throw error;
    }

    console.log('Ticket transferido com sucesso, dados atualizados:', data);
    return mapFromDatabase(data);
  } catch (error) {
    console.error('Erro em transferTicket:', error);
    throw error;
  }
}

// Adicionar método para transferir ticket para outro suporte com obtenção automática do nome
static async transferTicketWithUserLookup(ticketId: string, newSupportId: string): Promise<Ticket> {
  try {
    console.log('Transferindo ticket:', ticketId, 'para suporte:', newSupportId);
    
    // Primeiro, buscar informações do usuário de suporte
    const { data: userData, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('name')
      .eq('id', newSupportId)
      .single();
    
    if (userError || !userData) {
      console.error('Erro ao buscar informações do usuário:', userError);
      throw new Error('Não foi possível obter informações do usuário de suporte');
    }
    
    // Verificar se o nome é uma string
    const newSupportName = typeof userData.name === 'string' ? userData.name : newSupportId;
    console.log('Nome do novo suporte:', newSupportName);
    
    // Agora transferir o ticket com o nome obtido
    return this.transferTicket(ticketId, newSupportId, newSupportName);
  } catch (error) {
    console.error('Erro em transferTicketWithUserLookup:', error);
    throw error;
  }
}

  // Subscribe to ticket changes (real-time)
  static subscribeToTickets(userId: string, userRole: string, callback: (payload: any) => void, statusCallback?: (status: any) => void) {
    console.log('Setting up ticket subscription for user:', userId, 'role:', userRole);
    
    let channel;
    
    if (userRole === 'user') {
      // Users only see their own tickets
      channel = supabase
        .channel('user-tickets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.TICKETS,
            filter: `created_by=eq.${userId}`
          },
          (payload) => {
            console.log('User ticket change received:', payload);
            callback(payload);
          }
        );
    } else {
      // Support and admin see all tickets
      channel = supabase
        .channel('all-tickets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.TICKETS,
          },
          (payload) => {
            console.log('All tickets change received:', payload);
            callback(payload);
          }
        );
    }

    channel.subscribe(statusCallback);

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from ticket changes');
      channel.unsubscribe();
    };
  }

// Subscribe to chat messages (real-time) with status callback
static subscribeToChatMessages(ticketId: string, callback: (payload: any) => void, statusCallback?: (status: string) => void) {
  console.log('Setting up chat subscription for ticket:', ticketId);
  
  try {
    // Usar um ID de canal único para este ticket
    const channelId = `chat-${ticketId}-${Date.now()}`;
    
    // Limpar canais existentes para este ticket
    const existingChannels = supabase.getChannels().filter(ch => {
      const channelStr = ch.topic || '';
      return channelStr.includes(`chat-${ticketId}`);
    });
    
    if (existingChannels.length > 0) {
      console.log(`Removendo ${existingChannels.length} canais existentes`);
      existingChannels.forEach(ch => supabase.removeChannel(ch));
    }
    
    // Criar um novo canal
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLES.CHAT_MESSAGES,
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('Chat message received:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Status da inscrição: ${status}`);
        if (statusCallback) statusCallback(status);
      });

    // Configurar reconexão automática quando a rede voltar
    const reconnect = () => {
      if (channel.state !== 'joined') {
        console.log('Tentando reconectar ao canal de chat...');
        channel.subscribe((status) => {
          console.log(`Reconexão: Status da inscrição: ${status}`);
          if (statusCallback) statusCallback(status);
        });
      }
    };

    // Adicionar event listener para reconectar quando a conexão voltar
    window.addEventListener('online', reconnect);

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from chat messages');
      window.removeEventListener('online', reconnect);
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('Error subscribing to chat messages:', error);
    return () => {}; // Return empty function to avoid errors
  }
}

  // Subscribe to ticket messages - alias for subscribeToChatMessages
  static subscribeToTicketMessages(
    ticketId: string, 
    callback: (payload: any) => void,
    statusCallback?: (status: string) => void
  ) {
    return this.subscribeToChatMessages(ticketId, callback, statusCallback);
  }
}