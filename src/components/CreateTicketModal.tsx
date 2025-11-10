import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TicketForm from '@/components/TicketForm';
import { TicketService } from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext'; // Assumindo que você tem um contexto de autenticação

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
  }) => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { user } = useAuth(); // Obter o usuário atual
  const [hasPendingFeedback, setHasPendingFeedback] = useState<boolean>(false);
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Verificar se há feedback pendente quando o modal for aberto
  useEffect(() => {
    if (isOpen && user) {
      checkPendingFeedback();
    }
  }, [isOpen, user]);

  const checkPendingFeedback = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Verificar se há tickets com feedback pendente
      const { data, error } = await TicketService.getUserTicketsWithPendingFeedback(user.id);
      
      if (error) {
        console.error('Erro ao verificar feedback pendente:', error);
        return;
      }
      
      setHasPendingFeedback(data && data.length > 0);
      setPendingTickets(data || []);
    } catch (error) {
      console.error('Erro ao verificar feedback pendente:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
  }) => {
    // Se houver feedback pendente, não permitir a criação do ticket
    if (hasPendingFeedback) {
      return;
    }
    
    await onSubmit(data);
    onClose();
  };

  const navigateToTicket = (ticketId: string) => {
    window.location.href = `/tickets/${ticketId}`;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Criar Novo Ticket
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Preencha os detalhes abaixo para criar um novo ticket de suporte.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8 text-center">
            <p className="text-slate-500">Verificando tickets pendentes...</p>
          </div>
        ) : hasPendingFeedback ? (
          <div className="py-4">
            <Alert className="bg-amber-50 border-amber-200 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <AlertDescription className="text-amber-700">
                <p className="font-medium">Você tem tickets finalizados que precisam de avaliação.</p>
                <p className="mt-1">Por favor, avalie-os antes de criar um novo ticket.</p>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 mt-4">
              <p className="font-medium text-slate-700">Tickets pendentes de avaliação:</p>
              {pendingTickets.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className="p-3 border rounded-md bg-white hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigateToTicket(ticket.id)}
                >
                  <p className="font-medium text-slate-800">{ticket.title}</p>
                  <p className="text-sm text-slate-500">
                    Finalizado em: {new Date(ticket.resolved_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
            
            <DialogFooter className="mt-6">
              <Button onClick={onClose} className="w-full">
                Entendi
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-4">
            <TicketForm onSubmit={handleSubmit} onCancel={onClose} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketModal;