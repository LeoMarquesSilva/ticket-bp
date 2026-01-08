import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, X, RefreshCw } from 'lucide-react';
import { TicketService, type ChatMessage, type Ticket } from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';
import { useChatContext } from '@/contexts/ChatContext';
import { toast } from 'sonner';
import FinishTicketButton from './FinishTicketButton';

interface ChatModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  onTicketFinished?: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ ticket, isOpen, onClose, onTicketFinished = () => {} }) => {
  const { user } = useAuth();
  const { setActiveChatId } = useChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [subscriptionEstablished, setSubscriptionEstablished] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tempMessagesRef = useRef<Set<string>>(new Set());
  const isSubmittingRef = useRef(false);
  const lastMessageTimestampRef = useRef<number>(0);
  const messageQueueRef = useRef<{content: string, tempId: string}[]>([]);
  const processingQueueRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Verificar se o ticket está ativo (não resolvido ou fechado)
  const isTicketActive = ticket.status !== 'resolved';
  console.log('Ticket status:', ticket.status, 'isTicketActive:', isTicketActive);
  console.log('User role:', user?.role);

  // Informar o contexto sobre qual chat está ativo
  useEffect(() => {
    if (isOpen && ticket?.id) {
      console.log(`🎯 Chat ${ticket.id} está agora ativo`);
      setActiveChatId(ticket.id);
    } else {
      console.log('🎯 Nenhum chat ativo');
      setActiveChatId(null);
    }

    // Cleanup quando o modal fechar
    return () => {
      if (!isOpen) {
        setActiveChatId(null);
      }
    };
  }, [isOpen, ticket?.id, setActiveChatId]);

  // Função de utilidade para operações seguras de estado
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  // Função para focar no input
  const focusInput = useCallback(() => {
    if (inputRef.current && isTicketActive) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isTicketActive]);

  // Função para rolar para o final da conversa
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, []);

  // Rolar para o final quando novas mensagens chegam
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focar no input quando o modal abrir
  useEffect(() => {
    if (isOpen && isTicketActive) {
      focusInput();
    }
  }, [isOpen, isTicketActive, focusInput]);

  // Carregar mensagens do cache local
  const loadMessagesFromCache = useCallback(() => {
    try {
      if (!ticket?.id) return false;
      
      const cachedData = localStorage.getItem(`chat_${ticket.id}`);
      if (cachedData) {
        const { messages: cachedMessages, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log('Carregando mensagens do cache:', cachedMessages.length);
          safeSetState(setMessages, cachedMessages);
          return true;
        }
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens do cache:', e);
    }
    return false;
  }, [ticket?.id, safeSetState]);

  // Salvar mensagens no cache local
  const saveMessagesToCache = useCallback((messages: ChatMessage[]) => {
    try {
      if (!ticket?.id) return;
      
      localStorage.setItem(`chat_${ticket.id}`, JSON.stringify({
        messages,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Erro ao salvar mensagens no cache:', e);
    }
  }, [ticket?.id]);

  // Configurar e limpar recursos quando o componente montar/desmontar
  useEffect(() => {
    console.log('ChatModal montado');
    mountedRef.current = true;
    tempMessagesRef.current = new Set();
    messageQueueRef.current = [];
    processingQueueRef.current = false;
    lastMessageTimestampRef.current = Date.now();
    reconnectAttemptsRef.current = 0;
    
    return () => {
      console.log('ChatModal desmontado');
      mountedRef.current = false;
      
      // Limpar todos os timeouts e intervalos
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      
      // Cancelar inscrição do Supabase
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Carregar mensagens do servidor
  const loadMessages = useCallback(async (showLoading = true) => {
    if (!ticket?.id || !mountedRef.current) return;
    
    try {
      if (showLoading) {
        safeSetState(setLoading, true);
      }
      
      console.log('Carregando mensagens para o ticket:', ticket.id);
      const chatMessages = await TicketService.getChatMessages(ticket.id);
      
      if (!mountedRef.current) return;
      
      console.log('Mensagens carregadas:', chatMessages.length);
      
      safeSetState(setMessages, prev => {
        const tempIds = Array.from(tempMessagesRef.current);
        const filteredMessages = prev.filter(msg => !tempIds.includes(msg.id));
        const updatedMessages = [...filteredMessages, ...chatMessages.filter(msg => 
          !prev.some(existingMsg => existingMsg.id === msg.id && !existingMsg.id.startsWith('temp-'))
        )];
        
        updatedMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        saveMessagesToCache(updatedMessages);
        return updatedMessages;
      });
      
      tempMessagesRef.current.clear();
      
    } catch (error) {
      console.error('Error loading messages:', error);
      if (showLoading) {
        toast.error('Erro ao carregar mensagens');
      }
    } finally {
      if (mountedRef.current && showLoading) {
        safeSetState(setLoading, false);
      }
    }
  }, [ticket?.id, saveMessagesToCache, safeSetState]);

  // Processador de fila de mensagens
  const processMessageQueue = useCallback(async () => {
    if (processingQueueRef.current || messageQueueRef.current.length === 0) {
      return;
    }

    processingQueueRef.current = true;
    
    try {
      const nextMessage = messageQueueRef.current.shift();
      
      if (nextMessage && user && ticket?.id) {
        const { content, tempId } = nextMessage;
        
        const timeSinceLastMessage = Date.now() - lastMessageTimestampRef.current;
        if (timeSinceLastMessage < 500) {
          await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastMessage));
        }
        
        await TicketService.sendChatMessage(
          ticket.id,
          user.id,
          user.name,
          content
        );
        
        lastMessageTimestampRef.current = Date.now();
        
        setTimeout(() => {
          if (mountedRef.current && tempMessagesRef.current.has(tempId)) {
            console.log('Não recebeu confirmação da mensagem, atualizando...');
            loadMessages(false);
            tempMessagesRef.current.delete(tempId);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao processar fila de mensagens:', error);
      
      if (messageQueueRef.current.length > 0) {
        const failedMessage = messageQueueRef.current[0];
        if (failedMessage && failedMessage.tempId) {
          tempMessagesRef.current.delete(failedMessage.tempId);
        }
      }
      
      toast.error('Erro ao enviar mensagem. Tente novamente.');
      safeSetState(setSending, false);
      isSubmittingRef.current = false;
      
    } finally {
      processingQueueRef.current = false;
      
      if (messageQueueRef.current.length > 0) {
        setTimeout(() => {
          processMessageQueue();
        }, 300);
      }
    }
  }, [user, ticket?.id, loadMessages, safeSetState]);

  // Configurar polling como fallback
  const setupPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current && isOpen && ticket?.id) {
        console.log('Executando polling de mensagens...');
        loadMessages(false);
      }
    }, 10000);
  }, [isOpen, ticket?.id, loadMessages]);

  // Configurar inscrição em tempo real
  const setupSubscription = useCallback(() => {
    if (!ticket?.id || !isOpen) return;
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    console.log('Configurando inscrição para o ticket:', ticket.id);
    safeSetState(setSubscriptionEstablished, false);
    
    try {
      const channelId = `ticket-chat-${ticket.id}-user-${user?.id || 'anonymous'}-${Date.now()}`;
      console.log('ID do canal:', channelId);
      
      const unsubscribe = TicketService.subscribeToTicketMessages(
        ticket.id,
        (payload) => {
          console.log('Nova mensagem recebida via Realtime:', payload);
          
          if (!mountedRef.current || !isOpen) return;
          
          if (payload.eventType === 'INSERT') {
            const newMsg: ChatMessage = {
              id: payload.new.id,
              ticketId: payload.new.ticket_id,
              userId: payload.new.user_id,
              userName: payload.new.user_name,
              message: payload.new.message,
              createdAt: payload.new.created_at,
            };
            
            safeSetState(setMessages, prev => {
              if (prev.some(msg => msg.id === newMsg.id)) {
                return prev;
              }
              
              const tempMessages = prev.filter(msg => 
                msg.id.startsWith('temp-') && 
                msg.userId === newMsg.userId && 
                msg.message === newMsg.message
              );
              
              let updatedMessages;
              
              if (tempMessages.length > 0) {
                const tempId = tempMessages[0].id;
                tempMessagesRef.current.delete(tempId);
                
                updatedMessages = prev.map(msg => 
                  msg.id === tempId ? newMsg : msg
                );
              } else {
                updatedMessages = [...prev, newMsg];
              }
              
              updatedMessages.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              
              setTimeout(() => {
                if (mountedRef.current) {
                  saveMessagesToCache(updatedMessages);
                }
              }, 0);
              
              return updatedMessages;
            });
            
            // Não mostrar notificação toast se o chat estiver aberto (já que o usuário pode ver a mensagem)
            // A notificação sonora será controlada pelo hook useNotificationSound
            if (user && payload.new.user_id !== user.id) {
              console.log(`📱 Nova mensagem no chat ativo de ${payload.new.user_name} - notificação toast suprimida`);
            }
          }
          
          safeSetState(setSubscriptionEstablished, true);
          reconnectAttemptsRef.current = 0;
        },
        (status) => {
          console.log('Status da inscrição:', status);
          
          if (status === 'SUBSCRIBED') {
            safeSetState(setSubscriptionEstablished, true);
            safeSetState(setReconnecting, false);
            reconnectAttemptsRef.current = 0;
          } else {
            safeSetState(setSubscriptionEstablished, false);
            
            if (!reconnecting && mountedRef.current) {
              safeSetState(setReconnecting, true);
              
              if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                
                console.log(`Tentativa de reconexão ${reconnectAttemptsRef.current} em ${delay}ms`);
                
                reconnectTimeoutRef.current = setTimeout(() => {
                  if (mountedRef.current && isOpen) {
                    console.log('Tentando reconectar...');
                    setupSubscription();
                    safeSetState(setReconnecting, false);
                  }
                }, delay);
              } else {
                console.log('Máximo de tentativas de reconexão atingido');
                toast.error('Não foi possível reconectar. Tente atualizar manualmente.');
                safeSetState(setReconnecting, false);
              }
            }
          }
        }
      );
      
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Erro ao configurar inscrição:', error);
      safeSetState(setSubscriptionEstablished, false);
    }
  }, [isOpen, ticket?.id, user, saveMessagesToCache, safeSetState]);

  // Configurar inscrição em tempo real e carregar mensagens quando o modal abrir
  useEffect(() => {
    if (isOpen && ticket?.id) {
      console.log('Modal aberto para o ticket:', ticket.id);
      
      loadMessagesFromCache();
      loadMessages();
      setupPolling();
      setupSubscription();
      
      const connectionStatusInterval = setInterval(() => {
        if (mountedRef.current && isOpen && !subscriptionEstablished && !reconnecting) {
          console.log('Verificando status da conexão...');
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            safeSetState(setReconnecting, true);
            setupSubscription();
          }
        }
      }, 30000);
      
      return () => {
        clearInterval(connectionStatusInterval);
        
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    } else {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen, ticket?.id, loadMessages, loadMessagesFromCache, setupPolling, setupSubscription, subscriptionEstablished, reconnecting, safeSetState]);

  // Forçar atualização manual
  const handleForceRefresh = useCallback(() => {
    tempMessagesRef.current.clear();
    safeSetState(setSending, false);
    isSubmittingRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    loadMessages();
    
    safeSetState(setSubscriptionEstablished, false);
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      } catch (e) {
        console.error('Erro ao cancelar inscrição:', e);
      }
    }
    
    setTimeout(() => {
      setupSubscription();
    }, 300);
    
    toast.success('Atualizando mensagens...');
  }, [loadMessages, setupSubscription, safeSetState]);

  // Enviar uma nova mensagem
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user || sending || !ticket?.id || isSubmittingRef.current) return;

    const messageContent = newMessage.trim();
    safeSetState(setNewMessage, '');
    focusInput();
    
    isSubmittingRef.current = true;
    safeSetState(setSending, true);
    
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    
    const messageTimeout = setTimeout(() => {
      if (mountedRef.current) {
        safeSetState(setSending, false);
        isSubmittingRef.current = false;
        
        const now = Date.now();
        tempMessagesRef.current.forEach(tempId => {
          const idTimestamp = parseInt(tempId.split('-')[1] || '0');
          if (now - idTimestamp > 5000) {
            tempMessagesRef.current.delete(tempId);
            
            safeSetState(setMessages, prev => 
              prev.filter(msg => msg.id !== tempId)
            );
          }
        });
        
        toast.error('O envio da mensagem está demorando muito. Tente novamente.');
      }
    }, 5000);
    
    safetyTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        safeSetState(setSending, false);
        isSubmittingRef.current = false;
      }
    }, 10000);
    
    try {
      const tempId = `temp-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempId,
        ticketId: ticket.id,
        userId: user.id,
        userName: user.name,
        message: messageContent,
        createdAt: new Date().toISOString()
      };
      
      tempMessagesRef.current.add(tempId);
      
      safeSetState(setMessages, prev => {
        const updatedMessages = [...prev, tempMessage];
        updatedMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return updatedMessages;
      });
      
      messageQueueRef.current.push({
        content: messageContent,
        tempId: tempId
      });
      
      if (!processingQueueRef.current) {
        processMessageQueue();
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      safeSetState(setNewMessage, messageContent);
      safeSetState(setMessages, prev => prev.filter(msg => !msg.id.startsWith('temp-') || msg.message !== messageContent));
    } finally {
      clearTimeout(messageTimeout);
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (mountedRef.current) {
        safeSetState(setSending, false);
        isSubmittingRef.current = false;
      }
      
      focusInput();
    }
  }, [newMessage, user, sending, ticket?.id, processMessageQueue, safeSetState, focusInput]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [date: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const date = formatDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (!ticket) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-[#D5B170]" />
              <div>
                <DialogTitle className="text-lg font-semibold text-[#101F2E]">
                  Chat - Ticket #{ticket.id.slice(-8)}
                </DialogTitle>
                <p className="text-sm text-slate-600 mt-1">
                  {ticket.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Indicador de status da conexão */}
              {subscriptionEstablished ? (
                <span className="text-xs text-green-600 flex items-center">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-1"></div>
                  Conectado
                </span>
              ) : (
                <span className="text-xs text-amber-600 flex items-center">
                  <div className="h-2 w-2 bg-amber-500 rounded-full mr-1 animate-pulse"></div>
                  {reconnecting ? 'Reconectando...' : 'Desconectado'}
                </span>
              )}
              
              {/* Botão de finalizar ticket - mostrado apenas se o ticket estiver ativo */}
              {isTicketActive && user && (
                <FinishTicketButton
                  ticketId={ticket.id}
                  ticketTitle={ticket.title}
                  isSupport={user.role === 'support' || user.role === 'admin'}
                  onTicketFinished={onTicketFinished}
                />
              )}
              
              {/* Botão de atualização manual */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForceRefresh}
                className="h-8 w-8 text-slate-500 hover:text-[#D5B170]"
                title="Atualizar mensagens"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              {/* Botão de fechar */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-6">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170]"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Nenhuma mensagem ainda</p>
                <p className="text-sm text-slate-400">
                  Seja o primeiro a enviar uma mensagem!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(messageGroups).map(([date, dayMessages]) => (
                  <div key={date}>
                    <div className="flex items-center justify-center mb-4">
                      <div className="bg-slate-100 px-3 py-1 rounded-full">
                        <span className="text-xs text-slate-600 font-medium">
                          {date}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {dayMessages.map((message) => {
                        const isOwnMessage = user?.id === message.userId;
                        const isTemporary = message.id.startsWith('temp-');
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                          >
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="text-xs bg-[#D5B170] text-white">
                                {message.userName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-slate-700">
                                  {message.userName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatTime(message.createdAt)}
                                </span>
                                {isTemporary && (
                                  <span className="text-xs text-amber-500 flex items-center">
                                    <span className="animate-pulse mr-1">⏳</span>
                                    enviando...
                                  </span>
                                )}
                              </div>
                              
                              <div
                                className={`px-4 py-2 rounded-2xl ${
                                  isOwnMessage
                                    ? `bg-[#D5B170] text-white ${isTemporary ? 'opacity-70' : ''}`
                                    : 'bg-slate-100 text-slate-900'
                                } transition-opacity duration-200`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.message}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-6 border-t bg-white">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={sending || !isTicketActive}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending || !isTicketActive}
                className={`${
                  sending 
                    ? 'bg-gray-400 hover:bg-gray-400' 
                    : 'bg-[#D5B170] hover:bg-[#c4a05f]'
                } text-white px-4 transition-colors duration-200`}
              >
                {sending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span 
                      className="text-xs cursor-pointer underline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        safeSetState(setSending, false);
                        isSubmittingRef.current = false;
                        handleForceRefresh();
                      }}
                                          >
                      Cancelar
                    </span>
                  </div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!isTicketActive && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                Este ticket foi finalizado. Não é possível enviar novas mensagens.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatModal;