import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import NPSModal from './NPSModal';
import { toast } from 'sonner';

const PendingFeedbackHandler: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [isNPSModalOpen, setIsNPSModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Verificar se o ticket atual precisa de feedback
  useEffect(() => {
    const checkCurrentTicket = async () => {
      if (!ticketId || !user) return;

      try {
        setIsLoading(true);
        console.log('Verificando feedback para ticket atual:', ticketId);
        
        const ticket = await TicketService.getTicket(ticketId);
        console.log('Ticket obtido:', ticket);
        
        // Verificar se o ticket existe, é do usuário atual, está resolvido e não tem feedback
        if (
          ticket && 
          ticket.createdBy === user.id && 
          ticket.status === 'resolved' && 
          !ticket.feedbackSubmittedAt
        ) {
          console.log('Ticket com feedback pendente encontrado:', ticket);
          setTicket(ticket);
          setIsNPSModalOpen(true);
        }
      } catch (error) {
        console.error('Erro ao verificar feedback do ticket:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkCurrentTicket();
  }, [ticketId, user]);

  // Verificar se há tickets com feedback pendente ao carregar a página
  useEffect(() => {
    const checkPendingFeedback = async () => {
      if (!user) return;
      
      try {
        // Verificar se o usuário tem tickets com feedback pendente
        const hasPending = await TicketService.hasUnsubmittedFeedback(user.id);
        
        if (hasPending) {
          // Buscar os tickets com feedback pendente
          const { data: pendingTickets } = await TicketService.getUserTicketsWithPendingFeedback(user.id);
          
          if (pendingTickets && pendingTickets.length > 0) {
            // Se estamos em uma página de ticket específico, não redirecionar
            if (ticketId) return;
            
            // Redirecionar para o primeiro ticket com feedback pendente
            const firstPendingTicket = pendingTickets[0];
            toast.info('Você tem tickets que precisam de avaliação', {
              description: 'Por favor, avalie o ticket antes de continuar.'
            });
            navigate(`/tickets/${firstPendingTicket.id}`);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar tickets com feedback pendente:', error);
      }
    };
    
    checkPendingFeedback();
  }, [user, ticketId, navigate]);

  const handleNPSSubmit = async (data: {
    requestFulfilled: boolean;
    notFulfilledReason?: string;
    serviceScore: number;
    comment: string;
  }) => {
    if (!ticketId) return;
    
    try {
      await TicketService.submitTicketFeedback(ticketId, data);
      toast.success('Avaliação enviada com sucesso. Obrigado pelo feedback!');
      setIsNPSModalOpen(false);
      
      // Atualizar o ticket localmente
      if (ticket) {
        setTicket({
          ...ticket,
          feedbackSubmittedAt: new Date().toISOString(),
          status: 'closed'
        });
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    }
  };

  // Esta função não fará nada, pois o modal NPS é obrigatório
  const handleNPSClose = () => {
    // Não permitimos fechar o modal sem enviar o feedback
    toast.warning('Por favor, avalie o ticket antes de continuar', {
      description: 'Esta avaliação é obrigatória para tickets finalizados.'
    });
  };

  // Renderiza apenas o modal quando necessário
  return (
    <>
      {ticket && (
        <NPSModal
          isOpen={isNPSModalOpen}
          onClose={handleNPSClose}
          onSubmit={handleNPSSubmit}
          ticketTitle={ticket.title}
          mandatory={true}
        />
      )}
    </>
  );
};

export default PendingFeedbackHandler;