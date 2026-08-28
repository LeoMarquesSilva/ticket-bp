import { describe, expect, it } from 'vitest';
import {
  channelsForNotification,
  formatScheduleCaption,
  getEligibleNotificationTypes,
  latestHumanMessage,
  localCycleKey,
  normalizeSchedule,
  NPS_EXEMPT_CATEGORY_KEY,
  NPS_EXEMPT_SUBCATEGORY_KEY,
  SCHEDULE_DEFAULTS,
} from '../../supabase/functions/notify-ticket-communications/_shared/rules.mjs';

const now = new Date('2026-08-24T12:00:00.000Z');
const requesterId = '11111111-1111-1111-1111-111111111111';
const supportId = '22222222-2222-2222-2222-222222222222';

it('lembra quando a última mensagem humana do suporte completa 48 horas', () => {
  const result = getEligibleNotificationTypes({
    now,
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    ticket: { status: 'in_progress', created_by: requesterId, resolved_at: null, feedback_submitted_at: null, category: 'ti', subcategory: 'acesso' },
    lastHumanMessage: { user_id: supportId, created_at: '2026-08-22T12:00:00.000Z' },
  });
  expect(result).toEqual(['awaiting_requester']);
});

it('não lembra um milissegundo antes de completar 48 horas', () => {
  const result = getEligibleNotificationTypes({
    now: new Date('2026-08-24T11:59:59.999Z'),
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    ticket: { status: 'in_progress', created_by: requesterId, resolved_at: null, feedback_submitted_at: null, category: 'ti', subcategory: 'acesso' },
    lastHumanMessage: { user_id: supportId, created_at: '2026-08-22T12:00:00.000Z' },
  });
  expect(result).toEqual([]);
});

it('não lembra quando a última mensagem humana é do solicitante', () => {
  const result = getEligibleNotificationTypes({
    now,
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    ticket: { status: 'in_progress', created_by: requesterId, resolved_at: null, feedback_submitted_at: null, category: 'ti', subcategory: 'acesso' },
    lastHumanMessage: { user_id: requesterId, created_at: '2026-08-20T12:00:00.000Z' },
  });
  expect(result).toEqual([]);
});

it('localiza a última mensagem persistida, cujos autores são UUIDs', () => {
  expect(latestHumanMessage([
    { user_id: supportId, created_at: '2026-08-20T12:00:00.000Z' },
    { user_id: requesterId, created_at: '2026-08-24T11:00:00.000Z' },
  ])?.user_id).toBe(requesterId);
});

it('ignora mensagem automática mais recente sem usar sentinela textual no user_id', () => {
  expect(latestHumanMessage([
    { user_id: supportId, created_at: '2026-08-20T12:00:00.000Z', is_system: false },
    { user_id: requesterId, created_at: '2026-08-24T11:00:00.000Z', is_system: true },
  ])?.user_id).toBe(supportId);
});

describe('convite e lembrete de feedback', () => {
  const enabledAt = new Date('2026-08-01T00:00:00.000Z');
  const resolvedTicket = {
    status: 'resolved',
    created_by: requesterId,
    resolved_at: '2026-08-21T12:00:00.000Z',
    feedback_submitted_at: null,
    category: 'ti',
    subcategory: 'acesso',
  };

  it('emite convite e lembrete quando a resolução completa 72 horas', () => {
    expect(getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket: resolvedTicket,
      lastHumanMessage: null,
    })).toEqual(['resolved_feedback_invite', 'awaiting_feedback']);
  });

  it('não emite lembrete antes de completar 72 horas', () => {
    expect(getEligibleNotificationTypes({
      now: new Date('2026-08-24T11:59:59.999Z'),
      enabledAt,
      ticket: resolvedTicket,
      lastHumanMessage: null,
    })).toEqual(['resolved_feedback_invite']);
  });

  it('não notifica resolução histórica anterior à ativação', () => {
    expect(getEligibleNotificationTypes({
      now,
      enabledAt: new Date('2026-08-22T00:00:00.000Z'),
      ticket: resolvedTicket,
      lastHumanMessage: null,
    })).toEqual([]);
  });

  it('não convida quando o solicitante já enviou feedback', () => {
    expect(getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket: { ...resolvedTicket, feedback_submitted_at: '2026-08-22T00:00:00.000Z' },
      lastHumanMessage: null,
    })).toEqual([]);
  });

  it('isenta a categoria e subcategoria de auditoria', () => {
    expect(getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket: {
        ...resolvedTicket,
        category: NPS_EXEMPT_CATEGORY_KEY,
        subcategory: NPS_EXEMPT_SUBCATEGORY_KEY,
      },
      lastHumanMessage: null,
    })).toEqual([]);
  });
});

describe('prazos configuráveis', () => {
  const enabledAt = new Date('2026-08-01T00:00:00.000Z');
  const openTicket = {
    status: 'in_progress',
    created_by: requesterId,
    resolved_at: null,
    feedback_submitted_at: null,
    category: 'ti',
    subcategory: 'acesso',
  };
  const resolvedTicket = {
    status: 'resolved',
    created_by: requesterId,
    resolved_at: '2026-08-23T12:00:00.000Z',
    feedback_submitted_at: null,
    category: 'ti',
    subcategory: 'acesso',
  };

  it('usa 0/48/72 horas quando a configuração está ausente', () => {
    expect(normalizeSchedule(undefined)).toEqual(SCHEDULE_DEFAULTS);
    expect(normalizeSchedule({ awaiting_requester: { delayHours: -1, enabled: 'sim' } })).toEqual(SCHEDULE_DEFAULTS);
  });

  it('respeita um prazo menor para o lembrete ao solicitante', () => {
    const schedule = normalizeSchedule({
      awaiting_requester: { enabled: true, delayHours: 24 },
    });
    expect(getEligibleNotificationTypes({
      now: new Date('2026-08-23T12:00:00.000Z'),
      enabledAt,
      ticket: openTicket,
      lastHumanMessage: { user_id: supportId, created_at: '2026-08-22T12:00:00.000Z' },
      schedule,
    })).toEqual(['awaiting_requester']);
    expect(getEligibleNotificationTypes({
      now: new Date('2026-08-23T11:59:59.999Z'),
      enabledAt,
      ticket: openTicket,
      lastHumanMessage: { user_id: supportId, created_at: '2026-08-22T12:00:00.000Z' },
      schedule,
    })).toEqual([]);
  });

  it('não emite comunicação desativada mesmo depois do prazo', () => {
    const schedule = normalizeSchedule({
      resolved_feedback_invite: { enabled: false, delayHours: 0 },
      awaiting_requester: { enabled: false, delayHours: 1 },
      awaiting_feedback: { enabled: false, delayHours: 1 },
    });
    expect(getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket: openTicket,
      lastHumanMessage: { user_id: supportId, created_at: '2026-08-20T12:00:00.000Z' },
      schedule,
    })).toEqual([]);
    expect(getEligibleNotificationTypes({
      now,
      enabledAt,
      ticket: resolvedTicket,
      lastHumanMessage: null,
      schedule,
    })).toEqual([]);
  });

  it('atrasa o convite de avaliação quando o prazo deixa de ser imediato', () => {
    const schedule = normalizeSchedule({
      resolved_feedback_invite: { enabled: true, delayHours: 12 },
    });
    expect(getEligibleNotificationTypes({
      now: new Date('2026-08-24T00:00:00.000Z'),
      enabledAt,
      ticket: resolvedTicket,
      lastHumanMessage: null,
      schedule,
    })).toEqual(['resolved_feedback_invite']);
    expect(getEligibleNotificationTypes({
      now: new Date('2026-08-23T23:59:59.999Z'),
      enabledAt,
      ticket: resolvedTicket,
      lastHumanMessage: null,
      schedule,
    })).toEqual([]);
  });

  it('descreve o prazo para a interface', () => {
    expect(formatScheduleCaption('resolved_feedback_invite', { enabled: true, delayHours: 0 })).toBe(
      'Assim que o chamado é finalizado',
    );
    expect(formatScheduleCaption('awaiting_requester', { enabled: true, delayHours: 48 })).toBe('Após 48 horas');
    expect(formatScheduleCaption('awaiting_feedback', { enabled: false, delayHours: 72 })).toBe('Desativada');
  });
});

describe('canais e ciclos', () => {
  it('envia convite somente por e-mail e lembrete pelos dois canais', () => {
    expect(channelsForNotification('resolved_feedback_invite')).toEqual(['email']);
    expect(channelsForNotification('awaiting_feedback')).toEqual(['email', 'teams']);
  });

  it('calcula o ciclo na data local de São Paulo', () => {
    expect(localCycleKey(new Date('2026-08-24T02:00:00.000Z'))).toBe('2026-08-23');
    expect(localCycleKey(new Date('2026-08-24T03:00:00.000Z'))).toBe('2026-08-24');
  });
});
