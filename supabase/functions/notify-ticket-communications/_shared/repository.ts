const RPCS = {
  listCandidates: 'helpdesk_list_ticket_communication_candidates',
  contexts: 'helpdesk_get_ticket_communication_contexts',
  enqueue: 'helpdesk_enqueue_ticket_notification',
  claim: 'helpdesk_claim_ticket_notifications',
  countReady: 'helpdesk_count_ready_ticket_notifications',
  complete: 'helpdesk_complete_ticket_notification',
  release: 'helpdesk_release_ticket_notification',
  emailTemplates: 'helpdesk_get_ticket_communication_email_templates',
  teamsTemplates: 'helpdesk_get_ticket_communication_teams_templates',
  schedule: 'helpdesk_get_ticket_communication_schedule',
  listDeliveries: 'helpdesk_list_ticket_communication_deliveries',
  requeue: 'helpdesk_requeue_ticket_notification',
} as const;

const PAGE_SIZE = 500;

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: unknown };

interface SupabaseClientLike {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
}

function clientFrom(value: unknown): SupabaseClientLike {
  const candidate = value as Partial<SupabaseClientLike> | null;
  if (!candidate || typeof candidate.rpc !== 'function') {
    throw new TypeError('Supabase admin client is required');
  }
  return candidate as SupabaseClientLike;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function row(value: unknown): Row | null {
  if (Array.isArray(value)) return rows(value)[0] ?? null;
  return value && typeof value === 'object' ? value as Row : null;
}

function throwOnError(error: unknown, operation: string): void {
  if (error) throw new Error(`Ticket communication repository failed: ${operation}`);
}

async function readVersionedObject(
  client: SupabaseClientLike,
  rpcName: string,
  operation: string,
  field: 'templates' | 'schedule',
) {
  const result = await client.rpc(rpcName, {});
  throwOnError(result.error, operation);
  if (typeof result.data !== 'string' || !result.data.trim()) return {};
  try {
    const parsed = JSON.parse(result.data);
    return parsed?.version === 1 && parsed[field] && typeof parsed[field] === 'object'
      ? parsed[field]
      : {};
  } catch {
    return {};
  }
}

function mapContext(context: Row) {
  return {
    enabledAt: context.enabled_at,
    ticket: context.ticket ?? null,
    requester: context.requester ?? null,
    lastHumanMessage: context.last_human_message ?? null,
  };
}

export function createTicketCommunicationRepository(supabaseAdmin: unknown) {
  const client = clientFrom(supabaseAdmin);

  return {
    async getEmailTemplateOverrides() {
      return readVersionedObject(client, RPCS.emailTemplates, 'email_templates', 'templates');
    },

    async getTeamsTemplateOverrides() {
      return readVersionedObject(client, RPCS.teamsTemplates, 'teams_templates', 'templates');
    },

    async getSchedule() {
      return readVersionedObject(client, RPCS.schedule, 'schedule', 'schedule');
    },

    async listDeliveries(limit = 200) {
      const result = await client.rpc(RPCS.listDeliveries, {
        p_limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 200,
      });
      throwOnError(result.error, 'list_deliveries');
      return rows(result.data).map((item) => ({
        ticketId: item.ticket_id,
        ticketTitle: typeof item.ticket_title === 'string' ? item.ticket_title : '',
        requesterId: typeof item.requester_id === 'string' ? item.requester_id : '',
        requesterName: typeof item.requester_name === 'string' ? item.requester_name : '',
        requesterEmail: typeof item.requester_email === 'string' ? item.requester_email : '',
        notificationType: item.notification_type,
        channel: item.channel,
        cycleKey: item.cycle_key,
        status: item.status,
        sentAt: typeof item.sent_at === 'string' ? item.sent_at : null,
        lastError: typeof item.last_error === 'string' ? item.last_error : null,
      }));
    },

    async listCandidates(ticketId?: string) {
      const candidates: ReturnType<typeof mapContext>[] = [];
      let afterId: string | null = null;

      while (true) {
        const result = await client.rpc(RPCS.listCandidates, {
          p_after_id: afterId,
          p_limit: PAGE_SIZE,
          p_ticket_id: ticketId ?? null,
        });
        throwOnError(result.error, 'list_candidates');
        const page = rows(result.data);
        candidates.push(...page.map(mapContext));
        if (page.length < PAGE_SIZE) break;

        const nextAfterId = page.at(-1)?.ticket_id;
        if (typeof nextAfterId !== 'string' || nextAfterId === afterId) {
          throw new Error('Ticket communication repository failed: invalid_candidate_page');
        }
        afterId = nextAfterId;
      }

      return candidates;
    },

    async enqueue(input: {
      ticketId: string;
      notificationType: string;
      channel: string;
      cycleKey: string;
      nextAttemptAt: Date | string;
    }) {
      const result = await client.rpc(RPCS.enqueue, {
        p_ticket_id: input.ticketId,
        p_notification_type: input.notificationType,
        p_channel: input.channel,
        p_cycle_key: input.cycleKey,
        p_next_attempt_at: new Date(input.nextAttemptAt).toISOString(),
      });
      throwOnError(result.error, 'enqueue');
      return row(result.data);
    },

    async requeue(input: {
      ticketId: string;
      notificationType: string;
      channel: string;
      cycleKey: string;
      nextAttemptAt: Date | string;
    }) {
      const result = await client.rpc(RPCS.requeue, {
        p_ticket_id: input.ticketId,
        p_notification_type: input.notificationType,
        p_channel: input.channel,
        p_cycle_key: input.cycleKey,
        p_next_attempt_at: new Date(input.nextAttemptAt).toISOString(),
      });
      throwOnError(result.error, 'requeue');
      return row(result.data);
    },

    async claim(
      limit: number,
      now: Date,
      filters: { ticketId?: string; notificationType?: string } = {},
    ) {
      const result = await client.rpc(RPCS.claim, {
        p_limit: limit,
        p_now: now.toISOString(),
        p_ticket_id: filters.ticketId ?? null,
        p_notification_type: filters.notificationType ?? null,
      });
      throwOnError(result.error, 'claim');
      return rows(result.data);
    },

    async getContext(ticketId: string) {
      const contextsResult = await client.rpc(RPCS.contexts, { p_ticket_ids: [ticketId] });
      throwOnError(contextsResult.error, 'hydrate_delivery_contexts');
      const context = rows(contextsResult.data)
        .find((item) => item.ticket_id === ticketId);
      return context ? mapContext(context) : null;
    },

    async countReady(
      now: Date,
      filters: { ticketId?: string; notificationType?: string } = {},
    ) {
      const result = await client.rpc(RPCS.countReady, {
        p_now: now.toISOString(),
        p_ticket_id: filters.ticketId ?? null,
        p_notification_type: filters.notificationType ?? null,
      });
      throwOnError(result.error, 'count_ready');
      const count = Number(result.data ?? 0);
      return Number.isSafeInteger(count) && count >= 0 ? count : 0;
    },

    async complete(input: {
      id: string;
      claimToken: string;
      attemptCount: number;
      outcome: 'sent' | 'failed' | 'cancelled';
      error: string | null;
      nextAttemptAt: Date | string | null;
    }) {
      const result = await client.rpc(RPCS.complete, {
        p_delivery_id: input.id,
        p_claim_token: input.claimToken,
        p_attempt_count: input.attemptCount,
        p_outcome: input.outcome,
        p_error: input.error,
        p_next_attempt_at: input.nextAttemptAt
          ? new Date(input.nextAttemptAt).toISOString()
          : null,
      });
      throwOnError(result.error, 'complete');
      return row(result.data);
    },

    async release(input: {
      id: string;
      claimToken: string;
      attemptCount: number;
      nextAttemptAt: Date | string;
    }) {
      const result = await client.rpc(RPCS.release, {
        p_delivery_id: input.id,
        p_claim_token: input.claimToken,
        p_attempt_count: input.attemptCount,
        p_next_attempt_at: new Date(input.nextAttemptAt).toISOString(),
      });
      throwOnError(result.error, 'release');
      return row(result.data);
    },
  };
}
