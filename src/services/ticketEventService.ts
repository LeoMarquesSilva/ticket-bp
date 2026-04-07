import { supabase, TABLES } from '@/lib/supabase';

export type TicketFeedbackEvent = {
  ticketId: string;
  status: 'resolved';
  userId: string;
};

class TicketEventService {
  private listeners: Set<(event: TicketFeedbackEvent) => void> = new Set();
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  // Método de inicialização (compatibilidade com código existente)
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.setupRealtimeSubscription();
    console.log('🔧 TicketEventService inicializado');
  }

  private setupRealtimeSubscription() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase
      .channel('ticket-feedback-events')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.TICKETS,
        filter: "status=eq.resolved"
      }, (payload) => {
        const newData = payload.new as {
          id?: string;
          status?: string;
          created_by?: string;
        };
        
        if (newData?.status === 'resolved' && newData.id && newData.created_by) {
          this.notifyTicketStatusChanged({
            ticketId: newData.id,
            status: 'resolved',
            userId: newData.created_by
          });
        }
      })
      .subscribe();
  }

  public destroy(): void {
    this.listeners.clear();
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.initialized = false;
  }

  // Adicionar listener para eventos de feedback
  public onTicketStatusChanged(callback: (event: TicketFeedbackEvent) => void): () => void {
    this.listeners.add(callback);
    
    // Retornar função para remover o listener
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Método para compatibilidade com código existente
  public onFeedbackSubmitted(callback: (event: TicketFeedbackEvent) => void): () => void {
    return this.onTicketStatusChanged(callback);
  }

  // Notificar todos os listeners sobre mudança de status
  private notifyTicketStatusChanged(event: TicketFeedbackEvent): void {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Erro ao executar callback de evento de ticket:', error);
      }
    });
  }

  // Disparar evento de feedback submetido
  public emitFeedbackSubmitted(ticketId: string, status: 'resolved', userId: string): void {
    const event = new CustomEvent('ticketFeedbackSubmitted', {
      detail: { ticketId, status, userId }
    });
    window.dispatchEvent(event);
  }
}

// Exportar instância singleton
const ticketEventService = new TicketEventService();
export default ticketEventService;