import {
  prepareDeliveries as defaultPrepareDeliveries,
  processDeliveries as defaultProcessDeliveries,
} from './processor.mjs';
import { previewQueue as defaultPreviewQueue } from './queuePreview.mjs';

const TICKETS_TABLE = 'app_c009c0e4f1_tickets';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['ticket_resolved', 'daily', 'queue_status', 'run_pending', 'retry_delivery']);
const ADMIN_ACTIONS = new Set(['queue_status', 'run_pending']);
const RETRY_KEYS = ['action', 'ticketId', 'notificationType', 'channel', 'cycleKey'];
const QUEUE_TYPES = new Set([
  'resolved_feedback_invite',
  'awaiting_requester',
  'awaiting_feedback',
]);
const QUEUE_CHANNELS = new Set(['email', 'teams']);
const QUEUE_STATUSES = new Set(['pending', 'processing', 'failed', 'sent']);
const QUEUE_ITEM_LIMIT = 80;

function response(status, error) {
  return { status, body: { error } };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(body, keys) {
  const allowed = new Set(keys);
  return Object.keys(body).every((key) => allowed.has(key));
}

function count(value) {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function clippedText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function sanitizeQueueItem(item) {
  if (!isObject(item) || typeof item.ticketId !== 'string' || !UUID_PATTERN.test(item.ticketId)) {
    return null;
  }
  if (!QUEUE_TYPES.has(item.notificationType) || !QUEUE_CHANNELS.has(item.channel)) return null;
  if (!QUEUE_STATUSES.has(item.status)) return null;
  return {
    ticketId: item.ticketId,
    ticketTitle: clippedText(item.ticketTitle, 160) || 'Chamado',
    requesterId: typeof item.requesterId === 'string' && UUID_PATTERN.test(item.requesterId)
      ? item.requesterId
      : '',
    requesterName: clippedText(item.requesterName, 120),
    requesterEmail: clippedText(item.requesterEmail, 160),
    notificationType: item.notificationType,
    channel: item.channel,
    cycleKey: clippedText(item.cycleKey, 64),
    status: item.status,
    sentAt: typeof item.sentAt === 'string' ? item.sentAt : null,
    lastError: typeof item.lastError === 'string' ? item.lastError.slice(0, 64) : null,
  };
}

function sanitizeQueuePreview(preview) {
  const next = Array.isArray(preview?.next)
    ? preview.next.map(sanitizeQueueItem).filter(Boolean).slice(0, QUEUE_ITEM_LIMIT)
    : [];
  const sent = Array.isArray(preview?.sent)
    ? preview.sent.map(sanitizeQueueItem).filter(Boolean).slice(0, QUEUE_ITEM_LIMIT)
    : [];
  return {
    ok: true,
    nextRunAt: typeof preview?.nextRunAt === 'string' ? preview.nextRunAt : null,
    next,
    sent,
    counts: {
      next: count(preview?.counts?.next) || next.length,
      sent: count(preview?.counts?.sent) || sent.length,
    },
  };
}

async function visibleResolvedTicket(supabase, ticketId) {
  const { data, error } = await supabase
    .from(TICKETS_TABLE)
    .select('id, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw new Error('Unable to validate ticket visibility');
  if (!data) return response(404, 'ticket_not_found');
  if (data.status !== 'resolved') return response(409, 'ticket_not_resolved');
  return null;
}

function authorizeAction(action, authMode, isAdmin, body) {
  if (action === 'ticket_resolved') {
    if (authMode !== 'user') return response(403, 'forbidden');
    if (!hasOnlyKeys(body, ['action', 'ticketId'])) return response(400, 'invalid_body');
    if (typeof body.ticketId !== 'string' || !UUID_PATTERN.test(body.ticketId)) {
      return response(400, 'invalid_ticket_id');
    }
    return null;
  }
  if (action === 'retry_delivery') {
    if (authMode !== 'user' || isAdmin !== true) return response(403, 'forbidden');
    if (!hasOnlyKeys(body, RETRY_KEYS)) return response(400, 'invalid_body');
    if (typeof body.ticketId !== 'string' || !UUID_PATTERN.test(body.ticketId)) {
      return response(400, 'invalid_ticket_id');
    }
    if (!QUEUE_TYPES.has(body.notificationType) || !QUEUE_CHANNELS.has(body.channel)) {
      return response(400, 'invalid_body');
    }
    if (typeof body.cycleKey !== 'string' || !body.cycleKey.trim() || body.cycleKey.length > 64) {
      return response(400, 'invalid_body');
    }
    return null;
  }
  if (ADMIN_ACTIONS.has(action)) {
    if (authMode !== 'user' || isAdmin !== true) return response(403, 'forbidden');
    if (!hasOnlyKeys(body, ['action'])) return response(400, 'invalid_body');
    return null;
  }
  if (authMode !== 'secret') return response(403, 'forbidden');
  if (!hasOnlyKeys(body, ['action'])) return response(400, 'invalid_body');
  return null;
}

export async function handleTicketCommunicationRequest({ authMode, isAdmin, body, dependencies }) {
  if (!isObject(body) || !ACTIONS.has(body.action)) {
    return response(400, 'invalid_action');
  }

  const action = body.action;
  const authError = authorizeAction(action, authMode, isAdmin, body);
  if (authError) return authError;

  try {
    const ticketId = action === 'ticket_resolved' ? body.ticketId : undefined;
    const notificationType = ticketId ? 'resolved_feedback_invite' : undefined;
    if (ticketId) {
      const ticketError = await visibleResolvedTicket(dependencies.supabase, ticketId);
      if (ticketError) return ticketError;
    }

    const runtimeDependencies = dependencies.createRuntimeDependencies
      ? await dependencies.createRuntimeDependencies()
      : dependencies;
    if (!runtimeDependencies) return response(503, 'service_unavailable');

    const clock = dependencies.clock ?? runtimeDependencies.clock ?? (() => new Date());

    if (action === 'queue_status') {
      const previewQueue = runtimeDependencies.previewQueue
        ?? dependencies.previewQueue
        ?? defaultPreviewQueue;
      const preview = await previewQueue({
        repository: runtimeDependencies.repository ?? dependencies.repository,
        now: clock(),
      });
      return { status: 200, body: sanitizeQueuePreview(preview) };
    }

    const processDeliveries = runtimeDependencies.processDeliveries
      ?? dependencies.processDeliveries
      ?? defaultProcessDeliveries;

    if (action === 'retry_delivery') {
      const repository = runtimeDependencies.repository ?? dependencies.repository;
      if (typeof repository?.requeue !== 'function') return response(500, 'internal_error');
      const queued = await repository.requeue({
        ticketId: body.ticketId,
        notificationType: body.notificationType,
        channel: body.channel,
        cycleKey: body.cycleKey,
        nextAttemptAt: clock(),
      });
      if (!queued) return response(404, 'delivery_not_found');
      const processed = await processDeliveries({
        repository,
        graph: runtimeDependencies.graph,
        appBaseUrl: runtimeDependencies.appBaseUrl,
        headerImageUrl: runtimeDependencies.headerImageUrl,
        clock,
        ticketId: body.ticketId,
        notificationType: body.notificationType,
        channel: body.channel,
      });
      return {
        status: 200,
        body: {
          ok: true,
          prepared: 1,
          sent: count(processed?.sent),
          failed: count(processed?.failed),
        },
      };
    }

    const prepareDeliveries = runtimeDependencies.prepareDeliveries
      ?? dependencies.prepareDeliveries
      ?? defaultPrepareDeliveries;
    const prepareNow = clock();
    const prepared = await prepareDeliveries({
      repository: runtimeDependencies.repository,
      now: prepareNow,
      ticketId,
      notificationType,
    });
    const processed = await processDeliveries({
      repository: runtimeDependencies.repository,
      graph: runtimeDependencies.graph,
      appBaseUrl: runtimeDependencies.appBaseUrl,
      headerImageUrl: runtimeDependencies.headerImageUrl,
      clock,
      ticketId,
      notificationType,
    });

    const responseBody = {
      ok: true,
      prepared: count(prepared?.enqueued),
      sent: count(processed?.sent),
      failed: count(processed?.failed),
    };
    if (processed?.budgetExhausted === true) {
      responseBody.backlog = count(processed?.backlog);
      responseBody.budgetExhausted = true;
    }
    return { status: 200, body: responseBody };
  } catch {
    return response(500, 'internal_error');
  }
}
