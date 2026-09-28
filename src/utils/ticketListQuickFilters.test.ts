import { describe, expect, it } from 'vitest';
import {
  buildLastMessageAuthors,
  isAwaitingOurReply,
  matchesQuickFilter,
  sortTickets,
} from './ticketListQuickFilters';

const ticket = (overrides: Partial<Parameters<typeof isAwaitingOurReply>[0]> = {}) => ({
  id: 't1',
  status: 'open',
  createdBy: 'requester',
  assignedTo: 'agent',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
  ...overrides,
});

describe('ticketListQuickFilters', () => {
  it('usa a última mensagem que não é de sistema', () => {
    const authors = buildLastMessageAuthors([
      { ticket_id: 't1', user_id: 'system-user', created_at: '3', is_system: true },
      { ticket_id: 't1', user_id: 'agent', created_at: '2' },
      { ticket_id: 't1', user_id: 'requester', created_at: '1' },
    ]);
    expect(authors).toEqual({ t1: 'agent' });
  });

  it('considera aguardando resposta quando a última palavra é do solicitante ou não há mensagens', () => {
    expect(isAwaitingOurReply(ticket(), { t1: 'requester' })).toBe(true);
    expect(isAwaitingOurReply(ticket(), {})).toBe(true);
    expect(isAwaitingOurReply(ticket(), { t1: 'agent' })).toBe(false);
    expect(isAwaitingOurReply(ticket({ status: 'resolved' }), { t1: 'requester' })).toBe(false);
  });

  it('filtra não lidas e não atribuídos', () => {
    const context = { unreadCounts: { t1: 2 } };
    expect(matchesQuickFilter(ticket(), 'unread', context)).toBe(true);
    expect(matchesQuickFilter(ticket({ id: 't2' }), 'unread', context)).toBe(false);
    expect(matchesQuickFilter(ticket({ assignedTo: null }), 'unassigned', context)).toBe(true);
    expect(matchesQuickFilter(ticket(), 'unassigned', context)).toBe(false);
  });

  it('ordena por criação e por última atualização', () => {
    const a = ticket({ id: 'a', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-05T10:00:00Z' });
    const b = ticket({ id: 'b', createdAt: '2026-09-03T10:00:00Z', updatedAt: '2026-09-03T10:00:00Z' });
    expect(sortTickets([a, b], 'recent').map((t) => t.id)).toEqual(['b', 'a']);
    expect(sortTickets([a, b], 'oldest').map((t) => t.id)).toEqual(['a', 'b']);
    expect(sortTickets([a, b], 'activity').map((t) => t.id)).toEqual(['a', 'b']);
  });
});
