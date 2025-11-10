import { supabase, TABLES } from '@/lib/supabase';

// Tipo de evento para feedback de tickets
export type TicketFeedbackEvent = {
  ticketId: string;
  status: 'resolved' | 'closed';
  userId: string;
};

// Interface para os callbacks de eventos
type EventCallback = (event: TicketFeedbackEvent) => void;

class TicketEventService {
  private static instance: TicketEventService;
  private feedbackSubmittedListeners: EventCallback[] = [];
  private ticketStatusChangedListeners: EventCallback[] = [];
  private isInitialized = false;

  // Singleton pattern
  public static getInstance(): TicketEventService {
    if (!TicketEventService.instance) {
      TicketEventService.instance = new TicketEventService();
    }
    return TicketEventService.instance;
  }

  // Inicializar o serviço e configurar os listeners de eventos
  public initialize(): void {
    if (this.isInitialized) return;
    
    // Configurar o listener para eventos personalizados
    window.addEventListener('ticketFeedbackSubmitted', ((event: CustomEvent) => {
      this.notifyFeedbackSubmitted(event.detail);
    }) as EventListener);
    
    // Configurar o canal Realtime para mudanças de status de tickets
    this.setupRealtimeSubscription();
    
    this.isInitialized = true;
    console.log('TicketEventService initialized');
  }

  // Configurar a assinatura em tempo real para mudanças de status de tickets
  private setupRealtimeSubscription(): void {
    const channel = supabase.channel('ticket-status-changes');
    
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.TICKETS,
        filter: "status=in.(resolved,closed)"
      }, (payload) => {
        const newData = payload.new as any;
        
        if (newData && (newData.status === 'resolved' || newData.status === 'closed')) {
          this.notifyTicketStatusChanged({
            ticketId: newData.id,
            status: newData.status,
            userId: newData.created_by
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to ticket status changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to ticket status changes');
          
          // Tentar reconectar após um atraso
          setTimeout(() => this.setupRealtimeSubscription(), 5000);
        }
      });
  }

  // Disparar evento de feedback submetido
  public emitFeedbackSubmitted(ticketId: string, status: 'resolved' | 'closed', userId: string): void {
    const event = new CustomEvent('ticketFeedbackSubmitted', {
      detail: { ticketId, status, userId }
    });
    
    window.dispatchEvent(event);
  }

  // Notificar ouvintes sobre feedback submetido
  private notifyFeedbackSubmitted(event: TicketFeedbackEvent): void {
    this.feedbackSubmittedListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in feedback submitted listener:', error);
      }
    });
  }

  // Notificar ouvintes sobre mudança de status de ticket
  private notifyTicketStatusChanged(event: TicketFeedbackEvent): void {
    this.ticketStatusChangedListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in ticket status changed listener:', error);
      }
    });
  }

  // Adicionar ouvinte para evento de feedback submetido
  public onFeedbackSubmitted(callback: EventCallback): () => void {
    this.feedbackSubmittedListeners.push(callback);
    
    // Retornar função para remover o listener
    return () => {
      this.feedbackSubmittedListeners = this.feedbackSubmittedListeners.filter(
        listener => listener !== callback
      );
    };
  }

  // Adicionar ouvinte para evento de mudança de status de ticket
  public onTicketStatusChanged(callback: EventCallback): () => void {
    this.ticketStatusChangedListeners.push(callback);
    
    // Retornar função para remover o listener
    return () => {
      this.ticketStatusChangedListeners = this.ticketStatusChangedListeners.filter(
        listener => listener !== callback
      );
    };
  }

  // Limpar todos os ouvintes
  public cleanup(): void {
    this.feedbackSubmittedListeners = [];
    this.ticketStatusChangedListeners = [];
    window.removeEventListener('ticketFeedbackSubmitted', ((event: CustomEvent) => {
      this.notifyFeedbackSubmitted(event.detail);
    }) as EventListener);
  }
}

export const ticketEventService = TicketEventService.getInstance();
export default ticketEventService;