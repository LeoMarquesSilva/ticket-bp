import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, X, RefreshCw } from 'lucide-react';
import { TicketService, type ChatMessage, type Ticket } from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Adicionar referência ao input
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
// Verificar se o ticket está ativo (não resolvido ou fechado)
const isTicketActive = ticket.status !== 'resolved';
console.log('Ticket status:', ticket.status, 'isTicketActive:', isTicketActive);
  // Log para debug
  console.log('Ticket status:', ticket.status);
  console.log('isTicketActive:', isTicketActive);
  console.log('User role:', user?.role);

  // Função de utilidade para operações seguras de estado
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  // Função para focar no input
  const focusInput = useCallback(() => {
    if (inputRef.current && isTicketActive) {
      // Usar setTimeout para garantir que o foco aconteça após a renderização
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isTicketActive]);

  // Função para rolar para o final da conversa
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      // Usar requestAnimationFrame para garantir que a rolagem aconteça após a renderização
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
        // Usar cache apenas se for recente (menos de 5 minutos)
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
      
      // Substituir mensagens temporárias por mensagens reais
      safeSetState(setMessages, prev => {
        const tempIds = Array.from(tempMessagesRef.current);
        const filteredMessages = prev.filter(msg => !tempIds.includes(msg.id));
        const updatedMessages = [...filteredMessages, ...chatMessages.filter(msg => 
          !prev.some(existingMsg => existingMsg.id === msg.id && !existingMsg.id.startsWith('temp-'))
        )];
        
        // Ordenar mensagens por data
        updatedMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        saveMessagesToCache(updatedMessages);
        return updatedMessages;
      });
      
      // Limpar mensagens temporárias antigas
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
        
        // Adicionar um pequeno atraso para evitar problemas de rate limit
        const timeSinceLastMessage = Date.now() - lastMessageTimestampRef.current;
        if (timeSinceLastMessage < 500) {
          await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastMessage));
        }
        
        // Enviar mensagem para o servidor
        await TicketService.sendChatMessage(
          ticket.id,
          user.id,
          user.name,
          content
        );
        
        lastMessageTimestampRef.current = Date.now();
        
        // Se não receber confirmação em 2 segundos, forçar atualização
        setTimeout(() => {
          if (mountedRef.current && tempMessagesRef.current.has(tempId)) {
            console.log('Não recebeu confirmação da mensagem, atualizando...');
            loadMessages(false);
            
            // Importante: remover a mensagem temporária da lista para evitar problemas
            tempMessagesRef.current.delete(tempId);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao processar fila de mensagens:', error);
      
      // Importante: se houver erro, remover a mensagem da fila para não ficar presa
      if (messageQueueRef.current.length > 0) {
        const failedMessage = messageQueueRef.current[0];
        if (failedMessage && failedMessage.tempId) {
          tempMessagesRef.current.delete(failedMessage.tempId);
        }
      }
      
      // Mostrar mensagem de erro para o usuário
      toast.error('Erro ao enviar mensagem. Tente novamente.');
      
      // Resetar o estado de envio
      safeSetState(setSending, false);
      isSubmittingRef.current = false;
      
    } finally {
      processingQueueRef.current = false;
      
      // Adicionar um pequeno atraso antes de processar a próxima mensagem
      if (messageQueueRef.current.length > 0) {
        setTimeout(() => {
          processMessageQueue();
        }, 300); // Aumentar o delay para 300ms para dar mais tempo
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
        loadMessages(false); // Carregar silenciosamente (sem indicador de loading)
      }
    }, 10000); // Polling a cada 10 segundos
  }, [isOpen, ticket?.id, loadMessages]);

  // Configurar inscrição em tempo real
  const setupSubscription = useCallback(() => {
    if (!ticket?.id || !isOpen) return;
    
    // Limpar inscrição anterior se existir
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    console.log('Configurando inscrição para o ticket:', ticket.id);
    safeSetState(setSubscriptionEstablished, false);
    
    try {
      // Usar um ID de canal único que inclui o ID do usuário para evitar conflitos
      const channelId = `ticket-chat-${ticket.id}-user-${user?.id || 'anonymous'}-${Date.now()}`;
      console.log('ID do canal:', channelId);
      
      // Inscrever-se para novas mensagens
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
            
            // Verificar se a mensagem já existe para evitar duplicatas
            safeSetState(setMessages, prev => {
              // Verificar se já existe uma mensagem com este ID
              if (prev.some(msg => msg.id === newMsg.id)) {
                return prev;
              }
              
              // Verificar se é uma mensagem temporária nossa que foi confirmada
              const tempMessages = prev.filter(msg => 
                msg.id.startsWith('temp-') && 
                msg.userId === newMsg.userId && 
                msg.message === newMsg.message
              );
              
              let updatedMessages;
              
              if (tempMessages.length > 0) {
                // Substituir a mensagem temporária pela real
                const tempId = tempMessages[0].id;
                tempMessagesRef.current.delete(tempId);
                
                updatedMessages = prev.map(msg => 
                  msg.id === tempId ? newMsg : msg
                );
              } else {
                // Caso contrário, adicionar como nova mensagem
                updatedMessages = [...prev, newMsg];
              }
              
              // Ordenar mensagens por data
              updatedMessages.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              
              // Salvar no cache fora do setState para evitar loops
              setTimeout(() => {
                if (mountedRef.current) {
                  saveMessagesToCache(updatedMessages);
                }
              }, 0);
              
              return updatedMessages;
            });
            
            // Mostrar notificação se a mensagem for de outro usuário
            if (user && payload.new.user_id !== user.id) {
              toast.info(`Nova mensagem de ${payload.new.user_name}`);
            }
          }
          
          // Marcar inscrição como estabelecida quando receber a primeira mensagem
          safeSetState(setSubscriptionEstablished, true);
          // Resetar contador de tentativas de reconexão quando tiver sucesso
          reconnectAttemptsRef.current = 0;
        },
        (status) => {
          // Callback de status para monitorar o estado da conexão
          console.log('Status da inscrição:', status);
          
          if (status === 'SUBSCRIBED') {
            safeSetState(setSubscriptionEstablished, true);
            safeSetState(setReconnecting, false);
            reconnectAttemptsRef.current = 0; // Resetar tentativas quando conectar com sucesso
          } else {
            safeSetState(setSubscriptionEstablished, false);
            
            // Tentar reconectar automaticamente após um delay
            if (!reconnecting && mountedRef.current) {
              safeSetState(setReconnecting, true);
              
              // Implementar backoff exponencial para reconexão
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
      
      // Tentar carregar do cache primeiro para feedback imediato
      loadMessagesFromCache();
      
      // Carregar mensagens do servidor
      loadMessages();
      
      // Configurar polling como fallback
      setupPolling();
      
      // Configurar inscrição em tempo real
      setupSubscription();
      
      // Configurar um detector de status da conexão
      const connectionStatusInterval = setInterval(() => {
        if (mountedRef.current && isOpen && !subscriptionEstablished && !reconnecting) {
          console.log('Verificando status da conexão...');
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            safeSetState(setReconnecting, true);
            setupSubscription();
          }
        }
      }, 30000); // Verificar a cada 30 segundos
      
      return () => {
        clearInterval(connectionStatusInterval);
        
        // Limpar inscrição quando o modal fechar
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // Limpar polling quando o modal fechar
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    } else {
      // Limpar inscrição quando o modal fechar
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Limpar polling quando o modal fechar
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen, ticket?.id, loadMessages, loadMessagesFromCache, setupPolling, setupSubscription, subscriptionEstablished, reconnecting, safeSetState]);

  // Forçar atualização manual
  const handleForceRefresh = useCallback(() => {
    // Limpar mensagens temporárias
    tempMessagesRef.current.clear();
    
    // Resetar estados
    safeSetState(setSending, false);
    isSubmittingRef.current = false;
    
    // Resetar tentativas de reconexão
    reconnectAttemptsRef.current = 0;
    
    // Buscar mensagens
    loadMessages();
    
    // Forçar reconfiguração da inscrição
    safeSetState(setSubscriptionEstablished, false);
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      } catch (e) {
        console.error('Erro ao cancelar inscrição:', e);
      }
    }
    
    // Configurar nova inscrição após um pequeno delay
    setTimeout(() => {
      setupSubscription();
    }, 300);
    
    toast.success('Atualizando mensagens...');
  }, [loadMessages, setupSubscription, safeSetState]);

  // Enviar uma nova mensagem
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user || sending || !ticket?.id || isSubmittingRef.current) return;

    // Criar uma cópia local da mensagem para evitar problemas de estado
    const messageContent = newMessage.trim();
    
    // Limpar o campo de mensagem imediatamente para melhor UX
    safeSetState(setNewMessage, '');
    
    // Focar no input após limpar a mensagem
    focusInput();
    
    // Marcar como enviando para evitar múltiplos envios
    isSubmittingRef.current = true;
    safeSetState(setSending, true);
    
    // Configurar um timeout de segurança para resetar o estado de envio
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    
    // Timeout de segurança para evitar que o estado de envio fique preso
    const messageTimeout = setTimeout(() => {
      if (mountedRef.current) {
        // Se ainda estiver enviando após 5 segundos, resetar o estado
        safeSetState(setSending, false);
        isSubmittingRef.current = false;
        
        // Remover mensagens temporárias antigas
        const now = Date.now();
        tempMessagesRef.current.forEach(tempId => {
          // Verificar se a mensagem temporária tem mais de 5 segundos
          const idTimestamp = parseInt(tempId.split('-')[1] || '0');
          if (now - idTimestamp > 5000) {
            tempMessagesRef.current.delete(tempId);
            
            // Remover a mensagem temporária da UI
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
    }, 10000); // 10 segundos de timeout
    
    try {
      // Criar mensagem temporária para feedback imediato
      const tempId = `temp-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempId,
        ticketId: ticket.id,
        userId: user.id,
        userName: user.name,
        message: messageContent,
        createdAt: new Date().toISOString()
      };
      
      // Registrar mensagem temporária
      tempMessagesRef.current.add(tempId);
      
      // Adicionar mensagem temporária para feedback imediato
      safeSetState(setMessages, prev => {
        const updatedMessages = [...prev, tempMessage];
        // Ordenar mensagens por data
        updatedMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return updatedMessages;
      });
      
      // Adicionar à fila de mensagens para envio
      messageQueueRef.current.push({
        content: messageContent,
        tempId: tempId
      });
      
      // Iniciar processamento da fila se não estiver em andamento
      if (!processingQueueRef.current) {
        processMessageQueue();
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      
      // Restaurar mensagem no campo de entrada se falhar
      safeSetState(setNewMessage, messageContent);
      
      // Remover mensagem temporária
      safeSetState(setMessages, prev => prev.filter(msg => !msg.id.startsWith('temp-') || msg.message !== messageContent));
    } finally {
      // Limpar o timeout de segurança
      clearTimeout(messageTimeout);
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (mountedRef.current) {
        safeSetState(setSending, false);
        isSubmittingRef.current = false;
      }
      
      // Focar no input novamente após o envio
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