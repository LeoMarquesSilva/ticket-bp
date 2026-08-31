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
vi.mock('@/services/ticketCommunicationService', () => ({
  getTicketCommunicationQueue: vi.fn(async () => ({
    nextRunAt: '2026-08-29T12:00:00.000Z',
    next: [],
    sent: [],
    counts: { next: 0, sent: 0 },
  })),
  runPendingTicketCommunications: vi.fn(),
}));
vi.mock('@/contexts/OfficialPhotosContext', () => ({
  useOfficialPhoto: () => null,
}));
vi.mock('@/services/officialPhotosService', () => ({
  officialPhotoSrc: () => undefined,
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

import TicketCommunicationsTab, { TeamsConnectionCard, TicketCommunicationQueueCard } from './TicketCommunicationsTab';

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

  it('distingue fila vazia de falha ao carregar os avisos', () => {
    const errorHtml = renderToStaticMarkup(React.createElement(TicketCommunicationQueueCard, {
      loading: false,
      busy: false,
      queue: null,
      onRefresh: () => undefined,
      onRunPending: () => undefined,
    }));
    const emptyHtml = renderToStaticMarkup(React.createElement(TicketCommunicationQueueCard, {
      loading: false,
      busy: false,
      queue: {
        nextRunAt: '2026-08-29T12:00:00.000Z',
        next: [],
        sent: [],
        counts: { next: 0, sent: 0 },
      },
      onRefresh: () => undefined,
      onRunPending: () => undefined,
    }));

    expect(errorHtml).toContain('Não foi possível carregar a próxima rodada');
    expect(emptyHtml).toContain('Nenhum aviso pendente agora');
    expect(emptyHtml).toContain('Nenhum envio recente');
    expect(emptyHtml).not.toContain('Não foi possível carregar a próxima rodada');
  });

  it('mostra avatar, solicitante e agrupamento por dia', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationQueueCard, {
      loading: false,
      busy: false,
      queue: {
        nextRunAt: '2026-08-31T12:00:00.000Z',
        next: [{
          ticketId: '11111111-1111-1111-1111-111111111111',
          ticketTitle: 'Acesso VPN',
          requesterId: '22222222-2222-2222-2222-222222222222',
          requesterName: 'Samuel Silva',
          requesterEmail: 'samuel.silva@bpplaw.com.br',
          notificationType: 'awaiting_requester',
          channel: 'teams',
          cycleKey: '2026-08-31',
          status: 'pending',
          sentAt: null,
          lastError: null,
        }],
        sent: [{
          ticketId: '33333333-3333-3333-3333-333333333333',
          ticketTitle: 'Notebook',
          requesterId: '44444444-4444-4444-4444-444444444444',
          requesterName: 'Ana Costa',
          requesterEmail: 'ana.costa@bpplaw.com.br',
          notificationType: 'awaiting_feedback',
          channel: 'email',
          cycleKey: '2026-07-12',
          status: 'sent',
          sentAt: '2026-07-12T12:00:00.000-03:00',
          lastError: null,
        }],
        counts: { next: 1, sent: 1 },
      },
      onRefresh: () => undefined,
      onRunPending: () => undefined,
    }));

    expect(html).toContain('Samuel Silva');
    expect(html).toContain('SS');
    expect(html).toContain('Ana Costa');
    expect(html).toContain('AC');
    expect(html).toContain('Acesso VPN');
    expect(html).toContain('Notebook');
    expect(html).toContain('12 de julho');
    expect(html).toContain('Julho de 2026');
    expect(html).toContain('bg-[#DE5532]/10');
    expect(html).toContain('bg-[#5B5FC7]/10');
    expect(html).toContain('bg-[#BD2D29]/10');
    expect(html).toContain('bg-sky-50');
    expect(html).toContain('Todos os canais');
    expect(html).toContain('Enviado às');
    expect(html).toContain('Buscar chamado ou solicitante');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Abrir chamado');
  });

  it('oferece reenvio individual do aviso que falhou', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationQueueCard, {
      loading: false,
      busy: false,
      queue: {
        nextRunAt: '2026-08-31T12:00:00.000Z',
        next: [{
          ticketId: '11111111-1111-1111-1111-111111111111',
          ticketTitle: 'Acesso VPN',
          requesterId: '22222222-2222-2222-2222-222222222222',
          requesterName: 'Samuel Silva',
          requesterEmail: 'samuel.silva@bpplaw.com.br',
          notificationType: 'awaiting_requester',
          channel: 'teams',
          cycleKey: '2026-08-31',
          status: 'failed',
          sentAt: null,
          lastError: 'entra_user_not_found',
        }],
        sent: [],
        counts: { next: 1, sent: 0 },
      },
      onRefresh: () => undefined,
      onRunPending: () => undefined,
    }));

    expect(html).toContain('Reenviar');
    expect(html).toContain('Usuário não encontrado no Microsoft 365');
  });

  it('mostra a fila de avisos enviados, a próxima rodada e o envio manual', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Fila de avisos');
    expect(html).toContain('Próxima rodada');
    expect(html).toContain('Enviados');
    expect(html).toContain('Enviar pendentes agora');
  });

  it('mostra o prazo de cada aviso, sem o editor de horas', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationsTab));

    expect(html).toContain('Assim que o chamado é finalizado');
    expect(html).toContain('Após 48 horas');
    expect(html).toContain('Após 72 horas');
    expect(html).not.toContain('Salvar prazos');
    expect(html).not.toContain('schedule-awaiting_requester-hours');
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
