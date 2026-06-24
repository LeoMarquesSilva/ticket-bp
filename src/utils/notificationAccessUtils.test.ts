import { describe, expect, it } from 'vitest';
import {
  getMessageRecipientUserIds,
  isTicketParticipant,
  shouldNotifyMessage,
  shouldNotifyNewTicket,
  shouldNotifyTicketAssigned,
} from './notificationAccessUtils';

const LEONARDO = 'leonardo-id';
const MARIA = 'maria-heloiza-id';
const GIOVANA = 'giovana-id';
const ISADORA = 'isadora-id';
const MARKETING = 'marketing';

const frenteMarketingStaff = {
  isFrenteRestricted: true,
  userCategoryKeys: [MARKETING, 'comunicacao'],
  canViewAllTickets: false,
  strictFrenteOnly: false,
  assignedOnly: false,
  isStaff: true,
};

describe('mensagens — somente participantes', () => {
  const ticket = {
    assignee: LEONARDO,
    requester: ISADORA,
    category: MARKETING,
  };

  it('notifica solicitante e responsável', () => {
    expect(shouldNotifyMessage(ticket, LEONARDO)).toBe(true);
    expect(shouldNotifyMessage(ticket, ISADORA)).toBe(true);
  });

  it('NÃO notifica colega da mesma frente (Maria Heloiza / Marketing)', () => {
    expect(shouldNotifyMessage(ticket, MARIA)).toBe(false);
  });

  it('NÃO notifica outra pessoa da frente (Giovana no ticket da Isadora)', () => {
    expect(shouldNotifyMessage(ticket, GIOVANA)).toBe(false);
  });

  it('NÃO notifica admin com view_all_tickets', () => {
    expect(
      shouldNotifyMessage(ticket, 'admin-id')
    ).toBe(false);
  });

  it('getMessageRecipientUserIds exclui remetente', () => {
    expect(getMessageRecipientUserIds(ticket, LEONARDO)).toEqual([ISADORA]);
    expect(getMessageRecipientUserIds(ticket, ISADORA)).toEqual([LEONARDO]);
    expect(getMessageRecipientUserIds(ticket, MARIA).sort()).toEqual([LEONARDO, ISADORA].sort());
  });
});

describe('novo ticket — frente pode ser notificada', () => {
  const unassignedMarketing = {
    assignee: null,
    requester: ISADORA,
    category: MARKETING,
    isUnassigned: true,
  };

  it('equipe da frente recebe ticket sem responsável', () => {
    expect(
      shouldNotifyNewTicket(unassignedMarketing, MARIA, frenteMarketingStaff)
    ).toBe(true);
  });

  it('equipe de outra frente não recebe', () => {
    expect(
      shouldNotifyNewTicket(unassignedMarketing, MARIA, {
        ...frenteMarketingStaff,
        userCategoryKeys: ['juridico'],
      })
    ).toBe(false);
  });

  it('mensagem da frente NÃO segue a mesma regra ampla', () => {
    expect(
      shouldNotifyMessage(
        { assignee: LEONARDO, requester: ISADORA, category: MARKETING },
        MARIA
      )
    ).toBe(false);
  });
});

describe('atribuição de ticket', () => {
  it('notifica somente o novo responsável', () => {
    expect(shouldNotifyTicketAssigned(MARIA, null, MARIA)).toBe(true);
    expect(shouldNotifyTicketAssigned(MARIA, LEONARDO, MARIA)).toBe(true);
    expect(shouldNotifyTicketAssigned(MARIA, MARIA, MARIA)).toBe(false);
    expect(shouldNotifyTicketAssigned(MARIA, null, GIOVANA)).toBe(false);
  });
});

describe('isTicketParticipant', () => {
  it('identifica solicitante e responsável', () => {
    const ctx = { requester: ISADORA, assignee: LEONARDO };
    expect(isTicketParticipant(ctx, ISADORA)).toBe(true);
    expect(isTicketParticipant(ctx, LEONARDO)).toBe(true);
    expect(isTicketParticipant(ctx, MARIA)).toBe(false);
  });
});
