import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/ticketCommunicationSettingsService', () => ({
  TicketCommunicationSettingsService: {
    getSchedule: vi.fn(async () => ({
      resolved_feedback_invite: { enabled: true, delayHours: 0 },
      awaiting_requester: { enabled: true, delayHours: 48 },
      awaiting_feedback: { enabled: true, delayHours: 72 },
    })),
    saveSchedule: vi.fn(),
  },
}));

import TicketCommunicationScheduleTab from './TicketCommunicationScheduleTab';

describe('TicketCommunicationScheduleTab', () => {
  it('permite configurar quando cada mensagem automática é enviada', () => {
    const html = renderToStaticMarkup(React.createElement(TicketCommunicationScheduleTab));

    expect(html).toContain('Quando enviar');
    expect(html).toContain('Assim que o chamado é finalizado');
    expect(html).toContain('Após 48 horas');
    expect(html).toContain('Após 72 horas');
    expect(html).toContain('Salvar prazos');
    expect(html).toContain('schedule-awaiting_requester-hours');
  });
});
