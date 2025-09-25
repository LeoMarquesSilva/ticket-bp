import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, MessageCircle, Trash2, X, Lock, Paperclip, Send, Clock, Image, FileText } from 'lucide-react';
import FinishTicketButton from './FinishTicketButton';
import { Ticket } from '@/types';
import { ChatMessage } from '@/services/ticketService'; // Corrigir esta importação

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
  handleTyping
}) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
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

  return (
  <div className="w-full lg:w-2/3 xl:w-3/5 flex flex-col border-l border-slate-200">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
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
              <p className="text-xs text-slate-600">
                Ticket #{selectedTicket.id.slice(-8)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" style={{ maxHeight: 'calc(100vh - 240px)' }}>
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
                    
                    <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
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
      <div className="p-4 border-t border-slate-200 bg-white">
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