import { describe, expect, it, vi } from 'vitest';
import { createCorsHeaders } from '../../supabase/functions/notify-ticket-communications/_shared/cors.ts';
import { createTicketCommunicationRepository } from '../../supabase/functions/notify-ticket-communications/_shared/repository.ts';
import { handleTicketCommunicationRequest } from '../../supabase/functions/notify-ticket-communications/_shared/requestHandler.mjs';

const TICKET_ID = '11111111-1111-1111-1111-111111111111';
const REQUESTER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-24T12:00:00.000Z');

type QueryResult = { data: unknown; error: unknown };

function fakeQuery(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<QueryResult> = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  for (const method of ['select', 'eq', 'in', 'is', 'gte', 'neq', 'order', 'limit'] as const) {
    query[method].mockReturnValue(query);
  }

  return query;
}

function fakeSupabase(input: {
  tables?: Record<string, QueryResult[]>;
  rpcs?: Record<string, QueryResult>;
} = {}) {
  const queues = new Map(
    Object.entries(input.tables ?? {}).map(([table, results]) => [table, [...results]]),
  );
  const queries: Array<{ table: string; query: ReturnType<typeof fakeQuery> }> = [];
  const from = vi.fn((table: string) => {
    const result = queues.get(table)?.shift() ?? { data: [], error: null };
    const query = fakeQuery(result);
    queries.push({ table, query });
    return query;
  });
  const rpc = vi.fn(async (name: string) => input.rpcs?.[name] ?? { data: null, error: null });

  return { client: { from, rpc }, from, rpc, queries };
}

function handlerDependencies(ticket: unknown = { id: TICKET_ID, status: 'resolved' }) {
  const userQuery = fakeQuery({ data: ticket, error: null });
  const supabase = { from: vi.fn(() => userQuery) };
  const prepareDeliveries = vi.fn(async () => ({ candidates: 1, enqueued: 2 }));
  const processDeliveries = vi.fn(async () => ({ selected: 2, sent: 1, failed: 1, skipped: 0 }));
  const dependencies = {
    supabase,
    repository: { source: 'admin-client' },
    graph: { source: 'microsoft-graph' },
    appBaseUrl: 'https://responsum.example',
    now: NOW,
    prepareDeliveries,
    processDeliveries,
  };
  return { dependencies, supabase, userQuery, prepareDeliveries, processDeliveries };
}

describe('handleTicketCommunicationRequest', () => {
  it('rejeita ação desconhecida sem iniciar processamento', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'send_anything' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 400, body: { error: 'invalid_action' } });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('rejeita UUID inválido no disparo de ticket resolvido', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'ticket_resolved', ticketId: 'ticket-1' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 400, body: { error: 'invalid_ticket_id' } });
    expect(context.supabase.from).not.toHaveBeenCalled();
  });

  it('recusa ticket_resolved quando a credencial não é de usuário', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'secret',
      body: { action: 'ticket_resolved', ticketId: TICKET_ID },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(context.supabase.from).not.toHaveBeenCalled();
  });

  it('recusa daily quando a credencial não é a secret key nomeada', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'daily' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('não revela se um ticket fora da visibilidade RLS existe', async () => {
    const context = handlerDependencies(null);

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'ticket_resolved', ticketId: TICKET_ID },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 404, body: { error: 'ticket_not_found' } });
    expect(context.supabase.from).toHaveBeenCalledWith('app_c009c0e4f1_tickets');
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('recusa ticket visível que ainda não foi resolvido', async () => {
    const context = handlerDependencies({ id: TICKET_ID, status: 'in_progress' });

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'ticket_resolved', ticketId: TICKET_ID },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 409, body: { error: 'ticket_not_resolved' } });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('não aceita destinatário nem conteúdo fornecidos pelo cliente', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: {
        action: 'ticket_resolved',
        ticketId: TICKET_ID,
        recipient: 'attacker@example.invalid',
        content: '<script>payload</script>',
      },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 400, body: { error: 'invalid_body' } });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
    expect(context.processDeliveries).not.toHaveBeenCalled();
  });

  it('orquestra o modo diário sem filtro e responde somente com contagens', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'secret',
      body: { action: 'daily' },
      dependencies: context.dependencies,
    });

    expect(context.prepareDeliveries).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      now: NOW,
      ticketId: undefined,
    });
    expect(context.processDeliveries).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      graph: context.dependencies.graph,
      appBaseUrl: 'https://responsum.example',
      now: NOW,
    });
    expect(result).toEqual({
      status: 200,
      body: { ok: true, prepared: 2, sent: 1, failed: 1 },
    });
    expect(Object.keys(result.body)).toEqual(['ok', 'prepared', 'sent', 'failed']);
  });

  it('consulta o ticket pelo cliente RLS e filtra o preparo no modo imediato', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'ticket_resolved', ticketId: TICKET_ID },
      dependencies: context.dependencies,
    });

    expect(context.userQuery.select).toHaveBeenCalledWith('id, status');
    expect(context.userQuery.eq).toHaveBeenCalledWith('id', TICKET_ID);
    expect(context.prepareDeliveries).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      now: NOW,
      ticketId: TICKET_ID,
    });
    expect(result.status).toBe(200);
  });

  it('sanitiza erros internos sem expor destinatários ou detalhes do provedor', async () => {
    const context = handlerDependencies();
    context.processDeliveries.mockRejectedValueOnce(
      new Error('Microsoft Graph failed for ana@bpplaw.com.br with token-secret'),
    );

    const result = await handleTicketCommunicationRequest({
      authMode: 'secret',
      body: { action: 'daily' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 500, body: { error: 'internal_error' } });
    expect(JSON.stringify(result)).not.toContain('ana@bpplaw.com.br');
    expect(JSON.stringify(result)).not.toContain('token-secret');
  });
});

describe('createTicketCommunicationRepository', () => {
  it('usa nomes reais, restringe o ticket e carrega solicitante e última mensagem humana', async () => {
    const activeTicket = {
      id: TICKET_ID,
      title: 'Acesso',
      status: 'in_progress',
      created_by: REQUESTER_ID,
      category: 'ti',
      subcategory: 'acesso',
      resolved_at: null,
      feedback_submitted_at: null,
    };
    const requester = { id: REQUESTER_ID, name: 'Ana', email: 'ana@bpplaw.com.br' };
    const message = { user_id: 'support-id', created_at: '2026-08-22T12:00:00.000Z' };
    const fake = fakeSupabase({
      tables: {
        app_c009c0e4f1_integration_settings: [{ data: { value: '2026-08-01T00:00:00.000Z' }, error: null }],
        app_c009c0e4f1_tickets: [
          { data: [activeTicket], error: null },
          { data: [], error: null },
        ],
        app_c009c0e4f1_users: [{ data: [requester], error: null }],
        app_c009c0e4f1_chat_messages: [{ data: [message], error: null }],
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    const result = await repository.listCandidates(TICKET_ID);

    expect(result).toEqual([{
      enabledAt: '2026-08-01T00:00:00.000Z',
      ticket: activeTicket,
      requester,
      lastHumanMessage: message,
    }]);
    expect(fake.from.mock.calls.map(([table]) => table)).toEqual([
      'app_c009c0e4f1_integration_settings',
      'app_c009c0e4f1_tickets',
      'app_c009c0e4f1_tickets',
      'app_c009c0e4f1_users',
      'app_c009c0e4f1_chat_messages',
    ]);
    const activeQuery = fake.queries[1].query;
    const resolvedQuery = fake.queries[2].query;
    const messageQuery = fake.queries[4].query;
    expect(activeQuery.in).toHaveBeenCalledWith('status', ['open', 'assigned', 'in_progress']);
    expect(activeQuery.eq).toHaveBeenCalledWith('id', TICKET_ID);
    expect(resolvedQuery.eq).toHaveBeenCalledWith('id', TICKET_ID);
    expect(messageQuery.eq).toHaveBeenCalledWith('ticket_id', TICKET_ID);
    expect(messageQuery.neq).toHaveBeenCalledWith('user_id', 'system');
    expect(messageQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(messageQuery.limit).toHaveBeenCalledWith(1);
  });

  it('limita candidatos resolvidos à ativação e à ausência de feedback', async () => {
    const fake = fakeSupabase({
      tables: {
        app_c009c0e4f1_integration_settings: [{ data: { value: '2026-08-01T00:00:00.000Z' }, error: null }],
        app_c009c0e4f1_tickets: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    await repository.listCandidates();

    const resolvedQuery = fake.queries[2].query;
    expect(resolvedQuery.eq).toHaveBeenCalledWith('status', 'resolved');
    expect(resolvedQuery.is).toHaveBeenCalledWith('feedback_submitted_at', null);
    expect(resolvedQuery.gte).toHaveBeenCalledWith('resolved_at', '2026-08-01T00:00:00.000Z');
  });

  it('hidrata entregas reservadas com ticket e solicitante em consultas agrupadas', async () => {
    const delivery = {
      id: '33333333-3333-3333-3333-333333333333',
      ticket_id: TICKET_ID,
      notification_type: 'resolved_feedback_invite',
      channel: 'email',
    };
    const ticket = { id: TICKET_ID, title: 'Acesso', created_by: REQUESTER_ID };
    const requester = { id: REQUESTER_ID, name: 'Ana', email: 'ana@bpplaw.com.br' };
    const fake = fakeSupabase({
      tables: {
        app_c009c0e4f1_tickets: [{ data: [ticket], error: null }],
        app_c009c0e4f1_users: [{ data: [requester], error: null }],
      },
      rpcs: {
        helpdesk_claim_ticket_notifications: { data: [delivery], error: null },
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    const result = await repository.claim(25, NOW);

    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_claim_ticket_notifications', {
      p_limit: 25,
      p_now: '2026-08-24T12:00:00.000Z',
    });
    expect(fake.from.mock.calls.map(([table]) => table)).toEqual([
      'app_c009c0e4f1_tickets',
      'app_c009c0e4f1_users',
    ]);
    expect(result).toEqual([{ ...delivery, ticket, requester }]);
  });

  it('mapeia enqueue e nextAttemptAt para os nomes exatos das RPCs', async () => {
    const fake = fakeSupabase({
      rpcs: {
        helpdesk_enqueue_ticket_notification: { data: { id: 'delivery-id' }, error: null },
        helpdesk_complete_ticket_notification: { data: { id: 'delivery-id' }, error: null },
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    await repository.enqueue({
      ticketId: TICKET_ID,
      notificationType: 'awaiting_requester',
      channel: 'teams',
      cycleKey: '2026-08-24',
    });
    await repository.complete({
      id: '33333333-3333-3333-3333-333333333333',
      success: false,
      error: 'delivery_error',
      nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
    });

    expect(fake.rpc).toHaveBeenNthCalledWith(1, 'helpdesk_enqueue_ticket_notification', {
      p_ticket_id: TICKET_ID,
      p_notification_type: 'awaiting_requester',
      p_channel: 'teams',
      p_cycle_key: '2026-08-24',
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, 'helpdesk_complete_ticket_notification', {
      p_delivery_id: '33333333-3333-3333-3333-333333333333',
      p_success: false,
      p_error: 'delivery_error',
      p_next_attempt_at: '2026-08-25T12:00:00.000Z',
    });
  });
});

describe('createCorsHeaders', () => {
  it('permite somente a origem do app, POST/OPTIONS e headers necessários', () => {
    expect(createCorsHeaders('https://responsum.example/tickets')).toEqual({
      'Access-Control-Allow-Origin': 'https://responsum.example',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      Vary: 'Origin',
    });
  });
});
