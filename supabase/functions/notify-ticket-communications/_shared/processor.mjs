import {
  channelsForNotification,
  getEligibleNotificationTypes,
  localCycleKey,
} from './rules.mjs';
import { buildNotificationContent } from './templates.mjs';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_BUDGET = Object.freeze({
  maxDeliveries: 500,
  maxBatches: 10,
  maxDurationMs: 45_000,
});
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

async function completeDelivery(repository, delivery, input) {
  try {
    const completed = await repository.complete({
      id: delivery?.id,
      claimToken: delivery?.claim_token,
      attemptCount: delivery?.attempt_count,
      ...input,
    });
    return Boolean(completed);
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
    && delivery?.ticket_id
    && delivery?.claim_token
    && Number.isInteger(delivery?.attempt_count)
    && SUPPORTED_CHANNELS.has(delivery.channel)
    && SUPPORTED_NOTIFICATION_TYPES.has(delivery.notification_type)
    && channelsForNotification(delivery.notification_type).includes(delivery.channel);
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function deliveryChainId(delivery) {
  const key = `${delivery.id}:${delivery.cycle_key}`;
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function hasCurrentResolvedCycle(delivery, ticket) {
  return delivery.notification_type !== 'resolved_feedback_invite'
    || (
      typeof ticket?.resolved_at === 'string'
      && delivery.cycle_key === ticket.resolved_at
    );
}

export async function prepareDeliveries({ repository, now, ticketId, notificationType }) {
  const candidates = await repository.listCandidates(ticketId);
  let enqueued = 0;

  for (const candidate of candidates) {
    const eligibleTypes = getEligibleNotificationTypes({
      now,
      enabledAt: new Date(candidate.enabledAt),
      ticket: candidate.ticket,
      lastHumanMessage: candidate.lastHumanMessage,
    });
    const types = notificationType
      ? eligibleTypes.filter((type) => type === notificationType)
      : eligibleTypes;

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
          nextAttemptAt: now,
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
  clock,
  ticketId,
  notificationType,
  batchSize = DEFAULT_BATCH_SIZE,
  budget = DEFAULT_BUDGET,
  monotonicNow = () => Date.now(),
}) {
  const claimNow = clock ? clock() : now;
  if (!(claimNow instanceof Date) || Number.isNaN(claimNow.getTime())) {
    throw new TypeError('A valid claim clock is required');
  }
  const effectiveBatchSize = positiveInteger(batchSize, DEFAULT_BATCH_SIZE);
  const effectiveBudget = {
    maxDeliveries: positiveInteger(budget?.maxDeliveries, DEFAULT_BUDGET.maxDeliveries),
    maxBatches: positiveInteger(budget?.maxBatches, DEFAULT_BUDGET.maxBatches),
    maxDurationMs: positiveInteger(budget?.maxDurationMs, DEFAULT_BUDGET.maxDurationMs),
  };
  const startedAt = monotonicNow();
  const deadline = startedAt + effectiveBudget.maxDurationMs;
  const counts = {
    selected: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    backlog: 0,
    budgetExhausted: false,
  };
  let batches = 0;
  let queueDrained = false;
  let emailTemplateOverrides = {};
  try {
    emailTemplateOverrides = await repository.getEmailTemplateOverrides();
  } catch {
    // Configuração visual nunca deve bloquear uma comunicação operacional.
    emailTemplateOverrides = {};
  }

  while (
    counts.selected < effectiveBudget.maxDeliveries
    && batches < effectiveBudget.maxBatches
    && monotonicNow() < deadline
  ) {
    const remaining = effectiveBudget.maxDeliveries - counts.selected;
    const claimLimit = Math.min(effectiveBatchSize, remaining);
    const deliveries = await repository.claim(claimLimit, claimNow, { ticketId, notificationType });
    batches += 1;
    counts.selected += deliveries.length;

    for (const delivery of deliveries) {
    if (!isSupportedDelivery(delivery)) {
      const completed = await completeDelivery(repository, delivery, {
        outcome: 'failed',
        error: 'Entrega de comunicação inválida',
        nextAttemptAt: nextDailyAttemptAt(claimNow),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    let context;
    try {
      context = await repository.getContext(delivery.ticket_id);
    } catch {
      context = null;
    }
    const enabledAt = new Date(context?.enabledAt);
    if (!context?.ticket || Number.isNaN(enabledAt.getTime())) {
      const completed = await completeDelivery(repository, delivery, {
        outcome: 'failed',
        error: 'Contexto do ticket ausente ou inválido',
        nextAttemptAt: nextDailyAttemptAt(claimNow),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    const eligibleTypes = getEligibleNotificationTypes({
      now: claimNow,
      enabledAt,
      ticket: context.ticket,
      lastHumanMessage: context.lastHumanMessage,
    });
    if (
      !eligibleTypes.includes(delivery.notification_type)
      || !hasCurrentResolvedCycle(delivery, context.ticket)
    ) {
      const completed = await completeDelivery(repository, delivery, {
        outcome: 'cancelled',
        error: 'no_longer_eligible',
        nextAttemptAt: null,
      });
      countCompletion(counts, completed, 'cancelled');
      continue;
    }

    if (!isValidRecipient(context.requester)) {
      const completed = await completeDelivery(repository, delivery, {
        outcome: 'failed',
        error: 'Configuração do destinatário ausente ou e-mail inválido',
        nextAttemptAt: nextDailyAttemptAt(claimNow),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    try {
      const content = buildNotificationContent({
        type: delivery.notification_type,
        ticket: context.ticket,
        requester: context.requester,
        appBaseUrl,
        emailTemplateOverrides,
      });
      const email = context.requester.email.trim();

      if (delivery.channel === 'email') {
        await graph.sendEmail({ to: email, ...content.email });
      } else {
        const userId = await graph.resolveUserId(email);
        if (!userId) {
          const error = new Error('Usuário Microsoft Entra não encontrado');
          error.code = 'entra_user_not_found';
          throw error;
        }
        await graph.sendTeamsActivity({
          userId,
          ...content.teams,
          chainId: deliveryChainId(delivery),
        });
      }
    } catch (error) {
      const completed = await completeDelivery(repository, delivery, {
        outcome: 'failed',
        error: sanitizeError(error),
        nextAttemptAt: nextDailyAttemptAt(claimNow),
      });
      countCompletion(counts, completed, 'failed');
      continue;
    }

    const completed = await completeDelivery(repository, delivery, {
      outcome: 'sent',
      error: null,
      nextAttemptAt: null,
    });
    countCompletion(counts, completed, 'sent');
    }

    if (deliveries.length < claimLimit) {
      queueDrained = true;
      break;
    }
  }

  if (!queueDrained) {
    counts.backlog = await repository.countReady(claimNow, { ticketId, notificationType });
    counts.budgetExhausted = counts.backlog > 0;
  }

  return counts;
}
