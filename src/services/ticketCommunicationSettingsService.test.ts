import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getValue, setValue } = vi.hoisted(() => ({
  getValue: vi.fn(),
  setValue: vi.fn(),
}));

vi.mock('./integrationSettingsService', () => ({
  IntegrationSettingsService: { getValue, setValue },
}));

import {
  parseTicketCommunicationSettings,
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
});
