import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import {
  getTicketCommunicationQueue,
  notifyTicketResolved,
  runPendingTicketCommunications,
} from './ticketCommunicationService';

describe('notifyTicketResolved', () => {
  beforeEach(() => mocks.invoke.mockReset());

  it('envia somente a ação e o ticket ao absorver erro retornado pela comunicação', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('offline') });

    await expect(notifyTicketResolved('ticket-1')).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'ticket_resolved', ticketId: 'ticket-1' },
    });
  });

  it('absorve uma rejeição da comunicação', async () => {
    mocks.invoke.mockImplementationOnce(async () => {
      throw new Error('offline');
    });

    await expect(notifyTicketResolved('ticket-1')).resolves.toBeUndefined();
  });

  it('consulta a fila de avisos sem parâmetros extras', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        ok: true,
        nextRunAt: '2026-08-29T12:00:00.000Z',
        next: [],
        sent: [],
        counts: { next: 0, sent: 0 },
      },
      error: null,
    });

    await expect(getTicketCommunicationQueue()).resolves.toEqual({
      nextRunAt: '2026-08-29T12:00:00.000Z',
      next: [],
      sent: [],
      counts: { next: 0, sent: 0 },
    });
    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'queue_status' },
    });
  });

  it('dispara o envio da fila pendente', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: true, prepared: 2, sent: 2, failed: 0 },
      error: null,
    });

    await expect(runPendingTicketCommunications()).resolves.toEqual({
      prepared: 2,
      sent: 2,
      failed: 0,
    });
    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'run_pending' },
    });
  });
});
