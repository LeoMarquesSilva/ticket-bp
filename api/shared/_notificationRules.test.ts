import { describe, expect, it } from 'vitest';
import {
  getMessageRecipientUserIds,
  getNewTicketRecipientUserIds,
  shouldNotifyNewTicket,
  shouldNotifyTicketAssigned,
} from './notificationRules.mjs';

const MARKETING_CATEGORY = 'formularios_marketing';
const PEOPLE_CATEGORY = 'formularios_requisicao_movimentacao';

describe('notificationRules - mensagens', () => {
  it('notifica apenas solicitante/responsável e exclui remetente', () => {
    const ctx = { requester: 'u-requester', assignee: 'u-assignee' };
    expect(getMessageRecipientUserIds(ctx, 'u-requester')).toEqual(['u-assignee']);
    expect(getMessageRecipientUserIds(ctx, 'u-assignee')).toEqual(['u-requester']);
    expect(getMessageRecipientUserIds(ctx, 'u-other').sort()).toEqual(['u-assignee', 'u-requester'].sort());
  });
});

describe('notificationRules - novo ticket', () => {
  it('replica semântica de novo ticket para usuário de frente', () => {
    const ctx = {
      requester: 'u-requester',
      assignee: null,
      category: MARKETING_CATEGORY,
      isUnassigned: true,
    };
    const options = {
      canViewAllTickets: false,
      assignedOnly: false,
      strictFrenteOnly: false,
      isFrenteRestricted: true,
      userCategoryKeys: [MARKETING_CATEGORY],
      isStaff: true,
    };
    expect(shouldNotifyNewTicket(ctx, 'u-staff-marketing', options)).toBe(true);
  });

  it('não inclui criador no push de novo ticket', () => {
    const users = [
      { id: 'u-requester', role: 'admin', tag_id: null },
      { id: 'u-admin', role: 'admin', tag_id: null },
    ];
    const permissionsByUserId = new Map<string, Set<string>>([
      ['u-requester', new Set(['view_all_tickets'])],
      ['u-admin', new Set(['view_all_tickets'])],
    ]);
    const recipients = getNewTicketRecipientUserIds(
      {
        requester: 'u-requester',
        assignee: null,
        category: PEOPLE_CATEGORY,
        isUnassigned: true,
      },
      {
        senderUserId: 'u-requester',
        users,
        permissionsByUserId,
        categoryKeysByTagId: new Map(),
        tagIdByKey: new Map(),
      }
    );
    expect(recipients).toEqual(['u-admin']);
  });
});

describe('notificationRules - ticket reatribuído', () => {
  it('notifica o novo responsável quando a atribuição muda', () => {
    expect(shouldNotifyTicketAssigned('u-new', 'u-old')).toBe(true);
  });

  it('não notifica quando o responsável não mudou', () => {
    expect(shouldNotifyTicketAssigned('u-same', 'u-same')).toBe(false);
  });

  it('não notifica quando o ticket ficou sem responsável', () => {
    expect(shouldNotifyTicketAssigned(null, 'u-old')).toBe(false);
  });
});
