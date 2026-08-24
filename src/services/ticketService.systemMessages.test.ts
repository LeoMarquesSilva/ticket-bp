import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
  isOnline: vi.fn(),
  saveForLater: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  TABLES: { CHAT_MESSAGES: 'chat_messages' },
  supabase: { from: mocks.from },
}));
vi.mock('../utils/supabaseHelpers', () => ({
  executeWithRetry: (operation: () => unknown) => operation(),
  isOnline: mocks.isOnline,
}));
vi.mock('../utils/offlineStorage', () => ({ saveForLater: mocks.saveForLater }));

import { TicketService } from './ticketService';

describe('TicketService.sendChatMessage automatic representation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnline.mockResolvedValue(true);
    mocks.single.mockResolvedValue({
      data: {
        id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        user_name: 'Maria',
        message: 'Categoria alterada',
        attachments: null,
        created_at: '2026-08-24T12:00:00.000Z',
        read: false,
        is_system: true,
      },
      error: null,
    });
    mocks.insert.mockReturnValue({
      select: vi.fn(() => ({ single: mocks.single })),
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it('persiste o UUID do ator e marca a mensagem automática no schema', async () => {
    const result = await TicketService.sendChatMessage(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'Maria',
      'Categoria alterada',
      [],
      { isSystem: true },
    );

    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({
      user_id: '22222222-2222-2222-2222-222222222222',
      is_system: true,
    })]);
    expect(result.isSystem).toBe(true);
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain('"user_id":"system"');
  });
});
