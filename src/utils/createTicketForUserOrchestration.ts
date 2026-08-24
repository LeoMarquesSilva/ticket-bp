import type { Ticket } from '@/services/ticketService';

interface Finalizer {
  userId: string;
  userName: string;
}

interface TicketFinalizer {
  finishTicket(
    ticketId: string,
    finalizedBy: Finalizer,
    options: { assignToFinalizer: false },
  ): Promise<Ticket>;
}

export function finishCreatedTicket(
  ticketId: string,
  finalizedBy: Finalizer,
  service: TicketFinalizer,
): Promise<Ticket> {
  return service.finishTicket(ticketId, finalizedBy, { assignToFinalizer: false });
}
