const TABLES = {
  settings: 'app_c009c0e4f1_integration_settings',
  tickets: 'app_c009c0e4f1_tickets',
  users: 'app_c009c0e4f1_users',
  messages: 'app_c009c0e4f1_chat_messages',
} as const;

const RPCS = {
  enqueue: 'helpdesk_enqueue_ticket_notification',
  claim: 'helpdesk_claim_ticket_notifications',
  complete: 'helpdesk_complete_ticket_notification',
} as const;

const ENABLED_AT_KEY = 'ticket_communications_enabled_at';
const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress'] as const;
const TICKET_COLUMNS = [
  'id',
  'title',
  'status',
  'created_by',
  'category',
  'subcategory',
  'resolved_at',
  'feedback_submitted_at',
].join(', ');

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: unknown };

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: readonly unknown[]): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  gte(column: string, value: string): QueryBuilder;
  neq(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): PromiseLike<QueryResult>;
}

interface SupabaseClientLike {
  from(table: string): QueryBuilder;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
}

function clientFrom(value: unknown): SupabaseClientLike {
  const candidate = value as Partial<SupabaseClientLike> | null;
  if (!candidate || typeof candidate.from !== 'function' || typeof candidate.rpc !== 'function') {
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

function requiredString(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Ticket communication repository failed: ${operation}`);
  }
  return value.trim();
}

function isoDate(value: unknown, operation: string): string {
  const parsed = new Date(requiredString(value, operation));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ticket communication repository failed: ${operation}`);
  }
  return parsed.toISOString();
}

function throwOnError(error: unknown, operation: string): void {
  if (error) throw new Error(`Ticket communication repository failed: ${operation}`);
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function restrictTicket(query: QueryBuilder, ticketId: string | undefined): QueryBuilder {
  return ticketId ? query.eq('id', ticketId) : query;
}

async function loadEnabledAt(client: SupabaseClientLike): Promise<string> {
  const result = await client
    .from(TABLES.settings)
    .select('value')
    .eq('key', ENABLED_AT_KEY)
    .maybeSingle();
  throwOnError(result.error, 'load_enabled_at');
  return isoDate(row(result.data)?.value, 'load_enabled_at');
}

async function loadCandidateTickets(
  client: SupabaseClientLike,
  enabledAt: string,
  ticketId?: string,
): Promise<Row[]> {
  const activeQuery = restrictTicket(
    client
      .from(TABLES.tickets)
      .select(TICKET_COLUMNS)
      .in('status', ACTIVE_STATUSES),
    ticketId,
  );
  const resolvedQuery = restrictTicket(
    client
      .from(TABLES.tickets)
      .select(TICKET_COLUMNS)
      .eq('status', 'resolved')
      .is('feedback_submitted_at', null)
      .gte('resolved_at', enabledAt),
    ticketId,
  );
  const [activeResult, resolvedResult] = await Promise.all([activeQuery, resolvedQuery]);
  throwOnError(activeResult.error, 'list_active_tickets');
  throwOnError(resolvedResult.error, 'list_resolved_tickets');

  const byId = new Map<string, Row>();
  for (const ticket of [...rows(activeResult.data), ...rows(resolvedResult.data)]) {
    if (typeof ticket.id === 'string') byId.set(ticket.id, ticket);
  }
  return [...byId.values()];
}

async function loadUsersById(client: SupabaseClientLike, userIds: string[]): Promise<Map<string, Row>> {
  if (userIds.length === 0) return new Map();
  const result = await client
    .from(TABLES.users)
    .select('id, name, email')
    .in('id', userIds);
  throwOnError(result.error, 'load_requesters');
  return new Map(
    rows(result.data)
      .filter((user) => typeof user.id === 'string')
      .map((user) => [user.id as string, user]),
  );
}

async function loadLastMessages(
  client: SupabaseClientLike,
  ticketIds: string[],
): Promise<Map<string, Row | null>> {
  const entries = await Promise.all(ticketIds.map(async (ticketId) => {
    const result = await client
      .from(TABLES.messages)
      .select('user_id, created_at')
      .eq('ticket_id', ticketId)
      .neq('user_id', 'system')
      .order('created_at', { ascending: false })
      .limit(1);
    throwOnError(result.error, 'load_last_human_message');
    return [ticketId, rows(result.data)[0] ?? null] as const;
  }));
  return new Map(entries);
}

async function hydrateDeliveries(client: SupabaseClientLike, deliveries: Row[]): Promise<Row[]> {
  const ticketIds = uniqueStrings(deliveries.map((delivery) => delivery.ticket_id));
  if (ticketIds.length === 0) return deliveries.map((delivery) => ({
    ...delivery,
    ticket: null,
    requester: null,
  }));

  const ticketsResult = await client
    .from(TABLES.tickets)
    .select(TICKET_COLUMNS)
    .in('id', ticketIds);
  throwOnError(ticketsResult.error, 'hydrate_delivery_tickets');
  const tickets = rows(ticketsResult.data);
  const ticketsById = new Map(
    tickets
      .filter((ticket) => typeof ticket.id === 'string')
      .map((ticket) => [ticket.id as string, ticket]),
  );
  const requesterIds = uniqueStrings(tickets.map((ticket) => ticket.created_by));
  const usersById = await loadUsersById(client, requesterIds);

  return deliveries.map((delivery) => {
    const ticket = typeof delivery.ticket_id === 'string'
      ? ticketsById.get(delivery.ticket_id) ?? null
      : null;
    const requester = ticket && typeof ticket.created_by === 'string'
      ? usersById.get(ticket.created_by) ?? null
      : null;
    return { ...delivery, ticket, requester };
  });
}

export function createTicketCommunicationRepository(supabaseAdmin: unknown) {
  const client = clientFrom(supabaseAdmin);

  return {
    async listCandidates(ticketId?: string) {
      const enabledAt = await loadEnabledAt(client);
      const tickets = await loadCandidateTickets(client, enabledAt, ticketId);
      const requesterIds = uniqueStrings(tickets.map((ticket) => ticket.created_by));
      const ticketIds = uniqueStrings(tickets.map((ticket) => ticket.id));
      const [usersById, messagesByTicketId] = await Promise.all([
        loadUsersById(client, requesterIds),
        loadLastMessages(client, ticketIds),
      ]);

      return tickets.map((ticket) => ({
        enabledAt,
        ticket,
        requester: typeof ticket.created_by === 'string'
          ? usersById.get(ticket.created_by) ?? null
          : null,
        lastHumanMessage: typeof ticket.id === 'string'
          ? messagesByTicketId.get(ticket.id) ?? null
          : null,
      }));
    },

    async enqueue(input: {
      ticketId: string;
      notificationType: string;
      channel: string;
      cycleKey: string;
    }) {
      const result = await client.rpc(RPCS.enqueue, {
        p_ticket_id: input.ticketId,
        p_notification_type: input.notificationType,
        p_channel: input.channel,
        p_cycle_key: input.cycleKey,
      });
      throwOnError(result.error, 'enqueue');
      return row(result.data);
    },

    async claim(limit: number, now: Date) {
      const result = await client.rpc(RPCS.claim, {
        p_limit: limit,
        p_now: now.toISOString(),
      });
      throwOnError(result.error, 'claim');
      return hydrateDeliveries(client, rows(result.data));
    },

    async complete(input: {
      id: string;
      success: boolean;
      error: string | null;
      nextAttemptAt: Date | string | null;
    }) {
      const result = await client.rpc(RPCS.complete, {
        p_delivery_id: input.id,
        p_success: input.success,
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
