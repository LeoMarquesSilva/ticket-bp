import { describe, expect, it } from 'vitest';
import {
  buildEnvioOverview,
  deriveTypeState,
  deriveTypeStates,
  describePresenca,
  formatDateTimeBr,
  pickDefaultMode,
  planSend,
  submitLabel,
  todayIsoSaoPaulo,
  type OrquestraiCardSummary,
  type OrquestraiEnvioLogEntry,
  type OrquestraiEnvioStatus,
} from './orquestraiEnvioStatus';
import {
  summarizeCard,
  summarizePresenca,
} from '../../supabase/functions/orquestrai-treinamento/_shared/envioStatus';

function card(patch: Partial<OrquestraiCardSummary> = {}): OrquestraiCardSummary {
  return {
    id: 'card-ppt',
    requestType: 'PPT',
    title: '[DC] Workshop — Tema',
    status: 'pending',
    workflowStage: 'tarefas',
    deadline: '2026-11-20',
    createdAt: '2026-11-10T13:00:00+00:00',
    presenca: null,
    ...patch,
  };
}

function entry(patch: Partial<OrquestraiEnvioLogEntry> = {}): OrquestraiEnvioLogEntry {
  return {
    id: `e-${Math.random()}`,
    requestType: 'PPT',
    sendMode: 'ppt',
    outcome: 'created',
    marketingRequestId: 'card-ppt',
    errorMessage: null,
    sentBy: 'u1',
    sentByName: 'Leonardo Marques',
    createdAt: '2026-11-10T13:00:00+00:00',
    ...patch,
  };
}

function status(patch: Partial<OrquestraiEnvioStatus> = {}): OrquestraiEnvioStatus {
  return { cards: [], cardsError: null, envios: [], enviosError: null, ...patch };
}

describe('deriveTypeState', () => {
  it('sem card nem histórico → não enviado', () => {
    expect(deriveTypeState('PPT', status())).toEqual({ kind: 'not_sent' });
  });

  it('card existente usa quem criou no histórico', () => {
    const state = deriveTypeState(
      'PPT',
      status({
        cards: [card()],
        envios: [
          entry({ outcome: 'already_existed', sentByName: 'Valentina', createdAt: '2026-11-12T10:00:00Z' }),
          entry({ outcome: 'created', createdAt: '2026-11-10T13:00:00Z' }),
        ],
      }),
    );
    expect(state).toMatchObject({
      kind: 'sent',
      sentAt: '2026-11-10T13:00:00Z',
      sentByName: 'Leonardo Marques',
    });
  });

  it('card enviado antes do histórico usa a data do card, sem autor', () => {
    const state = deriveTypeState('PPT', status({ cards: [card()] }));
    expect(state).toMatchObject({ kind: 'sent', sentAt: card().createdAt, sentByName: null });
  });

  it('falha mais recente sem card → falhou, com o motivo', () => {
    const state = deriveTypeState(
      'Certificados',
      status({
        envios: [
          entry({
            requestType: 'Certificados',
            outcome: 'failed',
            marketingRequestId: null,
            errorMessage: 'timeout',
          }),
        ],
      }),
    );
    expect(state).toMatchObject({ kind: 'failed', error: 'timeout' });
  });

  it('enviado no histórico mas sem card no ORQESTRAI → card removido', () => {
    const state = deriveTypeState('PPT', status({ envios: [entry()] }));
    expect(state).toMatchObject({ kind: 'removed', sentByName: 'Leonardo Marques' });
  });

  it('falha antiga seguida de sucesso com card → enviado', () => {
    const state = deriveTypeState(
      'PPT',
      status({
        cards: [card()],
        envios: [
          entry({ createdAt: '2026-11-11T10:00:00Z' }),
          entry({ outcome: 'failed', marketingRequestId: null, errorMessage: 'x', createdAt: '2026-11-10T10:00:00Z' }),
        ],
      }),
    );
    expect(state.kind).toBe('sent');
  });

  it('ORQESTRAI fora do ar: vale o histórico, sem card', () => {
    expect(deriveTypeState('PPT', status({ cardsError: 'offline', envios: [entry()] }))).toMatchObject({
      kind: 'sent',
      card: null,
    });
    expect(deriveTypeState('PPT', status({ cardsError: 'offline' }))).toEqual({ kind: 'unknown' });
  });
});

describe('planSend', () => {
  it('não recria o que já está no ORQESTRAI', () => {
    const states = deriveTypeStates(status({ cards: [card()] }));
    const plan = planSend('ppt_e_certificados', states);
    expect(plan.alreadySent).toEqual(['PPT']);
    expect(plan.toCreate).toEqual(['Certificados']);
    expect(plan.needsConfirm).toBe(false);
    expect(submitLabel(plan, states)).toBe('Enviar certificados');
  });

  it('tudo enviado → nada a fazer', () => {
    const states = deriveTypeStates(status({ cards: [card()] }));
    const plan = planSend('ppt', states);
    expect(plan.toCreate).toEqual([]);
    expect(submitLabel(plan, states)).toBe('Já enviado');
  });

  it('card removido pede confirmação para criar de novo', () => {
    const states = deriveTypeStates(status({ envios: [entry()] }));
    const plan = planSend('ppt', states);
    expect(plan.needsConfirm).toBe(true);
    expect(submitLabel(plan, states)).toBe('Criar de novo');
  });

  it('sem conseguir conferir também pede confirmação', () => {
    const plan = planSend('certificados', deriveTypeStates(null));
    expect(plan.needsConfirm).toBe(true);
  });

  it('falha anterior vira "Tentar de novo" sem confirmação', () => {
    const states = deriveTypeStates(
      status({ envios: [entry({ outcome: 'failed', marketingRequestId: null, errorMessage: 'x' })] }),
    );
    const plan = planSend('ppt', states);
    expect(plan.needsConfirm).toBe(false);
    expect(submitLabel(plan, states)).toBe('Tentar de novo');
  });
});

describe('pickDefaultMode', () => {
  it('mantém o sugerido quando nada foi enviado', () => {
    expect(pickDefaultMode('ppt', deriveTypeStates(status()))).toBe('ppt');
  });

  it('troca para o tipo que falta', () => {
    expect(pickDefaultMode('ppt', deriveTypeStates(status({ cards: [card()] })))).toBe('certificados');
  });
});

describe('buildEnvioOverview', () => {
  it('resume os tipos enviados', () => {
    const overview = buildEnvioOverview(
      deriveTypeStates(
        status({ cards: [card(), card({ id: 'c2', requestType: 'Certificados' })] }),
      ),
    );
    expect(overview.tone).toBe('sent');
    expect(overview.label).toBe('Enviado · PPT + Cert.');
  });

  it('falha tem prioridade', () => {
    const overview = buildEnvioOverview(
      deriveTypeStates(
        status({
          cards: [card()],
          envios: [entry({ requestType: 'Certificados', outcome: 'failed', marketingRequestId: null, errorMessage: 'x' })],
        }),
      ),
    );
    expect(overview.tone).toBe('failed');
    expect(overview.details[1]).toContain('Certificados: falhou');
  });
});

describe('formatação', () => {
  it('data e hora no horário de Brasília', () => {
    expect(formatDateTimeBr('2026-11-16T17:32:00Z')).toBe('16/11/2026 às 14:32');
    expect(formatDateTimeBr('')).toBe('');
  });

  it('hoje em São Paulo', () => {
    expect(todayIsoSaoPaulo(new Date('2026-11-17T02:00:00Z'))).toBe('2026-11-16');
  });

  it('presença', () => {
    expect(describePresenca({ state: 'preenchida', names: ['A', 'B'] }, '2026-11-20', '2026-11-25')).toBe(
      'Presença: 2 pessoas',
    );
    expect(describePresenca({ state: 'nao_preenchida', names: [] }, null, '2026-11-25')).toBe(
      'Presença: ninguém preencheu',
    );
    expect(describePresenca({ state: 'aguardando', names: [] }, '2026-11-20', '2026-11-18')).toBe(
      'Presença: consulta automática a partir de 21/11/2026',
    );
    expect(describePresenca({ state: 'aguardando', names: [] }, '2026-11-20', '2026-11-22')).toBe(
      'Presença: aguardando a consulta diária',
    );
  });
});

describe('edge _shared/envioStatus', () => {
  it('lê o bloco de presença gravado no card', () => {
    expect(summarizePresenca('Origem: Responsum\n\nPresença:\n- Ana\n- Bruno')).toEqual({
      state: 'preenchida',
      names: ['Ana', 'Bruno'],
    });
    expect(summarizePresenca('Origem\n\nPresença: não preenchida').state).toBe('nao_preenchida');
    expect(summarizePresenca('Origem: Responsum').state).toBe('aguardando');
  });

  it('resume a linha do card sem expor a descrição', () => {
    const summary = summarizeCard({
      id: 'abc',
      request_type: 'Certificados',
      title: 'T',
      status: 'pending',
      workflow_stage: 'tarefas',
      deadline: '2026-11-21T00:00:00',
      created_at: '2026-11-16T12:00:00Z',
      description: 'Ticket ID: x\n\nPresença:\n- Ana',
    });
    expect(summary).toEqual({
      id: 'abc',
      requestType: 'Certificados',
      title: 'T',
      status: 'pending',
      workflowStage: 'tarefas',
      deadline: '2026-11-21',
      createdAt: '2026-11-16T12:00:00Z',
      presenca: { state: 'preenchida', names: ['Ana'] },
    });
    expect(summarizeCard({ id: 'p', request_type: 'PPT' }).presenca).toBeNull();
  });
});
