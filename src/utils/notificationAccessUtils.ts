/**
 * Regras centralizadas de quem recebe notificação.
 *
 * MENSAGEM  → somente participantes do ticket (solicitante + responsável).
 * NOVO TICKET → participantes + equipe da frente (quando sem responsável) + admins.
 * ATRIBUIÇÃO  → somente o novo responsável.
 *
 * Não duplique essa lógica em outros arquivos — importe daqui.
 */

export type TicketNotifyContext = {
  assignee: string | null;
  requester: string | null;
  category: string;
};

export type NotifyAccessOptions = {
  isFrenteRestricted: boolean;
  userCategoryKeys: string[];
  canViewAllTickets: boolean;
  strictFrenteOnly?: boolean;
  assignedOnly?: boolean;
};

export function normalizeNotifyUserId(value?: string | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

/** Participante direto do ticket (solicitante ou responsável). */
export function isTicketParticipant(
  ctx: Pick<TicketNotifyContext, 'assignee' | 'requester'>,
  userId: string
): boolean {
  const uid = normalizeNotifyUserId(userId);
  if (!uid) return false;
  return ctx.requester === uid || ctx.assignee === uid;
}

/**
 * IDs que devem receber push/toast de nova mensagem.
 * Exclui o remetente da mensagem.
 */
export function getMessageRecipientUserIds(
  ctx: Pick<TicketNotifyContext, 'assignee' | 'requester'>,
  senderUserId?: string | null
): string[] {
  const sender = normalizeNotifyUserId(senderUserId);
  const recipients = new Set<string>();

  const requester = normalizeNotifyUserId(ctx.requester);
  const assignee = normalizeNotifyUserId(ctx.assignee);

  if (requester && requester !== sender) recipients.add(requester);
  if (assignee && assignee !== sender) recipients.add(assignee);

  return [...recipients];
}

/**
 * Mensagem: APENAS participantes do ticket.
 * Frente, admin e permissões amplas NÃO ampliam o alcance de mensagens.
 */
export function shouldNotifyMessage(
  ctx: TicketNotifyContext,
  userId: string
): boolean {
  return isTicketParticipant(ctx, userId);
}

/** Novo ticket atribuído diretamente ao usuário. */
export function shouldNotifyTicketAssigned(
  newAssignee: string | null,
  previousAssignee: string | null,
  userId: string
): boolean {
  const uid = normalizeNotifyUserId(userId);
  const next = normalizeNotifyUserId(newAssignee);
  const prev = normalizeNotifyUserId(previousAssignee);
  return Boolean(uid && next === uid && prev !== uid);
}

/**
 * Novo ticket criado: participantes + equipe da frente (sem responsável) + admins.
 */
export function shouldNotifyNewTicket(
  ctx: TicketNotifyContext & { isUnassigned: boolean },
  userId: string,
  options: NotifyAccessOptions & { isStaff: boolean }
): boolean {
  if (isTicketParticipant(ctx, userId)) return true;

  if (options.canViewAllTickets) return true;

  if (options.assignedOnly) {
    return ctx.assignee === userId;
  }

  if (options.strictFrenteOnly) {
    return options.userCategoryKeys.includes(ctx.category);
  }

  if (!ctx.isUnassigned || !options.isStaff) return false;

  if (options.isFrenteRestricted) {
    return options.userCategoryKeys.includes(ctx.category);
  }

  return true;
}
