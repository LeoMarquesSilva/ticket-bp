import {
  channelsForNotification,
  getEligibleNotificationTypes,
  localCycleKey,
} from './rules.mjs';
import { buildNotificationContent } from './templates.mjs';

const DEFAULT_BATCH_SIZE = 100;
const DAILY_RUN_UTC_HOUR = 12;
const SUPPORTED_CHANNELS = new Set(['email', 'teams']);
const SUPPORTED_NOTIFICATION_TYPES = new Set([
  'resolved_feedback_invite',
  'awaiting_requester',
  'awaiting_feedback',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_FAILURE_CATEGORIES = new Set(['entra_user_not_found']);

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

function sanitizeError(error) {
  if (INTERNAL_FAILURE_CATEGORIES.has(error?.code)) return error.code;
  if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) {
    return `graph_http_${error.status}`;
  }
  return 'delivery_error';
}

async function completeDelivery(repository, input) {
  try {
    await repository.complete(input);
    return true;
  } catch {
    return false;
  }
}

function countCompletion(counts, completed, outcome) {
  // Each claimed row has one mutually exclusive terminal count. A queue write
  // failure is reported as skipped because its final state is unknown.
  if (completed) counts[outcome] += 1;
  else counts.skipped += 1;
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
      const completed = await completeDelivery(repository, {
        id: delivery?.id,
        success: false,
        error: 'Entrega de comunicação inválida',
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    if (!delivery.ticket || !isValidRecipient(delivery.requester)) {
      const completed = await completeDelivery(repository, {
        id: delivery.id,
        success: false,
        error: 'Configuração do destinatário ausente ou e-mail inválido',
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      countCompletion(counts, completed, 'failed');
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
      const completed = await completeDelivery(repository, {
        id: delivery.id,
        success: false,
        error: sanitizeError(error),
        nextAttemptAt: nextDailyAttemptAt(now),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    const completed = await completeDelivery(repository, {
      id: delivery.id,
      success: true,
      error: null,
      nextAttemptAt: null,
    });
    countCompletion(counts, completed, 'sent');
  }

  return counts;
}
