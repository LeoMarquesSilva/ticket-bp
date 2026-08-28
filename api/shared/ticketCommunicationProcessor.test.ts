import { describe, expect, it, vi } from 'vitest';
import {
  prepareDeliveries,
  processDeliveries,
} from '../../supabase/functions/notify-ticket-communications/_shared/processor.mjs';

const now = new Date('2026-08-24T12:00:00.000Z');
const requesterId = '22222222-2222-2222-2222-222222222222';
const supportId = '33333333-3333-3333-3333-333333333333';
const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso',
  status: 'in_progress',
  created_by: requesterId,
  category: 'ti',
  subcategory: 'acesso',
  resolved_at: null,
  feedback_submitted_at: null,
};
const requester = { id: requesterId, name: 'Ana', email: 'ana@bpplaw.com.br' };
const awaitingRequesterCandidate = {
  enabledAt: '2026-08-01T00:00:00.000Z',
  ticket,
  requester,
  lastHumanMessage: { user_id: supportId, created_at: '2026-08-22T12:00:00.000Z' },
};
const emailDelivery = {
  id: 'delivery-email',
  ticket_id: ticket.id,
  notification_type: 'awaiting_requester',
  channel: 'email',
  cycle_key: '2026-08-24',
  claim_token: '44444444-4444-4444-4444-444444444444',
  attempt_count: 1,
  ticket,
  requester,
  enabledAt: awaitingRequesterCandidate.enabledAt,
  lastHumanMessage: awaitingRequesterCandidate.lastHumanMessage,
};
const teamsDelivery = {
  id: 'delivery-teams',
  ticket_id: ticket.id,
  notification_type: 'awaiting_requester',
  channel: 'teams',
  cycle_key: '2026-08-24',
  claim_token: '55555555-5555-5555-5555-555555555555',
  attempt_count: 1,
  ticket,
  requester,
  enabledAt: awaitingRequesterCandidate.enabledAt,
  lastHumanMessage: awaitingRequesterCandidate.lastHumanMessage,
};

function fakeRepository({ candidates = [], claimed = [], completeError, completeErrors = [], emailTemplateOverrides = {} } = {}) {
  const enqueued: Record<string, unknown>[] = [];
  const completed: Record<string, unknown>[] = [];
  const released: Record<string, unknown>[] = [];
  const claimQueue = [...claimed];
  let completeAttempt = 0;
  return {
    enqueued,
    completed,
    released,
    listCandidates: vi.fn(async () => candidates),
    getEmailTemplateOverrides: vi.fn(async () => emailTemplateOverrides),
    enqueue: vi.fn(async (row) => {
      enqueued.push(row);
      return row;
    }),
    claim: vi.fn(async (limit: number) => claimQueue.splice(0, limit)),
    getContext: vi.fn(async (ticketId: string) => {
      const source = claimed.find((delivery) => delivery.ticket_id === ticketId) ?? claimed[0];
      return source ? {
        enabledAt: source.enabledAt,
        ticket: source.ticket,
        requester: source.requester,
        lastHumanMessage: source.lastHumanMessage,
      } : null;
    }),
    countReady: vi.fn(async () => claimQueue.length),
    release: vi.fn(async (row) => {
      released.push(row);
      return row;
    }),
    complete: vi.fn(async (row) => {
      completed.push(row);
      const error = completeErrors[completeAttempt] ?? completeError;
      completeAttempt += 1;
      if (error) throw error;
      return row;
    }),
  };
}

function fakeGraph({ emailError, teamsError, resolvedUserId = 'entra-user-id' } = {}) {
  return {
    sendEmail: vi.fn(async () => {
      if (emailError) throw emailError;
    }),
    resolveUserId: vi.fn(async () => resolvedUserId),
    sendTeamsChat: vi.fn(async () => {
      if (teamsError) throw teamsError;
    }),
  };
}

describe('prepareDeliveries', () => {
  it('enfileira email e Teams para chamado aguardando solicitante no ciclo local atual', async () => {
    const repository = fakeRepository({ candidates: [awaitingRequesterCandidate] });

    const result = await prepareDeliveries({
      repository,
      now,
      appBaseUrl: 'https://responsum.example',
    });

    expect(repository.enqueued).toEqual([
      {
        ticketId: ticket.id,
        notificationType: 'awaiting_requester',
        channel: 'email',
        cycleKey: '2026-08-24',
        nextAttemptAt: now,
      },
      {
        ticketId: ticket.id,
        notificationType: 'awaiting_requester',
        channel: 'teams',
        cycleKey: '2026-08-24',
        nextAttemptAt: now,
      },
    ]);
    expect(result).toEqual({ candidates: 1, enqueued: 2 });
  });

  it('usa a resolução como ciclo do convite único e não inclui NPS isento', async () => {
    const resolvedAt = '2026-08-24T11:00:00.000Z';
    const repository = fakeRepository({
      candidates: [
        {
          ...awaitingRequesterCandidate,
          ticket: {
            ...ticket,
            status: 'resolved',
            resolved_at: resolvedAt,
          },
          lastHumanMessage: null,
        },
        {
          ...awaitingRequesterCandidate,
          ticket: {
            ...ticket,
            id: '22222222-2222-2222-2222-222222222222',
            status: 'resolved',
            resolved_at: resolvedAt,
            category: 'validacao_de_indicadores',
            subcategory: 'auditoria_de_excludentes_envio_de_evidencia',
          },
          lastHumanMessage: null,
        },
      ],
    });

    const result = await prepareDeliveries({ repository, now, appBaseUrl: 'https://responsum.example' });

    expect(repository.enqueued).toEqual([
      {
        ticketId: ticket.id,
        notificationType: 'resolved_feedback_invite',
        channel: 'email',
        cycleKey: resolvedAt,
        nextAttemptAt: now,
      },
    ]);
    expect(result).toEqual({ candidates: 2, enqueued: 1 });
  });

  it('restringe o disparo imediato ao convite por email e fixa o instante claimable no enqueue', async () => {
    const resolvedAt = '2026-08-20T11:00:00.000Z';
    const repository = fakeRepository({ candidates: [{
      ...awaitingRequesterCandidate,
      ticket: { ...ticket, status: 'resolved', resolved_at: resolvedAt },
      lastHumanMessage: null,
    }] });

    await prepareDeliveries({
      repository,
      now,
      ticketId: ticket.id,
      notificationType: 'resolved_feedback_invite',
    });

    expect(repository.listCandidates).toHaveBeenCalledWith(ticket.id);
    expect(repository.enqueued).toEqual([{
      ticketId: ticket.id,
      notificationType: 'resolved_feedback_invite',
      channel: 'email',
      cycleKey: resolvedAt,
      nextAttemptAt: now,
    }]);
  });
});

describe('processDeliveries', () => {
  it('carrega a configuração uma vez e aplica os textos saneados ao e-mail', async () => {
    const repository = fakeRepository({
      claimed: [emailDelivery],
      emailTemplateOverrides: {
        awaiting_requester: { subject: 'Precisamos da sua resposta', action: 'Responder agora' },
      },
    });
    const graph = fakeGraph();

    await processDeliveries({
      repository, graph, appBaseUrl: 'https://responsum.example', now,
      monotonicNow: () => 0,
    });

    expect(repository.getEmailTemplateOverrides).toHaveBeenCalledTimes(1);
    expect(graph.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: requester.email,
      subject: 'Precisamos da sua resposta',
      html: expect.stringContaining('Responder agora'),
    }));
  });

  it('drena 102 entregas em mais de um lote dentro do orçamento explícito', async () => {
    const deliveries = Array.from({ length: 102 }, (_, index) => ({
      ...emailDelivery,
      id: `delivery-${index + 1}`,
      claim_token: `claim-${index + 1}`,
    }));
    const repository = fakeRepository({ claimed: deliveries });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
      batchSize: 100,
      budget: { maxDeliveries: 200, maxBatches: 4, maxDurationMs: 30_000 },
      monotonicNow: () => 0,
    });

    expect(repository.claim).toHaveBeenCalledTimes(2);
    expect(repository.claim.mock.calls.map(([limit]) => limit)).toEqual([100, 100]);
    expect(graph.sendEmail).toHaveBeenCalledTimes(102);
    expect(result).toEqual({
      selected: 102,
      sent: 102,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      backlog: 0,
      budgetExhausted: false,
    });
  });

  it('encerra no orçamento e informa o backlog sem deixar loop infinito', async () => {
    const deliveries = Array.from({ length: 3 }, (_, index) => ({
      ...emailDelivery,
      id: `budget-delivery-${index + 1}`,
      claim_token: `budget-claim-${index + 1}`,
    }));
    const repository = fakeRepository({ claimed: deliveries });

    const result = await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      now,
      batchSize: 2,
      budget: { maxDeliveries: 2, maxBatches: 1, maxDurationMs: 30_000 },
      monotonicNow: () => 0,
    });

    expect(repository.claim).toHaveBeenCalledTimes(1);
    expect(repository.countReady).toHaveBeenCalled();
    expect(result).toEqual({
      selected: 2,
      sent: 2,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      backlog: 1,
      budgetExhausted: true,
    });
  });

  it('interrompe dentro do lote e devolve os claims ainda não processados quando o tempo acaba', async () => {
    const deliveries = [emailDelivery, {
      ...emailDelivery,
      id: 'delivery-not-processed',
      claim_token: 'claim-not-processed',
    }];
    const repository = fakeRepository({ claimed: deliveries });
    repository.countReady.mockResolvedValue(1);
    const monotonicNow = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(30_001);

    const result = await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      now,
      batchSize: 100,
      budget: { maxDeliveries: 100, maxBatches: 2, maxDurationMs: 30_000 },
      monotonicNow,
    });

    expect(repository.release).toHaveBeenCalledWith({
      id: 'delivery-not-processed',
      claimToken: 'claim-not-processed',
      attemptCount: 1,
      nextAttemptAt: now,
    });
    expect(repository.getContext).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      selected: 2,
      sent: 1,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      backlog: 1,
      budgetExhausted: true,
    });
  });

  it('revalida o contexto antes de cada canal e cancela Teams após resposta intercalada', async () => {
    const repository = fakeRepository({ claimed: [emailDelivery, teamsDelivery] });
    repository.getContext
      .mockResolvedValueOnce({
        enabledAt: awaitingRequesterCandidate.enabledAt,
        ticket,
        requester,
        lastHumanMessage: awaitingRequesterCandidate.lastHumanMessage,
      })
      .mockResolvedValueOnce({
        enabledAt: awaitingRequesterCandidate.enabledAt,
        ticket,
        requester,
        lastHumanMessage: { user_id: requesterId, created_at: '2026-08-24T12:00:01.000Z' },
      });
    const graph = fakeGraph();

    const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(repository.getContext).toHaveBeenCalledTimes(2);
    expect(graph.sendEmail).toHaveBeenCalledTimes(1);
    expect(graph.sendTeamsChat).not.toHaveBeenCalled();
    expect(repository.completed.at(-1)).toEqual(expect.objectContaining({
      id: teamsDelivery.id,
      outcome: 'cancelled',
      error: 'no_longer_eligible',
    }));
    expect(result.cancelled).toBe(1);
  });

  it('cancela convite de ciclo antigo mesmo que o ticket tenha sido resolvido novamente', async () => {
    const oldCycleDelivery = {
      ...emailDelivery,
      notification_type: 'resolved_feedback_invite',
      cycle_key: '2026-08-20T12:00:00.000Z',
      ticket: {
        ...ticket,
        status: 'resolved',
        resolved_at: '2026-08-24T12:00:00.000Z',
      },
      lastHumanMessage: null,
    };
    const repository = fakeRepository({ claimed: [oldCycleDelivery] });
    repository.getContext.mockResolvedValue({
      enabledAt: '2026-08-01T00:00:00.000Z',
      ticket: {
        ...ticket,
        status: 'resolved',
        resolved_at: '2026-08-24T12:00:00.000Z',
      },
      requester,
      lastHumanMessage: null,
    });
    const graph = fakeGraph();

    const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(repository.completed[0]).toEqual(expect.objectContaining({ outcome: 'cancelled' }));
    expect(result.cancelled).toBe(1);
  });

  it('envia ao chat somente para o usuário resolvido e mantém o link direto', async () => {
    const repository = fakeRepository({ claimed: [teamsDelivery] });
    const graph = fakeGraph();

    await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(graph.sendTeamsChat).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'entra-user-id',
      ticketUrl: 'https://responsum.example/tickets/11111111-1111-1111-1111-111111111111',
    }));
  });

  it('conclui somente com token e versão recebidos no claim', async () => {
    const repository = fakeRepository({ claimed: [emailDelivery] });

    await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(repository.completed[0]).toEqual(expect.objectContaining({
      id: emailDelivery.id,
      claimToken: emailDelivery.claim_token,
      attemptCount: emailDelivery.attempt_count,
      outcome: 'sent',
    }));
  });

  it('classifica como skipped a conclusão rejeitada por fencing', async () => {
    const repository = fakeRepository({ claimed: [emailDelivery] });
    repository.complete.mockResolvedValueOnce(null);

    const result = await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('reclama somente o ticket e tipo do disparo imediato usando relógio lido após o preparo', async () => {
    const repository = fakeRepository({ claimed: [emailDelivery] });
    const claimNow = new Date('2026-08-24T12:00:01.000Z');

    await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      clock: vi.fn(() => claimNow),
      ticketId: ticket.id,
      notificationType: 'resolved_feedback_invite',
    });

    expect(repository.claim).toHaveBeenCalledWith(100, claimNow, {
      ticketId: ticket.id,
      notificationType: 'resolved_feedback_invite',
    });
  });

  it('cancela retry quando o solicitante respondeu depois do enqueue, sem chamar Graph', async () => {
    const repository = fakeRepository({ claimed: [{
      ...emailDelivery,
      lastHumanMessage: { user_id: requesterId, created_at: '2026-08-24T11:59:00.000Z' },
    }] });
    const graph = fakeGraph();

    const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(repository.completed).toEqual([{
      id: emailDelivery.id,
      claimToken: emailDelivery.claim_token,
      attemptCount: emailDelivery.attempt_count,
      outcome: 'cancelled',
      error: 'no_longer_eligible',
      nextAttemptAt: null,
    }]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 0, cancelled: 1, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it.each([
    ['ausente', null],
    ['com email inválido', { ...requester, email: 'email-invalido' }],
  ])('prioriza cancelamento da entrega inelegível quando o destinatário está %s', async (_case, invalidRequester) => {
    const repository = fakeRepository({ claimed: [{
      ...emailDelivery,
      requester: invalidRequester,
      lastHumanMessage: { user_id: requesterId, created_at: '2026-08-24T11:59:00.000Z' },
    }] });
    const graph = fakeGraph();

    const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(graph.resolveUserId).not.toHaveBeenCalled();
    expect(repository.completed).toEqual([{
      id: emailDelivery.id,
      claimToken: emailDelivery.claim_token,
      attemptCount: emailDelivery.attempt_count,
      outcome: 'cancelled',
      error: 'no_longer_eligible',
      nextAttemptAt: null,
    }]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 0, cancelled: 1, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it('cancela convite quando a avaliação foi enviada depois do enqueue, sem chamar Graph', async () => {
    const repository = fakeRepository({ claimed: [{
      ...emailDelivery,
      notification_type: 'resolved_feedback_invite',
      ticket: {
        ...ticket,
        status: 'resolved',
        resolved_at: '2026-08-24T11:00:00.000Z',
        feedback_submitted_at: '2026-08-24T11:30:00.000Z',
      },
      lastHumanMessage: null,
    }] });
    const graph = fakeGraph();

    const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(repository.completed[0]).toEqual(expect.objectContaining({ outcome: 'cancelled' }));
    expect(result.cancelled).toBe(1);
  });

  it('não reenvia email quando somente Teams falha', async () => {
    const repository = fakeRepository({ claimed: [emailDelivery, teamsDelivery] });
    const graph = fakeGraph({ teamsError: new Error('Teams app not installed') });

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).toHaveBeenCalledTimes(1);
    expect(graph.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: requester.email,
      subject: 'Seu chamado aguarda uma resposta: Acesso',
    }));
    expect(graph.resolveUserId).toHaveBeenCalledWith(requester.email);
    expect(repository.completed).toEqual([
      expect.objectContaining({ id: emailDelivery.id, outcome: 'sent' }),
      expect.objectContaining({
        id: teamsDelivery.id,
        outcome: 'failed',
        error: 'delivery_error',
        nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
      }),
    ]);
    expect(result).toEqual({ selected: 2, sent: 1, failed: 1, cancelled: 0, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it('registra falha de configuração sem enviar quando o destinatário está ausente', async () => {
    const repository = fakeRepository({
      claimed: [{ ...emailDelivery, requester: null }],
    });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(graph.resolveUserId).not.toHaveBeenCalled();
    expect(repository.completed).toEqual([
      {
        id: emailDelivery.id,
        claimToken: emailDelivery.claim_token,
        attemptCount: emailDelivery.attempt_count,
        outcome: 'failed',
        error: 'Configuração do destinatário ausente ou e-mail inválido',
        nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
      },
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, cancelled: 0, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it('recusa combinação de tipo e canal que não pertence à política de entrega', async () => {
    const repository = fakeRepository({
      claimed: [{
        ...teamsDelivery,
        notification_type: 'resolved_feedback_invite',
      }],
    });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.resolveUserId).not.toHaveBeenCalled();
    expect(graph.sendTeamsChat).not.toHaveBeenCalled();
    expect(repository.completed).toEqual([
      expect.objectContaining({
        id: teamsDelivery.id,
        outcome: 'failed',
        error: 'Entrega de comunicação inválida',
      }),
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, cancelled: 0, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it('persiste apenas a categoria HTTP normalizada, sem a mensagem bruta do Graph', async () => {
    const unsafeMessage = `Falha para ana@bpplaw.com.br com Bearer ${'secret-token-value-'.repeat(40)}`;
    const error = Object.assign(new Error(unsafeMessage), { status: 429, code: 'TooManyRequests' });
    const repository = fakeRepository({ claimed: [emailDelivery] });

    const result = await processDeliveries({
      repository,
      graph: fakeGraph({ emailError: error }),
      appBaseUrl: 'https://responsum.example',
      now,
    });

    const completion = repository.completed[0] as {
      error: string;
      nextAttemptAt: Date;
    };
    expect(completion.error).toBe('graph_http_429');
    expect(completion.error).not.toContain('ana@bpplaw.com.br');
    expect(completion.error).not.toContain('secret-token-value');
    expect(completion.error.length).toBeLessThanOrEqual(500);
    expect(completion.nextAttemptAt).toEqual(new Date('2026-08-25T12:00:00.000Z'));
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, cancelled: 0, skipped: 0, backlog: 0, budgetExhausted: false });
  });

  it.each([
    ['Cookie', new Error('Cookie: session=secret-cookie-value'), 'secret-cookie-value'],
    ['Authorization JSON', new Error('{"Authorization":"Bearer secret-json-token"}'), 'secret-json-token'],
    ['URL assinada', new Error('https://graph.example/file?sig=secret-url-signature'), 'secret-url-signature'],
    ['corpo curto com dado pessoal', new Error('Ana Souza <ana.souza@bpplaw.com.br>'), 'ana.souza@bpplaw.com.br'],
    ['propriedades e causa', Object.assign(new Error('falha genérica'), {
      cause: new Error('cause-secret-value'),
      body: 'body-secret-value',
      headers: { authorization: 'Bearer property-secret-value' },
      url: 'https://graph.example/?sig=property-url-signature',
    }), 'cause-secret-value'],
  ])('não persiste texto bruto de erro com %s', async (_kind, error, secret) => {
    const repository = fakeRepository({ claimed: [emailDelivery] });

    await processDeliveries({
      repository,
      graph: fakeGraph({ emailError: error }),
      appBaseUrl: 'https://responsum.example',
      now,
    });

    const completion = repository.completed[0] as { error: string };
    expect(completion.error).toBe('delivery_error');
    expect(JSON.stringify(completion)).not.toContain(secret);
    expect(JSON.stringify(completion)).not.toContain('property-secret-value');
    expect(JSON.stringify(completion)).not.toContain('property-url-signature');
  });

  it('classifica como skipped o envio aceito quando a conclusão de sucesso não é persistida', async () => {
    const repository = fakeRepository({
      claimed: [emailDelivery],
      completeError: new Error('database unavailable'),
    });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalledTimes(1);
    expect(repository.completed).toEqual([
      expect.objectContaining({ id: emailDelivery.id, outcome: 'sent' }),
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 0, cancelled: 0, skipped: 1, backlog: 0, budgetExhausted: false });
  });

  it('continua o lote quando a conclusão da falha Graph da primeira entrega é rejeitada', async () => {
    const repository = fakeRepository({
      claimed: [emailDelivery, teamsDelivery],
      completeErrors: [new Error('database unavailable')],
    });
    const graph = fakeGraph({ emailError: new Error('primeira falha Graph') });

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).toHaveBeenCalledTimes(1);
    expect(graph.sendTeamsChat).toHaveBeenCalledTimes(1);
    expect(repository.completed).toEqual([
      expect.objectContaining({ id: emailDelivery.id, outcome: 'failed', error: 'delivery_error' }),
      expect.objectContaining({ id: teamsDelivery.id, outcome: 'sent' }),
    ]);
    expect(result).toEqual({ selected: 2, sent: 1, failed: 0, cancelled: 0, skipped: 1, backlog: 0, budgetExhausted: false });
  });

  it('continua o lote depois de rejeições de conclusão para entrega inválida e destinatário ausente', async () => {
    const invalidDelivery = { ...emailDelivery, id: 'invalid-delivery', channel: 'push' };
    const missingRequesterDelivery = { ...emailDelivery, id: 'missing-requester', requester: null };
    const repository = fakeRepository({
      claimed: [invalidDelivery, missingRequesterDelivery, teamsDelivery],
      completeErrors: [new Error('database unavailable'), new Error('database unavailable')],
    });
    repository.getContext
      .mockResolvedValueOnce({
        enabledAt: missingRequesterDelivery.enabledAt,
        ticket: missingRequesterDelivery.ticket,
        requester: null,
        lastHumanMessage: missingRequesterDelivery.lastHumanMessage,
      })
      .mockResolvedValueOnce({
        enabledAt: teamsDelivery.enabledAt,
        ticket: teamsDelivery.ticket,
        requester: teamsDelivery.requester,
        lastHumanMessage: teamsDelivery.lastHumanMessage,
      });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(graph.sendTeamsChat).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ selected: 3, sent: 1, failed: 0, cancelled: 0, skipped: 2, backlog: 0, budgetExhausted: false });
  });

  it('retorna somente contadores quando não há entregas no lote', async () => {
    const repository = fakeRepository({
      claimed: [],
    });

    const result = await processDeliveries({
      repository,
      graph: fakeGraph(),
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(repository.completed).toEqual([]);
    expect(result).toEqual({ selected: 0, sent: 0, failed: 0, cancelled: 0, skipped: 0, backlog: 0, budgetExhausted: false });
    expect(JSON.stringify(result)).not.toContain(requester.email);
    expect(JSON.stringify(result)).not.toContain(requester.name);
  });
});
