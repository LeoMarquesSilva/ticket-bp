import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { TicketCommunicationTeamsService } from './ticketCommunicationTeamsService';

describe('TicketCommunicationTeamsService', () => {
  beforeEach(() => mocks.invoke.mockReset());

  it('obtém somente o status sanitizado da conta conectada', async () => {
    const teams = {
      connected: true,
      accountEmail: 'leonardo.marques@bismarchipires.com.br',
      accountDisplayName: 'Leonardo Marques',
      connectedAt: '2026-08-28T18:00:00.000Z',
    };
    mocks.invoke.mockResolvedValue({ data: { ok: true, teams }, error: null });

    await expect(TicketCommunicationTeamsService.getStatus()).resolves.toEqual(teams);
    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'teams_oauth_status' },
    });
  });

  it('obtém a URL oficial de autorização sem aceitar parâmetros do navegador', async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: true, authorizationUrl: 'https://login.microsoftonline.com/authorize?state=signed' },
      error: null,
    });

    await expect(TicketCommunicationTeamsService.startConnection()).resolves.toBe(
      'https://login.microsoftonline.com/authorize?state=signed',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'teams_oauth_start' },
    });
  });

  it('desconecta e transforma falha da Function em erro local', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(TicketCommunicationTeamsService.disconnect()).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
      body: { action: 'teams_oauth_disconnect' },
    });

    mocks.invoke.mockResolvedValueOnce({ data: { error: 'forbidden' }, error: null });
    await expect(TicketCommunicationTeamsService.getStatus()).rejects.toThrow(
      'Não foi possível consultar a conexão do Teams.',
    );
  });
});
