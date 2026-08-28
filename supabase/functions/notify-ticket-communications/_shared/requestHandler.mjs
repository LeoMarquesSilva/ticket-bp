import {
  prepareDeliveries as defaultPrepareDeliveries,
  processDeliveries as defaultProcessDeliveries,
} from './processor.mjs';

const TICKETS_TABLE = 'app_c009c0e4f1_tickets';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['ticket_resolved', 'daily']);

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

export async function handleTicketCommunicationRequest({ authMode, body, dependencies }) {
  if (!isObject(body) || !ACTIONS.has(body.action)) {
    return response(400, 'invalid_action');
  }

  const action = body.action;
  if (action === 'ticket_resolved') {
    if (authMode !== 'user') return response(403, 'forbidden');
    if (!hasOnlyKeys(body, ['action', 'ticketId'])) return response(400, 'invalid_body');
    if (typeof body.ticketId !== 'string' || !UUID_PATTERN.test(body.ticketId)) {
      return response(400, 'invalid_ticket_id');
    }
  } else {
    if (authMode !== 'secret') return response(403, 'forbidden');
    if (!hasOnlyKeys(body, ['action'])) return response(400, 'invalid_body');
  }

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

    const prepareDeliveries = runtimeDependencies.prepareDeliveries
      ?? dependencies.prepareDeliveries
      ?? defaultPrepareDeliveries;
    const processDeliveries = runtimeDependencies.processDeliveries
      ?? dependencies.processDeliveries
      ?? defaultProcessDeliveries;
    const clock = dependencies.clock ?? runtimeDependencies.clock ?? (() => new Date());
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
