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
  rpcs?: Record<string, QueryResult | QueryResult[]>;
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
  const rpcQueues = new Map(Object.entries(input.rpcs ?? {}).map(([name, results]) => [
    name,
    Array.isArray(results) ? [...results] : [results],
  ]));
  const rpc = vi.fn(async (name: string) => rpcQueues.get(name)?.shift() ?? { data: null, error: null });

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
    clock: vi.fn(() => NOW),
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

  it('recusa daily por usuário antes de construir dependências Graph ausentes', async () => {
    const context = handlerDependencies();
    const createRuntimeDependencies = vi.fn(() => {
      throw new Error('missing Graph secrets');
    });

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'daily' },
      dependencies: {
        supabase: context.dependencies.supabase,
        createRuntimeDependencies,
      },
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(createRuntimeDependencies).not.toHaveBeenCalled();
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
      notificationType: undefined,
    });
    expect(context.processDeliveries).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      graph: context.dependencies.graph,
      appBaseUrl: 'https://responsum.example',
      clock: context.dependencies.clock,
      ticketId: undefined,
      notificationType: undefined,
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
      notificationType: 'resolved_feedback_invite',
    });
    expect(context.processDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      ticketId: TICKET_ID,
      notificationType: 'resolved_feedback_invite',
    }));
    expect(result.status).toBe(200);
  });

  it('lê o relógio de claim somente depois que o preparo termina', async () => {
    const context = handlerDependencies();
    const prepareNow = new Date('2026-08-24T12:00:00.000Z');
    const claimNow = new Date('2026-08-24T12:00:01.000Z');
    const clock = vi.fn()
      .mockReturnValueOnce(prepareNow)
      .mockReturnValueOnce(claimNow);
    context.dependencies.clock = clock;
    context.processDeliveries.mockImplementationOnce(async ({ clock: processClock }) => {
      expect(processClock()).toBe(claimNow);
      return { selected: 0, sent: 0, failed: 0, cancelled: 0, skipped: 0 };
    });

    await handleTicketCommunicationRequest({
      authMode: 'secret',
      body: { action: 'daily' },
      dependencies: context.dependencies,
    });

    expect(context.prepareDeliveries).toHaveBeenCalledWith(expect.objectContaining({ now: prepareNow }));
    expect(clock).toHaveBeenCalledTimes(2);
    expect(context.prepareDeliveries.mock.invocationCallOrder[0])
      .toBeLessThan(context.processDeliveries.mock.invocationCallOrder[0]);
  });

  it('torna a entrega recém-criada claimable sem consumir outra fila no disparo do usuário', async () => {
    const otherTicketId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const prepareNow = new Date('2026-08-24T12:00:00.000Z');
    const claimNow = new Date('2026-08-24T12:00:01.000Z');
    const clock = vi.fn().mockReturnValueOnce(prepareNow).mockReturnValueOnce(claimNow);
    const requester = { id: REQUESTER_ID, name: 'Ana', email: 'ana@bpplaw.com.br' };
    const resolvedTicket = {
      id: TICKET_ID,
      title: 'Acesso',
      status: 'resolved',
      created_by: REQUESTER_ID,
      category: 'ti',
      subcategory: 'acesso',
      resolved_at: '2026-08-24T11:00:00.000Z',
      feedback_submitted_at: null,
    };
    const queue: Array<Record<string, unknown>> = [{
      id: '99999999-9999-9999-9999-999999999999',
      ticket_id: otherTicketId,
      notification_type: 'awaiting_feedback',
      channel: 'teams',
      nextAttemptAt: prepareNow,
    }];
    const repository = {
      listCandidates: vi.fn(async () => [{
        enabledAt: '2026-08-01T00:00:00.000Z',
        ticket: resolvedTicket,
        requester,
        lastHumanMessage: null,
      }]),
      enqueue: vi.fn(async (input: {
        ticketId: string;
        notificationType: string;
        channel: string;
        nextAttemptAt: Date;
      }) => {
        queue.push({
          id: '88888888-8888-8888-8888-888888888888',
          ticket_id: input.ticketId,
          notification_type: input.notificationType,
          channel: input.channel,
          nextAttemptAt: input.nextAttemptAt,
          enabledAt: '2026-08-01T00:00:00.000Z',
          ticket: resolvedTicket,
          requester,
          lastHumanMessage: null,
        });
      }),
      claim: vi.fn(async (
        _limit: number,
        at: Date,
        filters: { ticketId: string; notificationType: string },
      ) => queue.filter((delivery) => (
        delivery.ticket_id === filters.ticketId
        && delivery.notification_type === filters.notificationType
        && (delivery.nextAttemptAt as Date) <= at
      ))),
      complete: vi.fn(async () => undefined),
    };
    const graph = {
      sendEmail: vi.fn(async () => undefined),
      resolveUserId: vi.fn(async () => 'entra-id'),
      sendTeamsActivity: vi.fn(async () => undefined),
    };
    const userQuery = fakeQuery({ data: { id: TICKET_ID, status: 'resolved' }, error: null });

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      body: { action: 'ticket_resolved', ticketId: TICKET_ID },
      dependencies: {
        supabase: { from: vi.fn(() => userQuery) },
        repository,
        graph,
        appBaseUrl: 'https://responsum.example',
        clock,
      },
    });

    expect(result).toEqual({ status: 200, body: { ok: true, prepared: 1, sent: 1, failed: 0 } });
    expect(repository.claim).toHaveBeenCalledWith(100, claimNow, {
      ticketId: TICKET_ID,
      notificationType: 'resolved_feedback_invite',
    });
    expect(graph.sendEmail).toHaveBeenCalledTimes(1);
    expect(graph.resolveUserId).not.toHaveBeenCalled();
    expect(queue[0].ticket_id).toBe(otherTicketId);
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
  it('usa RPC service_role paginada e aceita user_id UUID na última mensagem', async () => {
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
    const message = { user_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-08-22T12:00:00.000Z' };
    const fake = fakeSupabase({
      rpcs: {
        helpdesk_list_ticket_communication_candidates: { data: [{
          enabled_at: '2026-08-01T00:00:00.000Z',
          ticket: activeTicket,
          requester,
          last_human_message: message,
        }], error: null },
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
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_list_ticket_communication_candidates', {
      p_after_id: null,
      p_limit: 500,
      p_ticket_id: TICKET_ID,
    });
  });

  it('pagina até esgotar mais de mil candidatos sem N+1/Data API limit', async () => {
    const makeRows = (start: number, count: number) => Array.from({ length: count }, (_, offset) => {
      const serial = (start + offset).toString(16).padStart(12, '0');
      return {
        ticket_id: `11111111-1111-1111-1111-${serial}`,
        enabled_at: '2026-08-01T00:00:00.000Z',
        ticket: { id: `11111111-1111-1111-1111-${serial}`, created_by: REQUESTER_ID },
        requester: { id: REQUESTER_ID },
        last_human_message: null,
      };
    });
    const pages = [makeRows(1, 500), makeRows(501, 500), makeRows(1001, 1)];
    const fake = fakeSupabase({
      rpcs: {
        helpdesk_list_ticket_communication_candidates: pages.map((data) => ({ data, error: null })),
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    const result = await repository.listCandidates();

    expect(result).toHaveLength(1001);
    expect(fake.rpc).toHaveBeenCalledTimes(3);
    expect(fake.rpc.mock.calls[1][1].p_after_id).toBe(pages[0][499].ticket_id);
    expect(fake.rpc.mock.calls[2][1].p_after_id).toBe(pages[1][499].ticket_id);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('hidrata entregas reservadas com ticket e solicitante em consultas agrupadas', async () => {
    const delivery = {
      id: '33333333-3333-3333-3333-333333333333',
      ticket_id: TICKET_ID,
      notification_type: 'resolved_feedback_invite',
      channel: 'email',
    };
    const ticket = { id: TICKET_ID, title: 'Acesso', status: 'resolved', created_by: REQUESTER_ID };
    const requester = { id: REQUESTER_ID, name: 'Ana', email: 'ana@bpplaw.com.br' };
    const fake = fakeSupabase({
      rpcs: {
        helpdesk_claim_ticket_notifications: { data: [delivery], error: null },
        helpdesk_get_ticket_communication_contexts: { data: [{
          ticket_id: TICKET_ID,
          enabled_at: '2026-08-01T00:00:00.000Z',
          ticket,
          requester,
          last_human_message: null,
        }], error: null },
      },
    });
    const repository = createTicketCommunicationRepository(fake.client);

    const result = await repository.claim(25, NOW, {
      ticketId: TICKET_ID,
      notificationType: 'resolved_feedback_invite',
    });

    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_claim_ticket_notifications', {
      p_limit: 25,
      p_now: '2026-08-24T12:00:00.000Z',
      p_ticket_id: TICKET_ID,
      p_notification_type: 'resolved_feedback_invite',
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, 'helpdesk_get_ticket_communication_contexts', {
      p_ticket_ids: [TICKET_ID],
    });
    expect(result).toEqual([{
      ...delivery,
      ticket,
      requester,
      enabledAt: '2026-08-01T00:00:00.000Z',
      lastHumanMessage: null,
    }]);
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
      nextAttemptAt: NOW,
    });
    await repository.complete({
      id: '33333333-3333-3333-3333-333333333333',
      outcome: 'failed',
      error: 'delivery_error',
      nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
    });

    expect(fake.rpc).toHaveBeenNthCalledWith(1, 'helpdesk_enqueue_ticket_notification', {
      p_ticket_id: TICKET_ID,
      p_notification_type: 'awaiting_requester',
      p_channel: 'teams',
      p_cycle_key: '2026-08-24',
      p_next_attempt_at: '2026-08-24T12:00:00.000Z',
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, 'helpdesk_complete_ticket_notification', {
      p_delivery_id: '33333333-3333-3333-3333-333333333333',
      p_outcome: 'failed',
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
