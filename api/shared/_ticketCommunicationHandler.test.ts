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

  it('expõe backlog sanitizado quando o orçamento diário termina', async () => {
    const context = handlerDependencies();
    context.processDeliveries.mockResolvedValueOnce({
      selected: 500,
      sent: 499,
      failed: 1,
      cancelled: 0,
      skipped: 0,
      backlog: 37,
      budgetExhausted: true,
    });

    const result = await handleTicketCommunicationRequest({
      authMode: 'secret',
      body: { action: 'daily' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        prepared: 2,
        sent: 499,
        failed: 1,
        backlog: 37,
        budgetExhausted: true,
      },
    });
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
          cycle_key: resolvedTicket.resolved_at,
          claim_token: '77777777-7777-7777-7777-777777777777',
          attempt_count: 1,
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
      getContext: vi.fn(async () => ({
        enabledAt: '2026-08-01T00:00:00.000Z',
        ticket: resolvedTicket,
        requester,
        lastHumanMessage: null,
      })),
      countReady: vi.fn(async () => 0),
      complete: vi.fn(async (input) => input),
    };
    const graph = {
      sendEmail: vi.fn(async () => undefined),
      resolveUserId: vi.fn(async () => 'entra-id'),
      sendTeamsChat: vi.fn(async () => undefined),
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

  it('recusa queue_status sem sessão de administrador', async () => {
    const context = handlerDependencies();
    const previewQueue = vi.fn(async () => ({ next: [], sent: [], counts: { next: 0, sent: 0 } }));

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      isAdmin: false,
      body: { action: 'queue_status' },
      dependencies: { ...context.dependencies, previewQueue },
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(previewQueue).not.toHaveBeenCalled();
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('recusa queue_status pela secret do cron', async () => {
    const context = handlerDependencies();
    const previewQueue = vi.fn();

    const result = await handleTicketCommunicationRequest({
      authMode: 'secret',
      isAdmin: true,
      body: { action: 'queue_status' },
      dependencies: { ...context.dependencies, previewQueue },
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(previewQueue).not.toHaveBeenCalled();
  });

  it('devolve a fila sanitizada sem enfileirar nem enviar', async () => {
    const context = handlerDependencies();
    const previewQueue = vi.fn(async () => ({
      nextRunAt: '2026-08-29T12:00:00.000Z',
      next: [{
        ticketId: TICKET_ID,
        ticketTitle: 'Acesso',
        requesterName: 'Samuel',
        requesterEmail: 'samuel.silva@bpplaw.com.br',
        notificationType: 'awaiting_requester',
        channel: 'teams',
        cycleKey: '2026-08-28',
        status: 'pending',
        sentAt: null,
        lastError: null,
      }],
      sent: [],
      counts: { next: 1, sent: 0 },
    }));

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      isAdmin: true,
      body: { action: 'queue_status' },
      dependencies: { ...context.dependencies, previewQueue },
    });

    expect(previewQueue).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      now: NOW,
    });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
    expect(context.processDeliveries).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        nextRunAt: '2026-08-29T12:00:00.000Z',
        next: [{
          ticketId: TICKET_ID,
          ticketTitle: 'Acesso',
          requesterName: 'Samuel',
          requesterEmail: 'samuel.silva@bpplaw.com.br',
          notificationType: 'awaiting_requester',
          channel: 'teams',
          cycleKey: '2026-08-28',
          status: 'pending',
          sentAt: null,
          lastError: null,
        }],
        sent: [],
        counts: { next: 1, sent: 0 },
      },
    });
  });

  it('recusa run_pending sem administrador e não dispara a rotina', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      isAdmin: false,
      body: { action: 'run_pending' },
      dependencies: context.dependencies,
    });

    expect(result).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(context.prepareDeliveries).not.toHaveBeenCalled();
  });

  it('envia a fila pendente com a mesma orquestração do daily', async () => {
    const context = handlerDependencies();

    const result = await handleTicketCommunicationRequest({
      authMode: 'user',
      isAdmin: true,
      body: { action: 'run_pending' },
      dependencies: context.dependencies,
    });

    expect(context.prepareDeliveries).toHaveBeenCalledWith({
      repository: context.dependencies.repository,
      now: NOW,
      ticketId: undefined,
      notificationType: undefined,
    });
    expect(context.processDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      ticketId: undefined,
      notificationType: undefined,
    }));
    expect(result).toEqual({
      status: 200,
      body: { ok: true, prepared: 2, sent: 1, failed: 1 },
    });
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

  it('reserva sem snapshot de contexto e revalida um ticket sob demanda', async () => {
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
    const context = await repository.getContext(TICKET_ID);

    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_claim_ticket_notifications', {
      p_limit: 25,
      p_now: '2026-08-24T12:00:00.000Z',
      p_ticket_id: TICKET_ID,
      p_notification_type: 'resolved_feedback_invite',
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, 'helpdesk_get_ticket_communication_contexts', {
      p_ticket_ids: [TICKET_ID],
    });
    expect(result).toEqual([delivery]);
    expect(context).toEqual({
      ticket,
      requester,
      enabledAt: '2026-08-01T00:00:00.000Z',
      lastHumanMessage: null,
    });
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
      claimToken: '44444444-4444-4444-4444-444444444444',
      attemptCount: 3,
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
      p_claim_token: '44444444-4444-4444-4444-444444444444',
      p_attempt_count: 3,
      p_outcome: 'failed',
      p_error: 'delivery_error',
      p_next_attempt_at: '2026-08-25T12:00:00.000Z',
    });
  });

  it('lê somente o envelope versionado dos textos de e-mail', async () => {
    const fake = fakeSupabase({ rpcs: {
      helpdesk_get_ticket_communication_email_templates: {
        data: '{"version":1,"templates":{"awaiting_feedback":{"action":"Avaliar agora"}}}',
        error: null,
      },
    }});
    const repository = createTicketCommunicationRepository(fake.client);

    await expect(repository.getEmailTemplateOverrides()).resolves.toEqual({
      awaiting_feedback: { action: 'Avaliar agora' },
    });
    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_get_ticket_communication_email_templates', {});
  });

  it('lê somente o envelope versionado dos textos do Teams', async () => {
    const fake = fakeSupabase({ rpcs: {
      helpdesk_get_ticket_communication_teams_templates: {
        data: '{"version":1,"templates":{"awaiting_requester":{"action":"Abrir no Teams"}}}',
        error: null,
      },
    }});
    const repository = createTicketCommunicationRepository(fake.client);

    await expect(repository.getTeamsTemplateOverrides()).resolves.toEqual({
      awaiting_requester: { action: 'Abrir no Teams' },
    });
    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_get_ticket_communication_teams_templates', {});
  });

  it('lê somente o envelope versionado dos prazos automáticos', async () => {
    const fake = fakeSupabase({ rpcs: {
      helpdesk_get_ticket_communication_schedule: {
        data: '{"version":1,"schedule":{"awaiting_requester":{"enabled":false,"delayHours":24}}}',
        error: null,
      },
    }});
    const repository = createTicketCommunicationRepository(fake.client);

    await expect(repository.getSchedule()).resolves.toEqual({
      awaiting_requester: { enabled: false, delayHours: 24 },
    });
    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_get_ticket_communication_schedule', {});
  });

  it('lista entregas recentes pela RPC de serviço', async () => {
    const fake = fakeSupabase({ rpcs: {
      helpdesk_list_ticket_communication_deliveries: {
        data: [{
          id: 'delivery-1',
          ticket_id: TICKET_ID,
          ticket_title: 'Acesso',
          requester_name: 'Ana',
          requester_email: 'ana@bpplaw.com.br',
          notification_type: 'awaiting_requester',
          channel: 'teams',
          cycle_key: '2026-08-28',
          status: 'sent',
          sent_at: '2026-08-28T12:05:00.000Z',
          last_error: null,
          updated_at: '2026-08-28T12:05:00.000Z',
        }],
        error: null,
      },
    }});
    const repository = createTicketCommunicationRepository(fake.client);

    await expect(repository.listDeliveries()).resolves.toEqual([{
      ticketId: TICKET_ID,
      ticketTitle: 'Acesso',
      requesterName: 'Ana',
      requesterEmail: 'ana@bpplaw.com.br',
      notificationType: 'awaiting_requester',
      channel: 'teams',
      cycleKey: '2026-08-28',
      status: 'sent',
      sentAt: '2026-08-28T12:05:00.000Z',
      lastError: null,
    }]);
    expect(fake.rpc).toHaveBeenCalledWith('helpdesk_list_ticket_communication_deliveries', {
      p_limit: 200,
    });
  });
});

describe('createCorsHeaders', () => {
  it('permite somente a origem do app, POST/OPTIONS e headers necessários', () => {
    expect(createCorsHeaders('https://responsum.example/tickets')).toEqual({
      'Access-Control-Allow-Origin': 'https://responsum.example',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-app-instance',
      Vary: 'Origin',
    });
  });
});
