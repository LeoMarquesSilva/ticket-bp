import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  TABLES: { TICKETS: 'tickets' },
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mocks.single })),
      })),
    })),
  },
}));

vi.mock('./evolutionEdgeService', () => ({ notifyTicketWhatsApp: vi.fn() }));

import { TicketService, type Ticket } from './ticketService';

describe('TicketService.finishTicket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.single.mockResolvedValue({
      data: {
        status: 'in_progress',
        feedback_submitted_at: '2026-08-19T12:00:00.000Z',
        title: 'Ticket',
        category: 'Geral',
        subcategory: 'Geral',
        evidencia_enviada: null,
      },
    });
  });

  it('resolve e atribui ao finalizador na mesma atualização', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket')
      .mockResolvedValue({ id: 'ticket-1' } as Ticket);

    await TicketService.finishTicket(
      'ticket-1',
      { userId: 'user-1', userName: 'Maria' },
      { assignToFinalizer: true },
    );

    expect(update).toHaveBeenCalledWith('ticket-1', {
      status: 'resolved',
      assignedTo: 'user-1',
      assignedToName: 'Maria',
      assignedAt: expect.any(String),
    });
  });

  it('resolve sem alterar a atribuição quando a opção não é usada', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket')
      .mockResolvedValue({ id: 'ticket-1' } as Ticket);

    await TicketService.finishTicket(
      'ticket-1',
      { userId: 'user-1', userName: 'Maria' },
      { assignToFinalizer: false },
    );

    expect(update).toHaveBeenCalledWith('ticket-1', { status: 'resolved' });
  });

  it('recusa atribuição sem os dados do finalizador', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket');

    await expect(TicketService.finishTicket(
      'ticket-1',
      undefined,
      { assignToFinalizer: true },
    )).rejects.toThrow('Usuário finalizador não informado');
    expect(update).not.toHaveBeenCalled();
  });
});
