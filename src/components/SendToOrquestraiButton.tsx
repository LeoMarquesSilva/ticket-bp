import React, { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
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
import { Ticket } from '@/types';
import { UserService } from '@/services/userService';
import { submitOrquestraiTreinamento } from '@/services/orquestraiTreinamentosService';
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
  certificadosDeadlineIso,
  defaultSendMode,
  includesPpt,
  isoDateFromBr,
  sendModeLabel,
  sendModesFor,
  type OrquestraiSendMode,
} from '@/utils/orquestraiSendMode';
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

const SendToOrquestraiButton: React.FC<Props> = ({
  ticket,
  user,
  subcategoryLabel = '',
}) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SharepointTreinamentoPayload>(emptyPayload());
  const [ticketUrl, setTicketUrl] = useState('');
  const [sendMode, setSendMode] = useState<OrquestraiSendMode>('certificados');

  const visible = useMemo(
    () =>
      canSendToOrquestrai(user) &&
      isDesenvolvimentoContinuoCategory(ticket.category || ''),
    [user, ticket.category],
  );

  const { departments, loading: loadingOptions } = useDesenvolvimentoContinuoOptions(
    visible && open,
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setLoadingPreview(true);
      setParseError(null);

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
            setSendMode('certificados');
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
            setSendMode(defaultSendMode(enriched.precisaAjustePpt));
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

  if (!visible) return null;

  const update = (patch: Partial<SharepointTreinamentoPayload>) => {
    setPayload((prev) => ({ ...prev, ...patch }));
  };

  const requestTypes = sendModesFor(sendMode);
  const pptDeadline = isoDateFromBr(payload.dataRealizacao) || payload.dataRealizacao || '—';
  const certDeadline = certificadosDeadlineIso(payload.dataRealizacao) || '—';
  const needsPptLink = includesPpt(sendMode) && payload.precisaAjustePpt;
  const canSubmit =
    Boolean(payload.tema.trim()) &&
    Boolean(payload.dataRealizacao.trim()) &&
    (!needsPptLink || Boolean(payload.linkPpt?.trim()));

  const handleConfirm = async () => {
    if (!canSubmit) {
      toast.error(
        needsPptLink
          ? 'Preencha tema, data e o link do PPT'
          : 'Preencha pelo menos tema e data',
      );
      return;
    }
    setSending(true);
    try {
      const result = await submitOrquestraiTreinamento(ticket.id, {
        ...payload,
        sendMode,
        linkPpt: needsPptLink ? payload.linkPpt?.trim() || undefined : undefined,
      });
      if (!result.ok) {
        toast.error(result.error || 'Falha ao enviar para o ORQESTRAI');
        return;
      }
      const results = result.results ?? [];
      const created = results.filter((item) => item.created);
      const existing = results.filter((item) => !item.created);
      if (created.length && existing.length) {
        toast.success(
          `Criado: ${created.map((item) => item.requestType).join(', ')}. Já existia: ${existing.map((item) => item.requestType).join(', ')}`,
        );
      } else if (created.length) {
        toast.success(
          created.length > 1
            ? 'Cards criados no ORQESTRAI'
            : `Card ${created[0].requestType} criado no ORQESTRAI`,
        );
      } else if (result.created === false || existing.length) {
        toast.info('Já existe um card deste tipo no ORQESTRAI');
      } else {
        toast.success('Card criado no ORQESTRAI');
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao enviar para o ORQESTRAI',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px] border-[#F69F19]/40 text-[#DE5532] hover:border-[#F69F19] hover:bg-[#F69F19]/10 rounded-md shrink-0"
        onClick={() => setOpen(true)}
        title="Enviar para ORQESTRAI"
      >
        <Send className="h-3 w-3" />
        <span>ORQESTRAI</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar para ORQESTRAI</DialogTitle>
            <DialogDescription>
              Ajuste os campos abaixo antes de criar o card no Marketing. O envio não
              altera o ticket no Responsum.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Prévia no ORQESTRAI
                </p>
                {requestTypes.map((type) => (
                  <p key={type} className="font-medium text-[#2C2D2F] break-words">
                    {type === 'Certificados'
                      ? `[DC] Certificados — ${payload.tema || '…'}`
                      : `[DC] ${payload.subcategory || 'Desenvolvimento Contínuo'} — ${payload.tema || '…'}`}
                  </p>
                ))}
                <p className="text-xs text-slate-500">
                  Tipo:{' '}
                  <span className="text-[#2C2D2F] font-medium">
                    {requestTypes.join(' + ')}
                  </span>
                  {' · '}
                  Estágio: <span className="text-[#2C2D2F] font-medium">Tarefas</span>
                  {' · '}
                  Assignee: <span className="text-[#2C2D2F] font-medium">Valentina Iacovacci</span>
                </p>
                <p className="text-xs text-slate-500">
                  Prazo:{' '}
                  <span className="text-[#2C2D2F] font-medium">
                    {requestTypes
                      .map((type) =>
                        type === 'Certificados'
                          ? `Certificados ${certDeadline}`
                          : `PPT ${pptDeadline}`,
                      )
                      .join(' · ')}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>O que enviar</Label>
                <Select
                  value={sendMode}
                  onValueChange={(value) => setSendMode(value as OrquestraiSendMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ppt">{sendModeLabel('ppt')}</SelectItem>
                    <SelectItem value="certificados">
                      {sendModeLabel('certificados')}
                    </SelectItem>
                    <SelectItem value="ppt_e_certificados">
                      {sendModeLabel('ppt_e_certificados')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

                {includesPpt(sendMode) && (
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
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={sending || loadingPreview || !canSubmit}
              className="text-white border-0"
              style={{ background: 'linear-gradient(135deg, #F69F19, #DE5532)' }}
            >
              {sending ? 'Enviando…' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendToOrquestraiButton;
