import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, RefreshCw, ThumbsUp } from 'lucide-react';
import NPSChatFeedback from '@/components/NPSChatFeedback';
import { TicketService } from '@/services/ticketService';

interface ChatMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface TicketChatProps {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  needsFeedback: boolean;
  onFeedbackSubmit: () => void;
}

// Função de debounce para limitar a frequência de chamadas
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const TicketChat: React.FC<TicketChatProps> = ({ 
  ticketId, 
  ticketTitle, 
  ticketStatus, 
  needsFeedback, 
  onFeedbackSubmit 
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [subscriptionEstablished, setSubscriptionEstablished] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const lastTicketIdRef = useRef<string | null>(null);
  const subscriptionAttemptRef = useRef(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mostrar o formulário de NPS diretamente no chat quando o ticket estiver finalizado
  // e o usuário precisar dar feedback e ainda não enviou o feedback
  const showNPSForm = ticketStatus === 'resolved' && 
                      needsFeedback && 
                      !feedbackSubmitted &&
                      user?.role === 'user';

  // Função melhorada para focar no textarea
  const focusTextarea = useCallback(() => {
    if (!textareaRef.current || showNPSForm || sending) return;
    
    // Limpar timeout anterior se existir
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    
    // Usar múltiplas tentativas de foco com diferentes delays
    const attemptFocus = (attempt: number = 0) => {
      if (attempt > 3) return; // Máximo 4 tentativas
      
      focusTimeoutRef.current = setTimeout(() => {
        if (textareaRef.current && !showNPSForm && !sending && mountedRef.current) {
          try {
            textareaRef.current.focus();
            // Verificar se o foco foi realmente aplicado
            if (document.activeElement !== textareaRef.current && attempt < 3) {
              attemptFocus(attempt + 1);
            }
          } catch (e) {
            console.error('Erro ao focar no textarea:', e);
          }
        }
      }, attempt === 0 ? 50 : 100 * attempt); // Delays progressivos: 50ms, 100ms, 200ms, 300ms
    };
    
    attemptFocus();
  }, [showNPSForm, sending]);

  // Focar no textarea quando o componente montar ou quando o NPS form for escondido
  useEffect(() => {
    if (!showNPSForm && !loading) {
      focusTextarea();
    }
  }, [showNPSForm, loading, focusTextarea]);

  // Função para carregar mensagens do cache local
  const loadMessagesFromCache = () => {
    try {
      const cachedData = localStorage.getItem(`chat_${ticketId}`);
      if (cachedData) {
        const { messages: cachedMessages, timestamp } = JSON.parse(cachedData);
        // Usar cache apenas se for recente (menos de 5 minutos)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log('Carregando mensagens do cache:', cachedMessages.length);
          setMessages(cachedMessages);
          return true;
        }
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens do cache:', e);
    }
    return false;
  };

  // Função para salvar mensagens no cache local
  const saveMessagesToCache = (messages: ChatMessage[]) => {
    try {
      localStorage.setItem(`chat_${ticketId}`, JSON.stringify({
        messages,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Erro ao salvar mensagens no cache:', e);
    }
  };

  // Função para carregar mensagens do servidor
  const fetchMessages = async () => {
    if (!mountedRef.current) return;
    
    try {
      console.log('Carregando mensagens para o ticket:', ticketId);
      setError(null);
      
      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        setError('Erro ao carregar mensagens. Por favor, tente novamente.');
        return;
      }
      
      console.log('Mensagens carregadas:', data?.length || 0);
      
      if (data && mountedRef.current) {
        const formattedMessages = data.map((msg: any) => ({
          id: msg.id,
          ticket_id: msg.ticket_id,
          user_id: msg.user_id,
          user_name: msg.user_name,
          message: msg.message,
          created_at: msg.created_at
        }));
        
        setMessages(formattedMessages);
        saveMessagesToCache(formattedMessages);
      }
    } catch (e) {
      console.error('Erro ao buscar mensagens:', e);
      setError('Erro ao carregar mensagens. Por favor, tente novamente.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        // Focar após carregar as mensagens
        setTimeout(() => focusTextarea(), 200);
      }
    }
  };

  // Função para configurar a inscrição em tempo real com debounce
  const setupSubscription = useCallback(() => {
    if (!mountedRef.current) return null;
    
    // Evitar configurar múltiplas vezes para o mesmo ticket
    if (lastTicketIdRef.current === ticketId && subscriptionRef.current && subscriptionEstablished) {
      console.log('Inscrição já estabelecida para o ticket:', ticketId);
      return null;
    }
    
    // Limitar tentativas de reconexão
    subscriptionAttemptRef.current += 1;
    if (subscriptionAttemptRef.current > 5) {
      console.warn('Muitas tentativas de reconexão, esperando 10 segundos antes de tentar novamente');
      setTimeout(() => {
        subscriptionAttemptRef.current = 0;
      }, 10000);
      return null;
    }
    
    if (subscriptionRef.current) {
      console.log('Cancelando inscrição anterior');
      try {
        subscriptionRef.current.unsubscribe();
      } catch (e) {
        console.error('Erro ao cancelar inscrição:', e);
      }
    }

    try {
      console.log('Configurando nova inscrição para o ticket:', ticketId);
      
      // Adicione um ID único para o canal para evitar conflitos
      const channelId = `ticket-chat-${ticketId}-${Date.now()}`;
      console.log('ID do canal:', channelId);
      
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: TABLES.CHAT_MESSAGES,
          filter: `ticket_id=eq.${ticketId}`
        }, (payload) => {
          console.log('Nova mensagem recebida via Realtime:', payload);
          
          if (!mountedRef.current) return;
          
          const newMsg = payload.new as ChatMessage;
          
          // Verificar se a mensagem já existe para evitar duplicatas
          setMessages(currentMessages => {
            if (currentMessages.some(msg => msg.id === newMsg.id)) {
              return currentMessages;
            }
            const updatedMessages = [...currentMessages, newMsg];
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        })
        .subscribe((status) => {
          console.log('Status da inscrição:', status);
          
          if (!mountedRef.current) return;
          
          if (status === 'SUBSCRIBED') {
            setSubscriptionEstablished(true);
            setReconnecting(false);
            subscriptionAttemptRef.current = 0; // Resetar contador de tentativas
            lastTicketIdRef.current = ticketId;
            // Buscar mensagens novamente após estabelecer a conexão
            fetchMessages();
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.warn('Erro na inscrição:', status);
            setSubscriptionEstablished(false);
          } else if (status === 'CLOSED') {
            setSubscriptionEstablished(false);
          } else {
            console.warn('Status de inscrição inesperado:', status);
          }
        });
      
      subscriptionRef.current = channel;
      
      return () => {
        console.log('Limpando inscrição');
        try {
          channel.unsubscribe();
        } catch (e) {
          console.error('Erro ao limpar inscrição:', e);
        }
      };
    } catch (e) {
      console.error('Erro ao configurar inscrição:', e);
      setError('Erro ao configurar atualizações em tempo real.');
      return null;
    }
  }, [ticketId]);

  // Versão com debounce para evitar múltiplas chamadas
  const debouncedSetupSubscription = useCallback(
    debounce(() => setupSubscription(), 500),
    [setupSubscription]
  );

  // Sistema de reconexão automática
  useEffect(() => {
    if (!subscriptionEstablished && !reconnecting && mountedRef.current) {
      setReconnecting(true);
      console.log('Agendando tentativa de reconexão...');
      
      // Limpar timeout anterior se existir
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Tentar reconectar após 3 segundos
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.log('Tentando reconectar...');
          debouncedSetupSubscription();
          setReconnecting(false);
        }
      }, 3000);
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [subscriptionEstablished, debouncedSetupSubscription]);

  // Sistema de polling como fallback
  useEffect(() => {
    // Configurar polling a cada 15 segundos como fallback
    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        console.log('Executando polling de mensagens...');
        fetchMessages();
      }
    }, 15000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [ticketId]);

  // Efeito para carregar mensagens e configurar inscrição
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    // Tentar carregar do cache primeiro
    const cachedLoaded = loadMessagesFromCache();
    
    // Sempre buscar mensagens atualizadas do servidor
    fetchMessages();
    
    // Configurar inscrição em tempo real com debounce
    const timeoutId = setTimeout(() => {
      setupSubscription();
    }, 500);
    
    return () => {
      clearTimeout(timeoutId);
      // Se necessário, limpe a inscrição aqui também
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch (e) {
          console.error('Erro ao limpar inscrição:', e);
        }
      }
    };
  }, [ticketId, setupSubscription]);

  // Efeito para rolar para o final quando novas mensagens chegam
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Debug para verificar montagem/desmontagem
  useEffect(() => {
    console.log('TicketChat montado para o ticket:', ticketId);
    
    // Verificar se o Supabase está configurado corretamente
    console.log('Verificando configuração do Supabase...');
    (async () => {
      try {
        const response = await supabase.from(TABLES.CHAT_MESSAGES).select('count').eq('ticket_id', ticketId);
        console.log('Teste de conexão com Supabase:', response);
      } catch (error) {
        console.error('Erro ao testar conexão com Supabase:', error);
      }
    })();
    
    mountedRef.current = true;
    lastTicketIdRef.current = ticketId;
    
    return () => {
      console.log('TicketChat desmontado para o ticket:', ticketId);
      mountedRef.current = false;
      
      // Limpar todos os timeouts e intervalos
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, [ticketId]);

  // Função para enviar uma nova mensagem
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user) return;
    
    // Criar uma cópia local da mensagem para evitar problemas de estado
    const messageContent = newMessage.trim();
    
    // Limpar o campo de mensagem imediatamente para melhor UX
    setNewMessage('');
    
    // Configurar um timeout de segurança para resetar o estado de envio
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) {
        setSending(false);
        // Focar após timeout de segurança
        focusTextarea();
      }
    }, 10000); // 10 segundos de timeout
    
    try {
      setSending(true);
      
      const messageData = {
        ticket_id: ticketId,
        user_id: user.id,
        user_name: user.name,
        message: messageContent,
        created_at: new Date().toISOString()
      };
      
      console.log('Enviando mensagem:', messageData);
      
      // Adicionar otimisticamente a mensagem para feedback imediato
      const tempId = `temp-${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempId,
        ticket_id: ticketId,
        user_id: user.id,
        user_name: user.name,
        message: messageContent,
        created_at: new Date().toISOString()
      };
      
      // Adicionar a mensagem temporária à lista
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages, tempMessage];
        return updatedMessages;
      });
      
      // Enviar para o Supabase
      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .insert(messageData)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        setError('Erro ao enviar mensagem. Por favor, tente novamente.');
        
        // Remover a mensagem temporária em caso de erro
        setMessages(currentMessages => 
          currentMessages.filter(msg => msg.id !== tempId)
        );
        
        // Restaurar a mensagem no campo de entrada
        setNewMessage(messageContent);
        return;
      }
      
      console.log('Mensagem enviada com sucesso:', data);
      
      if (!mountedRef.current) return;
      
      // Substituir a mensagem temporária pela real
      setMessages(currentMessages => {
        const updatedMessages = currentMessages.map(msg => 
          msg.id === tempId ? {
            id: data.id,
            ticket_id: data.ticket_id,
            user_id: data.user_id,
            user_name: data.user_name,
            message: data.message,
            created_at: data.created_at
          } as ChatMessage : msg
        );
        
        // Atualizar o cache com os dados atualizados
        saveMessagesToCache(updatedMessages);
        
        return updatedMessages;
      });
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
      setError('Erro ao enviar mensagem. Por favor, tente novamente.');
      
      // Restaurar a mensagem no campo de entrada em caso de erro
      setNewMessage(messageContent);
    } finally {
      // Limpar o timeout de segurança
      clearTimeout(safetyTimeout);
      
      if (mountedRef.current) {
        setSending(false);
      }
      
      // Focar no textarea após o envio (com delay para garantir que o estado foi atualizado)
      setTimeout(() => {
        if (mountedRef.current) {
          focusTextarea();
        }
      }, 100);
    }
  };

  // Função para forçar uma atualização manual
  const handleForceRefresh = () => {
    fetchMessages();
    
    // Forçar reconfiguração da inscrição
    setSubscriptionEstablished(false);
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      } catch (e) {
        console.error('Erro ao cancelar inscrição:', e);
      }
    }
    
    // Resetar contador de tentativas
    subscriptionAttemptRef.current = 0;
    
    // Configurar nova inscrição
    setupSubscription();
  };

  // Função para formatar a data
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Função para lidar com o envio do feedback NPS
  const handleNPSSubmit = async (feedbackData: {
    requestFulfilled: boolean;
    notFulfilledReason?: string;
    serviceScore: number;
    comment: string;
  }) => {
    try {
      await TicketService.submitTicketFeedback(ticketId, feedbackData);
      
      // Adicionar uma mensagem do sistema informando que o feedback foi enviado
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        ticket_id: ticketId,
        user_id: 'system',
        user_name: 'Sistema',
        message: `✅ Avaliação realizada. Obrigado pela sua avaliação!`,
        created_at: new Date().toISOString()
      };
      
      setMessages(currentMessages => [...currentMessages, systemMessage]);
      
      // Marcar o feedback como enviado para esconder o formulário
      setFeedbackSubmitted(true);
      
      // Notificar o componente pai que o feedback foi enviado
      onFeedbackSubmit();
      
      // Focar no textarea após o feedback ser enviado (com delay maior)
      setTimeout(() => {
        if (mountedRef.current) {
          focusTextarea();
        }
      }, 300);
      
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      setError('Erro ao enviar feedback. Por favor, tente novamente.');
    }
  };

  // Função para lidar com cliques na área do chat (focar no textarea)
  const handleChatAreaClick = () => {
    if (!showNPSForm && !sending) {
      focusTextarea();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#F6F6F6] rounded-lg border border-[#F69F19]/20 shadow-md">
      {/* Cabeçalho do chat */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#2C2D2F] to-[#404244] text-white rounded-t-lg flex items-center justify-between">
        <h3 className="font-semibold">Conversas</h3>
        <div className="flex items-center space-x-2">
          {!subscriptionEstablished && (
            <span className="text-xs text-[#F69F19] flex items-center">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Conectando...
            </span>
          )}
          {subscriptionEstablished && (
            <span className="text-xs text-[#F69F19] flex items-center">
              <div className="h-2 w-2 bg-green-400 rounded-full mr-1"></div>
              Conectado
            </span>
          )}
          <button 
            onClick={handleForceRefresh} 
            className="text-white/70 hover:text-white"
            title="Atualizar mensagens"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      {/* Área de mensagens - clicável para focar no textarea */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 cursor-text"
        onClick={handleChatAreaClick}
      >
        {loading && messages.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 text-[#F69F19] animate-spin" />
          </div>
        )}
        
        {!loading && messages.length === 0 && (
          <div className="flex justify-center items-center h-full text-slate-500 text-sm">
            Nenhuma mensagem ainda. Inicie a conversa!
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg px-4 py-2 shadow-sm ${
                msg.user_id === 'system' 
                  ? 'bg-[#F69F19]/20 text-slate-800 mx-auto' 
                  : msg.user_id === user?.id 
                    ? 'bg-[#DE5532] text-white' 
                    : 'bg-gray-200 text-slate-800'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-medium ${
                  msg.user_id === 'system' 
                    ? 'text-[#F69F19]'  
                    : msg.user_id === user?.id 
                      ? 'text-[#F69F19]' 
                      : 'text-[#2C2D2F]'
                }`}>
                  {msg.user_id === user?.id ? 'Você' : msg.user_name}
                </span>
                <span className={`text-xs ml-2 ${
                  msg.user_id === user?.id ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {formatDate(msg.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        ))}
        
        {/* Formulário de NPS no chat quando o ticket estiver finalizado e precisar de feedback */}
        {showNPSForm && (
          <div className="flex justify-center">
            <NPSChatFeedback 
              ticketTitle={ticketTitle}
              onSubmit={handleNPSSubmit}
            />
          </div>
        )}
        
        {/* Mensagem de feedback enviado quando o usuário já enviou o feedback */}
        {ticketStatus === 'resolved' && 
         !needsFeedback && 
         user?.role === 'user' && (
          <div className="flex justify-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ThumbsUp className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700">Avaliação realizada</span>
              </div>
              <p className="text-sm text-green-600">
                Obrigado pela sua avaliação! Sua opinião é muito importante para melhorarmos nossos serviços.
              </p>
            </div>
          </div>
        )}
        
        {/* Elemento para rolar para o final */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Área de erro */}
      {error && (
        <div className="px-4 py-2 bg-red-100 text-red-800 text-sm">
          {error}
          <button 
            className="ml-2 underline text-red-600"
            onClick={() => {
              setError(null);
              fetchMessages();
              handleForceRefresh();
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      
      {/* Formulário para enviar mensagem - desabilitado se estiver mostrando o formulário de NPS */}
      <form onSubmit={sendMessage} className="p-3 border-t border-[#F69F19]/20 bg-white/90 rounded-b-lg">
        <div className="flex space-x-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={showNPSForm ? "Por favor, preencha o formulário de feedback acima..." : "Digite sua mensagem..."}
            className="flex-1 resize-none min-h-[60px] max-h-[120px] bg-white"
            disabled={sending || showNPSForm}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            onFocus={() => {
              // Garantir que o textarea permaneça focado
              console.log('Textarea focado');
            }}
            onBlur={() => {
              // Tentar refocar se não estiver enviando ou mostrando NPS
              if (!sending && !showNPSForm) {
                setTimeout(() => focusTextarea(), 50);
              }
            }}
          />
          <Button 
            type="submit" 
            disabled={sending || !newMessage.trim() || showNPSForm}
            className="bg-[#DE5532] hover:bg-[#F69F19] text-white self-end"
            onClick={(e) => {
              // Prevenir que o clique no botão tire o foco do textarea
              e.preventDefault();
              sendMessage(e);
            }}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TicketChat;