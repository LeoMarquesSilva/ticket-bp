import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RecentFeedbackCard from './RecentFeedbackCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2, User, HeadphonesIcon, UserCircle, Briefcase, ChevronDown, ChevronUp, Tag, Clock, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserAvatar from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CategoryService } from '@/services/categoryService';
import { differenceInHours, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  assignedToAvatarUrl?: string; // Foto do atendente
  createdByName?: string; // Nome do solicitante
  createdBy?: string; // ID do criador do ticket
  category?: string; // Categoria do ticket
  subcategory?: string; // Subcategoria do ticket
  createdAt?: string; // Data de criação do ticket
}

interface RecentFeedbackListProps {
  feedbackItems: RecentFeedbackItem[];
}

interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
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
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>>({});

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
      
      // Buscar o ticket completo para ter todas as informações (createdBy, category, assignedToAvatarUrl, etc.)
      let fullTicket = ticket;
      if (ticket.id && (!ticket.createdByName || !ticket.createdBy || !ticket.category || !ticket.createdAt)) {
        const ticketData = await TicketService.getTicket(ticket.id);
        if (ticketData) {
          fullTicket = {
            ...ticket,
            ...ticketData,
            createdByName: ticketData.createdByName,
            createdBy: ticketData.createdBy,
            category: ticketData.category || ticket.category,
            subcategory: ticketData.subcategory || ticket.subcategory,
            createdAt: ticketData.createdAt || ticket.createdAt,
            serviceScore: ticketData.serviceScore || ticket.serviceScore,
            npsScore: ticketData.npsScore || ticket.npsScore
          };
        }
      }
      
      setSelectedTicket(fullTicket);
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

  // Função para obter cor do score
  const getScoreColor = (score: number) => {
    if (score >= 9) return "bg-green-100 text-green-700 border-green-200";
    if (score >= 7) return "bg-blue-50 text-blue-700 border-blue-200";
    if (score >= 5) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  // Carregar categorias do banco de dados
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const config = await CategoryService.getCategoriesConfig();
        setCategoriesConfig(config);
      } catch (error) {
        console.error('Erro ao carregar categorias do banco:', error);
      }
    };

    loadCategories();
  }, []);

  // Função para obter o label formatado da categoria
  const getCategoryLabel = (category: string): string => {
    if (Object.keys(categoriesConfig).length === 0) return category || 'Geral';
    const categoryConfig = categoriesConfig[category];
    return categoryConfig?.label || category || 'Geral';
  };

  // Função para obter o label formatado da subcategoria
  const getSubcategoryLabel = (category: string, subcategory: string): string => {
    if (Object.keys(categoriesConfig).length === 0 || !category || !subcategory) return subcategory || '';
    const categoryConfig = categoriesConfig[category];
    if (!categoryConfig) return subcategory || '';
    
    const subcategoryConfig = categoryConfig.subcategories.find(
      sub => sub.value === subcategory
    );
    return subcategoryConfig?.label || subcategory;
  };

  // Função para calcular e formatar o tempo de resolução
  const getResolutionTime = (createdAt?: string, resolvedAt?: string): string => {
    if (!createdAt || !resolvedAt) return 'Não resolvido';
    
    try {
      const created = new Date(createdAt);
      const resolved = new Date(resolvedAt);
      const hours = differenceInHours(resolved, created);
      const days = differenceInDays(resolved, created);
      
      if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else {
        const minutes = Math.round((resolved.getTime() - created.getTime()) / (1000 * 60));
        return `${minutes}min`;
      }
    } catch (error) {
      return 'Erro ao calcular';
    }
  };

  // Função para obter estilos da mensagem (igual ao Dashboard)
  const getMessageStyles = (message: ChatMessage, ticket: RecentFeedbackItem | null) => {
    if (!ticket) {
      // Fallback para lógica antiga se não tiver ticket
      const roleStyles = getUserRoleStyles(message.userRole);
      return {
        containerClass: 'justify-start',
        flexDirection: 'flex-row',
        bubbleClass: 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200',
        avatarBg: roleStyles.color,
        icon: roleStyles.icon,
        label: roleStyles.label,
        textAlign: 'text-left'
      };
    }
    
    // Identificar se a mensagem é do cliente (criador do ticket) ou do suporte/advogado/admin
    // Se o userId da mensagem for igual ao createdBy do ticket, é do cliente (esquerda)
    // Caso contrário, é do suporte/advogado/admin (direita)
    const isFromClient = ticket?.createdBy && message.userId === ticket.createdBy;
    
    if (!isFromClient) {
      // --- LADO DIREITO (SUPORTE/ADVOGADO/ADMIN) ---
      // Verificar se é advogado baseado no assignedToRole do ticket
      const isLawyer = ticket?.assignedToRole === 'lawyer';
      
      if (isLawyer) {
        return {
          containerClass: 'justify-end',
          flexDirection: 'flex-row-reverse',
          bubbleClass: 'bg-[#DE5532] text-white rounded-tr-none',
          avatarBg: 'bg-[#DE5532]',
          icon: <Briefcase className="h-4 w-4 text-white" />,
          label: 'Advogado',
          textAlign: 'text-right'
        };
      } else {
        return {
          containerClass: 'justify-end',
          flexDirection: 'flex-row-reverse',
          bubbleClass: 'bg-[#F69F19] text-white rounded-tr-none',
          avatarBg: 'bg-[#F69F19]',
          icon: <HeadphonesIcon className="h-4 w-4 text-white" />,
          label: 'Suporte',
          textAlign: 'text-right'
        };
      }
    } else {
      // --- LADO ESQUERDO (CLIENTE/USUÁRIO) ---
      return {
        containerClass: 'justify-start',
        flexDirection: 'flex-row',
        bubbleClass: 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200',
        avatarBg: 'bg-[#2C2D2F]',
        icon: <User className="h-4 w-4 text-white" />,
        label: 'Cliente',
        textAlign: 'text-left'
      };
    }
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
        headerBg: 'bg-[#F69F19]/10',
        headerText: 'text-[#2C2D2F]',
        icon: <Briefcase className="h-4 w-4 text-[#DE5532]" />,
        badge: 'bg-[#F69F19]/20 text-[#2C2D2F] border-[#F69F19]/30',
        contentBg: 'bg-[#F6F6F6]',
        roleText: 'Advogado'
      };
    } else if (role === 'support') {
      return {
        headerBg: 'bg-[#DE5532]/10',
        headerText: 'text-[#2C2D2F]',
        icon: <HeadphonesIcon className="h-4 w-4 text-[#F69F19]" />,
        badge: 'bg-[#DE5532]/20 text-[#2C2D2F] border-[#DE5532]/30',
        contentBg: 'bg-[#F6F6F6]',
        roleText: 'Suporte'
      };
    } else {
      return {
        headerBg: 'bg-[#2C2D2F]/10',
        headerText: 'text-[#2C2D2F]',
        icon: <UserCircle className="h-4 w-4 text-[#2C2D2F]" />,
        badge: 'bg-[#2C2D2F]/20 text-[#2C2D2F] border-[#2C2D2F]/30',
        contentBg: 'bg-[#F6F6F6]/70',
        roleText: 'Atendente'
      };
    }
  };

  // Função para obter o ícone e a cor com base no papel do usuário
  const getUserRoleStyles = (userRole?: string) => {
    if (userRole === 'lawyer') {
      return {
        icon: <Briefcase className="h-4 w-4" />,
        color: 'bg-[#DE5532] text-white',
        label: 'Advogado'
      };
    } else if (userRole === 'support' || userRole === 'admin') {
      return {
        icon: <HeadphonesIcon className="h-4 w-4" />,
        color: 'bg-[#F69F19] text-[#2C2D2F]',
        label: 'Suporte'
      };
    } else {
      return {
        icon: <User className="h-4 w-4" />,
        color: 'bg-[#2C2D2F] text-[#F6F6F6]',
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
            <MessageSquare className="h-5 w-5 text-[#F69F19]" />
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
          <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0" aria-describedby="chat-history-description">
            <DialogHeader className="p-4 sm:p-6 pb-2">
              <DialogTitle className="text-lg sm:text-xl">Histórico da Conversa</DialogTitle>
              <p className="text-xs sm:text-sm text-slate-500" id="chat-history-description">{selectedTicket?.title}</p>
              
              {/* Botão Mostrar Detalhes */}
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTicketDetails(!showTicketDetails)}
                  className="w-full sm:w-auto text-xs"
                >
                  {showTicketDetails ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Mostrar detalhes
                    </>
                  )}
                </Button>
              </div>

              {/* Detalhes do Ticket (expandível) */}
              {showTicketDetails && selectedTicket && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-in slide-in-from-top-2">
                  {/* Data e Hora de Criação */}
                  {selectedTicket.createdAt && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-[#2C2D2F]">Criado em:</span>
                      <span className="text-slate-700">
                        {format(new Date(selectedTicket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  
                  {/* Tempo de Resolução */}
                  {selectedTicket.createdAt && selectedTicket.resolvedAt && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-[#2C2D2F]">Tempo de resolução:</span>
                      <span className="text-slate-700">{getResolutionTime(selectedTicket.createdAt, selectedTicket.resolvedAt)}</span>
                    </div>
                  )}
                  
                  {/* Categoria e Subcategoria */}
                  {(selectedTicket.category || selectedTicket.subcategory) && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-[#2C2D2F]">Categoria:</span>
                      <span className="text-slate-700">
                        {getCategoryLabel(selectedTicket.category || 'outros')}
                        {selectedTicket.subcategory && (
                          <span> / {getSubcategoryLabel(selectedTicket.category || 'outros', selectedTicket.subcategory)}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-3 space-y-2">
                {/* Informações do cliente/usuario */}
                {selectedTicket?.createdByName && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs font-medium text-slate-500 shrink-0">Cliente:</div>
                      <span className="text-xs sm:text-sm text-slate-700 truncate">{selectedTicket.createdByName}</span>
                    </div>
                    {/* NPS */}
                    {(selectedTicket?.serviceScore !== undefined && selectedTicket?.serviceScore !== null) && (
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-slate-500 shrink-0">NPS:</div>
                        <Badge variant="outline" className={`${getScoreColor(selectedTicket.serviceScore)} font-bold text-xs shrink-0`}>
                          {selectedTicket.serviceScore}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Informações do atendente */}
                {selectedTicket?.assignedToName && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs font-medium text-slate-500 shrink-0">Atendente:</div>
                      <div className="flex items-center gap-1 min-w-0">
                        <UserAvatar
                          name={selectedTicket.assignedToName}
                          avatarUrl={selectedTicket.assignedToAvatarUrl}
                          size="sm"
                          className="h-4 w-4 sm:h-5 sm:w-5 shrink-0"
                          fallbackClassName={
                            selectedTicket.assignedToRole === 'lawyer' ? 'bg-[#DE5532] text-white' :
                            selectedTicket.assignedToRole === 'support' ? 'bg-[#F69F19] text-white' :
                            'bg-[#2C2D2F] text-[#F6F6F6]'
                          }
                        />
                        <span className="text-xs sm:text-sm text-slate-700 truncate">{selectedTicket.assignedToName}</span>
                        {selectedTicket.assignedToRole && (
                          <Badge variant="outline" className="text-xs font-normal bg-slate-50 border-slate-200 shrink-0 hidden sm:inline-flex">
                            {selectedTicket.assignedToRole === 'lawyer' ? 'Advogado' : 
                            selectedTicket.assignedToRole === 'support' ? 'Suporte' : 'Atendente'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <Separator className="my-3" />
            </DialogHeader>
            
            {/* Legenda para identificar os participantes */}
            <div className="px-4 sm:px-6 pb-2">
              <div className="flex flex-wrap gap-4 px-2 bg-[#F6F6F6] p-2 rounded-md justify-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300"></div>
                  <span className="text-xs text-[#2C2D2F]">Cliente (Esq)</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#F69F19]"></div>
                    <span className="text-xs text-[#2C2D2F]">Suporte (Dir)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#DE5532]"></div>
                    <span className="text-xs text-[#2C2D2F]">Advogado (Dir)</span>
                  </div>
                </div>
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
              <ScrollArea className="flex-1 w-full p-4 sm:p-6 pt-0">
                <div className="space-y-6 w-full">
                  {chatMessages.map((message) => {
                    const styles = getMessageStyles(message, selectedTicket);
                    
                    return (
                      <div key={message.id} className={`flex w-full ${styles.containerClass}`}>
                        <div className={`flex gap-3 ${styles.flexDirection}`} style={{ maxWidth: '85%', width: 'fit-content' }}>
                          {/* Avatar */}
                          <div className="flex flex-col items-center mt-1 shrink-0">
                            <UserAvatar
                              name={message.userName}
                              avatarUrl={message.avatarUrl}
                              size="md"
                              className={`h-8 w-8 ${styles.avatarBg}`}
                              fallbackClassName={`${styles.avatarBg} flex items-center justify-center`}
                            />
                          </div>

                          {/* Balão da Mensagem */}
                          <div className="flex flex-col" style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>
                            <div className={`rounded-lg p-3 shadow-sm ${styles.bubbleClass}`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden' }}>
                              <p className="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-wide">
                                {message.userName || styles.label}
                              </p>
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
                                {message.message}
                              </p>
                            </div>
                            
                            {/* Data */}
                            <div className={`text-[10px] mt-1 ${styles.textAlign} text-slate-400`}>
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
            
            <div className="p-4 sm:p-6 pt-2 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setIsModalOpen(false)} variant="outline">Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
    </>
  );
};

export default RecentFeedbackList;