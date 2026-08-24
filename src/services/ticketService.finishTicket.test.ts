import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
  notifyTicketResolved: vi.fn(),
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
vi.mock('./ticketCommunicationService', () => ({
  notifyTicketResolved: mocks.notifyTicketResolved,
}));

import { TicketService, type Ticket } from './ticketService';

describe('TicketService.finishTicket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.notifyTicketResolved.mockReset();
    mocks.notifyTicketResolved.mockResolvedValue(undefined);
    mocks.single.mockResolvedValue({
      data: {
        status: 'in_progress',
        feedback_submitted_at: null,
        title: 'Ticket',
        category: 'validacao_de_indicadores',
        subcategory: 'auditoria_de_excludentes_envio_de_evidencia',
        evidencia_enviada: null,
      },
    });
  });

  it('resolve e atribui ao finalizador na mesma atualização', async () => {
    const events: string[] = [];
    const resolvedTicket = { id: 'ticket-1', status: 'resolved' } as Ticket;
    const update = vi.spyOn(TicketService, 'updateTicket')
      .mockImplementation(async () => {
        events.push('update');
        return resolvedTicket;
      });
    mocks.notifyTicketResolved.mockImplementation(() => {
      events.push('notify');
      return Promise.resolve();
    });

    const result = await TicketService.finishTicket(
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
    expect(result).toBe(resolvedTicket);
    expect(events).toEqual(['update', 'notify']);
    expect(mocks.notifyTicketResolved).toHaveBeenCalledWith('ticket-1');
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
    expect(mocks.notifyTicketResolved).toHaveBeenCalledWith('ticket-1');
  });

  it('retorna o ticket resolvido sem esperar a comunicação', async () => {
    const resolvedTicket = { id: 'ticket-1', status: 'resolved' } as Ticket;
    vi.spyOn(TicketService, 'updateTicket').mockResolvedValue(resolvedTicket);
    mocks.notifyTicketResolved.mockImplementation(() => new Promise<void>(() => {}));

    await expect(TicketService.finishTicket('ticket-1')).resolves.toBe(resolvedTicket);
  });

  it('mantém o retorno da finalização quando a comunicação falha', async () => {
    const resolvedTicket = { id: 'ticket-1', status: 'resolved' } as Ticket;
    vi.spyOn(TicketService, 'updateTicket').mockResolvedValue(resolvedTicket);
    mocks.notifyTicketResolved.mockImplementationOnce(async () => {
      throw new Error('offline');
    });

    await expect(TicketService.finishTicket('ticket-1')).resolves.toBe(resolvedTicket);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.notifyTicketResolved).toHaveBeenCalledWith('ticket-1');
  });

  it('não comunica quando a atualização para resolvido falha', async () => {
    const failure = new Error('falha ao persistir');
    vi.spyOn(TicketService, 'updateTicket').mockRejectedValue(failure);

    await expect(TicketService.finishTicket('ticket-1')).rejects.toThrow(failure);

    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });

  it('não reenvia a comunicação ao finalizar ticket já resolvido', async () => {
    mocks.single.mockResolvedValue({
      data: {
        status: 'resolved',
        feedback_submitted_at: null,
        title: 'Ticket',
        category: 'validacao_de_indicadores',
        subcategory: 'auditoria_de_excludentes_envio_de_evidencia',
        evidencia_enviada: null,
      },
    });
    vi.spyOn(TicketService, 'updateTicket').mockResolvedValue({ id: 'ticket-1' } as Ticket);

    await TicketService.finishTicket('ticket-1');

    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });

  it('recusa atribuição sem os dados do finalizador', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket');

    await expect(TicketService.finishTicket(
      'ticket-1',
      undefined,
      { assignToFinalizer: true },
    )).rejects.toThrow('Usuário finalizador não informado');
    expect(update).not.toHaveBeenCalled();
    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });
});
