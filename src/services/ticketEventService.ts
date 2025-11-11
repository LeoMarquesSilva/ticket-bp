import { supabase, TABLES } from '@/lib/supabase';

export type TicketFeedbackEvent = {
  ticketId: string;
  status: 'resolved';
  userId: string;
};

class TicketEventService {
  private listeners: Set<(event: TicketFeedbackEvent) => void> = new Set();

  constructor() {
    this.setupRealtimeSubscription();
  }

  // Método de inicialização (compatibilidade com código existente)
  public initialize(): void {
    // O serviço já é inicializado no constructor
    console.log('🔧 TicketEventService já inicializado');
  }

  private setupRealtimeSubscription() {
    supabase
      .channel('ticket-feedback-events')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.TICKETS,
        filter: "status=eq.resolved"
      }, (payload) => {
        const newData = payload.new as any;
        
        if (newData && newData.status === 'resolved') {
          this.notifyTicketStatusChanged({
            ticketId: newData.id,
            status: newData.status,
            userId: newData.created_by
          });
        }
      })
      .subscribe();
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