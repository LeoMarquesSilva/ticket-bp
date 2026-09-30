import { buildTicketAssignedTeamsContent } from './templates.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAssignmentNotificationId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function sanitizeError(error) {
  if (error?.code === 'entra_user_not_found') return error.code;
  if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) {
    return `graph_http_${error.status}`;
  }
  if (typeof error?.code === 'string' && /^[a-z_]{1,64}$/.test(error.code)) return error.code;
  return 'delivery_error';
}

/**
 * Envia no Teams o aviso de "chamado atribuído" ao novo responsável.
 * A linha é reivindicada de forma atômica (pending → processing), então
 * chamadas repetidas para o mesmo aviso não duplicam a mensagem.
 */
export async function processTicketAssignmentNotification({
  repository,
  graph,
  appBaseUrl,
  headerImageUrl,
  notificationId,
}) {
  const claimed = await repository.claim(notificationId);
  if (!claimed) return { outcome: 'not_pending' };

  const finish = async (outcome, error = null) => {
    await repository.complete(claimed.id, outcome, error);
    return error ? { outcome, error } : { outcome };
  };

  if (claimed.ticket_current_assignee_id !== claimed.assignee_id) {
    return finish('skipped', 'reassigned_before_delivery');
  }
  if (!claimed.assignee_is_active) return finish('skipped', 'assignee_inactive');

  const email = typeof claimed.assignee_email === 'string' ? claimed.assignee_email.trim() : '';
  if (!EMAIL_PATTERN.test(email)) return finish('failed', 'invalid_assignee_email');

  try {
    const recipientUserId = await graph.resolveUserId(email);
    if (!recipientUserId) {
      const error = new Error('Usuário Microsoft Entra não encontrado');
      error.code = 'entra_user_not_found';
      throw error;
    }
    const content = buildTicketAssignedTeamsContent({
      ticket: { id: claimed.ticket_id, title: claimed.ticket_title },
      assignee: { name: claimed.assignee_name, email },
      assignedByName: claimed.assigned_by_name,
      requesterName: claimed.requester_name,
      appBaseUrl,
      headerImageUrl,
    });
    await graph.sendTeamsChat({ recipientUserId, ...content });
  } catch (error) {
    return finish('failed', sanitizeError(error));
  }

  return finish('sent');
}
