export const NPS_EXEMPT_CATEGORY_KEY = 'validacao_de_indicadores';
export const NPS_EXEMPT_SUBCATEGORY_KEY = 'auditoria_de_excludentes_envio_de_evidencia';

const ACTIVE = new Set(['open', 'assigned', 'in_progress']);
const HOUR_MS = 60 * 60 * 1000;
export const SCHEDULE_DELAY_HOURS_MAX = 720;

export const SCHEDULE_DEFAULTS = Object.freeze({
  resolved_feedback_invite: Object.freeze({ enabled: true, delayHours: 0 }),
  awaiting_requester: Object.freeze({ enabled: true, delayHours: 48 }),
  awaiting_feedback: Object.freeze({ enabled: true, delayHours: 72 }),
});

export function normalizeSchedule(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = {};
  for (const type of Object.keys(SCHEDULE_DEFAULTS)) {
    const fallback = SCHEDULE_DEFAULTS[type];
    const input = source[type];
    const rawHours = Number(input?.delayHours);
    normalized[type] = {
      enabled: typeof input?.enabled === 'boolean' ? input.enabled : fallback.enabled,
      delayHours: Number.isInteger(rawHours) && rawHours >= 0 && rawHours <= SCHEDULE_DELAY_HOURS_MAX
        ? rawHours
        : fallback.delayHours,
    };
  }
  return normalized;
}

export function formatScheduleCaption(type, item) {
  if (!item?.enabled) return 'Desativada';
  if (item.delayHours === 0) {
    return type === 'resolved_feedback_invite'
      ? 'Assim que o chamado é finalizado'
      : 'Imediatamente';
  }
  return item.delayHours === 1 ? 'Após 1 hora' : `Após ${item.delayHours} horas`;
}

export function latestHumanMessage(messages) {
  return [...messages]
    .filter((message) => message?.is_system !== true)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export function getEligibleNotificationTypes({ now, enabledAt, ticket, lastHumanMessage, schedule }) {
  const types = [];
  const nowMs = now.getTime();
  const rules = normalizeSchedule(schedule);

  if (
    rules.awaiting_requester.enabled &&
    ACTIVE.has(ticket.status) &&
    lastHumanMessage &&
    lastHumanMessage.user_id !== ticket.created_by &&
    nowMs - Date.parse(lastHumanMessage.created_at) >= rules.awaiting_requester.delayHours * HOUR_MS
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
    if (
      rules.resolved_feedback_invite.enabled
      && nowMs - resolvedMs >= rules.resolved_feedback_invite.delayHours * HOUR_MS
    ) {
      types.push('resolved_feedback_invite');
    }
    if (
      rules.awaiting_feedback.enabled
      && nowMs - resolvedMs >= rules.awaiting_feedback.delayHours * HOUR_MS
    ) {
      types.push('awaiting_feedback');
    }
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
