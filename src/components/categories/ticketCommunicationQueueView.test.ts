import { describe, expect, it } from 'vitest';
import { filterQueueItems, groupQueueItemsByMonthAndDay } from './ticketCommunicationQueueView';
import type { TicketCommunicationQueueItem } from '@/services/ticketCommunicationService';

const now = new Date('2026-08-31T13:00:00.000-03:00');

function item(patch: Partial<TicketCommunicationQueueItem>): TicketCommunicationQueueItem {
  return {
    ticketId: '11111111-1111-1111-1111-111111111111',
    ticketTitle: 'Acesso',
    requesterId: '22222222-2222-2222-2222-222222222222',
    requesterName: 'Samuel Silva',
    requesterEmail: 'samuel.silva@bpplaw.com.br',
    notificationType: 'awaiting_requester',
    channel: 'email',
    cycleKey: '2026-08-31',
    status: 'sent',
    sentAt: '2026-08-31T12:00:00.000Z',
    lastError: null,
    ...patch,
  };
}

describe('groupQueueItemsByMonthAndDay', () => {
  it('separa hoje, ontem e outro mês com rótulos em português', () => {
    const groups = groupQueueItemsByMonthAndDay([
      item({ ticketTitle: 'Hoje', sentAt: '2026-08-31T12:10:00.000-03:00' }),
      item({ ticketTitle: 'Ontem', sentAt: '2026-08-30T18:00:00.000-03:00' }),
      item({ ticketTitle: 'Julho', sentAt: '2026-07-12T09:00:00.000-03:00' }),
    ], now);

    expect(groups.map((group) => group.label)).toEqual(['Agosto de 2026', 'Julho de 2026']);
    expect(groups[0].days.map((day) => day.label)).toEqual(['Hoje', 'Ontem']);
    expect(groups[1].days[0].label).toBe('12 de julho');
    expect(groups[0].days[0].items[0].ticketTitle).toBe('Hoje');
  });
});

describe('filterQueueItems', () => {
  it('filtra por tipo de aviso e canal', () => {
    const items = [
      item({ ticketTitle: 'Teams pendente', channel: 'teams', notificationType: 'awaiting_requester' }),
      item({ ticketTitle: 'E-mail finalizado', channel: 'email', notificationType: 'resolved_feedback_invite' }),
    ];

    expect(filterQueueItems(items, { channel: 'teams' }).map((entry) => entry.ticketTitle))
      .toEqual(['Teams pendente']);
    expect(filterQueueItems(items, { type: 'resolved_feedback_invite' }).map((entry) => entry.ticketTitle))
      .toEqual(['E-mail finalizado']);
  });

  it('busca por título, nome ou e-mail do solicitante', () => {
    const items = [
      item({ ticketTitle: 'Acesso VPN', requesterName: 'Samuel Silva', requesterEmail: 'samuel.silva@bpplaw.com.br' }),
      item({ ticketTitle: 'Notebook', requesterName: 'Ana Costa', requesterEmail: 'ana.costa@bpplaw.com.br' }),
    ];

    expect(filterQueueItems(items, { query: 'vpn' }).map((entry) => entry.ticketTitle)).toEqual(['Acesso VPN']);
    expect(filterQueueItems(items, { query: 'ana costa' }).map((entry) => entry.ticketTitle)).toEqual(['Notebook']);
    expect(filterQueueItems(items, { query: 'samuel.silva' }).map((entry) => entry.ticketTitle)).toEqual(['Acesso VPN']);
  });
});
