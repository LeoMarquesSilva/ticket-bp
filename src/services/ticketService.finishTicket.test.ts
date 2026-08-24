import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  notifyTicketResolved: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  TABLES: { TICKETS: 'tickets' },
  supabase: { rpc: mocks.rpc },
}));

vi.mock('./evolutionEdgeService', () => ({ notifyTicketWhatsApp: vi.fn() }));
vi.mock('./ticketCommunicationService', () => ({
  notifyTicketResolved: mocks.notifyTicketResolved,
}));

import { TicketService } from './ticketService';

const databaseTicket = {
  id: 'ticket-1',
  title: 'Acesso',
  description: 'Solicitação de acesso',
  status: 'resolved',
  priority: 'medium',
  category: 'ti',
  subcategory: 'acesso',
  created_by: 'requester-1',
  created_by_name: 'Solicitante',
  feedback_submitted_at: null,
  created_at: '2026-08-24T12:00:00.000Z',
  updated_at: '2026-08-24T12:01:00.000Z',
  resolved_at: '2026-08-24T12:01:00.000Z',
};

describe('TicketService.finishTicket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.rpc.mockReset();
    mocks.notifyTicketResolved.mockReset();
    mocks.notifyTicketResolved.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({
      data: { changed: true, ticket: databaseTicket },
      error: null,
    });
  });

  it('faz a transição e atribuição em uma única RPC condicional', async () => {
    const sendChatMessage = vi.spyOn(TicketService, 'sendChatMessage')
      .mockResolvedValue({ id: 'message-1' } as never);

    const result = await TicketService.finishTicket(
      'ticket-1',
      { userId: '22222222-2222-2222-2222-222222222222', userName: 'Maria' },
      { assignToFinalizer: true },
    );

    expect(mocks.rpc).toHaveBeenCalledWith('helpdesk_finish_ticket', {
      p_ticket_id: 'ticket-1',
      p_assigned_to: '22222222-2222-2222-2222-222222222222',
      p_assigned_to_name: 'Maria',
      p_assigned_at: expect.any(String),
      p_evidencia_enviada: null,
      p_evidencia_decidido_por: null,
      p_evidencia_decidido_em: null,
    });
    expect(result).toMatchObject({ id: 'ticket-1', status: 'resolved' });
    expect(sendChatMessage).toHaveBeenCalledOnce();
    expect(mocks.notifyTicketResolved).toHaveBeenCalledWith('ticket-1');
  });

  it('não altera a atribuição quando a opção não é usada', async () => {
    vi.spyOn(TicketService, 'sendChatMessage').mockResolvedValue({ id: 'message-1' } as never);

    await TicketService.finishTicket(
      'ticket-1',
      { userId: '22222222-2222-2222-2222-222222222222', userName: 'Maria' },
      { assignToFinalizer: false },
    );

    expect(mocks.rpc).toHaveBeenCalledWith('helpdesk_finish_ticket', expect.objectContaining({
      p_assigned_to: null,
      p_assigned_to_name: null,
      p_assigned_at: null,
    }));
  });

  it('somente o vencedor da transição concorrente dispara chat e convite', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { changed: true, ticket: databaseTicket }, error: null })
      .mockResolvedValueOnce({ data: { changed: false, ticket: databaseTicket }, error: null });
    const sendChatMessage = vi.spyOn(TicketService, 'sendChatMessage')
      .mockResolvedValue({ id: 'message-1' } as never);

    await Promise.all([
      TicketService.finishTicket('ticket-1', {
        userId: '22222222-2222-2222-2222-222222222222',
        userName: 'Maria',
      }),
      TicketService.finishTicket('ticket-1', {
        userId: '22222222-2222-2222-2222-222222222222',
        userName: 'Maria',
      }),
    ]);

    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    expect(mocks.notifyTicketResolved).toHaveBeenCalledTimes(1);
  });

  it('não comunica quando o banco informa que o ticket já estava resolvido', async () => {
    mocks.rpc.mockResolvedValue({
      data: { changed: false, ticket: databaseTicket },
      error: null,
    });
    const sendChatMessage = vi.spyOn(TicketService, 'sendChatMessage');

    const result = await TicketService.finishTicket('ticket-1');

    expect(result).toMatchObject({ id: 'ticket-1', status: 'resolved' });
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });

  it('retorna sem esperar a comunicação externa', async () => {
    vi.spyOn(TicketService, 'sendChatMessage').mockResolvedValue({ id: 'message-1' } as never);
    mocks.notifyTicketResolved.mockImplementation(() => new Promise<void>(() => {}));

    await expect(TicketService.finishTicket('ticket-1')).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('mantém o retorno quando a comunicação externa falha', async () => {
    vi.spyOn(TicketService, 'sendChatMessage').mockResolvedValue({ id: 'message-1' } as never);
    mocks.notifyTicketResolved.mockRejectedValueOnce(new Error('offline'));

    await expect(TicketService.finishTicket('ticket-1')).resolves.toMatchObject({ id: 'ticket-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.notifyTicketResolved).toHaveBeenCalledWith('ticket-1');
  });

  it('não comunica quando a transição atômica falha', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('falha ao persistir') });

    await expect(TicketService.finishTicket('ticket-1')).rejects.toThrow('falha ao persistir');

    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });

  it('marca o convite automático no chat sem substituir o UUID do finalizador', async () => {
    const sendChatMessage = vi.spyOn(TicketService, 'sendChatMessage')
      .mockResolvedValue({ id: 'message-1' } as never);

    await TicketService.finishTicket('ticket-1', {
      userId: '22222222-2222-2222-2222-222222222222',
      userName: 'Maria',
    });

    expect(sendChatMessage).toHaveBeenCalledWith(
      'ticket-1',
      '22222222-2222-2222-2222-222222222222',
      'Maria',
      expect.stringContaining('foi finalizado'),
      [],
      { isSystem: true },
    );
  });

  it('envia a decisão de evidência para a mesma transição', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        changed: true,
        ticket: {
          ...databaseTicket,
          category: 'validacao_de_indicadores',
          subcategory: 'auditoria_de_excludentes_envio_de_evidencia',
        },
      },
      error: null,
    });

    await TicketService.finishTicket(
      'ticket-1',
      { userId: '22222222-2222-2222-2222-222222222222', userName: 'Maria' },
      { evidenciaEnviada: true },
    );

    expect(mocks.rpc).toHaveBeenCalledWith('helpdesk_finish_ticket', expect.objectContaining({
      p_evidencia_enviada: true,
      p_evidencia_decidido_por: '22222222-2222-2222-2222-222222222222',
      p_evidencia_decidido_em: expect.any(String),
    }));
    expect(mocks.notifyTicketResolved).toHaveBeenCalledOnce();
  });

  it('recusa atribuição sem os dados do finalizador antes de chamar a RPC', async () => {
    await expect(TicketService.finishTicket(
      'ticket-1',
      undefined,
      { assignToFinalizer: true },
    )).rejects.toThrow('Usuário finalizador não informado');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.notifyTicketResolved).not.toHaveBeenCalled();
  });
});
