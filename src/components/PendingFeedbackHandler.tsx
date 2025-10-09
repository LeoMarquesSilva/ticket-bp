import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ThumbsUp, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface PendingFeedbackHandlerProps {
  onHasPendingFeedback?: (hasPending: boolean) => void;
}

// Função auxiliar para tentar uma operação com retry
const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delay = 2000
): Promise<any> => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Tentativa ${attempt + 1} falhou:`, error);
      lastError = error;
      
      // Esperar antes de tentar novamente
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

const PendingFeedbackHandler: React.FC<PendingFeedbackHandlerProps> = ({ 
  onHasPendingFeedback = () => {} 
}) => {
  const { user } = useAuth();
  const [pendingFeedbackTickets, setPendingFeedbackTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  
  // Função para verificar feedback pendente com retry
const checkPendingFeedback = async (withRetry = true) => {
  if (!user || user.role !== 'user' || !mountedRef.current) {
    if (mountedRef.current) {
      setLoading(false);
      setPendingFeedbackTickets([]);
      onHasPendingFeedback(false);
    }
    return;
  }
  
  try {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    
    // Função que faz a chamada real à API
    const fetchTickets = async () => {
      return await TicketService.getUserTicketsWithPendingFeedback(user.id);
    };
    
    // Usar retry se solicitado
    const tickets = withRetry 
      ? await retryOperation(fetchTickets, 3, 2000)
      : await fetchTickets();
    
    if (mountedRef.current) {
      setPendingFeedbackTickets(tickets);
      onHasPendingFeedback(tickets.length > 0);
      setLoading(false);
    }
  } catch (error: any) {
    console.error('Erro ao verificar feedback pendente:', error);
    
    if (mountedRef.current) {
      setError(error.message || 'Erro ao verificar tickets pendentes');
      setPendingFeedbackTickets([]);
      onHasPendingFeedback(false);
      setLoading(false);
    }
  }
};

  // Função para tentar novamente manualmente
  const handleRetry = () => {
    setRetrying(true);
    checkPendingFeedback(true)
      .finally(() => {
        if (mountedRef.current) {
          setRetrying(false);
        }
      });
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Verificar imediatamente ao montar o componente
    checkPendingFeedback();
    
    // Verificar periodicamente (a cada 2 minutos)
    const intervalId = setInterval(() => {
      if (mountedRef.current) {
        checkPendingFeedback(false); // Sem retry automático para verificações periódicas
      }
    }, 2 * 60 * 1000);
    
    // Adicionar listener para reconectar quando a conexão de internet voltar
    const handleOnline = () => {
      console.log('Conexão de internet restaurada, verificando tickets pendentes...');
      if (mountedRef.current) {
        checkPendingFeedback();
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.id]); // Dependência apenas no user.id para evitar loops infinitos

  // Se estiver carregando, mostrar indicador de carregamento
  if (loading) {
    return null; // Não mostrar nada durante o carregamento inicial
  }

  // Se houver erro, mostrar mensagem de erro com botão para tentar novamente
  if (error) {
    return (
      <Alert className="bg-red-50 border-red-200 mb-4">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertTitle className="text-red-800">Erro ao verificar avaliações pendentes</AlertTitle>
        <AlertDescription className="text-red-700">
          <p className="mb-2">{error}</p>
          <Button 
            size="sm" 
            variant="outline"
            className="text-xs border-red-500 text-red-500 hover:bg-red-50"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Tentando novamente...
              </>
            ) : (
              'Tentar novamente'
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Não mostrar nada se não houver tickets pendentes ou o usuário não for do tipo 'user'
  if (!pendingFeedbackTickets.length || user?.role !== 'user') {
    return null;
  }

  return (
    <Alert className="bg-amber-50 border-amber-200 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-800">Avaliação pendente</AlertTitle>
      <AlertDescription className="text-amber-700">
        <p className="mb-2">
          Você tem {pendingFeedbackTickets.length} ticket(s) que precisa(m) de avaliação.
          Você não poderá criar novos tickets até avaliar os atendimentos finalizados.
        </p>
        
        <div className="space-y-2 mt-3">
          {pendingFeedbackTickets.map(ticket => (
            <div key={ticket.id} className="flex items-center justify-between bg-white p-2 rounded-md border border-amber-200">
              <div className="flex items-center">
                <ThumbsUp className="h-4 w-4 text-[#D5B170] mr-2" />
                <span className="text-sm font-medium text-slate-700">{ticket.title}</span>
                <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                  {ticket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
                </Badge>
              </div>
                    <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs border-[#D5B170] text-[#D5B170] hover:bg-[#D5B170]/10"
                    onClick={() => navigate(`/tickets/${ticket.id}?showFeedback=true`)}
                    >
                    Avaliar
                    </Button>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PendingFeedbackHandler;