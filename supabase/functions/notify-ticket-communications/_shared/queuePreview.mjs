import {
  channelsForNotification,
  getEligibleNotificationTypes,
  localCycleKey,
  normalizeSchedule,
} from './rules.mjs';

export const DAILY_RUN_UTC_HOUR = 12;

export function nextDailyRunAt(now) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    DAILY_RUN_UTC_HOUR,
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function deliveryKey(item) {
  return `${item.ticketId}:${item.notificationType}:${item.channel}:${item.cycleKey}`;
}

function previewItem({
  ticketId,
  ticketTitle,
  requesterName,
  requesterEmail,
  notificationType,
  channel,
  cycleKey,
  status = 'pending',
  sentAt = null,
  lastError = null,
}) {
  return {
    ticketId,
    ticketTitle: ticketTitle || 'Chamado',
    requesterName: requesterName || '',
    requesterEmail: requesterEmail || '',
    notificationType,
    channel,
    cycleKey,
    status,
    sentAt,
    lastError,
  };
}

export function buildQueuePreview({ now, candidates, deliveries, schedule }) {
  const known = new Map(
    (Array.isArray(deliveries) ? deliveries : [])
      .filter((item) => item?.ticketId && item.notificationType && item.channel && item.cycleKey)
      .map((item) => [deliveryKey(item), item]),
  );
  const next = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const ticket = candidate?.ticket;
    if (!ticket?.id) continue;
    const enabledAt = new Date(candidate.enabledAt);
    if (Number.isNaN(enabledAt.getTime())) continue;

    const types = getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket,
      lastHumanMessage: candidate.lastHumanMessage,
      schedule: normalizeSchedule(schedule),
    });

    for (const notificationType of types) {
      const cycleKey = notificationType === 'resolved_feedback_invite'
        ? ticket.resolved_at
        : localCycleKey(now);
      if (!cycleKey) continue;

      for (const channel of channelsForNotification(notificationType)) {
        const existing = known.get(deliveryKey({
          ticketId: ticket.id,
          notificationType,
          channel,
          cycleKey,
        }));
        if (existing?.status === 'sent') continue;
        next.push(previewItem({
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          requesterName: candidate.requester?.name,
          requesterEmail: candidate.requester?.email,
          notificationType,
          channel,
          cycleKey,
          status: existing?.status === 'failed' || existing?.status === 'processing'
            ? existing.status
            : 'pending',
          lastError: existing?.status === 'failed' ? existing.lastError ?? null : null,
        }));
      }
    }
  }

  const sent = (Array.isArray(deliveries) ? deliveries : [])
    .filter((item) => item?.status === 'sent')
    .sort((left, right) => Date.parse(right.sentAt ?? '') - Date.parse(left.sentAt ?? ''))
    .map((item) => previewItem(item));

  return {
    nextRunAt: nextDailyRunAt(now).toISOString(),
    next,
    sent,
    counts: {
      next: next.length,
      sent: sent.length,
    },
  };
}

export async function previewQueue({ repository, now }) {
  const candidates = await repository.listCandidates();
  let deliveries = [];
  try {
    deliveries = await repository.listDeliveries();
  } catch {
    deliveries = [];
  }
  let schedule = {};
  try {
    schedule = await repository.getSchedule();
  } catch {
    schedule = {};
  }
  return buildQueuePreview({ now, candidates, deliveries, schedule });
}
