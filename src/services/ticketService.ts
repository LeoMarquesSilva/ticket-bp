import { supabase, TABLES } from '@/lib/supabase';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  npsScore?: number;
  npsFeedback?: string;
  npsSubmittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface CreateTicketData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdBy: string;
  createdByName: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  status?: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;
  startedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  npsScore?: number;
  npsFeedback?: string;
  npsSubmittedAt?: string;
}

// Map frontend field names to database field names
const mapToDatabase = (data: any) => {
  const mapped: any = {};
  
  // Direct mappings
  if (data.title !== undefined) mapped.title = data.title;
  if (data.description !== undefined) mapped.description = data.description;
  if (data.priority !== undefined) mapped.priority = data.priority;
  if (data.category !== undefined) mapped.category = data.category;
  if (data.status !== undefined) mapped.status = data.status;
  
  // Field name mappings
  if (data.createdBy !== undefined) mapped.created_by = data.createdBy;
  if (data.createdByName !== undefined) mapped.created_by_name = data.createdByName;
  if (data.assignedTo !== undefined) mapped.assigned_to = data.assignedTo;
  if (data.assignedBy !== undefined) mapped.assigned_by = data.assignedBy;
  if (data.assignedAt !== undefined) mapped.assigned_at = data.assignedAt;
  if (data.startedAt !== undefined) mapped.started_at = data.startedAt;
  if (data.resolvedAt !== undefined) mapped.resolved_at = data.resolvedAt;
  if (data.closedAt !== undefined) mapped.closed_at = data.closedAt;
  if (data.reopenedAt !== undefined) mapped.reopened_at = data.reopenedAt;
  if (data.npsScore !== undefined) mapped.nps_score = data.npsScore;
  if (data.npsFeedback !== undefined) mapped.nps_feedback = data.npsFeedback;
  if (data.npsSubmittedAt !== undefined) mapped.nps_submitted_at = data.npsSubmittedAt;
  
  return mapped;
};

// Map database field names to frontend field names
const mapFromDatabase = (data: any): Ticket => {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category,
    status: data.status,
    createdBy: data.created_by,
    createdByName: data.created_by_name,
    assignedTo: data.assigned_to,
    assignedBy: data.assigned_by,
    assignedAt: data.assigned_at,
    startedAt: data.started_at,
    resolvedAt: data.resolved_at,
    closedAt: data.closed_at,
    reopenedAt: data.reopened_at,
    npsScore: data.nps_score,
    npsFeedback: data.nps_feedback,
    npsSubmittedAt: data.nps_submitted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export class TicketService {
  // Get tickets based on user role
  static async getTickets(userId: string, userRole: string): Promise<Ticket[]> {
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
  }

  // Get ticket statistics
  static async getTicketStats(userId: string, userRole: string) {
    try {
      console.log('Getting ticket stats for user:', userId, 'role:', userRole);
      
      const tickets = await this.getTickets(userId, userRole);
      
      const stats = {
        open: tickets.filter(t => t.status === 'open').length,
        assigned: tickets.filter(t => t.status === 'assigned').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
        total: tickets.length,
      };

      console.log('Calculated stats:', stats);
      return stats;
    } catch (error) {
      console.error('Error in getTicketStats:', error);
      throw error;
    }
  }

  // Create a new ticket
  static async createTicket(ticketData: CreateTicketData): Promise<Ticket> {
    try {
      console.log('Creating ticket with data:', ticketData);
      
      const dbData = {
        ...mapToDatabase(ticketData),
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Database insert data:', dbData);

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .insert([dbData])
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket:', error);
        throw error;
      }

      console.log('Created ticket data:', data);
      return mapFromDatabase(data);
    } catch (error) {
      console.error('Error in createTicket:', error);
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

  // Get chat messages for a ticket
  static async getChatMessages(ticketId: string): Promise<ChatMessage[]> {
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

      console.log('Raw chat messages:', data);

      // Map database fields to frontend fields
      const messages: ChatMessage[] = data ? data.map((msg: any) => ({
        id: msg.id,
        ticketId: msg.ticket_id,
        userId: msg.user_id,
        userName: msg.user_name,
        message: msg.message,
        createdAt: msg.created_at,
      })) : [];

      console.log('Mapped chat messages:', messages);
      return messages;
    } catch (error) {
      console.error('Error in getChatMessages:', error);
      throw error;
    }
  }

  // Send a chat message
  static async sendChatMessage(ticketId: string, userId: string, userName: string, message: string): Promise<ChatMessage> {
    try {
      console.log('Sending chat message:', { ticketId, userId, userName, message });
      
      const messageData = {
        ticket_id: ticketId,
        user_id: userId,
        user_name: userName,
        message: message,
        created_at: new Date().toISOString(),
      };

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

      return {
        id: data.id,
        ticketId: data.ticket_id,
        userId: data.user_id,
        userName: data.user_name,
        message: data.message,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Error in sendChatMessage:', error);
      throw error;
    }
  }

  // Subscribe to ticket changes (real-time)
  static subscribeToTickets(userId: string, userRole: string, callback: (payload: any) => void) {
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

    channel.subscribe();

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
      // Usar um ID de canal único para evitar conflitos
      const channelId = `chat-${ticketId}-${Date.now()}`;
      console.log('Canal ID:', channelId);
      
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
          console.log(`Status da inscrição para ticket ${ticketId}:`, status);
          if (statusCallback) {
            statusCallback(status);
          }
        });

      // Return unsubscribe function
      return () => {
        console.log('Unsubscribing from chat messages');
        channel.unsubscribe();
      };
    } catch (error) {
      console.error('Error subscribing to chat messages:', error);
      // Return empty function to avoid errors
      return () => {};
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