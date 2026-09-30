import { describe, expect, it, vi } from 'vitest';
import {
  isValidAssignmentNotificationId,
  processTicketAssignmentNotification,
} from '../../supabase/functions/notify-ticket-communications/_shared/assignment.mjs';
import { buildTicketAssignedTeamsContent } from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';

const NOTIFICATION_ID = '22222222-2222-2222-2222-222222222222';
const TICKET_ID = '11111111-1111-1111-1111-111111111111';
const ASSIGNEE_ID = '33333333-3333-3333-3333-333333333333';

function claimedRow(overrides = {}) {
  return {
    id: NOTIFICATION_ID,
    ticket_id: TICKET_ID,
    ticket_title: 'Acesso ao sistema',
    ticket_current_assignee_id: ASSIGNEE_ID,
    assignee_id: ASSIGNEE_ID,
    assignee_name: 'Giovanna Pereira',
    assignee_email: 'giovanna@example.com',
    assignee_is_active: true,
    assigned_by_name: 'Leonardo Marques',
    requester_name: 'Ana Souza',
    ...overrides,
  };
}

function setup(row: Record<string, unknown> | null = claimedRow()) {
  const repository = {
    claim: vi.fn().mockResolvedValue(row),
    complete: vi.fn().mockResolvedValue(true),
  };
  const graph = {
    resolveUserId: vi.fn().mockResolvedValue('entra-user-id'),
    sendTeamsChat: vi.fn().mockResolvedValue(undefined),
  };
  const run = () => processTicketAssignmentNotification({
    repository,
    graph,
    appBaseUrl: 'https://responsum.example',
    notificationId: NOTIFICATION_ID,
  });
  return { repository, graph, run };
}

describe('processTicketAssignmentNotification', () => {
  it('envia o card no Teams para o novo responsável e marca como enviado', async () => {
    const { repository, graph, run } = setup();

    await expect(run()).resolves.toEqual({ outcome: 'sent' });

    expect(graph.resolveUserId).toHaveBeenCalledWith('giovanna@example.com');
    const message = graph.sendTeamsChat.mock.calls[0][0];
    expect(message.recipientUserId).toBe('entra-user-id');
    expect(message.ticketUrl).toBe(`https://responsum.example/tickets/${TICKET_ID}`);
    expect(message.previewText).toBe('Leonardo Marques transferiu este chamado para o seu atendimento.');
    expect(JSON.stringify(message.card)).toContain('CHAMADO ATRIBUÍDO');
    expect(repository.complete).toHaveBeenCalledWith(NOTIFICATION_ID, 'sent', null);
  });

  it('usa o texto de continuação para chamado vinculado', async () => {
    const { graph, run } = setup(claimedRow({
      reason: 'linked',
      linked_from_title: 'Acesso ao sistema (original)',
      assigned_by_name: 'Ana Souza',
    }));

    await expect(run()).resolves.toEqual({ outcome: 'sent' });
    const message = graph.sendTeamsChat.mock.calls[0][0];
    expect(message.previewText).toBe(
      'Ana Souza abriu uma continuação do chamado "Acesso ao sistema (original)", que você atendeu.',
    );
    expect(JSON.stringify(message.card)).toContain('CHAMADO VINCULADO');
  });

  it('não envia nada quando o aviso já foi processado', async () => {
    const { repository, graph, run } = setup(null);

    await expect(run()).resolves.toEqual({ outcome: 'not_pending' });
    expect(graph.sendTeamsChat).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('ignora quando o ticket já foi transferido para outra pessoa', async () => {
    const { repository, graph, run } = setup(claimedRow({
      ticket_current_assignee_id: '44444444-4444-4444-4444-444444444444',
    }));

    await expect(run()).resolves.toEqual({ outcome: 'skipped', error: 'reassigned_before_delivery' });
    expect(graph.sendTeamsChat).not.toHaveBeenCalled();
    expect(repository.complete).toHaveBeenCalledWith(NOTIFICATION_ID, 'skipped', 'reassigned_before_delivery');
  });

  it('ignora responsável inativo', async () => {
    const { graph, run } = setup(claimedRow({ assignee_is_active: false }));

    await expect(run()).resolves.toEqual({ outcome: 'skipped', error: 'assignee_inactive' });
    expect(graph.sendTeamsChat).not.toHaveBeenCalled();
  });

  it('registra falha quando o usuário não existe no Entra', async () => {
    const { repository, graph, run } = setup();
    graph.resolveUserId.mockResolvedValue(null);

    await expect(run()).resolves.toEqual({ outcome: 'failed', error: 'entra_user_not_found' });
    expect(repository.complete).toHaveBeenCalledWith(NOTIFICATION_ID, 'failed', 'entra_user_not_found');
  });

  it('registra o código do erro quando a conta do Teams não está conectada', async () => {
    const { graph, run } = setup();
    graph.sendTeamsChat.mockRejectedValue(Object.assign(new Error('x'), { code: 'teams_not_connected' }));

    await expect(run()).resolves.toEqual({ outcome: 'failed', error: 'teams_not_connected' });
  });

  it('registra falha com e-mail inválido sem chamar o Graph', async () => {
    const { graph, run } = setup(claimedRow({ assignee_email: '' }));

    await expect(run()).resolves.toEqual({ outcome: 'failed', error: 'invalid_assignee_email' });
    expect(graph.resolveUserId).not.toHaveBeenCalled();
  });
});

describe('buildTicketAssignedTeamsContent', () => {
  it('usa texto neutro quando não se sabe quem transferiu', () => {
    const content = buildTicketAssignedTeamsContent({
      ticket: { id: TICKET_ID, title: 'Acesso' },
      assignee: { name: 'Giovanna Pereira' },
      appBaseUrl: 'https://responsum.example',
    });

    expect(content.previewText).toBe('Este chamado foi atribuído ao seu atendimento.');
    expect(JSON.stringify(content.card)).toContain('Olá, Giovanna.');
  });
});

describe('isValidAssignmentNotificationId', () => {
  it('aceita apenas UUIDs', () => {
    expect(isValidAssignmentNotificationId(NOTIFICATION_ID)).toBe(true);
    expect(isValidAssignmentNotificationId('abc')).toBe(false);
    expect(isValidAssignmentNotificationId(undefined)).toBe(false);
  });
});
