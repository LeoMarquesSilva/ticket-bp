import { describe, expect, it } from 'vitest';
import {
  buildQueuePreview,
  nextDailyRunAt,
} from '../../supabase/functions/notify-ticket-communications/_shared/queuePreview.mjs';

const now = new Date('2026-08-28T20:00:00.000Z');
const requesterId = '22222222-2222-2222-2222-222222222222';
const supportId = '33333333-3333-3333-3333-333333333333';
const ticketId = '11111111-1111-1111-1111-111111111111';

const awaitingTicket = {
  id: ticketId,
  title: 'Acesso ao sistema',
  status: 'in_progress',
  created_by: requesterId,
  category: 'ti',
  subcategory: 'acesso',
  resolved_at: null,
  feedback_submitted_at: null,
};

const candidate = {
  enabledAt: '2026-08-01T00:00:00.000Z',
  ticket: awaitingTicket,
  requester: { id: requesterId, name: 'Samuel Silva', email: 'samuel.silva@bpplaw.com.br' },
  lastHumanMessage: { user_id: supportId, created_at: '2026-08-26T20:00:00.000Z' },
};

describe('nextDailyRunAt', () => {
  it('marca a próxima rotina às 9h de Brasília no dia seguinte quando o horário já passou', () => {
    expect(nextDailyRunAt(now).toISOString()).toBe('2026-08-29T12:00:00.000Z');
  });
});

describe('buildQueuePreview', () => {
  it('coloca na próxima rodada o aviso elegível que ainda não saiu neste ciclo', () => {
    const preview = buildQueuePreview({
      now,
      candidates: [candidate],
      deliveries: [],
      schedule: {},
    });

    expect(preview.next).toEqual([
      expect.objectContaining({
        ticketId,
        ticketTitle: 'Acesso ao sistema',
        requesterName: 'Samuel Silva',
        requesterEmail: 'samuel.silva@bpplaw.com.br',
        notificationType: 'awaiting_requester',
        channel: 'email',
        cycleKey: '2026-08-28',
        status: 'pending',
      }),
      expect.objectContaining({
        notificationType: 'awaiting_requester',
        channel: 'teams',
        status: 'pending',
      }),
    ]);
    expect(preview.sent).toEqual([]);
    expect(preview.counts).toEqual({ next: 2, sent: 0 });
  });

  it('não recoloca na fila um aviso já enviado neste ciclo e lista o histórico', () => {
    const preview = buildQueuePreview({
      now,
      candidates: [candidate],
      deliveries: [{
        ticketId,
        ticketTitle: 'Acesso ao sistema',
        requesterName: 'Samuel Silva',
        requesterEmail: 'samuel.silva@bpplaw.com.br',
        notificationType: 'awaiting_requester',
        channel: 'email',
        cycleKey: '2026-08-28',
        status: 'sent',
        sentAt: '2026-08-28T12:05:00.000Z',
        lastError: null,
      }],
      schedule: {},
    });

    expect(preview.next.map((item) => item.channel)).toEqual(['teams']);
    expect(preview.sent).toEqual([
      expect.objectContaining({
        channel: 'email',
        status: 'sent',
        sentAt: '2026-08-28T12:05:00.000Z',
      }),
    ]);
  });

  it('mantém falha recente na próxima rodada para reenvio', () => {
    const preview = buildQueuePreview({
      now,
      candidates: [candidate],
      deliveries: [{
        ticketId,
        ticketTitle: 'Acesso ao sistema',
        requesterName: 'Samuel Silva',
        requesterEmail: 'samuel.silva@bpplaw.com.br',
        notificationType: 'awaiting_requester',
        channel: 'teams',
        cycleKey: '2026-08-28',
        status: 'failed',
        sentAt: null,
        lastError: 'entra_user_not_found',
      }],
      schedule: {},
    });

    expect(preview.next.find((item) => item.channel === 'teams')).toEqual(
      expect.objectContaining({
        status: 'failed',
        lastError: 'entra_user_not_found',
      }),
    );
  });

  it('inclui envios recentes mesmo quando o chamado já saiu da fila de candidatos', () => {
    const preview = buildQueuePreview({
      now,
      candidates: [],
      deliveries: [{
        ticketId,
        ticketTitle: 'Notebook novo',
        requesterName: 'Ana',
        requesterEmail: 'ana@bpplaw.com.br',
        notificationType: 'resolved_feedback_invite',
        channel: 'email',
        cycleKey: '2026-08-27T12:00:00.000Z',
        status: 'sent',
        sentAt: '2026-08-27T12:01:00.000Z',
        lastError: null,
      }],
      schedule: {},
    });

    expect(preview.next).toEqual([]);
    expect(preview.sent).toEqual([
      expect.objectContaining({
        ticketTitle: 'Notebook novo',
        notificationType: 'resolved_feedback_invite',
      }),
    ]);
  });
});
