import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getValue, setValue } = vi.hoisted(() => ({
  getValue: vi.fn(),
  setValue: vi.fn(),
}));

vi.mock('./integrationSettingsService', () => ({
  IntegrationSettingsService: { getValue, setValue },
}));

import {
  parseTicketCommunicationSchedule,
  parseTicketCommunicationSettings,
  parseTicketCommunicationTeamsSettings,
  TicketCommunicationSettingsService,
} from './ticketCommunicationSettingsService';

describe('ticket communication settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna vazio quando o JSON está ausente, inválido ou em versão desconhecida', () => {
    expect(parseTicketCommunicationSettings(null)).toEqual({});
    expect(parseTicketCommunicationSettings('{')).toEqual({});
    expect(parseTicketCommunicationSettings('{"version":2,"templates":{}}')).toEqual({});
  });

  it('remove campos não permitidos e valores acima do limite', () => {
    const value = JSON.stringify({ version: 1, templates: {
      awaiting_requester: {
        subject: 'Precisamos de sua resposta',
        reason: 'x'.repeat(321),
        action: 'Responder agora',
        recipient: 'outra-pessoa@example.com',
        html: '<script>alert(1)</script>',
      },
    }});

    expect(parseTicketCommunicationSettings(value)).toEqual({
      awaiting_requester: { subject: 'Precisamos de sua resposta', action: 'Responder agora' },
    });
  });

  it('persiste envelope versionado contendo somente templates saneados', async () => {
    await TicketCommunicationSettingsService.save({
      awaiting_feedback: { subject: 'Sua avaliação está pendente', reason: 'Avalie quando puder.', action: 'Avaliar' },
    });

    expect(setValue).toHaveBeenCalledWith(
      'ticket_communication_email_templates_v1',
      '{"version":1,"templates":{"awaiting_feedback":{"subject":"Sua avaliação está pendente","reason":"Avalie quando puder.","action":"Avaliar"}}}',
    );
  });

  it('carrega e normaliza a configuração salva', async () => {
    getValue.mockResolvedValue('{"version":1,"templates":{"resolved_feedback_invite":{"action":"Dar minha opinião"}}}');

    await expect(TicketCommunicationSettingsService.get()).resolves.toEqual({
      resolved_feedback_invite: { action: 'Dar minha opinião' },
    });
  });

  it('persiste e carrega os textos do Teams em chave própria', async () => {
    expect(parseTicketCommunicationTeamsSettings(null)).toEqual({});
    expect(parseTicketCommunicationTeamsSettings('{"version":1,"templates":{"awaiting_requester":{"action":"Abrir no Teams","html":"<script>"}}}')).toEqual({
      awaiting_requester: { action: 'Abrir no Teams' },
    });

    await TicketCommunicationSettingsService.saveTeams({
      awaiting_feedback: { subject: 'Avalie no Teams', reason: 'Sua opinião ajuda.', action: 'Avaliar' },
    });

    expect(setValue).toHaveBeenCalledWith(
      'ticket_communication_teams_templates_v1',
      '{"version":1,"templates":{"awaiting_feedback":{"subject":"Avalie no Teams","reason":"Sua opinião ajuda.","action":"Avaliar"}}}',
    );

    getValue.mockResolvedValue('{"version":1,"templates":{"resolved_feedback_invite":{"reason":"Chamado encerrado."}}}');
    await expect(TicketCommunicationSettingsService.getTeams()).resolves.toEqual({
      resolved_feedback_invite: { reason: 'Chamado encerrado.' },
    });
  });

  it('persiste e carrega os prazos das mensagens automáticas', async () => {
    expect(parseTicketCommunicationSchedule(null)).toEqual({
      resolved_feedback_invite: { enabled: true, delayHours: 0 },
      awaiting_requester: { enabled: true, delayHours: 48 },
      awaiting_feedback: { enabled: true, delayHours: 72 },
    });
    expect(parseTicketCommunicationSchedule('{"version":1,"schedule":{"awaiting_requester":{"enabled":false,"delayHours":24,"cron":"*"}}}')).toEqual({
      resolved_feedback_invite: { enabled: true, delayHours: 0 },
      awaiting_requester: { enabled: false, delayHours: 24 },
      awaiting_feedback: { enabled: true, delayHours: 72 },
    });

    await TicketCommunicationSettingsService.saveSchedule({
      awaiting_requester: { enabled: false, delayHours: 24 },
      awaiting_feedback: { enabled: true, delayHours: 96, extra: true },
    });

    expect(setValue).toHaveBeenCalledWith(
      'ticket_communication_schedule_v1',
      '{"version":1,"schedule":{"resolved_feedback_invite":{"enabled":true,"delayHours":0},"awaiting_requester":{"enabled":false,"delayHours":24},"awaiting_feedback":{"enabled":true,"delayHours":96}}}',
    );

    getValue.mockResolvedValue('{"version":1,"schedule":{"awaiting_feedback":{"enabled":true,"delayHours":12}}}');
    await expect(TicketCommunicationSettingsService.getSchedule()).resolves.toEqual({
      resolved_feedback_invite: { enabled: true, delayHours: 0 },
      awaiting_requester: { enabled: true, delayHours: 48 },
      awaiting_feedback: { enabled: true, delayHours: 12 },
    });
  });
});
