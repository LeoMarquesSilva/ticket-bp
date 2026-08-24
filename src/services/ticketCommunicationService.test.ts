import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { notifyTicketResolved } from './ticketCommunicationService';

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
});
