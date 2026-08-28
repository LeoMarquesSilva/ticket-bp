import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/ticketCommunicationSettingsService', () => ({
  TicketCommunicationSettingsService: { get: vi.fn(async () => ({})), save: vi.fn() },
}));
vi.mock('@/services/ticketCommunicationTeamsService', () => ({
  TicketCommunicationTeamsService: {
    getStatus: vi.fn(async () => ({
      connected: false,
      accountEmail: null,
      accountDisplayName: null,
      connectedAt: null,
    })),
    startConnection: vi.fn(),
    disconnect: vi.fn(),
  },
}));

import TicketCommunicationsTab, { TeamsConnectionCard } from './TicketCommunicationsTab';

describe('TicketCommunicationsTab', () => {
  it('oferece as três comunicações, editor seguro e preview do e-mail', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Chamado finalizado');
    expect(html).toContain('Aguardando resposta');
    expect(html).toContain('Avaliação pendente');
    expect(html).toContain('Assunto do e-mail');
    expect(html).toContain('Texto principal');
    expect(html).toContain('Texto do botão');
    expect(html).toContain('Prévia do destinatário');
    expect(html).toContain('iframe');
    expect(html).not.toContain('Editar HTML');
  });

  it('mostra a conta remetente conectada e permite reconectar ou desconectar', () => {
    const html = renderToStaticMarkup(React.createElement(TeamsConnectionCard, {
      loading: false,
      busy: false,
      status: {
        connected: true,
        accountEmail: 'leonardo.marques@bismarchipires.com.br',
        accountDisplayName: 'Leonardo Marques',
        connectedAt: '2026-08-28T18:00:00.000Z',
      },
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    }));

    expect(html).toContain('Microsoft Teams');
    expect(html).toContain('Leonardo Marques');
    expect(html).toContain('leonardo.marques@bismarchipires.com.br');
    expect(html).toContain('Conectar novamente');
    expect(html).toContain('Desconectar');
    expect(html).not.toContain('refresh');
  });

  it('explica que os colaboradores não precisam instalar aplicativo', () => {
    const html = renderToStaticMarkup(React.createElement(TeamsConnectionCard, {
      loading: false,
      busy: false,
      status: { connected: false, accountEmail: null, accountDisplayName: null, connectedAt: null },
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
    }));

    expect(html).toContain('Conectar conta do Teams');
    expect(html).toContain('não precisam instalar');
  });
});
