import {
  sendModesFor,
  type OrquestraiRequestType,
  type OrquestraiSendMode,
} from '@/utils/orquestraiSendMode';

export const ORQUESTRAI_REQUEST_TYPES: OrquestraiRequestType[] = ['PPT', 'Certificados'];

export type OrquestraiEnvioOutcome = 'created' | 'already_existed' | 'failed';

/** Uma linha de app_c009c0e4f1_orquestrai_envios, como a edge function devolve. */
export type OrquestraiEnvioLogEntry = {
  id: string;
  requestType: string;
  sendMode: string;
  outcome: OrquestraiEnvioOutcome | string;
  marketingRequestId: string | null;
  errorMessage: string | null;
  sentBy: string | null;
  sentByName: string | null;
  createdAt: string;
};

export type OrquestraiPresencaSummary = {
  state: 'aguardando' | 'preenchida' | 'nao_preenchida';
  names: string[];
};

/** Resumo de um card de marketing_requests (mesmo formato de _shared/envioStatus.ts). */
export type OrquestraiCardSummary = {
  id: string;
  requestType: string;
  title: string;
  status: string | null;
  workflowStage: string | null;
  deadline: string | null;
  createdAt: string | null;
  presenca: OrquestraiPresencaSummary | null;
};

export type OrquestraiEnvioStatus = {
  cards: OrquestraiCardSummary[];
  /** Não deu para consultar o ORQESTRAI: só o histórico local vale. */
  cardsError: string | null;
  envios: OrquestraiEnvioLogEntry[];
  enviosError: string | null;
};

export type TypeEnvioState =
  | { kind: 'not_sent' }
  | {
      kind: 'sent';
      /** null quando o ORQESTRAI não respondeu e o envio vem só do histórico. */
      card: OrquestraiCardSummary | null;
      sentAt: string | null;
      sentByName: string | null;
    }
  | { kind: 'removed'; sentAt: string; sentByName: string | null }
  | { kind: 'failed'; failedAt: string; sentByName: string | null; error: string }
  | { kind: 'unknown' };

export type TypeEnvioStates = Record<OrquestraiRequestType, TypeEnvioState>;

function time(value: string | null | undefined): number {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Situação de um tipo de card, cruzando o que existe no ORQESTRAI com o histórico. */
export function deriveTypeState(
  type: OrquestraiRequestType,
  status: OrquestraiEnvioStatus,
): TypeEnvioState {
  const entries = status.envios
    .filter((entry) => entry.requestType === type)
    .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const lastSuccess = entries.find((entry) => entry.outcome !== 'failed');
  const lastFailure = entries.find((entry) => entry.outcome === 'failed');

  if (!status.cardsError) {
    const card = status.cards.find((item) => item.requestType === type);
    if (card) {
      // Quem criou de fato: a tentativa mais antiga que aponta para este card.
      const linked = entries.filter((entry) => entry.marketingRequestId === card.id);
      const creator =
        [...linked].reverse().find((entry) => entry.outcome === 'created') ??
        linked[linked.length - 1];
      return {
        kind: 'sent',
        card,
        sentAt: creator?.createdAt ?? card.createdAt,
        sentByName: creator?.sentByName ?? null,
      };
    }
    if (lastFailure && (!lastSuccess || time(lastFailure.createdAt) > time(lastSuccess.createdAt))) {
      return {
        kind: 'failed',
        failedAt: lastFailure.createdAt,
        sentByName: lastFailure.sentByName,
        error: lastFailure.errorMessage || 'Erro desconhecido',
      };
    }
    if (lastSuccess) {
      return { kind: 'removed', sentAt: lastSuccess.createdAt, sentByName: lastSuccess.sentByName };
    }
    return { kind: 'not_sent' };
  }

  // ORQESTRAI fora do ar: o histórico é tudo o que se sabe.
  const latest = entries[0];
  if (!latest) return { kind: 'unknown' };
  if (latest.outcome === 'failed') {
    return {
      kind: 'failed',
      failedAt: latest.createdAt,
      sentByName: latest.sentByName,
      error: latest.errorMessage || 'Erro desconhecido',
    };
  }
  const firstCreated = [...entries].reverse().find((entry) => entry.outcome === 'created');
  const origin = firstCreated ?? latest;
  return { kind: 'sent', card: null, sentAt: origin.createdAt, sentByName: origin.sentByName };
}

export function deriveTypeStates(status: OrquestraiEnvioStatus | null): TypeEnvioStates {
  if (!status) return { PPT: { kind: 'unknown' }, Certificados: { kind: 'unknown' } };
  return {
    PPT: deriveTypeState('PPT', status),
    Certificados: deriveTypeState('Certificados', status),
  };
}

/** Enviado e conferido no ORQESTRAI agora: mandar de novo não faz nada. */
export function isConfirmedSent(state: TypeEnvioState): boolean {
  return state.kind === 'sent' && state.card !== null;
}

export type SendPlan = {
  /** Tipos do modo escolhido que serão (re)criados. */
  toCreate: OrquestraiRequestType[];
  /** Tipos do modo escolhido que já estão no ORQESTRAI e serão mantidos. */
  alreadySent: OrquestraiRequestType[];
  /** Reenvio: algo pode ser criado de novo ou não deu para conferir. */
  needsConfirm: boolean;
  isRetry: boolean;
};

export function planSend(mode: OrquestraiSendMode, states: TypeEnvioStates): SendPlan {
  const types = sendModesFor(mode);
  const alreadySent = types.filter((type) => isConfirmedSent(states[type]));
  const toCreate = types.filter((type) => !isConfirmedSent(states[type]));
  const needsConfirm = toCreate.some((type) => {
    const kind = states[type].kind;
    return kind === 'removed' || kind === 'unknown' || kind === 'sent';
  });
  const isRetry = toCreate.some((type) => states[type].kind === 'failed');
  return { toCreate, alreadySent, needsConfirm, isRetry };
}

/** Modo inicial: o sugerido pelo ticket, a menos que parte dele já tenha sido enviada. */
export function pickDefaultMode(
  preferred: OrquestraiSendMode,
  states: TypeEnvioStates,
): OrquestraiSendMode {
  const pending = ORQUESTRAI_REQUEST_TYPES.filter((type) => !isConfirmedSent(states[type]));
  const preferredTypes = sendModesFor(preferred);
  if (preferredTypes.every((type) => pending.includes(type))) return preferred;
  if (pending.length === 1) return pending[0] === 'PPT' ? 'ppt' : 'certificados';
  return preferred;
}

export function requestTypeLabel(type: OrquestraiRequestType, short = false): string {
  if (type === 'PPT') return 'PPT';
  return short ? 'Cert.' : 'Certificados';
}

export function joinTypes(types: OrquestraiRequestType[], short = false): string {
  return types.map((type) => requestTypeLabel(type, short)).join(' + ');
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO → "16/11/2026 às 14:32" no horário de Brasília. */
export function formatDateTimeBr(iso: string | null | undefined): string {
  const parsed = Date.parse(String(iso ?? ''));
  if (Number.isNaN(parsed)) return '';
  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(new Date(parsed)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

/** "2026-11-20" → "20/11/2026". */
export function formatIsoDateBr(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function humanizeStage(stage: string | null | undefined): string {
  const text = String(stage ?? '').trim().replace(/[_-]+/g, ' ');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Texto da presença no card de certificados. `todayIso` em America/Sao_Paulo. */
export function describePresenca(
  presenca: OrquestraiPresencaSummary | null,
  deadline: string | null,
  todayIso: string,
): string | null {
  if (!presenca) return null;
  if (presenca.state === 'preenchida') {
    const count = presenca.names.length;
    return `Presença: ${count} ${count === 1 ? 'pessoa' : 'pessoas'}`;
  }
  if (presenca.state === 'nao_preenchida') return 'Presença: ninguém preencheu';
  if (deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && todayIso <= deadline) {
    return `Presença: consulta automática a partir de ${formatIsoDateBr(addDaysIso(deadline, 1))}`;
  }
  return 'Presença: aguardando a consulta diária';
}

function byWhom(name: string | null): string {
  return name ? ` por ${name}` : '';
}

/** Uma linha por tipo, para tooltip e leitores de tela. */
export function describeTypeState(type: OrquestraiRequestType, state: TypeEnvioState): string {
  const label = requestTypeLabel(type);
  switch (state.kind) {
    case 'sent': {
      const when = formatDateTimeBr(state.sentAt);
      const base = when ? `${label}: enviado em ${when}${byWhom(state.sentByName)}` : `${label}: enviado`;
      return state.card ? base : `${base} (não conferido no ORQESTRAI agora)`;
    }
    case 'removed':
      return `${label}: enviado em ${formatDateTimeBr(state.sentAt)}, mas o card não está mais no ORQESTRAI`;
    case 'failed':
      return `${label}: falhou em ${formatDateTimeBr(state.failedAt)} — ${state.error}`;
    case 'unknown':
      return `${label}: não foi possível conferir`;
    default:
      return `${label}: não enviado`;
  }
}

export type EnvioOverviewTone = 'idle' | 'sent' | 'failed' | 'warning' | 'unknown';

export type EnvioOverview = {
  tone: EnvioOverviewTone;
  label: string;
  details: string[];
};

/** Resumo para o botão do cabeçalho do ticket. */
export function buildEnvioOverview(states: TypeEnvioStates): EnvioOverview {
  const details = ORQUESTRAI_REQUEST_TYPES.map((type) => describeTypeState(type, states[type]));
  const kinds = ORQUESTRAI_REQUEST_TYPES.map((type) => states[type].kind);
  const sentTypes = ORQUESTRAI_REQUEST_TYPES.filter((type) => states[type].kind === 'sent');

  if (kinds.includes('failed')) return { tone: 'failed', label: 'ORQESTRAI · falhou', details };
  if (kinds.includes('removed')) return { tone: 'warning', label: 'ORQESTRAI · card removido', details };
  if (sentTypes.length) {
    return { tone: 'sent', label: `Enviado · ${joinTypes(sentTypes, true)}`, details };
  }
  if (kinds.every((kind) => kind === 'unknown')) return { tone: 'unknown', label: 'ORQESTRAI', details };
  return { tone: 'idle', label: 'ORQESTRAI', details };
}

/** Rótulo do botão principal do modal. */
export function submitLabel(plan: SendPlan, states: TypeEnvioStates): string {
  if (plan.toCreate.length === 0) return 'Já enviado';
  if (plan.isRetry) return 'Tentar de novo';
  if (plan.toCreate.some((type) => states[type].kind === 'removed')) return 'Criar de novo';
  const target = plan.toCreate.map((type) => (type === 'PPT' ? 'PPT' : 'certificados')).join(' + ');
  return `Enviar ${target}`;
}

export function outcomeLabel(outcome: string): string {
  if (outcome === 'created') return 'Card criado';
  if (outcome === 'already_existed') return 'Já existia';
  if (outcome === 'failed') return 'Falhou';
  return outcome;
}

/** Data de hoje (YYYY-MM-DD) em America/Sao_Paulo. */
export function todayIsoSaoPaulo(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
