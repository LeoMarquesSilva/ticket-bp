import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserAvatar from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, MessageCircle, Trash2, X, Lock, Paperclip, Send, Clock, Image, FileText, UserPlus, User, UserCheck, Calendar, Tag, ThumbsUp, AlertTriangle, Bold, Italic, List, ListOrdered, Link2, Code, Maximize2, Minimize2 } from 'lucide-react';
import FinishTicketButton from './FinishTicketButton';
import TransferTicketModal from './TransferTicketModal';
import { Ticket, ChatMessage } from '@/types';
import { TicketService } from '@/services/ticketService';
import { UserService } from '@/services/userService';
import { getSlaHours } from '@/services/dashboardService';
import { CategoryService } from '@/services/categoryService';
import NPSChatFeedback from './NPSChatFeedback';
import QuickReplyTemplates from './QuickReplyTemplates';
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
import {
  FormattedChatMessage,
  applyWrap,
  applyBulletLines,
  applyNumberedLines,
  applyLinkTemplate,
} from '@/lib/chatMessageFormatting';

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
  canAssignTicket?: boolean;
  canDeleteTicket?: boolean;
  canFinishTicket?: boolean;
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
  onCreateNewTicket,
  canAssignTicket = false,
  canDeleteTicket = false,
  canFinishTicket = false
}) => {
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>>({});
  const [createdByAvatarUrl, setCreatedByAvatarUrl] = useState<string | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

  // Referência para o campo de mensagem (textarea)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Função para focar no textarea
  const focusInput = () => {
    if (!textareaRef.current || isTicketFinalized(selectedTicket)) return;

    const attemptFocus = () => {
      const el = textareaRef.current;
      if (el && !isTicketFinalized(selectedTicket)) {
        el.focus();
        if (document.activeElement !== el) {
          setTimeout(() => {
            const t = textareaRef.current;
            if (t && !isTicketFinalized(selectedTicket)) {
              t.focus();
              t.setSelectionRange(t.value.length, t.value.length);
            }
          }, 10);
        }
      }
    };

    attemptFocus();
    requestAnimationFrame(() => attemptFocus());
    setTimeout(() => attemptFocus(), 50);
  };

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || isTicketFinalized(selectedTicket)) return;
    const collapsedMin = 52;
    const expandedMin = Math.min(Math.round(window.innerHeight * 0.38), 360);
    const minPx = composerExpanded ? expandedMin : collapsedMin;
    const maxPx = composerExpanded
      ? Math.min(Math.round(window.innerHeight * 0.72), 560)
      : Math.min(Math.round(window.innerHeight * 0.28), 200);
    el.style.height = '0px';
    const sh = el.scrollHeight;
    el.style.height = `${Math.max(minPx, Math.min(sh, maxPx))}px`;
  }, [newMessage, composerExpanded, selectedTicket.id]);

  const applyComposerFormat = (
    fn: (v: string, s: number, e: number) => { value: string; selectionStart: number; selectionEnd: number }
  ) => {
    const ta = textareaRef.current;
    if (!ta || sending || isTicketFinalized(selectedTicket)) return;
    const res = fn(newMessage, ta.selectionStart, ta.selectionEnd);
    setNewMessage(res.value);
    handleTyping();
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(res.selectionStart, res.selectionEnd);
    }, 0);
  };

  // Buscar avatar do solicitante quando o modal de detalhes abre
  useEffect(() => {
    if (showTicketDetails && selectedTicket.createdBy) {
      UserService.getUserById(selectedTicket.createdBy).then(u => {
        if (u?.avatarUrl) setCreatedByAvatarUrl(u.avatarUrl);
        else setCreatedByAvatarUrl(null);
      }).catch(() => setCreatedByAvatarUrl(null));
    } else if (!showTicketDetails) {
      setCreatedByAvatarUrl(null);
    }
  }, [showTicketDetails, selectedTicket.createdBy]);

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

  const handleLocalKeyPress = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = e.key === 'Enter' || e.key === 'NumpadEnter';
    if (!isEnter) return;

    if (e.nativeEvent.isComposing) return;

    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const val = ta.value;
      const next = val.slice(0, start) + '\n' + val.slice(end);
      setNewMessage(next);
      handleTyping();
      const pos = start + 1;
      queueMicrotask(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (pastedImages.length > 0) {
      await handlePastedImagesUpload();
    }
    sendMessage();
    setPastedImages([]);
    setImageError(null);
    setTimeout(() => focusInput(), 100);
  };

  useEffect(() => {
    if (!sending && !isTicketFinalized(selectedTicket)) {
      setTimeout(() => focusInput(), 50);
    }
  }, [sending]);

  useEffect(() => {
    const checkNeedsFeedback = async () => {
      if (selectedTicket && user && selectedTicket.createdBy === user.id) {
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

  // supportUsers já vem filtrado por getSupportUsers (admin, lawyer, support + roles com assign_ticket)
  const assignableUsers = supportUsers;
  const assignedUser = selectedTicket.assignedTo ? supportUsers.find(u => u.id === selectedTicket.assignedTo) : null;
  const assignedUserName = selectedTicket.assignedTo 
    ? (assignedUser?.name || selectedTicket.assignedToName || "Usuário não encontrado") 
    : null;

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
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden border-l border-slate-200 chat-container bg-white">
      {/* Chat Header - mesmo estilo do header da página de tickets */}
      <div className="flex-shrink-0 bg-[#F6F6F6] border-b border-[#F69F19]/20 shadow-sm z-10">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          {/* Lado esquerdo: voltar (mobile) + info do ticket */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-9 w-9 shrink-0 lg:hidden rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-[#F69F19]/25 shadow-sm ring-1 ring-[#F69F19]/10">
                <MessageCircle className="h-4 w-4 text-[#F69F19]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-[#2C2D2F] text-base truncate">
                    {selectedTicket.title}
                  </h2>
                  <Badge variant="secondary" className={`${getStatusColor(selectedTicket.status)} shrink-0 text-[10px] font-medium px-2 py-0`}>
                    {getStatusLabel(selectedTicket.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  {assignedUserName && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <UserAvatar
                        name={assignedUserName}
                        avatarUrl={assignedUser?.avatarUrl}
                        size="sm"
                        className="h-5 w-5"
                        fallbackClassName="bg-[#F69F19]/20 text-[#F69F19] text-[10px]"
                      />
                      <span><span className="text-slate-400">Atendente:</span> {assignedUserName}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setShowTicketDetails(true)}
                    className="text-[#F69F19] hover:text-[#DE5532] font-medium transition-colors hover:underline shrink-0"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lado direito: ações */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canAssignTicket && !isTicketFinalized(selectedTicket) && handleAssignTicket && assignableUsers.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-slate-200 hover:border-[#F69F19]/50 hover:bg-[#F69F19]/5 rounded-lg"
                  onClick={() => setTransferModalOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Transferir</span>
                </Button>
                <TransferTicketModal
                  open={transferModalOpen}
                  onOpenChange={setTransferModalOpen}
                  ticketId={selectedTicket.id}
                  currentAssignee={selectedTicket.assignedTo}
                  supportUsers={assignableUsers}
                  onTransfer={async (supportId, _supportName) => {
                    await handleAssignTicket(selectedTicket.id, supportId);
                  }}
                />
              </>
            )}
            
            {canDeleteTicket && handleDeleteTicket && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-[#BD2D29] hover:bg-[#BD2D29]/10"
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
  
            {canFinishTicket && selectedTicket.status !== 'resolved' && user && handleUpdateTicket && (
              <FinishTicketButton
                ticketId={selectedTicket.id}
                ticketTitle={selectedTicket.title}
                isSupport={true}
                onTicketFinished={() => {
                  handleUpdateTicket(selectedTicket.id, { status: 'resolved' });
                }}
              />
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 hidden lg:flex rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de detalhes do ticket */}
      <Dialog open={showTicketDetails} onOpenChange={setShowTicketDetails}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 min-w-0 max-h-[90dvh] overflow-x-hidden overflow-y-auto">
          {/* Header com gradiente */}
          <div 
            className="px-6 pt-6 pb-5 relative"
            style={{ background: 'linear-gradient(135deg, rgba(246, 159, 25, 0.08) 0%, rgba(222, 85, 50, 0.05) 50%, rgba(189, 45, 41, 0.04) 100%)' }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#F69F19]/15 shrink-0">
                <FileText className="h-5 w-5 text-[#F69F19]" />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <p className="text-xs font-medium text-[#F69F19] uppercase tracking-wide mb-1">
                  Ticket #{selectedTicket.id.slice(-8)}
                </p>
                <DialogTitle className="text-lg font-bold text-[#2C2D2F] leading-snug">
                  {selectedTicket.title}
                </DialogTitle>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className={`${getStatusColor(selectedTicket.status)} border text-xs font-medium shadow-sm`}>
                    {getStatusLabel(selectedTicket.status)}
                  </Badge>
                  {selectedTicket.priority && (
                    <Badge className={`${getPriorityColor(selectedTicket.priority)} border text-xs font-medium shadow-sm`}>
                      {getPriorityLabel(selectedTicket.priority)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-6 pb-6 pt-4 space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                <UserAvatar
                  name={selectedTicket.createdByName}
                  avatarUrl={createdByAvatarUrl}
                  size="lg"
                  className="h-10 w-10 shrink-0 border-2 border-white shadow-sm"
                  fallbackClassName="bg-[#DE5532]/20 text-[#DE5532]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Solicitante</p>
                  <p className="text-sm font-medium text-[#2C2D2F] truncate">{selectedTicket.createdByName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                <UserAvatar
                  name={assignedUserName || undefined}
                  avatarUrl={assignedUser?.avatarUrl}
                  size="lg"
                  className="h-10 w-10 shrink-0 border-2 border-white shadow-sm"
                  fallbackClassName="bg-[#F69F19]/20 text-[#F69F19]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Atribuído</p>
                  <p className="text-sm font-medium text-[#2C2D2F] truncate">{assignedUserName || 'Não atribuído'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="p-1.5 rounded-lg bg-white border border-slate-200 shrink-0">
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Criado em</p>
                  <p className="text-sm font-medium text-[#2C2D2F]">{formatDate(selectedTicket.createdAt)} às {formatTime(selectedTicket.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                <div className="p-1.5 rounded-lg bg-white border border-slate-200 shrink-0">
                  <Tag className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Categoria</p>
                  <p className="text-sm font-medium text-[#2C2D2F] truncate">
                    {getCategoryLabel(selectedTicket.category || 'outros')}
                    {selectedTicket.subcategory && ` / ${getSubcategoryLabel(selectedTicket.category || 'outros', selectedTicket.subcategory)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F69F19]/5 border border-[#F69F19]/20 sm:col-span-2">
                <div className="p-1.5 rounded-lg bg-[#F69F19]/10 shrink-0">
                  <Clock className="h-4 w-4 text-[#F69F19]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#F69F19] uppercase tracking-wider">SLA Estimado</p>
                  <p className="text-sm font-bold text-[#DE5532]">
                    {(() => {
                      const slaHours = getSlaHours(selectedTicket.category || 'outros', selectedTicket.subcategory || 'outros');
                      return slaHours === 1 ? '1 hora' : `${slaHours} horas`;
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {selectedTicket.description && (
              <div className="min-w-0 w-full">
                <div className="flex items-center gap-2 mb-2 min-w-0">
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">Descrição</p>
                  <div className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
                </div>
                <div className="max-h-[min(50vh,24rem)] w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-4 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] custom-scrollbar shadow-inner">
                  {selectedTicket.description}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 min-h-0 p-4 relative bg-slate-50/30">
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
                  <UserAvatar
                    name={message.userName}
                    avatarUrl={message.avatarUrl}
                    size="md"
                    className="h-8 w-8 flex-shrink-0 border border-slate-200 shadow-sm"
                    fallbackClassName={`text-xs font-bold ${isOwnMessage ? 'bg-[#F69F19] text-white' : 'bg-[#2C2D2F] text-white'}`}
                  />
                  
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
                        <FormattedChatMessage text={message.message} tone={isOwnMessage ? 'own' : 'other'} />
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
                  // Focar o textarea após inserir o template
                  setTimeout(() => {
                    textareaRef.current?.focus();
                  }, 100);
                }}
                disabled={sending || isTicketFinalized(selectedTicket)}
              />
            )}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <TooltipProvider delayDuration={400}>
                <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/90 px-1 py-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat((v, s, e) => applyWrap(v, s, e, '**', '**', 'negrito'))}
                        disabled={sending}
                        aria-label="Negrito"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Negrito (**texto**)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat((v, s, e) => applyWrap(v, s, e, '*', '*', 'itálico'))}
                        disabled={sending}
                        aria-label="Itálico"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Itálico (*texto*)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat(applyBulletLines)}
                        disabled={sending}
                        aria-label="Lista com marcadores"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Lista (- item)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat(applyNumberedLines)}
                        disabled={sending}
                        aria-label="Lista numerada"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Lista numerada (1. item)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat((v, s, e) => applyWrap(v, s, e, '`', '`', 'código'))}
                        disabled={sending}
                        aria-label="Código"
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Código (`trecho`)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#2C2D2F]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyComposerFormat(applyLinkTemplate)}
                        disabled={sending}
                        aria-label="Link"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Link ([texto](url))</TooltipContent>
                  </Tooltip>
                  <div className="ml-auto flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-600 hover:text-[#F69F19]"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setComposerExpanded((x) => !x);
                      }}
                      disabled={sending}
                      aria-expanded={composerExpanded}
                      title={composerExpanded ? 'Recolher área de digitação' : 'Expandir área de digitação (altura maior)'}
                      aria-label={composerExpanded ? 'Recolher campo de mensagem' : 'Expandir campo de mensagem'}
                    >
                      {composerExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </TooltipProvider>

              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={handleLocalKeyPress}
                  placeholder={
                    Object.keys(typingUsers).length > 0
                      ? `${Object.values(typingUsers).join(', ')} está digitando...`
                      : 'Digite sua mensagem...'
                  }
                  rows={composerExpanded ? 5 : 1}
                  disabled={sending}
                  className={`resize-none overflow-y-auto pr-11 py-3 text-base leading-snug border-slate-200 focus-visible:ring-[#F69F19] focus-visible:border-[#F69F19] [overflow-wrap:anywhere] break-words ${
                    composerExpanded
                      ? 'min-h-[min(38vh,360px)] max-h-[min(72vh,560px)]'
                      : 'min-h-[52px] max-h-[min(28vh,200px)]'
                  }`}
                />

                <label className="absolute bottom-2 right-2 cursor-pointer rounded-full p-1.5 transition-colors hover:bg-slate-100">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFileUpload(e.target.files);
                        e.target.value = '';
                      }
                    }}
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                  />
                  <Paperclip className="h-5 w-5 text-slate-400 transition-colors hover:text-[#F69F19]" />
                </label>
              </div>
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
          <div className="mt-2 text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1 justify-between px-1">
            <span>Enter envia mensagem · Shift+Enter pula linha</span>
            <span className="shrink-0">Cole imagens com Ctrl+V</span>
          </div>
        </div>
      ) : (
        /* Ticket finalizado */
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex flex-row items-center justify-center gap-2 text-slate-500 text-xs">
            <div className="p-1.5 bg-slate-100 rounded-full">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <span>Atendimento finalizado</span>
          </div>
          
          {/* Mostrar botão de feedback se necessário */}
          {showFeedback && selectedTicket.createdBy === user?.id && (
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
