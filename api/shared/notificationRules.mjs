/**
 * Regras de notificação para backend/push.
 * Mantém paridade com a semântica principal do frontend.
 */

const LOCKED_FRENTE_BY_ROLE = {
  lawyer: 'juridico',
  advogado: 'juridico',
};

const ROLE_FRENTE_KEY_FALLBACK = {
  support: 'juridico',
  suporte: 'juridico',
  ti: 'tecnologia_informacao',
};

const ASSIGNED_ONLY_ROLES = new Set(['support', 'suporte']);

function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

export function normalizeNotifyUserId(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function isTicketParticipant(ctx, userId) {
  const uid = normalizeNotifyUserId(userId);
  if (!uid) return false;
  return ctx.requester === uid || ctx.assignee === uid;
}

/** Ticket reatribuído: notifica apenas o novo responsável (espelha o frontend). */
export function shouldNotifyTicketAssigned(newAssignee, previousAssignee) {
  const next = normalizeNotifyUserId(newAssignee);
  const prev = normalizeNotifyUserId(previousAssignee);
  return Boolean(next && next !== prev);
}

export function shouldNotifyNewTicket(ctx, userId, options) {
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

export function getMessageRecipientUserIds(ctx, senderUserId) {
  const sender = normalizeNotifyUserId(senderUserId);
  const recipients = new Set();

  const requester = normalizeNotifyUserId(ctx.requester);
  const assignee = normalizeNotifyUserId(ctx.assignee);

  if (requester && requester !== sender) recipients.add(requester);
  if (assignee && assignee !== sender) recipients.add(assignee);

  return [...recipients];
}

function buildUserCategoryKeys(user, categoryKeysByTagId, tagIdByKey) {
  const role = normalizeRole(user?.role);
  const lockedTagKey = LOCKED_FRENTE_BY_ROLE[role];
  if (lockedTagKey) {
    const lockedTagId = tagIdByKey.get(lockedTagKey);
    return lockedTagId ? (categoryKeysByTagId.get(lockedTagId) ?? []) : [];
  }

  const explicitTagId = normalizeNotifyUserId(user?.tag_id);
  if (explicitTagId) {
    return categoryKeysByTagId.get(explicitTagId) ?? [];
  }

  const fallbackTagKey = ROLE_FRENTE_KEY_FALLBACK[role];
  if (!fallbackTagKey) return [];
  const fallbackTagId = tagIdByKey.get(fallbackTagKey);
  return fallbackTagId ? (categoryKeysByTagId.get(fallbackTagId) ?? []) : [];
}

function buildNotifyAccessOptions(user, permissionSet, userCategoryKeys) {
  const role = normalizeRole(user?.role);
  const canViewAllTickets = permissionSet.has('view_all_tickets');
  const assignedOnly = ASSIGNED_ONLY_ROLES.has(role);
  const strictFrenteOnly = Boolean(LOCKED_FRENTE_BY_ROLE[role]);
  const isFrenteRestricted = !assignedOnly && permissionSet.has('view_frente_tickets') && !canViewAllTickets;
  const isStaffByRole = role === 'support' || role === 'lawyer' || role === 'admin' || role === 'advogado' || role === 'juridico' || role === 'jurídico';
  const isStaffByPermissions = permissionSet.has('assign_ticket') || permissionSet.has('view_all_tickets') || permissionSet.has('view_frente_tickets');

  return {
    canViewAllTickets,
    assignedOnly,
    strictFrenteOnly,
    isFrenteRestricted,
    userCategoryKeys,
    isStaff: isStaffByRole || isStaffByPermissions,
  };
}

/**
 * Resolve destinatários de novo ticket para push seguindo a mesma semântica do frontend:
 * participantes + equipe de frente (quando sem responsável) + admins.
 */
export function getNewTicketRecipientUserIds(ctx, params) {
  const sender = normalizeNotifyUserId(params?.senderUserId);
  const recipients = new Set();

  const users = params?.users ?? [];
  const permissionsByUserId = params?.permissionsByUserId ?? new Map();
  const categoryKeysByTagId = params?.categoryKeysByTagId ?? new Map();
  const tagIdByKey = params?.tagIdByKey ?? new Map();

  for (const user of users) {
    const userId = normalizeNotifyUserId(user?.id);
    if (!userId || userId === sender) continue;

    const permissionSet = permissionsByUserId.get(userId) ?? new Set();
    const userCategoryKeys = buildUserCategoryKeys(user, categoryKeysByTagId, tagIdByKey);
    const access = buildNotifyAccessOptions(user, permissionSet, userCategoryKeys);
    if (shouldNotifyNewTicket(ctx, userId, access)) {
      recipients.add(userId);
    }
  }

  return [...recipients];
}
