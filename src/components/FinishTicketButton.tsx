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
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  
  // Se o usuário for do tipo "user", não renderizar o botão
  if (user?.role === 'user') {
    return null;
  }

  const handleFinishTicket = async () => {
    try {
      setIsLoading(true);
      await TicketService.finishTicket(ticketId);
      setIsConfirmDialogOpen(false);
      
      // Apenas support/lawyer podem finalizar tickets agora
      toast.success('Ticket finalizado com sucesso');
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
        onClick={() => setIsConfirmDialogOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white"
        size="sm"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Finalizar Atendimento
      </Button>

      {/* Diálogo de confirmação */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-green-500" />
              Confirmar Finalização
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja finalizar este atendimento? O ticket será marcado como resolvido.
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
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? 'Finalizando...' : 'Confirmar Finalização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinishTicketButton;