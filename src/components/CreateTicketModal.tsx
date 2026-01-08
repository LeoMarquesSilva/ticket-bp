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
import { AlertTriangle, MessageSquare, Star, Info } from 'lucide-react';
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

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl">
        {/* Barra de gradiente no topo */}
        <div className="h-[3px] w-full" style={{ background: brandGradient }}></div>
        
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-[#2C2D2F] flex items-center gap-2">
              {hasPendingFeedback ? (
                <>
                  <AlertTriangle className="h-6 w-6 text-[#F69F19]" />
                  Ação Necessária
                </>
              ) : (
                'Criar Novo Ticket'
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {hasPendingFeedback 
                ? "Para manter a qualidade do atendimento, precisamos da sua opinião."
                : "Preencha os detalhes abaixo para criar um novo ticket de suporte."
              }
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#F69F19] mx-auto mb-4"></div>
              <p className="text-slate-500 font-medium">Verificando disponibilidade...</p>
            </div>
          ) : hasPendingFeedback ? (
            <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Alert className="bg-[#F69F19]/10 border-[#F69F19]/20 mb-6">
                <AlertTriangle className="h-5 w-5 text-[#F69F19]" />
                <AlertDescription className="text-[#2C2D2F]">
                  <div className="space-y-2">
                    <p className="font-semibold text-[#DE5532]">
                      Avaliação Obrigatória Pendente
                    </p>
                    <p className="text-sm">
                      Você possui <strong>{pendingTickets.length} ticket{pendingTickets.length > 1 ? 's' : ''}</strong> finalizado{pendingTickets.length > 1 ? 's' : ''} aguardando feedback. O sistema libera novos chamados automaticamente após essas avaliações.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Aguardando sua avaliação
                  </h3>
                </div>
                
                {pendingTickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    className="group p-4 border border-slate-200 rounded-lg bg-white hover:border-[#F69F19]/30 hover:shadow-md transition-all duration-200 relative overflow-hidden"
                  >
                    {/* Borda lateral indicativa */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F69F19]"></div>
                    
                    <div className="flex items-start justify-between pl-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-[#2C2D2F] mb-1 group-hover:text-[#DE5532] transition-colors">
                          {ticket.title}
                        </h4>
                        <p className="text-sm text-slate-600 mb-2 line-clamp-1">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>
                            Finalizado em: {formatDate(ticket.resolvedAt)}
                          </span>
                          <span className="flex items-center gap-1 text-[#F69F19] font-medium">
                            <Star className="h-3 w-3 fill-current" />
                            Avaliar agora
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Box de Instrução - Substituindo o Azul por Neutro/Dark */}
              <div className="mt-6 p-4 bg-[#F6F6F6] border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-[#2C2D2F] rounded-full mt-0.5">
                    <Info className="h-3 w-3 text-white" />
                  </div>
                  <div className="text-sm text-slate-600">
                    <p className="font-bold text-[#2C2D2F] mb-1">Como prosseguir?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Clique em <strong>"Entendi"</strong> abaixo para fechar esta janela.</li>
                      <li>Localize a barra de <strong>"Feedback Pendente"</strong> no topo do seu painel.</li>
                      <li>Avalie os atendimentos listados.</li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button 
                  onClick={handleClose} 
                  className="w-full text-white font-bold shadow-md border-0 hover:opacity-90 transition-opacity"
                  style={{ background: brandGradient }}
                >
                  Entendi - Vou Avaliar os Tickets
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-2">
              <TicketForm onSubmit={handleSubmit} onCancel={handleClose} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketModal;
