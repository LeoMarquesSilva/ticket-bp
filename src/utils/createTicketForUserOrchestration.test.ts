import { describe, expect, it, vi } from 'vitest';
import { finishCreatedTicket } from './createTicketForUserOrchestration';

describe('finishCreatedTicket', () => {
  it('finaliza o ticket criado pelo caminho central que dispara o convite imediato', async () => {
    const finishTicket = vi.fn().mockResolvedValue({ id: 'ticket-1', status: 'resolved' });

    await finishCreatedTicket(
      'ticket-1',
      { userId: '22222222-2222-2222-2222-222222222222', userName: 'Maria' },
      { finishTicket },
    );

    expect(finishTicket).toHaveBeenCalledWith(
      'ticket-1',
      { userId: '22222222-2222-2222-2222-222222222222', userName: 'Maria' },
      { assignToFinalizer: false },
    );
  });
});
