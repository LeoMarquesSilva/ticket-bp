import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TicketService } from '@/services/ticketService';
import { toast } from 'sonner';
import NPSModal from './NPSModal';

interface FinishTicketButtonProps {
  ticketId: string;
  ticketTitle: string;
  isSupport?: boolean;
  onTicketFinished?: () => void;
}

const FinishTicketButton: React.FC<FinishTicketButtonProps> = ({
  ticketId,
  ticketTitle,
  isSupport = false,
  onTicketFinished = () => {},
}) => {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isNPSModalOpen, setIsNPSModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFinishTicket = async () => {
    try {
      setIsLoading(true);
      await TicketService.finishTicket(ticketId);
      setIsConfirmDialogOpen(false);
      
      // Se for o usuário que está finalizando, mostrar o NPS
      if (!isSupport) {
        setIsNPSModalOpen(true);
        // Não chame onTicketFinished aqui, só depois que o NPS for enviado
      } else {
        toast.success('Ticket finalizado com sucesso');
        onTicketFinished();
      }
    } catch (error) {
      console.error('Erro ao finalizar ticket:', error);
      toast.error('Erro ao finalizar ticket. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNPSSubmit = async (data: {
    requestFulfilled: boolean;
    notFulfilledReason?: string;
    serviceScore: number;
    comment: string;
  }) => {
    try {
      await TicketService.submitTicketFeedback(ticketId, data);
      toast.success('Avaliação enviada com sucesso. Obrigado pelo feedback!');
      setIsNPSModalOpen(false); // Fechar o modal apenas após o envio bem-sucedido
      onTicketFinished();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
      // Não fechar o modal em caso de erro, para que o usuário possa tentar novamente
    }
  };

  // Esta função não fará nada, pois o modal NPS é obrigatório
  const handleNPSClose = () => {
    // Não permitimos fechar o modal sem enviar o feedback
    // Apenas para garantir que não fechará acidentalmente
    console.log("Tentativa de fechar o modal NPS sem enviar feedback");
  };

  return (
    <>
      <Button
        onClick={() => setIsConfirmDialogOpen(true)}
        className={`
          ${isSupport 
            ? 'bg-green-600 hover:bg-green-700' 
            : 'bg-[#D5B170] hover:bg-[#c4a05f]'
          } text-white
        `}
        size="sm"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {isSupport ? 'Finalizar Atendimento' : 'Finalizar Ticket'}
      </Button>

      {/* Diálogo de confirmação */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${isSupport ? 'text-green-500' : 'text-[#D5B170]'}`} />
              Confirmar Finalização
            </DialogTitle>
            <DialogDescription>
              {isSupport 
                ? 'Tem certeza que deseja finalizar este atendimento? O ticket será marcado como resolvido.'
                : 'Tem certeza que deseja finalizar este ticket? Isso indicará que sua solicitação foi concluída. Após finalizar, você deverá preencher uma avaliação obrigatória.'}
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
              onClick={handleFinishTicket}
              disabled={isLoading}
              className={`
                ${isSupport 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-[#D5B170] hover:bg-[#c4a05f]'
                } text-white
              `}
            >
              {isLoading ? 'Finalizando...' : 'Confirmar Finalização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de NPS (somente para usuários) - com mandatory=true */}
      {!isSupport && (
        <NPSModal
          isOpen={isNPSModalOpen}
          onClose={handleNPSClose}
          onSubmit={handleNPSSubmit}
          ticketTitle={ticketTitle}
          mandatory={true}
        />
      )}
    </>
  );
};

export default FinishTicketButton;