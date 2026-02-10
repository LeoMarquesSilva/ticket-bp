import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AlertCircle, X, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ticket, ChatMessage } from '@/types';
import { TicketService } from '@/services/ticketService';
import { UserService } from '@/services/userService';
import TicketHeader from '@/components/TicketHeader';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import TicketKanbanBoard from '@/components/TicketKanbanBoard';
import TicketUserBoard from '@/components/TicketUserBoard';
import TicketList from '@/components/TicketList';
import TicketChatPanel from '@/components/TicketChatPanel';
import SimpleTicketCard from '@/components/SimpleTicketCard';
import TicketFilters from '@/components/TicketFilters';
import CreateTicketModal from '@/components/CreateTicketModal';
import CreateTicketForUserModal from '@/components/CreateTicketForUserModal';
import PendingFeedbackHandler from '@/components/PendingFeedbackHandler';
import { useChatContext } from '@/contexts/ChatContext';
import { usePermissions } from '@/hooks/usePermissions';

interface SupportUser {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  progress: number;
  url: string | null;
  error: string | null;
}

interface CreateTicketData {
  title: string;
  description: string;
  category: string;
  subcategory: string;
}

interface CreateTicketForUserData {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  userId: string;
  userName: string;
  userDepartment?: string;
}

const Tickets = () => {
  const { user } = useAuth();
  const { has } = usePermissions();
  const { ticketId: ticketIdParam } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Carregar preferência do usuário ou usar 'list' como padrão
  const [view, setViewState] = useState<'list' | 'board' | 'users'>(
    user?.ticketViewPreference || 'list'
  );
  
  // Função para atualizar a visualização e salvar a preferência
  const setView = async (newView: 'list' | 'board' | 'users') => {
    setViewState(newView);
    
    // Salvar preferência no banco de dados
    if (user?.id) {
      try {
        await UserService.updateTicketViewPreference(user.id, newView);
        // Atualizar também no contexto do usuário (opcional, para sincronização imediata)
        if (user) {
          user.ticketViewPreference = newView;
        }
      } catch (error) {
        console.error('Erro ao salvar preferência de visualização:', error);
        // Não mostrar erro ao usuário, apenas logar
      }
    }
  };
  
  // Carregar preferência do usuário quando o componente monta ou quando o usuário muda
  useEffect(() => {
    if (user?.ticketViewPreference) setViewState(user.ticketViewPreference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.ticketViewPreference]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<SupportUser[]>([]);
  const { setActiveChatId } = useChatContext();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCreateForUserModal, setShowCreateForUserModal] = useState(false);


  // Referências para controlar inscrições e evitar vazamentos de memória
  const channelsRef = useRef<{
    system?: ReturnType<typeof supabase.channel>;
    presence?: ReturnType<typeof supabase.channel>;
    messages?: ReturnType<typeof supabase.channel>;
    typing?: ReturnType<typeof supabase.channel>;
    tickets?: ReturnType<typeof supabase.channel>; // NOVO: Canal para tickets
    globalMessages?: ReturnType<typeof supabase.channel>; 

  }>({});
  
  // Referência para verificar se o componente está montado
  const isMountedRef = useRef(true);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const isStaff = user?.role === 'admin' || user?.role === 'support' || user?.role === 'lawyer';
  // NOVO: Função para configurar subscription de tickets em tempo real
  const setupTicketsChannel = () => {
    if (!user?.id) return;
    
    // Remover canal anterior se existir
    if (channelsRef.current.tickets) {
      supabase.removeChannel(channelsRef.current.tickets);
    }
    
    // Criar novo canal para monitorar tickets
    const channel = supabase.channel('tickets-realtime');
    
    // Monitorar NOVOS tickets criados
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'app_c009c0e4f1_tickets'
    }, (payload) => {
      if (!isMountedRef.current) return;
      const newTicketData = payload.new;
      
      // Converter dados do banco para formato frontend
      const newTicket: Ticket = {
        id: newTicketData.id,
        title: newTicketData.title,
        description: newTicketData.description,
        priority: newTicketData.priority,
        category: newTicketData.category,
        subcategory: newTicketData.subcategory,
        status: newTicketData.status,
        createdBy: newTicketData.created_by,
        createdByName: newTicketData.created_by_name,
        createdByDepartment: newTicketData.created_by_department,
        assignedTo: newTicketData.assigned_to,
        assignedToName: newTicketData.assigned_to_name,
        createdAt: newTicketData.created_at,
        updatedAt: newTicketData.updated_at,
      };
      
      // Verificar se deve mostrar este ticket baseado na permissão view_all_tickets
      const canViewAll = has('view_all_tickets');
      const shouldShow = canViewAll
        ? true
        : newTicket.createdBy === user.id;

      if (shouldShow && canViewAll && newTicket.createdBy !== user.id) {
        const priorityEmoji = getPriorityEmoji(newTicket.priority);
        toast.success(
          `${priorityEmoji} Novo ticket criado!`,
          {
            description: `${newTicket.title} - por ${newTicket.createdByName}`,
            duration: 8000,
            action: {
              label: 'Ver',
              onClick: () => openChat(newTicket)
            }
          }
        );
      }
      
      if (shouldShow) {
        // Adicionar o novo ticket ao início da lista
        setTickets(prev => {
          // Verificar se o ticket já existe (evitar duplicatas)
          const exists = prev.some(t => t.id === newTicket.id);
          if (exists) return prev;
          
          return [newTicket, ...prev];
        });
      }
    });
    
    // Monitorar ATUALIZAÇÕES de tickets
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_c009c0e4f1_tickets'
    }, (payload) => {
      if (!isMountedRef.current) return;
      const updatedTicketData = payload.new;
      
      // Converter dados do banco para formato frontend
      const updatedTicket: Ticket = {
        id: updatedTicketData.id,
        title: updatedTicketData.title,
        description: updatedTicketData.description,
        priority: updatedTicketData.priority,
        category: updatedTicketData.category,
        subcategory: updatedTicketData.subcategory,
        status: updatedTicketData.status,
        createdBy: updatedTicketData.created_by,
        createdByName: updatedTicketData.created_by_name,
        createdByDepartment: updatedTicketData.created_by_department,
        assignedTo: updatedTicketData.assigned_to,
        assignedToName: updatedTicketData.assigned_to_name,
        createdAt: updatedTicketData.created_at,
        updatedAt: updatedTicketData.updated_at,
      };
      
      // Atualizar o ticket na lista
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === updatedTicket.id ? updatedTicket : ticket
        )
      );
      
      // Se o ticket selecionado foi atualizado, atualizar também
      if (selectedTicket && selectedTicket.id === updatedTicket.id) {
        setSelectedTicket(updatedTicket);
      }
    });
    
    // Monitorar EXCLUSÕES de tickets
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'app_c009c0e4f1_tickets'
    }, (payload) => {
      if (!isMountedRef.current) return;
      const deletedTicketId = payload.old.id;
      
      // Remover o ticket da lista
      setTickets(prev => prev.filter(ticket => ticket.id !== deletedTicketId));
      
      // Se o ticket excluído era o selecionado, fechar o chat
      if (selectedTicket && selectedTicket.id === deletedTicketId) {
        closeChat();
      }
    });
    
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Erro no canal de tickets');
        
        // Tentar reconectar após um pequeno atraso
        setTimeout(() => {
          if (isMountedRef.current && channelsRef.current.tickets) {
            channelsRef.current.tickets.subscribe();
          }
        }, 5000);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.tickets = channel;
  };

  // Função para obter emoji de prioridade
  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔥';
      case 'medium': return '⚡';
      case 'low': return '📝';
      default: return '📋';
    }
  };

  // Função para configurar um único canal de sistema para monitorar conexão
  const setupSystemChannel = () => {
    // Remover canal anterior se existir
    if (channelsRef.current.system) {
      supabase.removeChannel(channelsRef.current.system);
    }
    
    // Criar novo canal
    const channel = supabase.channel('system');
    
    // Monitorar status da conexão
    channel.on('system', { event: 'connection_status' }, (payload) => {
      if (isMountedRef.current) {
        setConnectionStatus(payload.status);
      }
    });
    
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        
        // Tentar reconectar após um pequeno atraso
        setTimeout(() => {
          if (isMountedRef.current && channelsRef.current.system) {
            channelsRef.current.system.subscribe();
          }
        }, 5000);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.system = channel;
  };

  // Função para configurar um único canal de presença para monitorar usuários online
  const setupPresenceChannel = () => {
    if (!user) return;
    
    // Remover canal anterior se existir
    if (channelsRef.current.presence) {
      supabase.removeChannel(channelsRef.current.presence);
    }
    
    // Criar novo canal
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });
    
    // Monitorar eventos de presença
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMountedRef.current) return;
      
      // Quando o estado de presença é sincronizado, atualizar a lista de usuários online
      const state = channel.presenceState() || {};
      const onlineUserIds = Object.keys(state);
      // Criar uma lista de usuários online diretamente dos dados de presença
      const onlineSupportUsers: SupportUser[] = [];
      
      // Processar cada usuário presente no estado
      Object.entries(state).forEach(([userId, presences]) => {
        // O valor de presences é um array de presenças para o mesmo usuário
        if (Array.isArray(presences) && presences.length > 0) {
          const userPresence = presences[0] as any;
          
          // Verificar se é um usuário de suporte ou advogado
          if (userPresence.role === 'support' || userPresence.role === 'lawyer' || userPresence.role === 'admin') {
            onlineSupportUsers.push({
              id: userId,
              name: userPresence.name || 'Usuário',
              role: userPresence.role,
              isOnline: true
            });
          }
        }
      });
      
      // Atualizar o estado dos usuários de suporte para mostrar quem está online
      setSupportUsers(prev => 
        prev.map(supportUser => ({
          ...supportUser,
          isOnline: onlineUserIds.includes(supportUser.id)
        }))
      );
      
      // Atualizar a lista separada de usuários online
      setOnlineUsers(onlineSupportUsers);
    });
    
    // Inscrever-se no canal
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (user.role === 'support' || user.role === 'lawyer' || user.role === 'admin') {
          channel.track({
            id: user.id,
            name: user.name,
            role: user.role,
            online_at: new Date().toISOString(),
          });
        }
      } else if (status === 'CHANNEL_ERROR') {
        // Tentar reconectar após um pequeno atraso
        setTimeout(() => {
          if (isMountedRef.current && channelsRef.current.presence) {
            channelsRef.current.presence.subscribe();
          }
        }, 5000);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.presence = channel;
  };

  // Função para configurar um único canal de mensagens para o ticket selecionado
  const setupMessagesChannel = (ticketId: string) => {
    if (!ticketId || !user?.id) return;
    // Remover canal anterior se existir
    if (channelsRef.current.messages) {
      supabase.removeChannel(channelsRef.current.messages);
    }
    
    // Criar novo canal
    const channel = supabase.channel(`ticket-${ticketId}`);
    
    // Monitorar novas mensagens
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'app_c009c0e4f1_chat_messages',
      filter: `ticket_id=eq.${ticketId}`
    }, (payload) => {
      if (!isMountedRef.current) return;
      const messageId = payload.new.id;
      const userId = payload.new.user_id;
      const userName = payload.new.user_name;

      setChatMessages(prevMessages => {
        const existingAvatar = prevMessages.find(m => m.userId === userId && m.avatarUrl)?.avatarUrl;
        const newMessage: ChatMessage = {
          id: messageId,
          ticketId: payload.new.ticket_id,
          userId,
          userName,
          avatarUrl: existingAvatar,
          message: payload.new.message,
          attachments: payload.new.attachments || [],
          createdAt: payload.new.created_at,
          read: payload.new.read
        };

        const messageExists = prevMessages.some(
          msg => msg.id === messageId || 
                (msg.isTemp && msg.userId === userId && msg.message === payload.new.message)
        );

        if (messageExists) {
          return prevMessages.map(msg => 
            (msg.isTemp && msg.userId === userId && msg.message === payload.new.message) 
              ? { ...newMessage, isTemp: false } 
              : msg
          );
        }

        const updated = [...prevMessages, newMessage];
        if (!existingAvatar) {
          UserService.getUserById(userId).then(u => {
            if (u?.avatarUrl && isMountedRef.current) {
              setChatMessages(prev => prev.map(m => m.id === messageId ? { ...m, avatarUrl: u.avatarUrl } : m));
            }
          });
        }
        return updated;
      });
      
      // Marcar como lida se for de outro usuário e o chat estiver aberto
      if (userId !== user.id) {
        markMessagesAsRead(ticketId);
      }
      
      // Rolar para o final da conversa
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
    
    // Monitorar atualizações de mensagens (ex: marcadas como lidas)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_c009c0e4f1_chat_messages',
      filter: `ticket_id=eq.${ticketId}`
    }, (payload) => {
      if (!isMountedRef.current) return;
      // Atualizar o estado das mensagens
      setChatMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === payload.new.id 
          ? {
              ...msg,
              read: payload.new.read
            }
          : msg
        )
      );
    });
    
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        
        // Tentar reconectar após um pequeno atraso
        setTimeout(() => {
          if (isMountedRef.current && channelsRef.current.messages) {
            channelsRef.current.messages.subscribe();
          }
        }, 5000);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.messages = channel;
    
    // Configurar canal de digitação junto com o canal de mensagens
    setupTypingChannel(ticketId);
  };

  // Função para configurar um único canal para eventos de digitação
  const setupTypingChannel = (ticketId: string) => {
    if (!ticketId || !user?.id) return;
    
    // Remover canal anterior se existir
    if (channelsRef.current.typing) {
      supabase.removeChannel(channelsRef.current.typing);
    }
    
    // Criar novo canal
    const channel = supabase.channel(`typing-${ticketId}`);
    
    // Monitorar eventos de digitação
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (!isMountedRef.current) return;
      
      // Ignorar eventos do próprio usuário
      if (payload.payload.userId === user.id) return;
      
      // Adicionar usuário à lista de digitando
      setTypingUsers(prev => ({
        ...prev,
        [payload.payload.userId]: payload.payload.userName
      }));
    });
    
    // Monitorar eventos de parar de digitar
    channel.on('broadcast', { event: 'stop-typing' }, (payload) => {
      if (!isMountedRef.current) return;
      
      // Remover usuário da lista de digitando
      setTypingUsers(prev => {
        const newTyping = { ...prev };
        delete newTyping[payload.payload.userId];
        return newTyping;
      });
    });
    
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        // Tentar reconectar após um pequeno atraso
        setTimeout(() => {
          if (isMountedRef.current && channelsRef.current.typing) {
            channelsRef.current.typing.subscribe();
          }
        }, 5000);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.typing = channel;
  };

  // NOVO: Função para configurar canal global de mensagens (apenas para atualizar contadores)
const setupGlobalMessagesChannel = () => {
  if (!user?.id) return;
  
  // Remover canal anterior se existir
  if (channelsRef.current.globalMessages) {
    supabase.removeChannel(channelsRef.current.globalMessages);
  }
  // Criar novo canal para monitorar todas as mensagens
  const channel = supabase.channel('global-messages-counters');
  
  // Monitorar TODAS as novas mensagens
  channel.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'app_c009c0e4f1_chat_messages'
  }, (payload) => {
    if (!isMountedRef.current) return;
    const newMessageData = payload.new;
    
    // Converter dados do banco para formato frontend
    const newMessage = {
      id: newMessageData.id,
      ticketId: newMessageData.ticket_id,
      userId: newMessageData.user_id,
      userName: newMessageData.user_name,
      message: newMessageData.message,
      createdAt: newMessageData.created_at,
      read: newMessageData.read
    };
    
    // Só processar se não for mensagem do próprio usuário
    if (newMessage.userId === user.id) {
      return;
    }
    
    // Verificar se a mensagem é de um ticket que o usuário pode ver
    const ticket = tickets.find(t => t.id === newMessage.ticketId);
    if (!ticket) {
      return; // Ticket não encontrado ou usuário não tem acesso
    }
    
    // Verificar se o ticket NÃO está aberto no chat atual
    const isCurrentTicket = selectedTicket?.id === newMessage.ticketId && showChat;
    
    if (!isCurrentTicket) {
      // Atualizar contador de mensagens não lidas EM TEMPO REAL
      setUnreadMessages(prev => ({
        ...prev,
        [newMessage.ticketId]: (prev[newMessage.ticketId] || 0) + 1
      }));
    }
  });
  
  // Monitorar quando mensagens são marcadas como lidas
  channel.on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'app_c009c0e4f1_chat_messages'
  }, (payload) => {
    if (!isMountedRef.current) return;
    
    const updatedMessage = payload.new;
    
    if (updatedMessage.read === true) {
      loadUnreadMessageCountsForTicket(updatedMessage.ticket_id);
    }
  });
  
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      // Tentar reconectar após um pequeno atraso
      setTimeout(() => {
        if (isMountedRef.current && channelsRef.current.globalMessages) {
          channelsRef.current.globalMessages.subscribe();
        }
      }, 5000);
    }
  });
  
  // Armazenar referência ao canal
  channelsRef.current.globalMessages = channel;
};

// NOVO: Função para recarregar contador de um ticket específico
const loadUnreadMessageCountsForTicket = async (ticketId: string) => {
  if (!user?.id) return;
  
  try {
    // Buscar contagem de mensagens não lidas para este ticket específico
    const { data, error } = await supabase
      .from('app_c009c0e4f1_chat_messages')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('read', false)
      .neq('user_id', user.id); // Não contar mensagens próprias
    
    if (error) throw error;
    
    const count = data?.length || 0;
    
    // Atualizar contador local
    if (isMountedRef.current) {
      setUnreadMessages(prev => ({
        ...prev,
        [ticketId]: count
      }));
    }
  } catch (error) {
    console.error('Erro ao carregar contador de mensagens para ticket:', ticketId, error);
  }
};

  // Função para notificar que o usuário está digitando
  const handleTyping = () => {
    if (!selectedTicket?.id || !user?.id || !channelsRef.current.typing) return;
    
    try {
      // Enviar evento de digitação através do canal existente
      channelsRef.current.typing.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name }
      });
      
      // Limpar timeout anterior se existir
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      
      // Definir novo timeout para parar de mostrar "digitando" após 2 segundos
      typingTimeout.current = setTimeout(() => {
        if (channelsRef.current.typing) {
          channelsRef.current.typing.send({
            type: 'broadcast',
            event: 'stop-typing',
            payload: { userId: user.id }
          });
        }
      }, 2000);
    } catch (error) {
      console.error('Erro ao enviar evento de digitação:', error);
    }
  };

// Garantir que o canal global de mensagens seja configurado na inicialização
useEffect(() => {
  isMountedRef.current = true;
  
  // Carregar dados iniciais
  loadTickets();
  loadSupportUsers();
  
  // Configurar canais
  setupSystemChannel();
  setupTicketsChannel();
  setupGlobalMessagesChannel(); // ✅ Garantir que este canal seja configurado
  
  // Configurar monitoramento de presença para usuários da equipe
  if (user && (user.role === 'admin' || user.role === 'lawyer' || user.role === 'support')) {
    setupPresenceChannel();
  }
  
  // Limpar ao desmontar
  return () => {
    isMountedRef.current = false;
    
    // Limpar timeout de digitação
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Remover todos os canais
    Object.values(channelsRef.current).forEach(channel => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    
    // Limpar referência aos canais
    channelsRef.current = {};
  };
}, [user?.id, has]);

  // Configurar canal de mensagens quando o ticket selecionado mudar
  useEffect(() => {
    if (selectedTicket?.id) {
      loadMessages(selectedTicket.id);
      setupMessagesChannel(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

  // Abrir o chat do ticket quando a URL for /tickets/:ticketId (ex.: clique em "Ver" no toast)
  useEffect(() => {
    if (!ticketIdParam || loading || tickets.length === 0) return;
    if (selectedTicket?.id === ticketIdParam) return;
    const ticket = tickets.find((t) => t.id === ticketIdParam);
    if (ticket) {
      openChat(ticket);
    }
  }, [ticketIdParam, loading, tickets]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let tickets;
      
      if (has('view_all_tickets')) {
        tickets = await TicketService.getAllTickets();
      } else if (user?.id) {
        // Quem não tem view_all_tickets vê só criados por ou atribuídos a si
        tickets = await TicketService.getTicketsForCurrentUser(user.id);
      } else {
        tickets = [];
      }
      
      if (isMountedRef.current) {
        setTickets(tickets);
        
        // Carregar contagem de mensagens não lidas para cada ticket
        if (tickets.length > 0) {
          loadUnreadMessageCounts(tickets);
        }
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      if (isMountedRef.current) {
        setError('Erro ao carregar tickets. Por favor, tente novamente.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadSupportUsers = async () => {
    try {
      const users = await TicketService.getSupportUsers();
      if (isMountedRef.current) {
        setSupportUsers(users as SupportUser[]);
      }
    } catch (error) {
      console.error('Error loading support users:', error);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      setLoadingMessages(true);
      const messages = await TicketService.getTicketMessages(ticketId);
      if (isMountedRef.current) {
        setChatMessages(messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      if (isMountedRef.current) {
        setLoadingMessages(false);
      }
    }
  };

  const loadUnreadMessageCounts = async (ticketsList: Ticket[]) => {
    try {
      const counts = await TicketService.getUnreadMessageCounts(user?.id || '');
      if (isMountedRef.current) {
        setUnreadMessages(counts);
      }
    } catch (error) {
      console.error('Error loading unread message counts:', error);
    }
  };

  const markMessagesAsRead = async (ticketId: string) => {
    if (!user?.id) return;
    
    try {
      await TicketService.markMessagesAsRead(ticketId, user.id);
      
      // Atualizar o contador local
      if (isMountedRef.current) {
        setUnreadMessages(prev => ({
          ...prev,
          [ticketId]: 0
        }));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!selectedTicket?.id || !user?.id || (!newMessage.trim() && uploadingFiles.length === 0)) return;
    
    const tempMessageId = `temp-${Date.now()}`;
    const attachments = uploadingFiles
      .filter(file => file.progress === 100 && file.url)
      .map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url
      }));
    
    // Adicionar mensagem temporária ao estado
    const tempMessage = {
      id: tempMessageId,
      ticketId: selectedTicket.id,
      userId: user.id,
      userName: user.name,
      message: newMessage.trim(),
      attachments,
      createdAt: new Date().toISOString(),
      read: false,
      isTemp: true
    };
    
    setChatMessages(prev => [...prev, tempMessage]);
    
    try {
      setSending(true);
      
      // Enviar mensagem para o servidor
      const newMessageData = await TicketService.sendMessage({
        ticketId: selectedTicket.id,
        userId: user.id,
        userName: user.name,
        message: newMessage.trim(),
        attachments
      });
      
      // Atualizar o ticket para "em andamento" se estiver aberto
      if (selectedTicket.status === 'open' && user.role !== 'user') {
        await handleUpdateTicket(selectedTicket.id, { status: 'in_progress' });
      }
      
      // Substituir a mensagem temporária pela real
      if (newMessageData && newMessageData.id) {
        setChatMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempMessageId ? { ...newMessageData, isTemp: false } : msg
          )
        );
      }
      
      setNewMessage('');
      setUploadingFiles([]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      
      // Remover a mensagem temporária em caso de erro
      setChatMessages(prevMessages => 
        prevMessages.filter(msg => !msg.isTemp)
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    
    // Guardar referência ao input
    const inputElement = e.currentTarget;
    
    // Enviar mensagem
    sendMessage();
    
    // Usar múltiplas estratégias para garantir que o foco retorne
    const restoreFocus = () => {
      if (inputElement && document.contains(inputElement)) {
        inputElement.focus();
        inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      }
    };
    
    // Tentar imediatamente
    restoreFocus();
    
    // Tentar após o próximo frame
    requestAnimationFrame(restoreFocus);
    
    // Tentar após um pequeno delay como backup
    setTimeout(restoreFocus, 10);
    setTimeout(restoreFocus, 50);
    setTimeout(restoreFocus, 100);
  }
};

const handleCreateTicket = async (ticketData: CreateTicketData) => {
  if (!user) return;

  try {
    const newTicket = await TicketService.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      subcategory: ticketData.subcategory,
      createdBy: user.id,
      createdByName: user.name,
      createdByDepartment: user.department,
    });
      
    
    if (newTicket && newTicket.id) {
      // REMOVIDO: setTickets(prev => [newTicket, ...prev]);
      // O ticket será adicionado automaticamente via real-time subscription
      setShowCreateForm(false);
      toast.success('Ticket criado com sucesso!');
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    toast.error('Erro ao criar ticket');
  }
};

const handleCreateTicketForUser = async (ticketData: CreateTicketForUserData) => {
  if (!user || !isStaff) {
    toast.error('Você não tem permissão para criar tickets em nome de usuários');
    return;
  }

  try {
    
    // Primeiro, criar o ticket
    const newTicket = await TicketService.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      subcategory: ticketData.subcategory,
      createdBy: ticketData.userId,
      createdByName: ticketData.userName,
      createdByDepartment: ticketData.userDepartment,
    });
    
    // Depois, atribuir ao criador (membro da equipe)
    if (newTicket && newTicket.id) {
      await handleUpdateTicket(newTicket.id, {
        assignedTo: user.id,
        assignedToName: user.name,
        status: 'in_progress'
      });
      
      setShowCreateForUserModal(false);
      toast.success(`Ticket criado e atribuído com sucesso para ${ticketData.userName}!`);
    }
  } catch (error) {
    console.error('Error creating ticket for user:', error);
    toast.error('Erro ao criar ticket para usuário');
  }
};

const handleUpdateTicket = async (ticketId: string, updates: Record<string, unknown>) => {
  try {
    
    const updatedTicket = await TicketService.updateTicket(ticketId, updates);
    
    if (updatedTicket && updatedTicket.id) {
      // REMOVIDO: setTickets manual update
      // O ticket será atualizado automaticamente via real-time subscription
      
      // Update selected ticket if it's the one being updated
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
      
      toast.success('Ticket atualizado com sucesso!');
    }
  } catch (error) {
    console.error('Error updating ticket:', error);
    toast.error('Erro ao atualizar ticket');
  }
};

const handleAssignTicket = async (ticketId: string, supportUserId: string) => {
  try {
    // Encontrar o nome do usuário de suporte pelo ID
    const supportUser = supportUsers.find(user => user.id === supportUserId);
    const supportUserName = supportUser ? supportUser.name : "Usuário de suporte";
    
    // Atualizar o ticket com o ID e o nome do usuário atribuído
    await handleUpdateTicket(ticketId, { 
      assignedTo: supportUserId,
      assignedToName: supportUserName,
      status: 'in_progress'
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    toast.error('Erro ao atribuir ticket');
  }
};

const handleDeleteTicket = async (ticketId: string) => {
  try {
    const success = await TicketService.deleteTicket(ticketId);
    if (success) {
      // REMOVIDO: setTickets manual update
      // O ticket será removido automaticamente via real-time subscription
      
      // Se o ticket excluído for o que está sendo visualizado, feche o chat
      if (selectedTicket && selectedTicket.id === ticketId) {
        closeChat();
      }
      
      toast.success('Ticket excluído com sucesso!');
    }
  } catch (error) {
    console.error('Error deleting ticket:', error);
    toast.error('Erro ao excluir ticket');
  }
};

// Função para upload de arquivos - VERSÃO DEFINITIVA com 300MB
const handleFileUpload = async (files: FileList) => {
  if (!files || files.length === 0 || !selectedTicket?.id) return;
  
  // Verificar se o ticket está finalizado
  if (isTicketFinalized(selectedTicket)) {
    toast.error('Este ticket está finalizado e não pode receber novos anexos');
    return;
  }
  
  // Limite aumentado para 300MB
  const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB em bytes
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`O arquivo ${file.name} excede o limite de 300MB (atual: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    
    // Adicionar arquivo à lista de uploads com progresso 0
    const fileId = `${Date.now()}-${i}`;
    const newFile: UploadingFile = {
      id: fileId,
      file: file,
      name: file.name,
      type: file.type,
      size: file.size,
      progress: 0,
      url: null,
      error: null
    };
    
    setUploadingFiles(prev => [...prev, newFile]);
    
    try {
      
      // Atualizar progresso para simular início do upload
      setUploadingFiles(prev => 
        prev.map(f => f.id === fileId ? { ...f, progress: 10 } : f)
      );
      
      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `tickets/${selectedTicket.id}/${fileName}`;
      
      
      // Simular progresso antes do upload
      setUploadingFiles(prev => 
        prev.map(f => f.id === fileId ? { ...f, progress: 30 } : f)
      );
      
      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('❌ Erro detalhado do Supabase:', error);
        throw error;
      }
      
      // Simular progresso após upload
      setUploadingFiles(prev => 
        prev.map(f => f.id === fileId ? { ...f, progress: 70 } : f)
      );
      
      // Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);
      
      // Atualizar arquivo na lista com URL e progresso completo
      setUploadingFiles(prev => 
        prev.map(f => f.id === fileId ? { 
          ...f, 
          url: publicUrl, 
          progress: 100 
        } : f)
      );
    } catch (error) {
      console.error('❌ Erro ao fazer upload:', error);
      
      // Atualizar arquivo na lista com erro
      setUploadingFiles(prev => 
        prev.map(f => f.id === fileId ? { 
          ...f, 
          error: `Erro: ${error.message || 'Desconhecido'}`, 
          progress: 0 
        } : f)
      );
      
      toast.error(`Erro ao fazer upload de ${file.name}: ${error.message || 'Erro desconhecido'}`);
    }
  }
};

// Função para remover arquivo da lista de uploads
const removeUploadingFile = (fileId: string) => {
  setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
};

// Função para verificar se um ticket está finalizado
const isTicketFinalized = (ticket: Ticket) => {
  return ticket.status === 'resolved';
};

  // Função para alternar entre vistas (list, board, users)
  const handleViewChange = (newView: 'list' | 'board' | 'users') => {
    // Se estiver mudando para Kanban ou UserBoard e o chat estiver aberto, feche-o
    if (newView !== 'list' && showChat) {
      closeChat();
    }
    
    // Atualizar visualização (salva preferência automaticamente)
    setView(newView);
  };

// Função para abrir o chat de um ticket
const openChat = (ticket: Ticket) => {
  // Se estiver no modo Kanban ou UserBoard, mude para o modo lista antes de abrir o chat
  if (view !== 'list') {
    setView('list');
  }
  
  setSelectedTicket(ticket);
  setShowChat(true);
  setActiveChatId(ticket.id); // 🎯 NOVA LINHA
  
  // Marcar mensagens como lidas quando abrir o chat
  if (user?.id && unreadMessages[ticket.id] > 0) {
    markMessagesAsRead(ticket.id);
  }
};

const closeChat = () => {
  setShowChat(false);
  setSelectedTicket(null);
  setChatMessages([]);
  setNewMessage('');
  setUploadingFiles([]);
  setTypingUsers({});
  setActiveChatId(null); // 🎯 NOVA LINHA
  if (ticketIdParam) navigate('/tickets', { replace: true });

  // Remover canais específicos do ticket
  if (channelsRef.current.messages) {
    supabase.removeChannel(channelsRef.current.messages);
    channelsRef.current.messages = undefined;
  }

  if (channelsRef.current.typing) {
    supabase.removeChannel(channelsRef.current.typing);
    channelsRef.current.typing = undefined;
  }
};

// Função para lidar com feedback enviado
const handleFeedbackSubmitted = () => {
  // Recarregar tickets para atualizar o status de feedback
  loadTickets();
};

// Funções para filtrar tickets
const getFilteredTickets = () => {
  return tickets.filter(ticket => {
    // Filtro de pesquisa
    const matchesSearch = searchTerm === '' || 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de status
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    // Filtro de categorias
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
    
    // Filtro de atribuição
    const matchesAssigned = assignedFilter === 'all' || 
      (assignedFilter === 'assigned' && ticket.assignedTo) ||
      (assignedFilter === 'unassigned' && !ticket.assignedTo);
    
    // Filtro de usuário (para atribuição)
    const matchesUser = userFilter === 'all' || 
      (userFilter === 'mine' && ticket.assignedTo === user?.id) ||
      (userFilter !== 'mine' && userFilter !== 'all' && ticket.assignedTo === userFilter);
    
    return matchesSearch && matchesStatus && matchesCategory && matchesAssigned && matchesUser;
  });
};

// Organizar tickets por status para o quadro Kanban
const getTicketsByStatus = () => {
  const filteredTickets = getFilteredTickets();
  
  return {
    open: filteredTickets.filter(ticket => ticket.status === 'open'),
    in_progress: filteredTickets.filter(ticket => ticket.status === 'in_progress'),
    resolved: filteredTickets.filter(ticket => ticket.status === 'resolved')
  };
};

// Organizar tickets por usuário para o quadro de usuários
const getTicketsByUser = () => {
  const filteredTickets = getFilteredTickets();

  const result: Record<string, Ticket[]> = {
    unassigned: filteredTickets.filter(ticket => !ticket.assignedTo)
  };
  
  // Adicionar tickets para cada usuário de suporte
  supportUsers.forEach(user => {
    result[user.id] = filteredTickets.filter(ticket => ticket.assignedTo === user.id);
  });
  
  return result;
};

// Funções para cores de status e prioridade
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-[#BD2D29]/10 text-[#BD2D29] border-[#BD2D29]/20';
    case 'high':
      return 'bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20';
    case 'medium':
      return 'bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20';
    case 'low':
      return 'bg-[#2C2D2F]/10 text-[#2C2D2F] border-[#2C2D2F]/20';
    default:
      return 'bg-gray-100 text-[#2C2D2F] border-gray-200';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':
      return 'bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20';
    case 'in_progress':
      return 'bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20';
    case 'resolved':
      return 'bg-[#2C2D2F]/10 text-[#2C2D2F] border-[#2C2D2F]/20';
    default:
      return 'bg-gray-100 text-[#2C2D2F] border-gray-200';
  }
};

// Renderizar cartão de ticket
// Atualizar a função renderTicketCard para incluir o contador
const renderTicketCard = (ticket: Ticket) => {
  return (
    <SimpleTicketCard
      key={ticket.id}
      ticket={ticket}
      selectedTicketId={selectedTicket?.id}
      unreadCount={unreadMessages[ticket.id] || 0}
      onClick={() => openChat(ticket)}
      getPriorityColor={getPriorityColor}
      getStatusColor={getStatusColor}
      isTicketFinalized={isTicketFinalized}
      compact={showChat}
    />
  );
};

// Filtrar usuários online para mostrar apenas support e lawyer
const getOnlineStaff = () => {
  return onlineUsers;
};

return (
  <div className="h-screen flex flex-col overflow-hidden">
    {/* PendingFeedbackHandler - só mostrar para usuários comuns */}
    {user?.role === 'user' && (
      <PendingFeedbackHandler
        tickets={tickets}
        onFeedbackSubmitted={handleFeedbackSubmitted}
        onOpenTicket={openChat}
      />
    )}

{/* Cabeçalho com filtros e botões - altura fixa */}
<div className="flex-shrink-0 bg-[#F6F6F6] border-b border-[#F69F19]/20 shadow-sm w-full">
      <TicketHeader
        view={view}
        setView={handleViewChange}
        setShowCreateForm={setShowCreateForm}
        setShowCreateForUserModal={setShowCreateForUserModal}
        supportUsers={supportUsers}
        user={user}
        onlineUsersCount={getOnlineStaff().length}
        canCreateTicket={has('create_ticket')}
        canCreateTicketForUser={has('create_ticket_for_user')}
      />

      {/* Filtros sempre visíveis */}
      <div className="px-4 pb-4">
        <TicketFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          assignedFilter={assignedFilter}
          onAssignedFilterChange={setAssignedFilter}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          supportUsers={supportUsers}
          isSupport={user?.role === 'admin' || user?.role === 'lawyer' || user?.role === 'support'}
        />
      </div>

      {/* Modal para criação de ticket - sempre modal ao clicar em Novo Ticket */}
      <CreateTicketModal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateTicket}
      />

      {/* Mensagem de erro */}
      {error && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center w-full">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setError(null)} 
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>

        {/* Modal para criação de ticket em nome de usuário (por permissão create_ticket_for_user) */}
        {has('create_ticket_for_user') && (
          <CreateTicketForUserModal
            isOpen={showCreateForUserModal}
            onClose={() => setShowCreateForUserModal(false)}
            onSuccess={() => {
              // Modal já criou o ticket internamente, só precisamos fechar
              setShowCreateForUserModal(false);
            }}
          />
        )}

    {/* Conteúdo principal - ocupa todo o espaço restante */}
    <div className="flex-1 flex overflow-hidden w-full h-full">
      {/* Carregando */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F69F19]"></div>
            <span className="ml-3 text-[#2C2D2F]">Carregando tickets...</span>
          </div>
        )}

        {/* Layout principal: lista de tickets + chat */}
        {!loading && (
          <>
            {/* Mobile: chat fullscreen quando aberto, lista fullscreen quando fechado */}
            <div className="flex w-full h-full lg:hidden">
              {!showChat && (
                <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
                  {view === 'list' && (
                    <TicketList
                      filteredTickets={getFilteredTickets()}
                      tickets={tickets}
                      renderTicketCard={renderTicketCard}
                      isChatOpen={false}
                    />
                  )}
                  {view === 'board' && (
                    <TicketKanbanBoard
                      ticketsByStatus={getTicketsByStatus()}
                      renderTicketCard={renderTicketCard}
                    />
                  )}
                  {view === 'users' && (
                    <TicketUserBoard
                      ticketsByUser={getTicketsByUser()}
                      supportUsers={supportUsers}
                      renderTicketCard={renderTicketCard}
                      handleAssignTicket={has('assign_ticket') ? handleAssignTicket : undefined}
                    />
                  )}
                </div>
              )}
              {showChat && selectedTicket && (
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <TicketChatPanel
                    selectedTicket={selectedTicket}
                    chatMessages={chatMessages}
                    user={user}
                    sending={sending}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    uploadingFiles={uploadingFiles}
                    handleFileUpload={handleFileUpload}
                    removeUploadingFile={removeUploadingFile}
                    sendMessage={sendMessage}
                    handleKeyPress={handleKeyPress}
                    closeChat={closeChat}
                    handleDeleteTicket={has('delete_ticket') ? handleDeleteTicket : undefined}
                    handleUpdateTicket={handleUpdateTicket}
                    isTicketFinalized={isTicketFinalized}
                    messagesEndRef={messagesEndRef}
                    markMessagesAsRead={markMessagesAsRead}
                    setShowImagePreview={setShowImagePreview}
                    typingUsers={typingUsers}
                    handleTyping={handleTyping}
                    supportUsers={supportUsers}
                    handleAssignTicket={handleAssignTicket}
                    canAssignTicket={has('assign_ticket')}
                    canDeleteTicket={has('delete_ticket')}
                    canFinishTicket={has('finish_ticket')}
                  />
                </div>
              )}
            </div>

            {/* Desktop (lg+): painel redimensionável ou lista única */}
            <div className="hidden lg:flex w-full h-full">
              {!showChat ? (
                <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
                  {view === 'list' && (
                    <TicketList
                      filteredTickets={getFilteredTickets()}
                      tickets={tickets}
                      renderTicketCard={renderTicketCard}
                      isChatOpen={false}
                    />
                  )}
                  {view === 'board' && (
                    <TicketKanbanBoard
                      ticketsByStatus={getTicketsByStatus()}
                      renderTicketCard={renderTicketCard}
                    />
                  )}
                  {view === 'users' && (
                    <TicketUserBoard
                      ticketsByUser={getTicketsByUser()}
                      supportUsers={supportUsers}
                      renderTicketCard={renderTicketCard}
                      handleAssignTicket={has('assign_ticket') ? handleAssignTicket : undefined}
                    />
                  )}
                </div>
              ) : (
                <ResizablePanelGroup direction="horizontal" className="w-full">
                  <ResizablePanel
                    defaultSize={28}
                    minSize={20}
                    maxSize={40}
                    className="flex flex-col min-w-[280px]"
                  >
                    <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200 bg-white">
                      {view === 'list' && (
                        <TicketList
                          filteredTickets={getFilteredTickets()}
                          tickets={tickets}
                          renderTicketCard={renderTicketCard}
                          isChatOpen={true}
                        />
                      )}
                      {view === 'board' && (
                        <TicketKanbanBoard
                          ticketsByStatus={getTicketsByStatus()}
                          renderTicketCard={renderTicketCard}
                        />
                      )}
                      {view === 'users' && (
                        <TicketUserBoard
                          ticketsByUser={getTicketsByUser()}
                          supportUsers={supportUsers}
                          renderTicketCard={renderTicketCard}
                          handleAssignTicket={has('assign_ticket') ? handleAssignTicket : undefined}
                        />
                      )}
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-slate-200 hover:bg-[#F69F19]/30 transition-colors" />
                  <ResizablePanel defaultSize={72} minSize={50} className="min-w-0 overflow-hidden">
                    {selectedTicket && (
                      <TicketChatPanel
                        selectedTicket={selectedTicket}
                        chatMessages={chatMessages}
                        user={user}
                        sending={sending}
                        newMessage={newMessage}
                        setNewMessage={setNewMessage}
                        uploadingFiles={uploadingFiles}
                        handleFileUpload={handleFileUpload}
                        removeUploadingFile={removeUploadingFile}
                        sendMessage={sendMessage}
                        handleKeyPress={handleKeyPress}
                        closeChat={closeChat}
                        handleDeleteTicket={has('delete_ticket') ? handleDeleteTicket : undefined}
                        handleUpdateTicket={handleUpdateTicket}
                        isTicketFinalized={isTicketFinalized}
                        messagesEndRef={messagesEndRef}
                        markMessagesAsRead={markMessagesAsRead}
                        setShowImagePreview={setShowImagePreview}
                        typingUsers={typingUsers}
                        handleTyping={handleTyping}
                        supportUsers={supportUsers}
                        handleAssignTicket={handleAssignTicket}
                        canAssignTicket={has('assign_ticket')}
                        canDeleteTicket={has('delete_ticket')}
                        canFinishTicket={has('finish_ticket')}
                      />
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </div>
          </>
        )}
    </div>

    {/* Preview de imagem - overlay fixo */}
    {showImagePreview && (
      <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={() => setShowImagePreview(null)}
      >
        <div className="max-w-4xl max-h-[90vh] relative">
          <img 
            src={showImagePreview} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain"
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 bg-white/80"
            onClick={() => setShowImagePreview(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )}
  </div>
);
};

export default Tickets;