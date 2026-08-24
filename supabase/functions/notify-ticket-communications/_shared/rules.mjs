export const NPS_EXEMPT_CATEGORY_KEY = 'validacao_de_indicadores';
export const NPS_EXEMPT_SUBCATEGORY_KEY = 'auditoria_de_excludentes_envio_de_evidencia';

const ACTIVE = new Set(['open', 'assigned', 'in_progress']);
const HOURS_48 = 48 * 60 * 60 * 1000;
const HOURS_72 = 72 * 60 * 60 * 1000;

export function latestHumanMessage(messages) {
  return [...messages]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export function getEligibleNotificationTypes({ now, enabledAt, ticket, lastHumanMessage }) {
  const types = [];
  const nowMs = now.getTime();

  if (
    ACTIVE.has(ticket.status) &&
    lastHumanMessage &&
    lastHumanMessage.user_id !== ticket.created_by &&
    nowMs - Date.parse(lastHumanMessage.created_at) >= HOURS_48
  ) {
    types.push('awaiting_requester');
  }

  const exempt =
    ticket.category === NPS_EXEMPT_CATEGORY_KEY &&
    ticket.subcategory === NPS_EXEMPT_SUBCATEGORY_KEY;
  const resolvedMs = ticket.resolved_at ? Date.parse(ticket.resolved_at) : Number.NaN;

  if (
    ticket.status === 'resolved' &&
    !exempt &&
    !ticket.feedback_submitted_at &&
    resolvedMs >= enabledAt.getTime()
  ) {
    types.push('resolved_feedback_invite');
    if (nowMs - resolvedMs >= HOURS_72) types.push('awaiting_feedback');
  }

  return types;
}

export function channelsForNotification(type) {
  return type === 'resolved_feedback_invite' ? ['email'] : ['email', 'teams'];
}

export function localCycleKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
