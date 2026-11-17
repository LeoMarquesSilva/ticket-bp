import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  HelpCircle,
  History,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { OrquestraiRequestType } from '@/utils/orquestraiSendMode';
import {
  ORQUESTRAI_REQUEST_TYPES,
  describePresenca,
  formatDateTimeBr,
  formatIsoDateBr,
  humanizeStage,
  outcomeLabel,
  requestTypeLabel,
  type OrquestraiEnvioStatus,
  type TypeEnvioState,
  type TypeEnvioStates,
} from '@/utils/orquestraiEnvioStatus';

type Props = {
  status: OrquestraiEnvioStatus | null;
  states: TypeEnvioStates;
  loading: boolean;
  error: string | null;
  todayIso: string;
  onRefresh: () => void;
};

const STATE_STYLE: Record<
  TypeEnvioState['kind'],
  { box: string; icon: React.ElementType; iconClass: string; badge: string; badgeText: string }
> = {
  sent: {
    box: 'border-green-200 bg-green-50/70',
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badge: 'bg-green-100 text-green-800',
    badgeText: 'Enviado',
  },
  not_sent: {
    box: 'border-slate-200 bg-white',
    icon: Circle,
    iconClass: 'text-slate-300',
    badge: 'bg-slate-100 text-slate-600',
    badgeText: 'Não enviado',
  },
  failed: {
    box: 'border-red-200 bg-red-50/70',
    icon: AlertCircle,
    iconClass: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    badgeText: 'Falhou',
  },
  removed: {
    box: 'border-amber-200 bg-amber-50/70',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
    badgeText: 'Card removido',
  },
  unknown: {
    box: 'border-slate-200 bg-slate-50',
    icon: HelpCircle,
    iconClass: 'text-slate-400',
    badge: 'bg-slate-100 text-slate-600',
    badgeText: 'Não conferido',
  },
};

function Who({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <>
      {' · '}
      <span className="font-medium text-slate-700">{name}</span>
    </>
  );
}

function TypeStateBody({
  state,
  todayIso,
}: {
  state: TypeEnvioState;
  todayIso: string;
}) {
  switch (state.kind) {
    case 'sent': {
      const card = state.card;
      const presenca = card ? describePresenca(card.presenca, card.deadline, todayIso) : null;
      const stage = humanizeStage(card?.workflowStage);
      const deadline = formatIsoDateBr(card?.deadline);
      return (
        <>
          <p>
            {state.sentAt ? formatDateTimeBr(state.sentAt) : 'Data não registrada'}
            <Who name={state.sentByName} />
          </p>
          {card && !state.sentByName && (
            <p className="text-slate-400">Enviado antes do histórico do Responsum</p>
          )}
          {!card && (
            <p className="text-amber-700">
              Pelo histórico do Responsum (o ORQESTRAI não respondeu agora)
            </p>
          )}
          {(stage || deadline) && (
            <p>
              {stage && (
                <>
                  Estágio <span className="font-medium text-slate-700">{stage}</span>
                </>
              )}
              {stage && deadline && ' · '}
              {deadline && (
                <>
                  Prazo <span className="font-medium text-slate-700">{deadline}</span>
                </>
              )}
            </p>
          )}
          {presenca && (
            <p
              className={cn(
                card?.presenca?.state === 'preenchida' && 'text-green-700',
                card?.presenca?.state === 'nao_preenchida' && 'text-amber-700',
              )}
              title={card?.presenca?.names.join('\n') || undefined}
            >
              {presenca}
            </p>
          )}
        </>
      );
    }
    case 'failed':
      return (
        <>
          <p>
            {formatDateTimeBr(state.failedAt)}
            <Who name={state.sentByName} />
          </p>
          <p className="text-red-700 line-clamp-3 break-words" title={state.error}>
            {state.error}
          </p>
        </>
      );
    case 'removed':
      return (
        <>
          <p>
            Enviado em {formatDateTimeBr(state.sentAt)}
            <Who name={state.sentByName} />
          </p>
          <p className="text-amber-700">
            O card não está mais no ORQESTRAI. Dá para criar de novo.
          </p>
        </>
      );
    case 'unknown':
      return <p>Não foi possível conferir agora.</p>;
    default:
      return <p>Nenhum card deste tipo no ORQESTRAI.</p>;
  }
}

function TypeStatusCard({
  type,
  state,
  loading,
  todayIso,
}: {
  type: OrquestraiRequestType;
  state: TypeEnvioState;
  loading: boolean;
  todayIso: string;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <p className="text-sm font-medium text-[#2C2D2F]">{requestTypeLabel(type)}</p>
        <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const style = STATE_STYLE[state.kind];
  const Icon = style.icon;
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', style.box)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', style.iconClass)} aria-hidden="true" />
        <p className="text-sm font-medium text-[#2C2D2F]">{requestTypeLabel(type)}</p>
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium',
            style.badge,
          )}
        >
          {style.badgeText}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5 pl-6 text-xs text-slate-500">
        <TypeStateBody state={state} todayIso={todayIso} />
      </div>
    </div>
  );
}

const OrquestraiEnvioStatusPanel: React.FC<Props> = ({
  status,
  states,
  loading,
  error,
  todayIso,
  onRefresh,
}) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = status?.envios ?? [];
  const firstLoad = loading && !status && !error;

  return (
    <section aria-label="Situação no ORQESTRAI" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Situação no ORQESTRAI
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-slate-500"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
          {loading ? 'Conferindo…' : 'Atualizar'}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Não foi possível conferir o que já foi enviado ({error}). O ORQESTRAI não duplica
          cards do mesmo tipo, mas vamos pedir confirmação antes de enviar.
        </p>
      )}
      {!error && status?.cardsError && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          O ORQESTRAI não respondeu ({status.cardsError}). A situação abaixo vem só do
          histórico do Responsum.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ORQUESTRAI_REQUEST_TYPES.map((type) => (
          <TypeStatusCard
            key={type}
            type={type}
            state={states[type]}
            loading={firstLoad}
            todayIso={todayIso}
          />
        ))}
      </div>

      {history.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#2C2D2F]"
            >
              <History className="h-3 w-3" aria-hidden="true" />
              Histórico de envios ({history.length})
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', historyOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {history.map((entry) => (
                <li key={entry.id} className="text-xs text-slate-600">
                  <span className="tabular-nums text-slate-500">
                    {formatDateTimeBr(entry.createdAt)}
                  </span>
                  {' · '}
                  <span className="font-medium text-[#2C2D2F]">{entry.requestType}</span>
                  {' · '}
                  <span
                    className={cn(
                      entry.outcome === 'created' && 'text-green-700',
                      entry.outcome === 'failed' && 'text-red-700',
                    )}
                  >
                    {outcomeLabel(entry.outcome)}
                  </span>
                  {entry.sentByName && <span className="text-slate-500"> · {entry.sentByName}</span>}
                  {entry.errorMessage && (
                    <span className="block break-words text-red-700">{entry.errorMessage}</span>
                  )}
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
};

export default OrquestraiEnvioStatusPanel;
