import { describe, expect, it, vi } from 'vitest';
import {
  prepareDeliveries,
  processDeliveries,
} from '../../supabase/functions/notify-ticket-communications/_shared/processor.mjs';

const now = new Date('2026-08-24T12:00:00.000Z');
const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso',
  status: 'in_progress',
  created_by: 'requester-id',
  category: 'ti',
  subcategory: 'acesso',
  resolved_at: null,
  feedback_submitted_at: null,
};
const requester = { id: 'requester-id', name: 'Ana', email: 'ana@bpplaw.com.br' };
const awaitingRequesterCandidate = {
  enabledAt: '2026-08-01T00:00:00.000Z',
  ticket,
  requester,
  lastHumanMessage: { user_id: 'support-id', created_at: '2026-08-22T12:00:00.000Z' },
};
const emailDelivery = {
  id: 'delivery-email',
  notification_type: 'awaiting_requester',
  channel: 'email',
  ticket,
  requester,
};
const teamsDelivery = {
  id: 'delivery-teams',
  notification_type: 'awaiting_requester',
  channel: 'teams',
  ticket,
  requester,
};

function fakeRepository({ candidates = [], claimed = [], completeError, completeErrors = [] } = {}) {
  const enqueued: Record<string, unknown>[] = [];
  const completed: Record<string, unknown>[] = [];
  let completeAttempt = 0;
  return {
    enqueued,
    completed,
    listCandidates: vi.fn(async () => candidates),
    enqueue: vi.fn(async (row) => {
      enqueued.push(row);
      return row;
    }),
    claim: vi.fn(async () => claimed),
    complete: vi.fn(async (row) => {
      completed.push(row);
      const error = completeErrors[completeAttempt] ?? completeError;
      completeAttempt += 1;
      if (error) throw error;
    }),
  };
}

function fakeGraph({ emailError, teamsError, resolvedUserId = 'entra-user-id' } = {}) {
  return {
    sendEmail: vi.fn(async () => {
      if (emailError) throw emailError;
    }),
    resolveUserId: vi.fn(async () => resolvedUserId),
    sendTeamsActivity: vi.fn(async () => {
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
      },
      {
        ticketId: ticket.id,
        notificationType: 'awaiting_requester',
        channel: 'teams',
        cycleKey: '2026-08-24',
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
      },
    ]);
    expect(result).toEqual({ candidates: 2, enqueued: 1 });
  });
});

describe('processDeliveries', () => {
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
      expect.objectContaining({ id: emailDelivery.id, success: true }),
      expect.objectContaining({
        id: teamsDelivery.id,
        success: false,
        error: 'delivery_error',
        nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
      }),
    ]);
    expect(result).toEqual({ selected: 2, sent: 1, failed: 1, skipped: 0 });
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
        success: false,
        error: 'Configuração do destinatário ausente ou e-mail inválido',
        nextAttemptAt: new Date('2026-08-25T12:00:00.000Z'),
      },
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, skipped: 0 });
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
    expect(graph.sendTeamsActivity).not.toHaveBeenCalled();
    expect(repository.completed).toEqual([
      expect.objectContaining({
        id: teamsDelivery.id,
        success: false,
        error: 'Entrega de comunicação inválida',
      }),
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, skipped: 0 });
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
    expect(result).toEqual({ selected: 1, sent: 0, failed: 1, skipped: 0 });
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
      expect.objectContaining({ id: emailDelivery.id, success: true }),
    ]);
    expect(result).toEqual({ selected: 1, sent: 0, failed: 0, skipped: 1 });
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
    expect(graph.sendTeamsActivity).toHaveBeenCalledTimes(1);
    expect(repository.completed).toEqual([
      expect.objectContaining({ id: emailDelivery.id, success: false, error: 'delivery_error' }),
      expect.objectContaining({ id: teamsDelivery.id, success: true }),
    ]);
    expect(result).toEqual({ selected: 2, sent: 1, failed: 0, skipped: 1 });
  });

  it('continua o lote depois de rejeições de conclusão para entrega inválida e destinatário ausente', async () => {
    const invalidDelivery = { ...emailDelivery, id: 'invalid-delivery', channel: 'push' };
    const missingRequesterDelivery = { ...emailDelivery, id: 'missing-requester', requester: null };
    const repository = fakeRepository({
      claimed: [invalidDelivery, missingRequesterDelivery, teamsDelivery],
      completeErrors: [new Error('database unavailable'), new Error('database unavailable')],
    });
    const graph = fakeGraph();

    const result = await processDeliveries({
      repository,
      graph,
      appBaseUrl: 'https://responsum.example',
      now,
    });

    expect(graph.sendEmail).not.toHaveBeenCalled();
    expect(graph.sendTeamsActivity).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ selected: 3, sent: 1, failed: 0, skipped: 2 });
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
    expect(result).toEqual({ selected: 0, sent: 0, failed: 0, skipped: 0 });
    expect(JSON.stringify(result)).not.toContain(requester.email);
    expect(JSON.stringify(result)).not.toContain(requester.name);
  });
});
