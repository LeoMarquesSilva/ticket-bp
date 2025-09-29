import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, MessageCircle, Trash2, X, Lock, Paperclip, Send, Clock, Image, FileText, UserPlus, User, UserCheck, Calendar, Tag } from 'lucide-react';
import FinishTicketButton from './FinishTicketButton';
import { Ticket } from '@/types';
import { ChatMessage } from '@/services/ticketService'; // Corrigir esta importação
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  supportUsers?: any[]; // Adicionamos esta prop para listar usuários de suporte
  handleAssignTicket?: (ticketId: string, supportUserId: string) => void; // Adicionamos esta prop para transferir o ticket
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
  handleKeyPress,
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
  handleAssignTicket
}) => {
  const [showTicketDetails, setShowTicketDetails] = useState(false);

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

  const renderAttachments = (attachments: any[]) => {
    if (!attachments || attachments.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((attachment, index) => {
          const isImage = attachment.type?.startsWith('image/');
          
          return (
            <div 
              key={index} 
              className="flex items-center p-1 rounded-md bg-slate-100 border border-slate-200"
            >
              {isImage ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImagePreview(attachment.url);
                  }}
                  className="flex items-center text-xs text-blue-600 hover:underline"
                >
                  <Image className="h-3 w-3 mr-1" />
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
                  className="flex items-center text-xs text-blue-600 hover:underline"
                >
                  <FileText className="h-3 w-3 mr-1" />
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

  // Filtrar apenas usuários de suporte (não advogados)
  const supportOnlyUsers = supportUsers.filter(u => u.role === 'support');

  // Encontrar o nome do usuário atribuído
  const assignedUserName = selectedTicket.assignedTo ? 
    supportUsers.find(u => u.id === selectedTicket.assignedTo)?.name || 
    selectedTicket.assignedToName || 
    "Usuário não encontrado" : 
    null;

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority || 'Normal';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
  <div className="w-full lg:w-3/4 xl:w-4/5 flex flex-col border-l border-slate-200">
      {/* Chat Header */}
      <div className="p-3 border-b border-slate-200 bg-white">
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
            <MessageCircle className="h-5 w-5 text-[#D5B170]" />
            <div>
              <h2 className="font-semibold text-[#101F2E]">
                {selectedTicket.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Ticket #{selectedTicket.id.slice(-8)}</span>
                <button 
                  onClick={() => setShowTicketDetails(!showTicketDetails)}
                  className="text-[#D5B170] hover:underline"
                >
                  {showTicketDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Botão de transferência (apenas para advogados) */}
            {user?.role === 'lawyer' && !isTicketFinalized(selectedTicket) && handleAssignTicket && supportOnlyUsers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-xs"
                  >
                    <UserPlus className="h-3 w-3" />
                    Transferir
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
                          <AvatarFallback className="text-xs bg-blue-500 text-white">
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
            
            {/* Botão de excluir ticket (apenas para admin) */}
            {user?.role === 'admin' && handleDeleteTicket && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
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
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
  
            {/* Botão de finalizar ticket */}
            {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && user && handleUpdateTicket && (
              <FinishTicketButton
                ticketId={selectedTicket.id}
                ticketTitle={selectedTicket.title}
                isSupport={user.role === 'support' || user.role === 'admin' || user.role === 'lawyer'}
                onTicketFinished={() => {
                  // Atualizar o ticket na lista
                  handleUpdateTicket(selectedTicket.id, { status: 'resolved' });
                }}
              />
            )}
            
            {/* Botão de fechar chat */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="h-8 w-8 hidden lg:flex"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Detalhes do ticket (expandível) */}
        {showTicketDetails && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-1 text-slate-600">
                <User className="h-3 w-3" />
                <span className="font-medium">Solicitante:</span> {selectedTicket.createdByName}
              </div>
              <div className="flex items-center gap-1 text-slate-600">
                <UserCheck className="h-3 w-3" />
                <span className="font-medium">Atribuído:</span> {assignedUserName || <span className="italic text-slate-400">Não atribuído</span>}
              </div>
              <div className="flex items-center gap-1 text-slate-600">
                <Calendar className="h-3 w-3" />
                <span className="font-medium">Criado em:</span> {formatDate(selectedTicket.createdAt)}
              </div>
              <div className="flex items-center gap-1 text-slate-600">
                <Tag className="h-3 w-3" />
                <span className="font-medium">Categoria:</span> {selectedTicket.category || 'Geral'} 
                {selectedTicket.subcategory && <span> / {selectedTicket.subcategory}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge className={`${getStatusColor(selectedTicket.status)} border text-xs`}>
                {getStatusLabel(selectedTicket.status)}
              </Badge>
              {selectedTicket.priority && (
                <Badge className={`${getPriorityColor(selectedTicket.priority)} border text-xs`}>
                  {getPriorityLabel(selectedTicket.priority)}
                </Badge>
              )}
            </div>
            {selectedTicket.description && (
              <div className="mt-2 p-2 bg-slate-50 rounded text-slate-700 whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-3" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <MessageCircle className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs text-slate-400">
              {isTicketFinalized(selectedTicket) 
                ? 'Este ticket está finalizado e não pode receber novas mensagens.'
                : 'Seja o primeiro a enviar uma mensagem!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
              {chatMessages.map((message) => {
                const isOwnMessage = user?.id === message.userId;
                const isTemp = message.isTemp;
                
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-[#D5B170] text-white">
                        {message.userName?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-700">
                          {message.userName || 'Usuário'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(message.createdAt)}
                        </span>
                        {isTemp && (
                          <span className="text-xs text-slate-400">
                            <Clock className="h-3 w-3 inline" /> enviando...
                          </span>
                        )}
                      </div>
                      
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm ${
                          isOwnMessage
                            ? isTemp 
                              ? 'bg-[#D5B170]/70 text-white' 
                              : 'bg-[#D5B170] text-white'
                            : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">
                          {message.message}
                        </p>
                        
                        {/* Renderizar anexos se houver */}
                        {message.attachments && message.attachments.length > 0 && renderAttachments(message.attachments)}
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-3 border-t border-slate-200 bg-white">
        {isTicketFinalized(selectedTicket) ? (
          <div className="flex items-center justify-center py-2 bg-slate-50 rounded-md border border-slate-200">
            <Lock className="h-4 w-4 text-slate-400 mr-2" />
            <p className="text-sm text-slate-500">Este ticket está finalizado e não pode receber novas mensagens</p>
          </div>
        ) : (
          <>
            {/* Lista de arquivos sendo carregados */}
            {uploadingFiles.length > 0 && (
              <div className="mb-2 p-2 bg-slate-50 rounded-md border border-slate-200">
                <div className="text-xs font-medium mb-1 text-slate-500">Anexos:</div>
                <div className="flex flex-wrap gap-2">
                  {uploadingFiles.map(file => (
                    <div 
                      key={file.id}
                      className="flex items-center gap-1 p-1 bg-white rounded border border-slate-200 text-xs"
                    >
                      {file.progress < 100 ? (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
                          <span className="text-slate-600">{file.name.substring(0, 10)}... ({file.progress}%)</span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-600">{file.name.substring(0, 10)}...</span>
                          <button 
                            onClick={() => removeUploadingFile(file.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onInput={handleTyping}
                  placeholder={Object.keys(typingUsers).length > 0 
                    ? `${Object.values(typingUsers).join(', ')} está digitando...` 
                    : "Digite sua mensagem..."}
                  disabled={sending}
                  className="flex-1 pr-10"
                />
                <label 
                  htmlFor="file-upload" 
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <Paperclip className="h-5 w-5" />
                </label>
                <input 
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files!)}
                  className="hidden"
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={(!newMessage.trim() && uploadingFiles.length === 0) || sending}
                className="bg-[#D5B170] hover:bg-[#c4a05f] text-white px-4"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketChatPanel;