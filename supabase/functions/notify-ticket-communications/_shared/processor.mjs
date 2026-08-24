import {
  channelsForNotification,
  getEligibleNotificationTypes,
  localCycleKey,
} from './rules.mjs';
import { buildNotificationContent } from './templates.mjs';

const DEFAULT_BATCH_SIZE = 100;
const MAX_PERSISTED_ERROR_LENGTH = 500;
const DAILY_RUN_UTC_HOUR = 12;
const SUPPORTED_CHANNELS = new Set(['email', 'teams']);
const SUPPORTED_NOTIFICATION_TYPES = new Set([
  'resolved_feedback_invite',
  'awaiting_requester',
  'awaiting_feedback',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nextDailyAttemptAt(now) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    DAILY_RUN_UTC_HOUR,
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function isValidRecipient(requester) {
  return typeof requester?.email === 'string' && EMAIL_PATTERN.test(requester.email.trim());
}

function sanitizeText(value, fallback) {
  const text = String(value ?? fallback)
    .replace(/\b(authorization|x-api-key|api[_-]?key|password)\s*[:=]\s*[^\r\n]+/gi, '$1: [redacted]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/\b(access[_-]?token|client[_-]?secret|token)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function sanitizeError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599
    ? `HTTP ${error.status} `
    : '';
  const code = sanitizeText(error?.code, 'delivery_error').slice(0, 100);
  const message = sanitizeText(error?.message, 'Falha ao entregar comunicação');
  return `${status}${code}: ${message}`.slice(0, MAX_PERSISTED_ERROR_LENGTH);
}

function isSupportedDelivery(delivery) {
  return delivery?.id
    && SUPPORTED_CHANNELS.has(delivery.channel)
    && SUPPORTED_NOTIFICATION_TYPES.has(delivery.notification_type)
    && channelsForNotification(delivery.notification_type).includes(delivery.channel);
}

export async function prepareDeliveries({ repository, now, ticketId }) {
  const candidates = await repository.listCandidates(ticketId);
  let enqueued = 0;

  for (const candidate of candidates) {
    const types = getEligibleNotificationTypes({
      now,
      enabledAt: new Date(candidate.enabledAt),
      ticket: candidate.ticket,
      lastHumanMessage: candidate.lastHumanMessage,
    });

    for (const type of types) {
      const cycleKey = type === 'resolved_feedback_invite'
        ? candidate.ticket.resolved_at
        : localCycleKey(now);
      for (const channel of channelsForNotification(type)) {
        await repository.enqueue({
          ticketId: candidate.ticket.id,
          notificationType: type,
          channel,
          cycleKey,
        });
        enqueued += 1;
      }
    }
  }

  return { candidates: candidates.length, enqueued };
}

export async function processDeliveries({
  repository,
  graph,
  appBaseUrl,
  now,
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  const deliveries = await repository.claim(batchSize, now);
  const counts = { selected: deliveries.length, sent: 0, failed: 0, skipped: 0 };

  for (const delivery of deliveries) {
    if (!isSupportedDelivery(delivery)) {
      await repository.complete({
        id: delivery?.id,
        success: false,
        error: 'Entrega de comunicação inválida',
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      counts.failed += 1;
      continue;
    }

    if (!delivery.ticket || !isValidRecipient(delivery.requester)) {
      await repository.complete({
        id: delivery.id,
        success: false,
        error: 'Configuração do destinatário ausente ou e-mail inválido',
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      counts.failed += 1;
      continue;
    }

    try {
      const content = buildNotificationContent({
        type: delivery.notification_type,
        ticket: delivery.ticket,
        requester: delivery.requester,
        appBaseUrl,
      });
      const email = delivery.requester.email.trim();

      if (delivery.channel === 'email') {
        await graph.sendEmail({ to: email, ...content.email });
      } else {
        const userId = await graph.resolveUserId(email);
        if (!userId) {
          const error = new Error('Usuário Microsoft Entra não encontrado');
          error.code = 'entra_user_not_found';
          throw error;
        }
        await graph.sendTeamsActivity({ userId, ...content.teams });
      }
    } catch (error) {
      await repository.complete({
        id: delivery.id,
        success: false,
        error: sanitizeError(error),
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      counts.failed += 1;
      continue;
    }

    await repository.complete({ id: delivery.id, success: true, error: null, nextAttemptAt: null });
    counts.sent += 1;
  }

  return counts;
}
