import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import OrquestraiEnvioStatusPanel from '@/components/OrquestraiEnvioStatusPanel';
import { Ticket } from '@/types';
import { UserService } from '@/services/userService';
import {
  fetchOrquestraiEnvioStatus,
  submitOrquestraiTreinamento,
} from '@/services/orquestraiTreinamentosService';
import { canSendToOrquestrai } from '@/utils/orquestraiSendAccess';
import {
  isDesenvolvimentoContinuoCategory,
  type SharepointTreinamentoPayload,
} from '@/utils/desenvolvimentoContinuoForm';
import {
  enrichResponsavelEmail,
  parseDesenvolvimentoContinuoPayload,
} from '@/utils/orquestraiTreinamentoPreview';
import {
  ORQUESTRAI_SEND_MODES,
  certificadosDeadlineIso,
  defaultSendMode,
  isoDateFromBr,
  sendModeLabel,
  sendModesFor,
  type OrquestraiRequestType,
  type OrquestraiSendMode,
} from '@/utils/orquestraiSendMode';
import {
  ORQUESTRAI_REQUEST_TYPES,
  buildEnvioOverview,
  deriveTypeStates,
  formatDateTimeBr,
  formatIsoDateBr,
  isConfirmedSent,
  joinTypes,
  pickDefaultMode,
  planSend,
  requestTypeLabel,
  submitLabel,
  todayIsoSaoPaulo,
  type EnvioOverviewTone,
  type OrquestraiEnvioStatus,
  type TypeEnvioState,
} from '@/utils/orquestraiEnvioStatus';
import { useDesenvolvimentoContinuoOptions } from '@/hooks/useDesenvolvimentoContinuoOptions';

type Props = {
  ticket: Ticket;
  user: { id?: string; email?: string } | null;
  subcategoryLabel?: string;
};

function buildTicketAppUrl(ticketId: string): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  const base = (fromEnv || window.location.origin).replace(/\/$/, '');
  return `${base}/tickets/${ticketId}`;
}

function emptyPayload(): SharepointTreinamentoPayload {
  return {
    tema: '',
    facilitador: '',
    responsavelEmail: '',
    responsavelName: '',
    dataRealizacao: '',
    area: '',
    subcategory: '',
    duracaoMinutos: '',
    precisaAjustePpt: false,
    linkPpt: '',
  };
}

const TONE_BUTTON: Record<EnvioOverviewTone, string> = {
  idle: 'border-[#F69F19]/40 text-[#DE5532] hover:border-[#F69F19] hover:bg-[#F69F19]/10',
  unknown: 'border-[#F69F19]/40 text-[#DE5532] hover:border-[#F69F19] hover:bg-[#F69F19]/10',
  sent: 'border-green-200 bg-green-50 text-green-700 hover:border-green-300 hover:bg-green-100 hover:text-green-800',
  failed: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-900',
};

const TONE_ICON: Record<EnvioOverviewTone, React.ElementType> = {
  idle: Send,
  unknown: Send,
  sent: CheckCircle2,
  failed: AlertCircle,
  warning: AlertTriangle,
};

/** Frase do modal de confirmação para cada tipo que será (re)criado. */
function confirmLine(type: OrquestraiRequestType, state: TypeEnvioState): string {
  const label = requestTypeLabel(type);
  switch (state.kind) {
    case 'removed':
      return `${label} foi enviado em ${formatDateTimeBr(state.sentAt)}${
        state.sentByName ? ` por ${state.sentByName}` : ''
      }, mas o card não está mais no ORQESTRAI. Um card novo será criado.`;
    case 'sent':
      return `Pelo histórico, ${label} já foi enviado${
        state.sentAt ? ` em ${formatDateTimeBr(state.sentAt)}` : ''
      }. O ORQESTRAI não respondeu agora; se o card ainda existir, ele não será duplicado.`;
    case 'unknown':
      return `Não deu para conferir se ${label} já foi enviado. Se o card já existir no ORQESTRAI, ele não será duplicado.`;
    case 'failed':
      return `${label}: nova tentativa depois da falha de ${formatDateTimeBr(state.failedAt)}.`;
    default:
      return `${label}: será criado agora.`;
  }
}

const SendToOrquestraiButton: React.FC<Props> = ({
  ticket,
  user,
  subcategoryLabel = '',
}) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SharepointTreinamentoPayload>(emptyPayload());
  const [ticketUrl, setTicketUrl] = useState('');
  const [preferredMode, setPreferredMode] = useState<OrquestraiSendMode>('certificados');
  const [sendMode, setSendMode] = useState<OrquestraiSendMode>('certificados');
  const [modeTouched, setModeTouched] = useState(false);

  const [status, setStatus] = useState<OrquestraiEnvioStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusRequest = useRef(0);

  const visible = useMemo(
    () =>
      canSendToOrquestrai(user) &&
      isDesenvolvimentoContinuoCategory(ticket.category || ''),
    [user, ticket.category],
  );

  const { departments, loading: loadingOptions } = useDesenvolvimentoContinuoOptions(
    visible && open,
  );

  const loadStatus = useCallback(async () => {
    const requestId = ++statusRequest.current;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await fetchOrquestraiEnvioStatus(ticket.id);
      if (requestId !== statusRequest.current) return;
      setStatus(next);
    } catch (error) {
      if (requestId !== statusRequest.current) return;
      setStatus(null);
      setStatusError(
        error instanceof Error ? error.message : 'Falha ao consultar o ORQESTRAI',
      );
    } finally {
      if (requestId === statusRequest.current) setStatusLoading(false);
    }
  }, [ticket.id]);

  // Situação do envio já no cabeçalho do ticket, sem precisar abrir o modal.
  useEffect(() => {
    if (!visible) return;
    setStatus(null);
    setStatusError(null);
    void loadStatus();
  }, [visible, loadStatus]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setLoadingPreview(true);
      setParseError(null);
      setModeTouched(false);

      try {
        const parsed = parseDesenvolvimentoContinuoPayload(
          ticket.description || '',
          subcategoryLabel,
        );

        if (!parsed) {
          if (!cancelled) {
            setPayload({
              ...emptyPayload(),
              subcategory: subcategoryLabel,
            });
            setPreferredMode('certificados');
            setParseError(
              'Não foi possível ler todos os campos automaticamente. Preencha ou ajuste manualmente antes de enviar.',
            );
          }
        } else {
          const users = await UserService.getAllUsers(false);
          const enriched = enrichResponsavelEmail(parsed, users);
          if (!cancelled) {
            setPayload({
              ...enriched,
              linkPpt: enriched.linkPpt || '',
            });
            setPreferredMode(defaultSendMode(enriched.precisaAjustePpt));
          }
        }

        if (!cancelled) {
          setTicketUrl(buildTicketAppUrl(ticket.id));
        }
      } catch (error) {
        if (!cancelled) {
          setParseError(
            error instanceof Error
              ? error.message
              : 'Erro ao montar a prévia do ORQESTRAI',
          );
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, ticket.description, ticket.id, subcategoryLabel]);

  // Ao abrir, confere de novo: alguém pode ter enviado em outra aba ou máquina.
  useEffect(() => {
    if (open && visible) void loadStatus();
  }, [open, visible, loadStatus]);

  const states = useMemo(() => deriveTypeStates(statusError ? null : status), [status, statusError]);
  const overview = useMemo(() => buildEnvioOverview(states), [states]);
  const statusReady = Boolean(status) || Boolean(statusError);

  // Sugere o modo com o que ainda falta enviar, até o usuário escolher outro.
  useEffect(() => {
    if (!open || modeTouched) return;
    setSendMode(statusReady ? pickDefaultMode(preferredMode, states) : preferredMode);
  }, [open, modeTouched, statusReady, preferredMode, states]);

  if (!visible) return null;

  const update = (patch: Partial<SharepointTreinamentoPayload>) => {
    setPayload((prev) => ({ ...prev, ...patch }));
  };

  const plan = planSend(sendMode, states);
  const isResend = plan.toCreate.some((type) => {
    const kind = states[type].kind;
    return kind === 'removed' || kind === 'sent';
  });
  const createsPpt = plan.toCreate.includes('PPT');
  const pptDeadline =
    formatIsoDateBr(isoDateFromBr(payload.dataRealizacao)) || payload.dataRealizacao || '—';
  const certDeadline = formatIsoDateBr(certificadosDeadlineIso(payload.dataRealizacao)) || '—';
  const needsPptLink = createsPpt && payload.precisaAjustePpt;
  const formValid =
    Boolean(payload.tema.trim()) &&
    Boolean(payload.dataRealizacao.trim()) &&
    (!needsPptLink || Boolean(payload.linkPpt?.trim()));
  const nothingToSend = statusReady && plan.toCreate.length === 0;
  // PPT e Certificados já estão lá: não há o que escolher nem preencher.
  const everythingSent =
    statusReady && ORQUESTRAI_REQUEST_TYPES.every((type) => isConfirmedSent(states[type]));
  const canSubmit = formValid && statusReady && !nothingToSend;
  const todayIso = todayIsoSaoPaulo();

  const OverviewIcon = statusLoading && !statusReady ? Loader2 : TONE_ICON[overview.tone];

  const modeSuffix = (mode: OrquestraiSendMode): string => {
    if (!statusReady) return '';
    const types = sendModesFor(mode);
    const sent = types.filter((type) => isConfirmedSent(states[type]));
    if (sent.length === types.length) return ' · já enviado';
    if (sent.length) return ` · ${joinTypes(sent)} já enviado`;
    return '';
  };

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const result = await submitOrquestraiTreinamento(ticket.id, {
        ...payload,
        sendMode,
        linkPpt: needsPptLink ? payload.linkPpt?.trim() || undefined : undefined,
      });
      const results = result.results ?? [];
      const created = results.filter((item) => item.created).map((item) => item.requestType);
      const existing = results
        .filter((item) => !item.created && !item.error)
        .map((item) => item.requestType);
      const failed = results.filter((item) => item.error);

      if (!result.ok) {
        toast.error('Não foi possível enviar ao ORQESTRAI', {
          description: result.error || 'Falha ao enviar para o ORQESTRAI',
        });
        return;
      }

      if (failed.length) {
        toast.warning(
          created.length ? `Criado: ${created.join(' + ')}. Falhou: ${failed.map((item) => item.requestType).join(' + ')}` : 'Parte do envio falhou',
          { description: failed.map((item) => `${item.requestType}: ${item.error}`).join(' · ') },
        );
        return;
      }

      if (created.length) {
        toast.success(`Enviado ao ORQESTRAI: ${created.join(' + ')}`, {
          description: existing.length
            ? `${existing.join(' + ')} já estava lá e não foi duplicado.`
            : `Card${created.length > 1 ? 's' : ''} no estágio Tarefas.`,
        });
      } else {
        toast.info('Nada novo: o ORQESTRAI já tinha esses cards', {
          description: existing.length ? existing.join(' + ') : undefined,
        });
      }
      setOpen(false);
    } catch (error) {
      toast.error('Não foi possível enviar ao ORQESTRAI', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(false);
      // Tanto sucesso quanto falha ficam no histórico: atualiza o status.
      void loadStatus();
    }
  };

  const handleSubmit = () => {
    if (!formValid) {
      toast.error(
        needsPptLink
          ? 'Preencha tema, data e o link do PPT'
          : 'Preencha pelo menos tema e data',
      );
      return;
    }
    if (!canSubmit) return;
    if (plan.needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    void send();
  };

  const primaryLabel = sending
    ? 'Enviando…'
    : !statusReady
      ? 'Conferindo envios…'
      : submitLabel(plan, states);

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 gap-1.5 px-2 text-[11px] rounded-md shrink-0',
                TONE_BUTTON[statusReady ? overview.tone : 'idle'],
              )}
              onClick={() => setOpen(true)}
              aria-label={`Enviar para ORQESTRAI. ${statusReady ? overview.details.join('. ') : 'Conferindo envios.'}`}
            >
              <OverviewIcon
                className={cn('h-3 w-3', statusLoading && !statusReady && 'animate-spin')}
                aria-hidden="true"
              />
              <span>{statusReady ? overview.label : 'ORQESTRAI'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs space-y-0.5 text-xs">
            {statusReady ? (
              overview.details.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>Conferindo o que já foi enviado ao ORQESTRAI…</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={(next) => !sending && setOpen(next)}>
        <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar para ORQESTRAI</DialogTitle>
            <DialogDescription>
              Cria os cards no Planner do Marketing. Cada ticket tem no máximo um card de PPT
              e um de Certificados. O envio não altera o ticket no Responsum.
            </DialogDescription>
          </DialogHeader>

          <OrquestraiEnvioStatusPanel
            status={status}
            states={states}
            loading={statusLoading}
            error={statusError}
            todayIso={todayIso}
            onRefresh={() => void loadStatus()}
          />

          {everythingSent ? (
            <p className="flex gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                PPT e Certificados já estão no ORQESTRAI. Não há mais nada para enviar deste
                ticket.
              </span>
            </p>
          ) : (
            <div className="h-px bg-slate-200" aria-hidden="true" />
          )}

          {everythingSent ? null : loadingPreview ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Montando prévia…
            </p>
          ) : (
            <div className="space-y-4">
              {parseError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  {parseError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label>O que enviar</Label>
                <Select
                  value={sendMode}
                  onValueChange={(value) => {
                    setModeTouched(true);
                    setSendMode(value as OrquestraiSendMode);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORQUESTRAI_SEND_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {sendModeLabel(mode)}
                        {modeSuffix(mode) && (
                          <span className="text-slate-400">{modeSuffix(mode)}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {nothingToSend ? (
                  <p className="flex gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {plan.alreadySent.length > 1
                        ? `${joinTypes(plan.alreadySent)} já estão no ORQESTRAI.`
                        : `${joinTypes(plan.alreadySent)} já está no ORQESTRAI.`}{' '}
                      Não há nada novo para enviar com esta opção.
                    </span>
                  </p>
                ) : (
                  statusReady &&
                  plan.alreadySent.length > 0 && (
                    <p className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {joinTypes(plan.alreadySent)} já está no ORQESTRAI e não será criado de
                        novo. Este envio cria só{' '}
                        <span className="font-medium text-[#2C2D2F]">{joinTypes(plan.toCreate)}</span>.
                      </span>
                    </p>
                  )
                )}
              </div>

              {plan.toCreate.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Prévia do que será criado
                  </p>
                  {plan.toCreate.map((type) => (
                    <p key={type} className="font-medium text-[#2C2D2F] break-words">
                      {type === 'Certificados'
                        ? `[DC] Certificados — ${payload.tema || '…'}`
                        : `[DC] ${payload.subcategory || 'Desenvolvimento Contínuo'} — ${payload.tema || '…'}`}
                    </p>
                  ))}
                  <p className="text-xs text-slate-500">
                    Tipo:{' '}
                    <span className="text-[#2C2D2F] font-medium">
                      {plan.toCreate.join(' + ')}
                    </span>
                    {' · '}
                    Estágio: <span className="text-[#2C2D2F] font-medium">Tarefas</span>
                    {' · '}
                    Assignee: <span className="text-[#2C2D2F] font-medium">Valentina Iacovacci</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Prazo:{' '}
                    <span className="text-[#2C2D2F] font-medium">
                      {plan.toCreate
                        .map((type) =>
                          type === 'Certificados'
                            ? `Certificados ${certDeadline}`
                            : `PPT ${pptDeadline}`,
                        )
                        .join(' · ')}
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="orq-tema">Tema</Label>
                  <Input
                    id="orq-tema"
                    value={payload.tema}
                    onChange={(e) => update({ tema: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orq-tipo">Tipo (subcategoria)</Label>
                  <Input
                    id="orq-tipo"
                    value={payload.subcategory}
                    onChange={(e) => update({ subcategory: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Área</Label>
                  <Select
                    value={payload.area || undefined}
                    onValueChange={(value) => update({ area: value })}
                    disabled={loadingOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.area &&
                        !departments.some((d) => d.name === payload.area) && (
                          <SelectItem value={payload.area}>{payload.area}</SelectItem>
                        )}
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orq-resp-name">Responsável (gerente)</Label>
                  <Input
                    id="orq-resp-name"
                    value={payload.responsavelName}
                    onChange={(e) => update({ responsavelName: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orq-resp-email">E-mail do responsável</Label>
                  <Input
                    id="orq-resp-email"
                    type="email"
                    value={payload.responsavelEmail}
                    onChange={(e) => update({ responsavelEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="orq-facilitador">Facilitador(es)</Label>
                  <Input
                    id="orq-facilitador"
                    value={payload.facilitador}
                    onChange={(e) => update({ facilitador: e.target.value })}
                    placeholder="Nomes separados por vírgula"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orq-data">Data da realização</Label>
                  <Input
                    id="orq-data"
                    value={payload.dataRealizacao}
                    onChange={(e) => update({ dataRealizacao: e.target.value })}
                    placeholder="DD/MM/AAAA"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orq-duracao">Duração (minutos)</Label>
                  <Input
                    id="orq-duracao"
                    inputMode="numeric"
                    value={payload.duracaoMinutos}
                    onChange={(e) =>
                      update({ duracaoMinutos: e.target.value.replace(/\D/g, '') })
                    }
                  />
                </div>

                {createsPpt && (
                  <div className="space-y-1.5">
                    <Label>Precisa de ajuste em PPT?</Label>
                    <Select
                      value={payload.precisaAjustePpt ? 'sim' : 'nao'}
                      onValueChange={(value) =>
                        update({
                          precisaAjustePpt: value === 'sim',
                          linkPpt: value === 'sim' ? payload.linkPpt : '',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim → cria como PPT</SelectItem>
                        <SelectItem value="nao">Não → PPT sem link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {needsPptLink && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="orq-ppt">Link do PPT</Label>
                    <Input
                      id="orq-ppt"
                      value={payload.linkPpt || ''}
                      onChange={(e) => update({ linkPpt: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Link do ticket</Label>
                  <Input value={ticketUrl} readOnly className="bg-slate-50 text-slate-600" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              {nothingToSend ? 'Fechar' : 'Cancelar'}
            </Button>
            {!everythingSent && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={sending || loadingPreview || !canSubmit}
                className="gap-1.5 text-white border-0"
                style={{ background: 'linear-gradient(135deg, #F69F19, #DE5532)' }}
              >
                {sending || !statusReady ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : nothingToSend ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {primaryLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isResend ? 'Reenviar para o ORQESTRAI?' : 'Enviar sem conferir?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                {plan.toCreate.map((type) => (
                  <p key={type}>{confirmLine(type, states[type])}</p>
                ))}
                {plan.alreadySent.length > 0 && (
                  <p>{joinTypes(plan.alreadySent)} já está no ORQESTRAI e fica como está.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void send()}
              className="text-white border-0"
              style={{ background: 'linear-gradient(135deg, #F69F19, #DE5532)' }}
            >
              {isResend ? 'Sim, reenviar' : 'Sim, enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SendToOrquestraiButton;
