/** Regras do "chamado vinculado" (continuação de um chamado finalizado). */

export const LINKED_TICKET_TITLE_PREFIX = 'Continuação: ';
export const LINKED_TICKET_TITLE_MAX = 200;

/** Título sugerido para a continuação, sem empilhar prefixos. */
export function buildLinkedTicketTitle(sourceTitle: string): string {
  const base = String(sourceTitle ?? '')
    .trim()
    .replace(/^(Continuação:\s*)+/i, '');
  return `${LINKED_TICKET_TITLE_PREFIX}${base}`.slice(0, LINKED_TICKET_TITLE_MAX);
}

type LinkableTicket = {
  status: string;
  createdBy: string;
  assignedTo?: string | null;
};

/**
 * Solicitante e equipe (quem atendeu, quem atribui ou finaliza chamados)
 * podem abrir a continuação de um chamado finalizado.
 */
export function canOpenLinkedTicket(
  ticket: LinkableTicket,
  userId: string | null | undefined,
  permissions: { canAssign: boolean; canFinish: boolean },
): boolean {
  if (!userId || ticket.status !== 'resolved') return false;
  if (ticket.createdBy === userId || ticket.assignedTo === userId) return true;
  return permissions.canAssign || permissions.canFinish;
}
