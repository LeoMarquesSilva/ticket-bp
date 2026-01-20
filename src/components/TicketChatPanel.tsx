import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, MessageCircle, Trash2, X, Lock, Paperclip, Send, Clock, Image, FileText, UserPlus, User, UserCheck, Calendar, Tag, ThumbsUp, AlertTriangle } from 'lucide-react';
import FinishTicketButton from './FinishTicketButton';
import { Ticket, ChatMessage } from '@/types';
import { TicketService } from '@/services/ticketService';
import { getSlaHours } from '@/services/dashboardService';
import { CategoryService } from '@/services/categoryService';
import NPSChatFeedback from './NPSChatFeedback';
import QuickReplyTemplates from './QuickReplyTemplates';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePasteImage } from '@/hooks/usePasteImage';
import PastedImagePreview from '@/components/PastedImagePreview';

// Interface para dados de feedback
interface TicketFeedbackData {
  requestFulfilled: boolean;
  notFulfilledReason?: string;
  serviceScore: number;
  comment: string;
}

interface TicketChatPanelProps {
  selectedTicket: Ticket;
  chatMessages: ChatMessage[];
  user: any;
  sending: boolean;
  newMessage: string;
  setNewMessage: (message: string) => void;
  uploadingFiles: any[];
  handleFileUpload: (files: FileList) => void;
  removeUploadingFile: (fileId: string) => void;
  sendMessage: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  closeChat: () => void;
  handleDeleteTicket?: (ticketId: string) => void;
  handleUpdateTicket?: (ticketId: string, updates: any) => void;
  isTicketFinalized: (ticket: Ticket) => boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  markMessagesAsRead: (ticketId: string) => void;
  setShowImagePreview: (url: string | null) => void;
  typingUsers: Record<string, string>;
  handleTyping: () => void;
  supportUsers?: any[];
  handleAssignTicket?: (ticketId: string, supportUserId: string) => void;
  onCreateNewTicket?: () => void;
}

const TicketChatPanel: React.FC<TicketChatPanelProps> = ({
  selectedTicket,
  chatMessages,
  user,
  sending,
  newMessage,
  setNewMessage,
  uploadingFiles,
  handleFileUpload,
  removeUploadingFile,
  sendMessage,
  closeChat,
  handleDeleteTicket,
  handleUpdateTicket,
  isTicketFinalized,
  messagesEndRef,
  markMessagesAsRead,
  setShowImagePreview,
  typingUsers,
  handleTyping,
  supportUsers = [],
  handleAssignTicket,
  onCreateNewTicket
}) => {
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>>({});

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

  // Referência para o input de mensagem
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook para colar imagens com limite de 300MB
  const { attachPasteListener } = usePasteImage({
    onImagePaste: (file: File) => {
      const maxSize = 300 * 1024 * 1024; // 300MB
      if (file.size > maxSize) {
        setImageError(`Arquivo muito grande. Tamanho máximo: 300MB. Arquivo atual: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        return;
      }
      setPastedImages(prev => [...prev, file]);
      setImageError(null);
    },
    onError: (error: string) => {
      setImageError(error);
    }
  });

  // Função para focar no input
  const focusInput = () => {
    if (!inputRef.current || isTicketFinalized(selectedTicket)) return;
    
    const attemptFocus = () => {
      if (inputRef.current && !isTicketFinalized(selectedTicket)) {
        inputRef.current.focus();
        if (document.activeElement !== inputRef.current) {
          setTimeout(() => {
            if (inputRef.current && !isTicketFinalized(selectedTicket)) {
              inputRef.current.focus();
              inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
            }
          }, 10);
        }
      }
    };
    
    attemptFocus();
    requestAnimationFrame(() => attemptFocus());
    setTimeout(() => attemptFocus(), 50);
  };

  useEffect(() => {
    if (!isTicketFinalized(selectedTicket)) {
      const timeoutId = setTimeout(() => focusInput(), 100);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedTicket.id]);

  useEffect(() => {
    const cleanup = attachPasteListener(document.body);
    return cleanup;
  }, [selectedTicket.id]);

  const handlePastedImagesUpload = async () => {
    if (!selectedTicket?.id || pastedImages.length === 0) return;
    
    try {
      const dataTransfer = new DataTransfer();
      pastedImages.forEach((file) => {
        dataTransfer.items.add(file);
      });
      handleFileUpload(dataTransfer.files);
    } catch (error) {
      console.error('Erro ao processar imagens:', error);
      setImageError('Erro ao processar imagens coladas');
    }
  };

  const removePastedImage = (index: number) => {
    setPastedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocalKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pastedImages.length > 0) {
        await handlePastedImagesUpload();
      }
      sendMessage();
      setPastedImages([]);
      setImageError(null);
      setTimeout(() => focusInput(), 100);
    }
  };

  useEffect(() => {
    if (!sending && !isTicketFinalized(selectedTicket)) {
      setTimeout(() => focusInput(), 50);
    }
  }, [sending]);

  useEffect(() => {
    const checkNeedsFeedback = async () => {
      if (selectedTicket && user && user.role === 'user' && selectedTicket.createdBy === user.id) {
        const showFeedbackParam = searchParams.get('showFeedback') === 'true';
        const needsFeedback = await TicketService.checkTicketNeedsFeedback(selectedTicket.id);
        setShowFeedback(showFeedbackParam || needsFeedback);
      } else {
        setShowFeedback(false);
      }
    };
    checkNeedsFeedback();
  }, [selectedTicket, user, searchParams]);

  const handleSubmitFeedback = async (feedbackData: TicketFeedbackData) => {
    if (!selectedTicket) return;
    
    try {
      setSubmittingFeedback(true);
      await TicketService.submitTicketFeedback(selectedTicket.id, feedbackData);
      
      if (handleUpdateTicket) {
        handleUpdateTicket(selectedTicket.id, {
          ...feedbackData,
          feedbackSubmittedAt: new Date().toISOString(),
          status: 'resolved',
          needsFeedback: false
        });
      }
      
      setShowFeedback(false);
      setShowFeedbackModal(false);
      
      if (searchParams.has('showFeedback')) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('showFeedback');
        setSearchParams(newParams, { replace: true });
      }
      
      const feedbackEvent = new CustomEvent('ticketFeedbackSubmitted', {
        detail: { ticketId: selectedTicket.id, userId: user?.id }
      });
      window.dispatchEvent(feedbackEvent);
      
      try {
        const pendingFeedbackKey = `pendingFeedback_${user?.id}`;
        const storedPending = localStorage.getItem(pendingFeedbackKey);
        if (storedPending) {
          const pendingTickets = JSON.parse(storedPending);
          const updatedPending = pendingTickets.filter(
            (ticketId: string) => ticketId !== selectedTicket.id
          );
          if (updatedPending.length > 0) {
            localStorage.setItem(pendingFeedbackKey, JSON.stringify(updatedPending));
          } else {
            localStorage.removeItem(pendingFeedbackKey);
          }
        }
      } catch (err) {
        console.error("Erro ao atualizar localStorage:", err);
      }
      
      closeChat();
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      alert('Ocorreu um erro ao enviar sua avaliação.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

  const renderAttachments = (attachments: any[]) => {
    if (!attachments || attachments.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((attachment, index) => {
          const isImage = attachment.type?.startsWith('image/');
          
          return (
            <div 
              key={index} 
              className="flex items-center p-1.5 rounded-md bg-white/50 border border-black/5 hover:bg-white transition-colors"
            >
              {isImage ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImagePreview(attachment.url);
                  }}
                  className="flex items-center text-xs font-medium text-[#F69F19] hover:text-[#DE5532] hover:underline"
                >
                  <Image className="h-3 w-3 mr-1.5" />
                  {attachment.name.length > 15 
                    ? attachment.name.substring(0, 12) + '...' 
                    : attachment.name}
                </button>
              ) : (
                <a 
                  href={attachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center text-xs font-medium text-[#F69F19] hover:text-[#DE5532] hover:underline"
                >
                  <FileText className="h-3 w-3 mr-1.5" />
                  {attachment.name.length > 15 
                    ? attachment.name.substring(0, 12) + '...' 
                    : attachment.name}
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const supportOnlyUsers = supportUsers.filter(u => u.role === 'support');
  const assignedUserName = selectedTicket.assignedTo ? 
    supportUsers.find(u => u.id === selectedTicket.assignedTo)?.name || 
    selectedTicket.assignedToName || 
    "Usuário não encontrado" : 
    null;

  const getPriorityLabel = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority || 'Normal';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'open': return 'Aberto';
      case 'assigned': return 'Atribuído';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvido';
      default: return status;
    }
  };

  // Cores atualizadas para a marca
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-[#BD2D29]/10 text-[#BD2D29] border-[#BD2D29]/20';
      case 'high': return 'bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'assigned': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20';
      case 'resolved': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden border-l border-slate-200 chat-container bg-white">
      {/* Chat Header */}
      <div className="p-3 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2 bg-[#F69F19]/10 rounded-lg">
              <MessageCircle className="h-5 w-5 text-[#F69F19]" />
            </div>
            <div>
              <h2 className="font-bold text-[#2C2D2F] text-sm md:text-base">
                {selectedTicket.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Ticket #{selectedTicket.id.slice(-8)}</span>
                <span className="text-slate-300">|</span>
                <button 
                  onClick={() => setShowTicketDetails(!showTicketDetails)}
                  className="text-[#F69F19] hover:text-[#DE5532] font-medium hover:underline transition-colors"
                >
                  {showTicketDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Botão de transferência */}
            {user?.role === 'lawyer' && !isTicketFinalized(selectedTicket) && handleAssignTicket && supportOnlyUsers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-xs border-slate-200 hover:bg-slate-50"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span className="hidden sm:inline">Transferir</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Transferir para suporte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {supportOnlyUsers.map(supportUser => (
                    <DropdownMenuItem 
                      key={supportUser.id}
                      onClick={() => handleAssignTicket(selectedTicket.id, supportUser.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs bg-[#F69F19] text-white">
                            {supportUser.name?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{supportUser.name}</span>
                        {supportUser.isOnline && (
                          <span className="h-2 w-2 rounded-full bg-green-500 ml-1"></span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Botão de excluir ticket */}
            {user?.role === 'admin' && handleDeleteTicket && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#BD2D29] hover:bg-[#BD2D29]/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Ticket</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita e todas as mensagens relacionadas serão perdidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteTicket(selectedTicket.id)}
                      className="bg-[#BD2D29] hover:bg-[#a02622] text-white"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
  
            {/* Botão de finalizar ticket */}
            {selectedTicket.status !== 'resolved' && user && handleUpdateTicket && (
              <FinishTicketButton
                ticketId={selectedTicket.id}
                ticketTitle={selectedTicket.title}
                isSupport={user.role === 'support' || user.role === 'admin' || user.role === 'lawyer'}
                onTicketFinished={() => {
                  handleUpdateTicket(selectedTicket.id, { status: 'resolved' });
                }}
              />
            )}
            
            {/* Botão de fechar chat */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 hidden lg:flex text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Detalhes do ticket (expandível) */}
        {showTicketDetails && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-[#2C2D2F]">Solicitante:</span> {selectedTicket.createdByName}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-[#2C2D2F]">Atribuído:</span> {assignedUserName || <span className="italic text-slate-400">Não atribuído</span>}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-[#2C2D2F]">Criado em:</span> {formatDate(selectedTicket.createdAt)} às {formatTime(selectedTicket.createdAt)}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-[#2C2D2F]">Categoria:</span> 
                {getCategoryLabel(selectedTicket.category || 'outros')}
                {selectedTicket.subcategory && (
                  <span> / {getSubcategoryLabel(selectedTicket.category || 'outros', selectedTicket.subcategory)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-[#2C2D2F]">SLA Estimado:</span> 
                <span className="text-[#F69F19] font-medium">
                  {(() => {
                    const slaHours = getSlaHours(selectedTicket.category || 'outros', selectedTicket.subcategory || 'outros');
                    if (slaHours === 1) return '1 hora';
                    return `${slaHours} horas`;
                  })()}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={`${getStatusColor(selectedTicket.status)} border text-xs font-medium`}>
                {getStatusLabel(selectedTicket.status)}
              </Badge>
              {selectedTicket.priority && (
                <Badge className={`${getPriorityColor(selectedTicket.priority)} border text-xs font-medium`}>
                  {getPriorityLabel(selectedTicket.priority)}
                </Badge>
              )}
            </div>
            {selectedTicket.description && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4 relative bg-slate-50/30" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-3">
              <MessageCircle className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-600 font-medium text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs text-slate-400 max-w-[250px] mt-1">
              {isTicketFinalized(selectedTicket) 
                ? 'Este ticket está finalizado e não pode receber novas mensagens.'
                : 'Seja o primeiro a enviar uma mensagem para iniciar o atendimento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mensagem de feedback enviado */}
            {selectedTicket.feedbackSubmittedAt && (
              <div className="flex justify-center my-4">
                <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-medium flex items-center shadow-sm">
                  <ThumbsUp className="h-3 w-3 mr-1.5" />
                  Avaliação realizada com sucesso
                </div>
              </div>
            )}
            
            {chatMessages.map((message) => {
              const isOwnMessage = user?.id === message.userId;
              const isTemp = message.isTemp;
              const isSystemMessage = message.userId === 'system' || message.isSystem;
              
              // Renderizar mensagem do sistema
              if (isSystemMessage) {
                return (
                  <div key={message.id} className="flex justify-center my-4">
                    <div className="bg-slate-100 border border-slate-200 text-slate-600 px-4 py-1.5 rounded-full text-xs font-medium flex items-center shadow-sm">
                      {message.message.includes('Feedback enviado') || message.message.includes('Avaliação realizada') ? (
                        <ThumbsUp className="h-3 w-3 mr-1.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1.5 text-[#F69F19]" />
                      )}
                      {message.message.includes('Feedback enviado') ? 'Avaliação realizada' : message.message}
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0 border border-slate-200 shadow-sm">
                    <AvatarFallback className={`text-xs font-bold ${isOwnMessage ? 'bg-[#F69F19] text-white' : 'bg-[#2C2D2F] text-white'}`}>
                      {message.userName?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {message.userName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatTime(message.createdAt)}
                      </span>
                      {isTemp && (
                        <Clock className="h-3 w-3 text-slate-400 animate-pulse" />
                      )}
                    </div>
                    
                    <div
                      className={`
                        px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm
                        ${isOwnMessage 
                          ? 'bg-[#F69F19] text-white rounded-tr-none' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }
                        ${isTemp ? 'opacity-70' : ''}
                      `}
                    >
                      {message.message && (
                        <div className="whitespace-pre-wrap leading-relaxed">{message.message}</div>
                      )}
                      {renderAttachments(message.attachments)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Indicador de usuários digitando */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic px-4">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span>
                  {Object.values(typingUsers).join(', ')} está digitando...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input de mensagem */}
      {!isTicketFinalized(selectedTicket) ? (
        <div className="p-4 border-t border-slate-200 bg-white">
          {/* Lista de arquivos sendo carregados */}
          {uploadingFiles.length > 0 && (
            <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-medium mb-2 text-slate-500 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                Anexando arquivos:
              </div>
              <div className="flex flex-wrap gap-2">
                {uploadingFiles.map(file => (
                  <div 
                    key={file.id} 
                    className="relative group bg-white rounded-md border border-slate-200 p-2 flex items-center gap-2 max-w-xs shadow-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {file.type?.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-[#F69F19] flex-shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-[#F69F19] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate text-slate-700">{file.name}</div>
                        {file.error ? (
                          <div className="text-xs text-[#BD2D29]">Erro no upload</div>
                        ) : (
                          <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                            <div 
                              className="bg-[#F69F19] h-1 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUploadingFile(file.id)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-[#BD2D29] hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prévia das imagens coladas */}
          {pastedImages.length > 0 && (
            <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200 border-l-4 border-l-[#F69F19]">
              <div className="text-xs font-medium mb-2 text-[#F69F19] flex items-center gap-1">
                <Image className="h-3 w-3" />
                Imagens prontas para envio:
              </div>
              <div className="flex flex-wrap gap-2">
                {pastedImages.map((file, index) => (
                  <PastedImagePreview
                    key={index}
                    file={file}
                    onRemove={() => removePastedImage(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Erro de imagem */}
          {imageError && (
            <div className="mb-3 p-2 bg-[#BD2D29]/5 rounded-md border border-[#BD2D29]/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#BD2D29]" />
              <div className="text-xs text-[#BD2D29] font-medium">{imageError}</div>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Botão de templates de resposta rápida - apenas para atendentes */}
            {(user?.role === 'support' || user?.role === 'lawyer' || user?.role === 'admin') && !isTicketFinalized(selectedTicket) && (
              <QuickReplyTemplates
                onSelectTemplate={(message) => {
                  setNewMessage(message);
                  // Focar o input após inserir o template
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 100);
                }}
                disabled={sending || isTicketFinalized(selectedTicket)}
              />
            )}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleLocalKeyPress}
                placeholder={Object.keys(typingUsers).length > 0 
                  ? `${Object.values(typingUsers).join(', ')} está digitando...` 
                  : "Digite sua mensagem..."}
                className="flex-1 pr-10 py-6 border-slate-200 focus-visible:ring-[#F69F19] focus-visible:border-[#F69F19]"
                disabled={sending}
              />
              
              {/* Botão de anexar arquivo */}
              <label className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-100 rounded-full transition-colors">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileUpload(e.target.files);
                      e.target.value = ''; // Limpar o input
                    }
                  }}
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                />
                <Paperclip className="h-5 w-5 text-slate-400 hover:text-[#F69F19] transition-colors" />
              </label>
            </div>
            
            <Button
              onClick={async () => {
                if (pastedImages.length > 0) {
                  await handlePastedImagesUpload();
                }
                sendMessage();
                setPastedImages([]);
                setImageError(null);
                setTimeout(() => focusInput(), 50);
              }}
              disabled={(!newMessage.trim() && uploadingFiles.length === 0 && pastedImages.length === 0) || sending || uploadingFiles.some(f => f.progress < 100 && !f.error)}
              className="h-[50px] w-[50px] rounded-lg shadow-md border-0 transition-transform active:scale-95"
              style={{ background: brandGradient }}
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Send className="h-5 w-5 text-white" />
              )}
            </Button>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex justify-between px-1">
             <span>Pressione Enter para enviar</span>
             <span>Cole imagens com Ctrl+V</span>
          </div>
        </div>
      ) : (
        /* Ticket finalizado */
        <div className="p-6 border-t border-slate-200 bg-slate-50/50">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500 text-sm py-4">
            <div className="p-3 bg-slate-100 rounded-full">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <span className="font-medium">Atendimento finalizado</span>
          </div>
          
          {/* Mostrar botão de feedback se necessário */}
          {showFeedback && user?.role === 'user' && selectedTicket.createdBy === user.id && (
            <div className="mt-2 p-4 bg-[#F69F19]/5 border border-[#F69F19]/20 rounded-xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#F69F19]/10 rounded-full">
                    <ThumbsUp className="h-5 w-5 text-[#F69F19]" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#2C2D2F] block">
                      Avalie nosso atendimento
                    </span>
                    <span className="text-xs text-slate-500">
                      Sua opinião é fundamental para nós.
                    </span>
                  </div>
                </div>
                <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-white font-bold shadow-sm border-0" style={{ background: brandGradient }}>
                      Avaliar Agora
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ThumbsUp className="h-5 w-5 text-[#F69F19]" />
                        Avaliação de Suporte
                      </DialogTitle>
                      <DialogDescription>
                        Como foi sua experiência com o ticket <strong>{selectedTicket.title}</strong>?
                      </DialogDescription>
                    </DialogHeader>
                    <NPSChatFeedback
                        ticketTitle={selectedTicket.title}
                        onSubmit={handleSubmitFeedback}
                        isSubmitting={submittingFeedback}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TicketChatPanel;
