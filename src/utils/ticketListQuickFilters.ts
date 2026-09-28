export type TicketQuickFilter = 'all' | 'unread' | 'awaiting_reply' | 'unassigned';
export type TicketSortOrder = 'recent' | 'oldest' | 'activity';

export const TICKET_SORT_OPTIONS: { value: TicketSortOrder; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'activity', label: 'Última atualização' },
];

interface QuickFilterTicket {
  id: string;
  status: string;
  createdBy: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface LastMessageRow {
  ticket_id: string;
  user_id: string;
  created_at: string;
  is_system?: boolean | null;
}

/** Autor da última mensagem não-sistema de cada ticket. Espera linhas em ordem decrescente de data. */
export function buildLastMessageAuthors(rows: readonly LastMessageRow[]): Record<string, string> {
  const authors: Record<string, string> = {};
  rows.forEach((row) => {
    if (row.is_system === true) return;
    if (!(row.ticket_id in authors)) authors[row.ticket_id] = row.user_id;
  });
  return authors;
}

/** Ticket em aberto cuja última palavra é do solicitante (ou que ainda não teve resposta). */
export function isAwaitingOurReply(
  ticket: QuickFilterTicket,
  lastMessageAuthors: Readonly<Record<string, string>>,
): boolean {
  if (ticket.status === 'resolved') return false;
  const lastAuthor = lastMessageAuthors[ticket.id];
  return lastAuthor === undefined || lastAuthor === ticket.createdBy;
}

export function matchesQuickFilter(
  ticket: QuickFilterTicket,
  filter: TicketQuickFilter,
  context: {
    unreadCounts: Readonly<Record<string, number>>;
    lastMessageAuthors?: Readonly<Record<string, string>>;
  },
): boolean {
  switch (filter) {
    case 'unread':
      return (context.unreadCounts[ticket.id] ?? 0) > 0;
    case 'awaiting_reply':
      return context.lastMessageAuthors ? isAwaitingOurReply(ticket, context.lastMessageAuthors) : false;
    case 'unassigned':
      return ticket.status !== 'resolved' && !ticket.assignedTo;
    default:
      return true;
  }
}

const toTime = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
};

export function sortTickets<T extends QuickFilterTicket>(tickets: readonly T[], order: TicketSortOrder): T[] {
  const sorted = [...tickets];
  if (order === 'oldest') sorted.sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  else if (order === 'activity') sorted.sort((a, b) => toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt));
  else sorted.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  return sorted;
}
