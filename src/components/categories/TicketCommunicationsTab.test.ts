import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/ticketCommunicationSettingsService', () => ({
  TicketCommunicationSettingsService: {
    get: vi.fn(async () => ({})),
    save: vi.fn(),
    getTeams: vi.fn(async () => ({})),
    saveTeams: vi.fn(),
    getSchedule: vi.fn(async () => ({
      resolved_feedback_invite: { enabled: true, delayHours: 0 },
      awaiting_requester: { enabled: true, delayHours: 48 },
      awaiting_feedback: { enabled: true, delayHours: 72 },
    })),
    saveSchedule: vi.fn(),
  },
}));
vi.mock('@/services/userService', () => ({
  UserService: {
    getAllUsers: vi.fn(async () => []),
    isSelectableUser: () => true,
  },
}));
vi.mock('@/components/UserAssigneePicker', () => ({
  default: () => 'Escolher usuário',
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
    sendTestMessage: vi.fn(),
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

  it('oferece o painel do Teams com os mesmos textos seguros e prévia do cartão', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Mensagens do Teams');
    expect(html).toContain('Título da mensagem');
    expect(html).toContain('Prévia do Teams');
    expect(html).toContain('RESPONSUM');
    expect(html).toContain('Avaliar atendimento');
    expect(html).toContain('CHAMADO FINALIZADO');
    expect(html).toContain('Atendimento concluído');
    expect(html).toContain('como o destinatário vê no Teams');
    expect(html).not.toContain('title="Prévia do Teams"');
    expect(html).not.toContain('Editar Adaptive Card');
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
      onSendTest: vi.fn(),
    }));

    expect(html).toContain('Microsoft Teams');
    expect(html).toContain('Leonardo Marques');
    expect(html).toContain('leonardo.marques@bismarchipires.com.br');
    expect(html).toContain('Conectar novamente');
    expect(html).toContain('Enviar teste');
    expect(html).toContain('Desconectar');
    expect(html).not.toContain('refresh');
  });

  it('permite configurar quando cada mensagem automática é enviada', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Quando enviar');
    expect(html).toContain('Assim que o chamado é finalizado');
    expect(html).toContain('Após 48 horas');
    expect(html).toContain('Após 72 horas');
    expect(html).toContain('Salvar prazos');
    expect(html).toContain('schedule-awaiting_requester-hours');
  });

  it('oferece escolha de destinatário e botões de teste no Teams', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Destinatário do teste');
    expect(html).toContain('Escolher usuário');
    expect(html).toContain('Enviar teste');
    expect(html).toContain('Enviar esta mensagem de teste');
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
