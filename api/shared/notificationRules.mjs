/**
 * Espelho JS das regras em src/utils/notificationAccessUtils.ts (serverless / push).
 * Ao alterar regras de destinatário, atualize os dois arquivos e rode `pnpm test`.
 */

export function normalizeNotifyUserId(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function isTicketParticipant(ctx, userId) {
  const uid = normalizeNotifyUserId(userId);
  if (!uid) return false;
  return ctx.requester === uid || ctx.assignee === uid;
}

export function getMessageRecipientUserIds(ctx, senderUserId) {
  const sender = normalizeNotifyUserId(senderUserId);
  const recipients = new Set();

  const requester = normalizeNotifyUserId(ctx.requester);
  const assignee = normalizeNotifyUserId(ctx.assignee);

  if (requester && requester !== sender) recipients.add(requester);
  if (assignee && assignee !== sender) recipients.add(assignee);

  return [...recipients];
}

/** Novo ticket via push: somente participantes (sem broadcast para todos). */
export function getNewTicketRecipientUserIds(ctx) {
  const recipients = new Set();

  const requester = normalizeNotifyUserId(ctx.requester);
  const assignee = normalizeNotifyUserId(ctx.assignee);

  if (requester) recipients.add(requester);
  if (assignee) recipients.add(assignee);

  return [...recipients];
}
