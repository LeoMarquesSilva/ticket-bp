import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, FileCheck2, FileX2 } from 'lucide-react';
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

interface FinishTicketButtonProps {
  ticketId: string;
  ticketTitle: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const isEvidenciaAudit = isEvidenciaFatalAuditTicket(category, subcategory);
  const hasSavedDecision =
    evidenciaEnviadaSalva === true || evidenciaEnviadaSalva === false;

  const handleOpen = () => {
    if (isEvidenciaAudit) {
      setIsEvidenciaDialogOpen(true);
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const finishTicket = async (evidenciaEnviada?: boolean) => {
    try {
      setIsLoading(true);

      if (isEvidenciaAudit) {
        if (typeof evidenciaEnviada !== 'boolean' && !hasSavedDecision) {
          toast.error('Informe se a evidência foi enviada (Sim ou Não).');
          return;
        }

        const ci = extractCiFromTicketText(ticketTitle, ticketDescription);
        if (!ci) {
          toast.error(
            'Não foi possível extrair o CI do título/descrição (padrão: CI <valor>). Corrija o texto antes de finalizar.',
          );
          return;
        }

        const decisao =
          typeof evidenciaEnviada === 'boolean'
            ? evidenciaEnviada
            : Boolean(evidenciaEnviadaSalva);

        await TicketService.finishTicket(
          ticketId,
          user ? { userId: user.id, userName: user.name } : undefined,
          { evidenciaEnviada: decisao },
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
        );
        toast.success('Ticket finalizado com sucesso');
      }

      setIsConfirmDialogOpen(false);
      setIsEvidenciaDialogOpen(false);
      onTicketFinished();
    } catch (error) {
      console.error('Erro ao finalizar ticket:', error);
      toast.error('Erro ao finalizar ticket. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
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
