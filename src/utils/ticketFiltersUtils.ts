type TicketLike = {
  createdBy?: string;
  assignedTo?: string;
};

/**
 * Regra centralizada do filtro de responsável no módulo de Tickets.
 * - all  => todos
 * - mine => criados por mim OU atribuídos a mim
 * - <id> => atribuídos ao usuário selecionado
 */
export function matchesUserTicketFilter(
  ticket: TicketLike,
  userId: string | undefined,
  userFilter: string
): boolean {
  if (userFilter === 'all') return true;

  if (userFilter === 'mine') {
    if (!userId) return false;
    return ticket.assignedTo === userId || ticket.createdBy === userId;
  }

  return ticket.assignedTo === userFilter;
}
