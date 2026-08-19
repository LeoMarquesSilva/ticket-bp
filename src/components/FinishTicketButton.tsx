import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  FileCheck2,
  FileX2,
  Info,
  Loader2,
  UserCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TicketService } from '@/services/ticketService';
import { notifySioeEvidenciaDecisao } from '@/services/sioeEvidenciaService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  extractCiFromTicketText,
  isEvidenciaFatalAuditTicket,
} from '@/utils/evidenciaFatal';
import {
  type FinishAssignmentDecision,
  getFinishAssignmentCopy,
  getFinishStepAfterAssignmentChoice,
  getInitialFinishTicketStep,
  shouldAssignToFinalizer,
} from '@/utils/ticketFinishAssignment';
import { runFinishTicketOperation } from '@/utils/finishTicketOrchestration';
import UserAvatar from '@/components/UserAvatar';

interface FinishTicketButtonProps {
  ticketId: string;
  ticketTitle: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedToAvatarUrl?: string;
  ticketDescription?: string;
  category?: string;
  subcategory?: string;
  /** Se já houver decisão salva (ticket reaberto etc.), só mostra read-only. */
  evidenciaEnviada?: boolean | null;
  isSupport?: boolean;
  onTicketFinished?: () => void;
  className?: string;
}

const FinishTicketButton: React.FC<FinishTicketButtonProps> = ({
  ticketId,
  ticketTitle,
  assignedTo,
  assignedToName,
  assignedToAvatarUrl,
  ticketDescription,
  category,
  subcategory,
  evidenciaEnviada: evidenciaEnviadaSalva = null,
  isSupport = false,
  onTicketFinished = () => {},
  className,
}) => {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isEvidenciaDialogOpen, setIsEvidenciaDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [assignToFinalizer, setAssignToFinalizer] = useState(false);
  const [pendingAssignmentDecision, setPendingAssignmentDecision] =
    useState<FinishAssignmentDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const isEvidenciaAudit = isEvidenciaFatalAuditTicket(category, subcategory);
  const hasSavedDecision =
    evidenciaEnviadaSalva === true || evidenciaEnviadaSalva === false;
  const assignmentCopy = getFinishAssignmentCopy(assignedToName);

  const openFinalStep = () => {
    const step = getFinishStepAfterAssignmentChoice(isEvidenciaAudit);
    if (step === 'evidence') setIsEvidenciaDialogOpen(true);
    else setIsConfirmDialogOpen(true);
  };

  const handleOpen = () => {
    setPendingAssignmentDecision(null);
    const step = getInitialFinishTicketStep({
      assignedTo,
      finalizerId: user?.id,
      isEvidenceAudit: isEvidenciaAudit,
    });

    if (step === 'assignment-choice') {
      setIsAssignmentDialogOpen(true);
      return;
    }

    setAssignToFinalizer(shouldAssignToFinalizer(assignedTo));
    if (step === 'evidence') setIsEvidenciaDialogOpen(true);
    else setIsConfirmDialogOpen(true);
  };

  const finishTicket = async (
    evidenciaEnviada?: boolean,
    assignOverride = assignToFinalizer,
  ) => {
    setIsLoading(true);

    try {
      await runFinishTicketOperation({
        operation: async () => {
          if (isEvidenciaAudit) {
            if (typeof evidenciaEnviada !== 'boolean' && !hasSavedDecision) {
              toast.error('Informe se a evidência foi enviada (Sim ou Não).');
              return false;
            }

            const ci = extractCiFromTicketText(ticketTitle, ticketDescription);
            if (!ci) {
              toast.error(
                'Não foi possível extrair o CI do título/descrição (padrão: CI <valor>). Corrija o texto antes de finalizar.',
              );
              return false;
            }

            const decisao =
              typeof evidenciaEnviada === 'boolean'
                ? evidenciaEnviada
                : Boolean(evidenciaEnviadaSalva);

            await TicketService.finishTicket(
              ticketId,
              user ? { userId: user.id, userName: user.name } : undefined,
              { evidenciaEnviada: decisao, assignToFinalizer: assignOverride },
            );

            // Política: resolve localmente mesmo se o SIOE falhar; erro fica em evidencia_sioe_erro.
            const sioe = await notifySioeEvidenciaDecisao(ticketId, decisao);
            if (sioe.ok || sioe.idempotent) {
              toast.success(
                decisao
                  ? 'Ticket finalizado — evidência ok (excludente mantida)'
                  : 'Ticket finalizado — sem evidência (incluído no FATAL)',
              );
            } else if (sioe.mocked) {
              toast.success(
                'Ticket finalizado. Callback SIOE ainda pendente (endpoint/config) — decisão gravada no RESPONSUM.',
              );
              console.warn('[FinishTicket] SIOE mock/log:', sioe);
            } else {
              toast.warning(
                'Ticket finalizado, mas o SIOE não confirmou o callback. A decisão ficou salva para retry.',
              );
              console.warn('[FinishTicket] SIOE callback falhou:', sioe);
            }
          } else {
            await TicketService.finishTicket(
              ticketId,
              user ? { userId: user.id, userName: user.name } : undefined,
              { assignToFinalizer: assignOverride },
            );
            toast.success('Ticket finalizado com sucesso');
          }

          return true;
        },
        onSuccess: () => {
          setIsConfirmDialogOpen(false);
          setIsEvidenciaDialogOpen(false);
          setIsAssignmentDialogOpen(false);
          setPendingAssignmentDecision(null);
          onTicketFinished();
        },
        onError: (error) => {
          console.error('Erro ao finalizar ticket:', error);
          toast.error('Erro ao finalizar ticket. Tente novamente.');
        },
      });
    } finally {
      setIsLoading(false);
      setPendingAssignmentDecision(null);
    }
  };

  const handleAssignmentDecision = async (decision: FinishAssignmentDecision) => {
    setPendingAssignmentDecision(decision);
    const shouldAssign = shouldAssignToFinalizer(assignedTo, decision);
    setAssignToFinalizer(shouldAssign);

    if (isEvidenciaAudit) {
      setIsAssignmentDialogOpen(false);
      setPendingAssignmentDecision(null);
      openFinalStep();
      return;
    }

    await finishTicket(undefined, shouldAssign);
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className={cn(
          'h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white',
          className,
        )}
        size="sm"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Finalizar
      </Button>

      <Dialog
        open={isAssignmentDialogOpen}
        onOpenChange={(open) => {
          if (isLoading) return;
          setIsAssignmentDialogOpen(open);
          if (!open) setPendingAssignmentDecision(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[540px]">
          <DialogHeader className="space-y-0 border-b border-slate-100 bg-[#F69F19]/[0.06] px-6 py-5 text-left">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F69F19]/15 text-[#B96A00]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-balance text-lg font-semibold text-[#2C2D2F]">
                  Em nome de quem deseja finalizar?
                </DialogTitle>
                <DialogDescription className="mt-1.5 max-w-[46ch] text-pretty text-sm leading-5 text-slate-600">
                  {assignmentCopy.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                aria-label={assignmentCopy.keepLabel}
                onClick={() => void handleAssignmentDecision('keep-current')}
                className={cn(
                  'group h-auto min-h-[96px] w-full justify-start gap-4 whitespace-normal rounded-xl border-slate-200 bg-white p-4 text-left transition-colors duration-200',
                  'hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#F69F19]/40',
                  pendingAssignmentDecision === 'keep-current' && isLoading &&
                    'border-slate-300 bg-slate-50',
                )}
              >
                <UserAvatar
                  name={assignedToName}
                  userId={assignedTo}
                  avatarUrl={assignedToAvatarUrl}
                  size="lg"
                  className="h-12 w-12 shrink-0 ring-2 ring-slate-100"
                />
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#2C2D2F]">
                      {assignedToName || 'Responsável atual'}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Responsável atual
                    </span>
                  </span>
                  <span className="block text-xs font-normal leading-5 text-slate-600">
                    {assignmentCopy.keepDescription}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-slate-200 group-hover:text-slate-700">
                  {isLoading && pendingAssignmentDecision === 'keep-current' ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                aria-label={assignmentCopy.assignLabel}
                onClick={() => void handleAssignmentDecision('assign-to-finalizer')}
                className={cn(
                  'group h-auto min-h-[96px] w-full justify-start gap-4 whitespace-normal rounded-xl border-[#F69F19]/40 bg-[#F69F19]/[0.04] p-4 text-left transition-colors duration-200',
                  'hover:border-[#F69F19]/70 hover:bg-[#F69F19]/[0.08] focus-visible:ring-2 focus-visible:ring-[#F69F19]/40',
                  pendingAssignmentDecision === 'assign-to-finalizer' && isLoading &&
                    'border-[#F69F19]/70 bg-[#F69F19]/[0.08]',
                )}
              >
                <UserAvatar
                  name={user?.name}
                  userId={user?.id}
                  avatarUrl={user?.avatarUrl}
                  size="lg"
                  className="h-12 w-12 shrink-0 ring-2 ring-[#F69F19]/15"
                  fallbackClassName="bg-[#F69F19]/20 text-[#9A5700]"
                />
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#2C2D2F]">
                      {user?.name || 'Você'}
                    </span>
                    <span className="inline-flex rounded-full bg-[#F69F19]/15 px-2 py-0.5 text-[11px] font-medium text-[#8A4D00]">
                      Você
                    </span>
                  </span>
                  <span className="block text-xs font-normal leading-5 text-slate-600">
                    {assignmentCopy.assignDescription}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F69F19]/15 text-[#9A5700] transition-colors group-hover:bg-[#F69F19]/25">
                  {isLoading && pendingAssignmentDecision === 'assign-to-finalizer' ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </span>
              </Button>
            </div>

            <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-[36ch] items-start gap-2 text-xs leading-5 text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B96A00]" />
                <span>A escolha define para quem este atendimento será contabilizado.</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={isLoading}
                onClick={() => setIsAssignmentDialogOpen(false)}
                className="shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Cancelar
              </Button>
            </div>

            {isLoading && (
              <p className="mt-3 text-center text-xs font-medium text-slate-500" aria-live="polite">
                Finalizando o ticket…
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação padrão — demais tickets */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-green-500" />
              Confirmar Finalização
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja finalizar este atendimento? O ticket será
              marcado como resolvido.
              {!assignedTo && ' Este ticket será atribuído a você antes da finalização.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={isLoading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => finishTicket()}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? 'Finalizando...' : 'Confirmar Finalização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passo intermediário — auditoria evidência FATAL (SIOE) */}
      <Dialog open={isEvidenciaDialogOpen} onOpenChange={setIsEvidenciaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Evidência enviada?
            </DialogTitle>
            <DialogDescription>
              {hasSavedDecision ? (
                <>
                  Já existe decisão neste ticket:{' '}
                  <span className="font-medium text-slate-700">
                    {evidenciaEnviadaSalva
                      ? 'Evidência ok — mantém excludente'
                      : 'Sem evidência — inclui no FATAL'}
                  </span>
                  . Ao confirmar, o ticket será marcado como resolvido.
                </>
              ) : (
                <>
                  Antes de finalizar este chamado de auditoria FATAL, informe se a
                  evidência foi enviada. A resposta afeta o indicador no
                  financeiro-bp (SIOE).
                  {!assignedTo && ' Este ticket será atribuído a você antes da finalização.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {hasSavedDecision ? (
            <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEvidenciaDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => finishTicket()}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? 'Finalizando...' : 'Finalizar ticket'}
              </Button>
            </DialogFooter>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => finishTicket(true)}
                className="h-auto py-3 justify-start gap-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FileCheck2 className="h-5 w-5 shrink-0" />
                <span className="text-left">
                  <span className="block font-medium">Sim</span>
                  <span className="block text-xs font-normal opacity-90">
                    Evidência ok — mantém excludente
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => finishTicket(false)}
                className="h-auto py-3 justify-start gap-3 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <FileX2 className="h-5 w-5 shrink-0" />
                <span className="text-left">
                  <span className="block font-medium">Não</span>
                  <span className="block text-xs font-normal opacity-90">
                    Sem evidência — inclui no FATAL
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEvidenciaDialogOpen(false)}
                disabled={isLoading}
                className="mt-1"
              >
                Cancelar
              </Button>
              {isLoading && (
                <p className="text-center text-xs text-slate-500">Finalizando...</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinishTicketButton;
