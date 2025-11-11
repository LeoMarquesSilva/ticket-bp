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
import { AlertTriangle, MessageSquare, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TicketForm from '@/components/TicketForm';
import { TicketService } from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
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
      const tickets = await TicketService.getUserTicketsWithPendingFeedback(user.id);
      
      setHasPendingFeedback(tickets && tickets.length > 0);
      setPendingTickets(tickets || []);
    } catch (error) {
      console.error('Erro ao verificar feedback pendente:', error);
      // Em caso de erro, permitir a criação do ticket
      setHasPendingFeedback(false);
      setPendingTickets([]);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClose = () => {
    // Permitir fechar o modal mesmo com feedback pendente
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Criar Novo Ticket
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {hasPendingFeedback 
              ? "Você precisa avaliar tickets anteriores antes de criar um novo."
              : "Preencha os detalhes abaixo para criar um novo ticket de suporte."
            }
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
            <p className="text-slate-500">Verificando tickets pendentes...</p>
          </div>
        ) : hasPendingFeedback ? (
          <div className="py-4">
            <Alert className="bg-amber-50 border-amber-200 mb-6">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <AlertDescription className="text-amber-700">
                <div className="space-y-2">
                  <p className="font-medium">
                    ⚠️ Avaliação Obrigatória Pendente
                  </p>
                  <p>
                    Você tem <strong>{pendingTickets.length} ticket{pendingTickets.length > 1 ? 's' : ''}</strong> finalizado{pendingTickets.length > 1 ? 's' : ''} que precisa{pendingTickets.length > 1 ? 'm' : ''} de avaliação.
                  </p>
                  <p className="text-sm">
                    Para manter a qualidade do nosso atendimento, é necessário avaliar todos os tickets finalizados antes de criar novos.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-[#D5B170]" />
                <h3 className="font-medium text-slate-700">
                  Tickets aguardando sua avaliação:
                </h3>
              </div>
              
              {pendingTickets.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className="p-4 border border-slate-200 rounded-lg bg-gradient-to-r from-white to-amber-50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-800 mb-1">
                        {ticket.title}
                      </h4>
                      <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>
                          Finalizado em: {formatDate(ticket.resolvedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Aguardando avaliação
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Como avaliar seus tickets:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Feche este modal clicando em "Entendi"</li>
                    <li>Procure pela seção "Feedback Pendente" na parte superior da tela</li>
                    <li>Avalie cada ticket respondendo às perguntas sobre o atendimento</li>
                    <li>Após avaliar todos, você poderá criar novos tickets</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button 
                onClick={handleClose} 
                className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
              >
                Entendi - Vou Avaliar os Tickets
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-4">
            <TicketForm onSubmit={handleSubmit} onCancel={handleClose} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketModal;