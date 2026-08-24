const RPCS = {
  listCandidates: 'helpdesk_list_ticket_communication_candidates',
  contexts: 'helpdesk_get_ticket_communication_contexts',
  enqueue: 'helpdesk_enqueue_ticket_notification',
  claim: 'helpdesk_claim_ticket_notifications',
  countReady: 'helpdesk_count_ready_ticket_notifications',
  complete: 'helpdesk_complete_ticket_notification',
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
  };
}
