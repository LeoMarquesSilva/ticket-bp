import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RecentFeedbackCard from './RecentFeedbackCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2, User, HeadphonesIcon, UserCircle, Briefcase } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface RecentFeedbackItem {
  id: string;
  title: string;
  npsScore?: number;
  serviceScore?: number;
  requestFulfilled?: boolean;
  comment?: string;
  resolvedAt?: string;
  ticketUrl: string;
  assignedToName: string; // Nome do atendente
  assignedToRole?: string; // Função do atendente (support, lawyer, etc.)
  createdByName?: string; // Nome do solicitante
}

interface RecentFeedbackListProps {
  feedbackItems: RecentFeedbackItem[];
}

interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
  userRole?: string;
}

const RecentFeedbackList: React.FC<RecentFeedbackListProps> = ({ feedbackItems }) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<RecentFeedbackItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbacksByAttendant, setFeedbacksByAttendant] = useState<Record<string, RecentFeedbackItem[]>>({});
  const [attendants, setAttendants] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);

  // Processar feedbacks e agrupá-los por atendente
  useEffect(() => {
    const processFeedbacks = () => {
      setIsProcessing(true);
      
      // Objeto para armazenar feedbacks por atendente
      const feedbackMap: Record<string, RecentFeedbackItem[]> = {
        unassigned: []
      };
      
      // Set para armazenar nomes únicos de atendentes
      const uniqueAttendants = new Set<string>();
      
      // Processar cada feedback
      if (feedbackItems && feedbackItems.length > 0) {
        console.log("Feedbacks recebidos:", feedbackItems);
        
        feedbackItems.forEach(feedback => {
          console.log("Processando feedback:", feedback.id, feedback.title);
          console.log("Nome do atendente (assignedToName):", feedback.assignedToName);
          
          // Se o feedback tem um nome de atendente
          if (feedback.assignedToName && feedback.assignedToName.trim() !== '') {
            const attendantName = feedback.assignedToName.trim();
            console.log("✅ Atribuindo ao atendente:", attendantName);
            
            // Adicionar o nome do atendente ao set de atendentes únicos
            uniqueAttendants.add(attendantName);
            
            // Inicializar o array para este atendente se ainda não existir
            if (!feedbackMap[attendantName]) {
              feedbackMap[attendantName] = [];
            }
            
            // Adicionar o feedback à lista do atendente
            feedbackMap[attendantName].push(feedback);
          } else {
            // Se não tem atendente atribuído, vai para não atribuídos
            console.log("❌ Sem atendente atribuído, indo para 'não atribuídos'");
            feedbackMap.unassigned.push(feedback);
          }
        });
      }
      
      // Converter o set de atendentes em um array e ordenar alfabeticamente
      const sortedAttendants = Array.from(uniqueAttendants).sort();
      
      // Atualizar o estado
      setFeedbacksByAttendant(feedbackMap);
      setAttendants(sortedAttendants);
      setIsProcessing(false);
      
      // Log para depuração
      console.log('Atendentes encontrados:', sortedAttendants);
      console.log('Feedbacks por atendente:', feedbackMap);
    };
    
    processFeedbacks();
  }, [feedbackItems]);

  // Função para abrir o modal com o histórico da conversa
  const handleOpenChat = async (ticketId: string) => {
    // Prevenir comportamento padrão que poderia causar redirecionamento
    if (event) {
      event.preventDefault();
    }
    
    const ticket = feedbackItems.find(item => item.id === ticketId);
    if (!ticket) return;
    
    setSelectedTicket(ticket);
    setIsModalOpen(true);
    setIsLoading(true);
    setError(null);
    
    try {
      // Se o usuário não estiver autenticado, mostrar mensagem apropriada
      if (!user) {
        setError("Você precisa estar autenticado para ver o histórico completo.");
        setIsLoading(false);
        return;
      }
      
      const messages = await TicketService.getTicketMessages(ticketId);
      setChatMessages(messages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setError('Não foi possível carregar o histórico da conversa. Por favor, tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obter as iniciais do nome
  const getInitials = (name: string) => {
    if (!name) return "??";
    
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Renderizar o card de feedback
  const renderFeedbackCard = (feedback: RecentFeedbackItem) => (
    <RecentFeedbackCard
      key={feedback.id}
      id={feedback.id}
      title={feedback.title}
      npsScore={feedback.npsScore}
      serviceScore={feedback.serviceScore}
      requestFulfilled={feedback.requestFulfilled}
      comment={feedback.comment}
      resolvedAt={feedback.resolvedAt}
      ticketUrl={feedback.ticketUrl}
      onOpenChat={() => handleOpenChat(feedback.id)}
    />
  );

  // Função para determinar a cor do fundo e do texto com base na função do atendente
  const getAttendantStyles = (role?: string) => {
    if (role === 'lawyer') {
      return {
        headerBg: 'bg-indigo-50',
        headerText: 'text-indigo-700',
        icon: <Briefcase className="h-4 w-4 text-indigo-600" />,
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-400',
        contentBg: 'bg-indigo-50/30',
        roleText: 'Advogado'
      };
    } else if (role === 'support') {
      return {
        headerBg: 'bg-blue-50',
        headerText: 'text-blue-700',
        icon: <HeadphonesIcon className="h-4 w-4 text-blue-600" />,
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        contentBg: 'bg-blue-50/30',
        roleText: 'Suporte'
      };
    } else {
      return {
        headerBg: 'bg-slate-100',
        headerText: 'text-slate-700',
        icon: <UserCircle className="h-4 w-4 text-slate-600" />,
        badge: 'bg-slate-200 text-slate-800 border-slate-300',
        contentBg: 'bg-slate-50/30',
        roleText: 'Atendente'
      };
    }
  };

  // Função para obter o ícone e a cor com base no papel do usuário
  const getUserRoleStyles = (userRole?: string) => {
    if (userRole === 'lawyer') {
      return {
        icon: <Briefcase className="h-4 w-4" />,
        color: 'bg-indigo-600 text-blue',
        label: 'Advogado'
      };
    } else if (userRole === 'support' || userRole === 'admin') {
      return {
        icon: <HeadphonesIcon className="h-4 w-4" />,
        color: 'bg-[#D5B170] text-blue',
        label: 'Suporte'
      };
    } else {
      return {
        icon: <User className="h-4 w-4" />,
        color: 'bg-slate-700 text-blue',
        label: 'Cliente'
      };
    }
  };

  if (isProcessing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedbacks Recentes</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <span className="ml-2 text-slate-500">Processando feedbacks...</span>
        </CardContent>
      </Card>
    );
  }

  if (!feedbackItems || feedbackItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedbacks Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Nenhum feedback disponível.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-[#D5B170]" />
            Feedbacks por Atendente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-full w-full flex flex-col">
            {/* Container principal com rolagem horizontal */}
            <div className="flex-1 overflow-x-auto">
              {/* Este div define a largura mínima do conteúdo para garantir que as colunas não fiquem muito apertadas */}
              <div className="flex p-4 gap-4 h-full">
                {/* Coluna: Não atribuídos */}
                <div className="flex-shrink-0 flex flex-col h-full w-[250px]">
                  <div className="bg-slate-100 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-600" />
                      <h3 className="font-medium text-slate-700">Não Atribuídos</h3>
                    </div>
                    <Badge className="bg-slate-200 text-slate-800 border-slate-300">
                      {feedbacksByAttendant['unassigned']?.length || 0}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 p-2 overflow-y-auto rounded-b-md bg-slate-50/30 max-h-[500px]">
                    <div className="space-y-2 pb-1">
                      {!feedbacksByAttendant['unassigned'] || feedbacksByAttendant['unassigned'].length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-500">
                          Nenhum feedback não atribuído
                        </div>
                      ) : (
                        feedbacksByAttendant['unassigned'].map((feedback) => (
                          <div key={feedback.id}>
                            {renderFeedbackCard(feedback)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Colunas para cada atendente */}
                {attendants.map(attendantName => {
                  // Encontrar o primeiro feedback deste atendente para obter a função
                  const attendantFeedbacks = feedbacksByAttendant[attendantName] || [];
                  const firstFeedback = attendantFeedbacks[0];
                  const role = firstFeedback?.assignedToRole;
                  const styles = getAttendantStyles(role);
                  
                  // Verificar se há feedbacks reais (não vazios)
                  const hasRealFeedbacks = attendantFeedbacks.some(feedback => 
                    feedback.id.indexOf('empty-') !== 0 && 
                    (feedback.npsScore !== undefined || 
                     feedback.serviceScore !== undefined || 
                     feedback.requestFulfilled !== undefined || 
                     feedback.comment)
                  );
                  
                  return (
                    <div key={attendantName} className="flex-shrink-0 flex flex-col h-full w-[250px]">
                      <div className={`${styles.headerBg} p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10`}>
                        <div className="flex items-center gap-2">
                          {styles.icon}
                          <div>
                            <div className="flex items-center gap-1">
                              <h3 className={`font-medium text-sm truncate max-w-[120px] ${styles.headerText}`}>
                                {attendantName}
                              </h3>
                            </div>
                            <span className="text-xs text-slate-500">
                              {styles.roleText}
                            </span>
                          </div>
                        </div>
                        <Badge className={styles.badge}>
                          {hasRealFeedbacks ? attendantFeedbacks.filter(f => f.id.indexOf('empty-') !== 0).length : 0}
                        </Badge>
                      </div>
                      
                      <div className={`flex-1 p-2 overflow-y-auto rounded-b-md ${styles.contentBg} max-h-[500px]`}>
                        <div className="space-y-2 pb-1">
                          {!hasRealFeedbacks ? (
                            <div className="text-center py-8 text-sm text-slate-500">
                              Nenhum feedback atribuído
                            </div>
                          ) : (
                            attendantFeedbacks.map((feedback) => {
                              // Só renderizar se não for um item vazio
                              if (feedback.id.indexOf('empty-') === 0) {
                                return null;
                              }
                              return (
                                <div key={feedback.id}>
                                  {renderFeedbackCard(feedback)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal para exibir o histórico da conversa */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">Histórico da Conversa</DialogTitle>
            <p className="text-sm text-slate-500">{selectedTicket?.title}</p>
            
            <div className="mt-3 space-y-2">
              {/* Informações do atendente */}
              {selectedTicket?.assignedToName && (
                <div className="flex items-center gap-2">
                  <div className="w-24 text-xs font-medium text-slate-500">Atendente:</div>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className={
                        selectedTicket.assignedToRole === 'lawyer' ? 'bg-indigo-600 text-white' :
                        selectedTicket.assignedToRole === 'support' ? 'bg-[#D5B170] text-white' :
                        'bg-slate-600 text-white'
                      }>
                        {selectedTicket.assignedToRole === 'lawyer' ? <Briefcase className="h-3 w-3" /> :
                         selectedTicket.assignedToRole === 'support' ? <HeadphonesIcon className="h-3 w-3" /> :
                         getInitials(selectedTicket.assignedToName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedTicket.assignedToName}</span>
                    {selectedTicket.assignedToRole && (
                      <Badge variant="outline" className="text-xs font-normal ml-1 bg-slate-50 border-slate-200">
                        {selectedTicket.assignedToRole === 'lawyer' ? 'Advogado' : 
                         selectedTicket.assignedToRole === 'support' ? 'Suporte' : 'Atendente'}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {/* Informações do solicitante */}
              {selectedTicket?.createdByName && (
                <div className="flex items-center gap-2">
                  <div className="w-24 text-xs font-medium text-slate-500">Solicitado por:</div>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-slate-700 text-white">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedTicket.createdByName}</span>
                    <Badge variant="outline" className="text-xs font-normal ml-1 bg-slate-50 border-slate-200">
                      Cliente
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            
            <Separator className="my-3" />
          </DialogHeader>
          
          {/* Legenda para identificar os participantes */}
          <div className="flex flex-wrap gap-4 mb-3 px-2 bg-slate-50 p-2 rounded-md">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 bg-slate-700 text-blue">
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-slate-600">Cliente</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 bg-[#D5B170] text-blue">
                <AvatarFallback>
                  <HeadphonesIcon className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-slate-600">Suporte</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 bg-indigo-600 text-blue">
                <AvatarFallback>
                  <Briefcase className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-slate-600">Advogado</span>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              {user && selectedTicket && (
                <Button onClick={() => handleOpenChat(selectedTicket.id)}>
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma mensagem encontrada para este ticket.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 p-4">
                {chatMessages.map((message) => {
                  const isCurrentUser = message.userId === user?.id;
                  const roleStyles = getUserRoleStyles(message.userRole);
                  
                  return (
                    <div 
                      key={message.id} 
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-3 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                        <div className="flex flex-col items-center mt-1">
                          <Avatar className={`h-8 w-8 ${roleStyles.color}`}>
                            <AvatarFallback>
                              {roleStyles.icon}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`text-[10px] font-medium mt-1 ${
                            isCurrentUser ? 'text-indigo-600' : 
                            message.userRole === 'support' ? 'text-[#D5B170]' : 
                            'text-slate-700'
                          }`}>
                            {isCurrentUser ? 'Você' : message.userName || roleStyles.label}
                          </span>
                        </div>
                        
                        <div>
                          <div className={`rounded-lg p-3 ${
                            isCurrentUser ? 'bg-indigo-600 text-white rounded-tr-none' : 
                            message.userRole === 'support' ? 'bg-[#D5B170] text-white rounded-tl-none' : 
                            'bg-slate-100 text-slate-800 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{message.message}</p>
                          </div>
                          <div className={`text-xs mt-1 ${isCurrentUser ? 'text-right' : 'text-left'} text-slate-500`}>
                            {formatDate(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-end mt-4">
            <Button onClick={() => setIsModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecentFeedbackList;