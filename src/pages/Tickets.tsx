import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES } from '@/lib/supabase';
import { toast } from 'sonner';
import { AlertCircle, X, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ticket, ChatMessage } from '@/types';
import { TicketService } from '@/services/ticketService';
import {
  buildRequisicaoPessoalCardMessageText,
  buildRequisicaoPessoalFichaCardAttachment,
} from '@/utils/requisicaoPessoalForm';
import { notifyTicketWhatsApp } from '@/services/evolutionEdgeService';
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
import { useRealtimeReconnectSignal } from '@/hooks/useRealtimeReconnectSignal';
import { CategoryService } from '@/services/categoryService';
import {
  type CategoriesConfigMap,
  getCategoryKeysForFrente,
  getCategoryKeysForFrenteIds,
  ticketMatchesFrente,
} from '@/utils/ticketFilterUtils';
import { matchesUserTicketFilter } from '@/utils/ticketFiltersUtils';
import { FrenteAccessService, isStrictFrenteRole, isAssignedOnlyRole } from '@/services/frenteAccessService';
import { canUserFinishTicket, isInverseTicketFlow } from '@/utils/inverseTicketFlow';

interface SupportUser {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
  manualOnline?: boolean;
  avatarUrl?: string;
}

interface PresenceUserData {
  name?: string;
  role?: string;
}

type PresenceState = Record<string, PresenceUserData[]>;

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
  assignedTo?: string;
  assignedToName?: string;
  initialChatMessage?: string;
  sharepointTreinamento?: import('@/utils/desenvolvimentoContinuoForm').SharepointTreinamentoPayload;
  pendingApprovalFile?: File | null;
  reqPessoalCard?: {
    data: import('@/utils/requisicaoPessoalForm').RequisicaoPessoalFormData;
    requester: import('@/utils/requisicaoPessoalForm').RequisicaoPessoalRequester;
  };
}

interface CreateTicketForUserData {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  userId: string;
  userName: string;
  userDepartment?: string;
  initialChatMessage?: string;
  sharepointTreinamento?: import('@/utils/desenvolvimentoContinuoForm').SharepointTreinamentoPayload;
  pendingApprovalFile?: File | null;
}

type RealtimeTicketRow = {
  id: string;
  title: string;
  description: string;
  priority: Ticket['priority'];
  category: string;
  subcategory?: string | null;
  status: Ticket['status'];
  created_by: string;
  created_by_name: string;
  created_by_department?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at: string;
};

const Tickets = () => {
  const { user } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
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
  const [frenteFilter, setFrenteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [hideResolvedTickets, setHideResolvedTickets] = useState(false);
  // Painel de filtros recolhível: aberto por padrão em telas altas, recolhido em telas baixas
  // (notebooks) para devolver altura à lista de tickets e ao chat.
  const [filtersOpen, setFiltersOpen] = useState<boolean>(
    () => (typeof window === 'undefined' ? true : window.innerHeight >= 850)
  );
  const [categoriesConfig, setCategoriesConfig] = useState<CategoriesConfigMap>({});
  const [frentes, setFrentes] = useState<{ id: string; label: string; color: string }[]>([]);
  const [userFrenteIds, setUserFrenteIds] = useState<string[]>([]);
  const [userCategoryKeys, setUserCategoryKeys] = useState<string[]>([]);
  const [frenteAccessReady, setFrenteAccessReady] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const { setActiveChatId } = useChatContext();
  const reconnectSignal = useRealtimeReconnectSignal();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCreateForUserModal, setShowCreateForUserModal] = useState(false);
  const filtersPrefsStorageKey = React.useMemo(
    () => (user?.id ? `tickets_filters_prefs:${user.id}` : null),
    [user?.id]
  );

  useEffect(() => {
    if (!filtersPrefsStorageKey) return;
    try {
      const raw = localStorage.getItem(filtersPrefsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        userFilter?: string;
        hideResolvedTickets?: boolean;
      };
      if (typeof parsed.userFilter === 'string') {
        setUserFilter(parsed.userFilter);
      }
      if (typeof parsed.hideResolvedTickets === 'boolean') {
        setHideResolvedTickets(parsed.hideResolvedTickets);
      }
    } catch (error) {
      console.warn('Falha ao carregar preferências de filtros de tickets', error);
    }
  }, [filtersPrefsStorageKey]);

  useEffect(() => {
    if (!filtersPrefsStorageKey) return;
    try {
      localStorage.setItem(
        filtersPrefsStorageKey,
        JSON.stringify({
          userFilter,
          hideResolvedTickets,
        })
      );
    } catch (error) {
      console.warn('Falha ao salvar preferências de filtros de tickets', error);
    }
  }, [filtersPrefsStorageKey, userFilter, hideResolvedTickets]);

  const normalizeRole = (role?: string | null) => String(role ?? '').trim().toLowerCase();
  const isStaffRole = (role?: string | null) => {
    const normalized = normalizeRole(role);
    return (
      normalized === 'support' ||
      normalized === 'lawyer' ||
      normalized === 'admin' ||
      normalized === 'advogado' ||
      normalized === 'juridico' ||
      normalized === 'jurídico'
    );
  };



  // Referências para controlar inscrições e evitar vazamentos de memória
  const channelsRef = useRef<{
    system?: ReturnType<typeof supabase.channel>;
    presence?: ReturnType<typeof supabase.channel>;
    supportUsersStatus?: ReturnType<typeof supabase.channel>;
    messages?: ReturnType<typeof supabase.channel>;
    typing?: ReturnType<typeof supabase.channel>;
    tickets?: ReturnType<typeof supabase.channel>; // NOVO: Canal para tickets
    globalMessages?: ReturnType<typeof supabase.channel>; 

  }>({});

  type ChannelKey = keyof typeof channelsRef.current;
  
  // Referência para verificar se o componente está montado
  const isMountedRef = useRef(true);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const channelRetryCountRef = useRef<Record<string, number>>({});
  const channelRetryTimerRef = useRef<Record<string, NodeJS.Timeout | null>>({});
  const selectedTicketIdRef = useRef<string | null>(null);
  const lastMessageReconcileAtRef = useRef<Record<string, number>>({});
  const ticketsRef = useRef<Ticket[]>([]);
  const chatOpenRef = useRef(false);
  const deniedTicketLinkRef = useRef<string | null>(null);
  
  const canCreateTicketForUser = has('create_ticket_for_user');
  const isAssignedOnly = isAssignedOnlyRole(user?.role);
  const isFrenteRestricted =
    !isAssignedOnly && has('view_frente_tickets') && !has('view_all_tickets');
  const strictFrenteOnly = isStrictFrenteRole(user?.role);
  const isStaffUser = Boolean(user && (isStaffRole(user.role) || has('assign_ticket') || has('view_all_tickets') || has('view_frente_tickets')));
  const canUsePresenceChannel = Boolean(isStaffUser);
  const visibleFrentes = isFrenteRestricted
    ? frentes.filter((f) => userFrenteIds.includes(f.id))
    : frentes;
  const mapRealtimeTicketRow = (ticketData: RealtimeTicketRow): Ticket => ({
    id: ticketData.id,
    title: ticketData.title,
    description: ticketData.description,
    priority: ticketData.priority,
    category: ticketData.category,
    subcategory: ticketData.subcategory ?? undefined,
    status: ticketData.status,
    createdBy: ticketData.created_by,
    createdByName: ticketData.created_by_name,
    createdByDepartment: ticketData.created_by_department ?? undefined,
    assignedTo: ticketData.assigned_to ?? undefined,
    assignedToName: ticketData.assigned_to_name ?? undefined,
    createdAt: ticketData.created_at,
    updatedAt: ticketData.updated_at,
  });
  const canUserSeeTicket = (ticket: Ticket) => {
    if (has('view_all_tickets')) return true;
    if (isAssignedOnly && user?.id) {
      return ticket.createdBy === user.id || ticket.assignedTo === user.id;
    }
    if (isFrenteRestricted && user?.id) {
      return FrenteAccessService.canUserAccessTicket(
        ticket,
        user.id,
        userCategoryKeys,
        strictFrenteOnly
      );
    }
    if (!user?.id) return false;
    return ticket.createdBy === user.id || ticket.assignedTo === user.id;
  };

  useEffect(() => {
    const loadFilterData = async () => {
      try {
        setLoadingCategories(true);
        const [config, tags] = await Promise.all([
          CategoryService.getCategoriesConfig(),
          CategoryService.getAllTags(false),
        ]);
        setCategoriesConfig(config);
        setFrentes(tags.map((t) => ({ id: t.id, label: t.label, color: t.color })));
      } catch (error) {
        console.error('Erro ao carregar dados dos filtros:', error);
        setCategoriesConfig({});
        setFrentes([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadFilterData();
  }, []);

  useEffect(() => {
    const loadUserFrenteAccess = async () => {
      if (permissionsLoading) return;

      if (!user?.id || !isFrenteRestricted) {
        setUserFrenteIds([]);
        setUserCategoryKeys([]);
        setFrenteAccessReady(true);
        return;
      }

      setFrenteAccessReady(false);
      try {
        const frenteIds = await FrenteAccessService.getUserFrenteIds(user.id, user.tagId, user.role);
        setUserFrenteIds(frenteIds);
        setUserCategoryKeys(getCategoryKeysForFrenteIds(categoriesConfig, frenteIds));
        if (frenteIds.length === 1) {
          setFrenteFilter(frenteIds[0]);
        }
      } catch (error) {
        console.error('Erro ao carregar frente de atuação do usuário:', error);
        setUserFrenteIds([]);
        setUserCategoryKeys([]);
      } finally {
        setFrenteAccessReady(true);
      }
    };

    loadUserFrenteAccess();
  }, [user?.id, user?.tagId, isFrenteRestricted, categoriesConfig, permissionsLoading]);

  const canLoadTickets =
    Boolean(user?.id) &&
    !permissionsLoading &&
    (!isFrenteRestricted || frenteAccessReady);

  useEffect(() => {
    if (!canLoadTickets) return;
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadTickets, isFrenteRestricted, userCategoryKeys.join(',')]);

  const handleFrenteFilterChange = (value: string) => {
    if (isFrenteRestricted && value === 'all') return;
    if (isFrenteRestricted && value !== 'all' && !userFrenteIds.includes(value)) return;
    setFrenteFilter(value);
    if (categoryFilter !== 'all' && value !== 'all') {
      const keys = getCategoryKeysForFrente(categoriesConfig, value);
      if (!keys.includes(categoryFilter)) {
        setCategoryFilter('all');
      }
    }
  };

  const applyPresenceToSupportUsers = (users: SupportUser[], state: PresenceState) => {
    const _onlineUserIds = new Set(Object.keys(state));
    const mergedUsers = users.map((supportUser) => {
      const manualOnline = supportUser.manualOnline ?? Boolean(supportUser.isOnline);
      return {
        ...supportUser,
        manualOnline,
        // Usabilidade: status de disponibilidade segue o toggle manual em tempo real.
        isOnline: manualOnline,
      };
    });

    return {
      mergedUsers,
    };
  };

  const clearRetryTimer = (key: string) => {
    const timer = channelRetryTimerRef.current[key];
    if (timer) {
      clearTimeout(timer);
      channelRetryTimerRef.current[key] = null;
    }
  };

  const handleChannelStatus = (key: string, channelRefKey: ChannelKey, status: string) => {
    if (status === 'SUBSCRIBED') {
      channelRetryCountRef.current[key] = 0;
      clearRetryTimer(key);
      return;
    }

    const retryable = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
    if (!retryable) return;

    const nextAttempt = (channelRetryCountRef.current[key] ?? 0) + 1;
    channelRetryCountRef.current[key] = nextAttempt;
    const delay = Math.min(1000 * 2 ** Math.min(nextAttempt, 5), 30000);
    clearRetryTimer(key);

    channelRetryTimerRef.current[key] = setTimeout(() => {
      if (!isMountedRef.current) return;
      const channel = channelsRef.current[channelRefKey];
      if (!channel) return;
      console.warn(`[realtime] retry ${key} status=${status} attempt=${nextAttempt} delay=${delay}`);
      channel.subscribe((nextStatus) => handleChannelStatus(key, channelRefKey, nextStatus));
    }, delay);
  };

  const removeChannelSafely = (key: string, channelRefKey: ChannelKey) => {
    clearRetryTimer(key);
    channelRetryCountRef.current[key] = 0;
    const channel = channelsRef.current[channelRefKey];
    if (channel) {
      supabase.removeChannel(channel);
      channelsRef.current[channelRefKey] = undefined;
    }
  };

  const reconcileMessagesForTicket = async (ticketId: string, reason: 'subscribed' | 'reconnect') => {
    const now = Date.now();
    const lastRun = lastMessageReconcileAtRef.current[ticketId] ?? 0;
    if (now - lastRun < 1500) return;
    lastMessageReconcileAtRef.current[ticketId] = now;

    try {
      const latestMessages = await TicketService.getTicketMessages(ticketId);
      if (!isMountedRef.current || selectedTicketIdRef.current !== ticketId) return;

      setChatMessages((current) => {
        const tempMessages = current.filter((m) => m.isTemp);
        const merged = [...latestMessages];

        tempMessages.forEach((temp) => {
          const hasEquivalent = latestMessages.some((msg) => msg.id === temp.id || (
            msg.userId === temp.userId &&
            msg.message === temp.message &&
            Math.abs(new Date(msg.createdAt).getTime() - new Date(temp.createdAt).getTime()) < 30000
          ));
          if (!hasEquivalent) merged.push(temp);
        });

        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return merged;
      });

      console.info(`[realtime] reconciled ticket=${ticketId} reason=${reason}`);
    } catch (error) {
      console.warn(`[realtime] reconcile failed ticket=${ticketId} reason=${reason}`, error);
    }
  };
  // NOVO: Função para configurar subscription de tickets em tempo real
  const setupTicketsChannel = () => {
    if (!user?.id) return;
    
    // Remover canal anterior se existir
    removeChannelSafely('tickets', 'tickets');
    
    // Criar novo canal para monitorar tickets
    const channel = supabase.channel('tickets-realtime');
    
    // Monitorar NOVOS tickets criados
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'app_c009c0e4f1_tickets'
    }, (payload) => {
      if (!isMountedRef.current) return;
      const newTicket = mapRealtimeTicketRow(payload.new as RealtimeTicketRow);

      if (!canUserSeeTicket(newTicket)) {
        return;
      }

      setTickets(prev => {
        const exists = prev.some(t => t.id === newTicket.id);
        if (exists) return prev;
        console.info('[realtime] insert_visible', { ticketId: newTicket.id });
        return [newTicket, ...prev];
      });
    });
    
    // Monitorar ATUALIZAÇÕES de tickets
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_c009c0e4f1_tickets'
    }, (payload) => {
      if (!isMountedRef.current) return;
      const updatedTicket = mapRealtimeTicketRow(payload.new as RealtimeTicketRow);
      const canSeeTicket = canUserSeeTicket(updatedTicket);
      const isSelectedTicket = selectedTicketIdRef.current === updatedTicket.id;
      let removedFromList = false;

      setTickets(prev => {
        const existingIndex = prev.findIndex(ticket => ticket.id === updatedTicket.id);
        const exists = existingIndex >= 0;

        if (canSeeTicket) {
          if (!exists) {
            console.info('[realtime] update_added', { ticketId: updatedTicket.id });
            return [updatedTicket, ...prev];
          }

          console.info('[realtime] update_updated', { ticketId: updatedTicket.id });
          const next = [...prev];
          next[existingIndex] = updatedTicket;
          return next;
        }

        if (!exists) {
          return prev;
        }

        removedFromList = true;
        console.info('[realtime] update_removed', { ticketId: updatedTicket.id });
        return prev.filter(ticket => ticket.id !== updatedTicket.id);
      });

      if (canSeeTicket && isSelectedTicket) {
        setSelectedTicket(updatedTicket);
      }

      if (removedFromList && isSelectedTicket) {
        console.info('[realtime] update_removed_selected_ticket', { ticketId: updatedTicket.id });
        closeChat();
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
      if (selectedTicketIdRef.current === deletedTicketId) {
        closeChat();
      }
    });
    
    channel.subscribe((status) => handleChannelStatus('tickets', 'tickets', status));
    
    // Armazenar referência ao canal
    channelsRef.current.tickets = channel;
  };

  // Função para configurar um único canal de sistema para monitorar conexão
  const setupSystemChannel = () => {
    // Remover canal anterior se existir
    removeChannelSafely('system', 'system');
    
    // Criar novo canal
    const channel = supabase.channel('system');
    
    // Monitorar status da conexão
    channel.on('system', { event: 'connection_status' }, (payload) => {
      if (isMountedRef.current) {
        setConnectionStatus(payload.status);
      }
    });
    
    channel.subscribe((status) => handleChannelStatus('system', 'system', status));
    
    // Armazenar referência ao canal
    channelsRef.current.system = channel;
  };

  // Função para configurar um único canal de presença para monitorar usuários online
  const setupPresenceChannel = () => {
    if (!user) return;
    
    // Remover canal anterior se existir
    removeChannelSafely('presence', 'presence');
    
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
      
      // Regra: online efetivo = toggle no banco (manualOnline) E presença ativa no canal
      const state = (channel.presenceState() || {}) as PresenceState;
      setSupportUsers((prev) => {
        const { mergedUsers } = applyPresenceToSupportUsers(prev, state);
        return mergedUsers;
      });
    });
    
    // Inscrever-se no canal
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (canUsePresenceChannel) {
          channel.track({
            id: user.id,
            name: user.name,
            role: user.role,
            online_at: new Date().toISOString(),
          });
        }
      } else {
        handleChannelStatus('presence', 'presence', status);
      }
    });
    
    // Armazenar referência ao canal
    channelsRef.current.presence = channel;
  };

  const setupSupportUsersStatusChannel = () => {
    if (!user?.id) return;

    removeChannelSafely('supportUsersStatus', 'supportUsersStatus');

    const channel = supabase.channel('support-users-status');
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: TABLES.USERS,
    }, (payload) => {
      if (!isMountedRef.current) return;

      const updatedUserId = String(payload.new?.id ?? '');
      if (!updatedUserId) return;
      const manualOnline = Boolean(payload.new?.is_online);

      setSupportUsers((prev) => {
        const exists = prev.some((supportUser) => supportUser.id === updatedUserId);
        if (!exists) return prev;

        return prev.map((supportUser) => {
          if (supportUser.id !== updatedUserId) return supportUser;
          return {
            ...supportUser,
            manualOnline,
            isOnline: manualOnline,
          };
        });
      });
    });

    channel.subscribe((status) => handleChannelStatus('supportUsersStatus', 'supportUsersStatus', status));
    channelsRef.current.supportUsersStatus = channel;
  };

  // Função para configurar um único canal de mensagens para o ticket selecionado
  const setupMessagesChannel = (ticketId: string) => {
    if (!ticketId || !user?.id) return;
    // Remover canal anterior se existir
    removeChannelSafely('messages', 'messages');
    
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
      handleChannelStatus('messages', 'messages', status);
      if (status === 'SUBSCRIBED') {
        void reconcileMessagesForTicket(ticketId, 'subscribed');
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
    removeChannelSafely('typing', 'typing');
    
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
    
    channel.subscribe((status) => handleChannelStatus('typing', 'typing', status));
    
    // Armazenar referência ao canal
    channelsRef.current.typing = channel;
  };

  // NOVO: Função para configurar canal global de mensagens (apenas para atualizar contadores)
const setupGlobalMessagesChannel = () => {
  if (!user?.id) return;
  
  // Remover canal anterior se existir
  removeChannelSafely('globalMessages', 'globalMessages');
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
    const ticket = ticketsRef.current.find(t => t.id === newMessage.ticketId);
    if (!ticket) {
      return; // Ticket não encontrado ou usuário não tem acesso
    }
    
    // Verificar se o ticket NÃO está aberto no chat atual
    const isCurrentTicket = selectedTicketIdRef.current === newMessage.ticketId && chatOpenRef.current;
    
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
  
  channel.subscribe((status) => handleChannelStatus('globalMessages', 'globalMessages', status));
  
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

  loadSupportUsers();
  
  // Configurar canais
  setupSystemChannel();
  setupTicketsChannel();
  setupGlobalMessagesChannel(); // ✅ Garantir que este canal seja configurado
  setupSupportUsersStatusChannel();
  
  // Configurar monitoramento de presença para usuários da equipe
  if (canUsePresenceChannel) {
    setupPresenceChannel();
  }
  
  // Limpar ao desmontar
  return () => {
    // Este cleanup roda também em reconnectSignal; não derrubar canal de chat ativo aqui.
    removeChannelSafely('system', 'system');
    removeChannelSafely('tickets', 'tickets');
    removeChannelSafely('globalMessages', 'globalMessages');
    removeChannelSafely('presence', 'presence');
    removeChannelSafely('supportUsersStatus', 'supportUsersStatus');
  };
}, [canUsePresenceChannel, user?.id, permissionsLoading, has]);

// Cleanup final no unmount: remover todos os canais restantes.
useEffect(() => {
  return () => {
    // Evita estado stale no contexto que pode suprimir som indevidamente.
    setActiveChatId(null);
    isMountedRef.current = false;

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    Object.values(channelsRef.current).forEach((channel) => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });

    Object.keys(channelRetryTimerRef.current).forEach((key) => {
      clearRetryTimer(key);
      channelRetryCountRef.current[key] = 0;
    });

    channelsRef.current = {};
  };
}, [setActiveChatId]);

// Mantém o contexto de chat ativo sincronizado com o estado visual real.
useEffect(() => {
  if (showChat && selectedTicket?.id) {
    chatOpenRef.current = true;
    setActiveChatId(selectedTicket.id);
    return;
  }

  chatOpenRef.current = false;
  setActiveChatId(null);
}, [showChat, selectedTicket?.id, setActiveChatId]);

useEffect(() => {
  ticketsRef.current = tickets;
}, [tickets]);

  // Configurar canal de mensagens quando o ticket selecionado mudar
  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id ?? null;

    if (selectedTicket?.id) {
      loadMessages(selectedTicket.id);
      setupMessagesChannel(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

// Reconnect sem mini reload visual: rebind silencioso de canais.
useEffect(() => {
  if (reconnectSignal === 0) return;
  if (!user?.id) return;

  setupSystemChannel();
  setupTicketsChannel();
  setupGlobalMessagesChannel();
  setupSupportUsersStatusChannel();

  if (canUsePresenceChannel) {
    setupPresenceChannel();
  }

  const currentTicketId = selectedTicketIdRef.current;
  if (currentTicketId) {
    setupMessagesChannel(currentTicketId);
    void reconcileMessagesForTicket(currentTicketId, 'reconnect');
  }
}, [canUsePresenceChannel, reconnectSignal, user?.id]);

  // Abrir o chat do ticket quando a URL for /tickets/:ticketId (ex.: clique em "Ver" no toast)
  useEffect(() => {
    if (!ticketIdParam || loading) return;
    if (selectedTicket?.id === ticketIdParam) return;

    const ticket = tickets.find((t) => t.id === ticketIdParam);
    if (ticket) {
      deniedTicketLinkRef.current = null;
      openChat(ticket);
      return;
    }

    if (deniedTicketLinkRef.current === ticketIdParam) return;
    deniedTicketLinkRef.current = ticketIdParam;

    toast.error('Você não tem acesso a este ticket');
    navigate('/tickets', { replace: true });
  }, [ticketIdParam, loading, tickets, selectedTicket?.id, navigate]);

  const loadTickets = async () => {
    if (!user?.id || permissionsLoading) return;
    if (isFrenteRestricted && !frenteAccessReady) return;

    try {
      setLoading(true);
      setError(null);
      
      let tickets;
      
      if (has('view_all_tickets')) {
        tickets = await TicketService.getAllTickets();
      } else if (isAssignedOnly) {
        tickets = await TicketService.getTicketsAssignedToUser(user.id);
      } else if (isFrenteRestricted) {
        tickets = await TicketService.getTicketsForFrenteAccess(
          user.id,
          userCategoryKeys,
          strictFrenteOnly
        );
        tickets = tickets.filter((ticket) =>
          FrenteAccessService.canUserAccessTicket(
            ticket,
            user.id,
            userCategoryKeys,
            strictFrenteOnly
          )
        );
      } else {
        tickets = await TicketService.getTicketsForCurrentUser(user.id);
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
        const normalizedUsers = (users as SupportUser[]).map((supportUser) => ({
          ...supportUser,
          manualOnline: Boolean(supportUser.isOnline),
          isOnline: false,
        }));
        const presenceState = (channelsRef.current.presence?.presenceState?.() || {}) as PresenceState;
        const { mergedUsers } = applyPresenceToSupportUsers(normalizedUsers, presenceState);
        setSupportUsers(mergedUsers);
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
      const canStartAttendance =
        user.role !== 'user' ||
        (isInverseTicketFlow(selectedTicket.category, selectedTicket.subcategory) &&
          selectedTicket.assignedTo === user.id);

      if (selectedTicket.status === 'open' && canStartAttendance) {
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
      assignedTo: ticketData.assignedTo,
      assignedToName: ticketData.assignedToName,
      initialChatMessage: ticketData.initialChatMessage,
      sharepointTreinamento: ticketData.sharepointTreinamento,
    });
      
    
    if (newTicket && newTicket.id) {
      // REMOVIDO: setTickets(prev => [newTicket, ...prev]);
      // O ticket será adicionado automaticamente via real-time subscription
      setShowCreateForm(false);
      toast.success('Ticket criado com sucesso!');

      if (ticketData.reqPessoalCard) {
        try {
          let approvalAttachment = null;
          if (ticketData.pendingApprovalFile) {
            approvalAttachment = await TicketService.uploadAttachment(newTicket.id, ticketData.pendingApprovalFile);
          }
          await TicketService.sendChatMessage(
            newTicket.id,
            user.id,
            user.name,
            buildRequisicaoPessoalCardMessageText(ticketData.reqPessoalCard.data),
            [buildRequisicaoPessoalFichaCardAttachment(
              ticketData.reqPessoalCard.data,
              ticketData.reqPessoalCard.requester,
              approvalAttachment,
            )],
          );
        } catch (uploadError) {
          console.error('Error building requisicao pessoal ficha card:', uploadError);
          toast.error('Ticket criado, mas houve um erro ao montar a ficha no chat.');
        }
      }
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    toast.error('Erro ao criar ticket');
  }
};

const handleCreateTicketForUser = async (ticketData: CreateTicketForUserData) => {
  if (!user || !canCreateTicketForUser) {
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
      skipFeedbackCheck: true,
      initialChatMessage: ticketData.initialChatMessage,
      sharepointTreinamento: ticketData.sharepointTreinamento,
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

    // Disparar notificação WhatsApp para categorias configuradas (ex: T.I)
    void notifyTicketWhatsApp(ticketId);
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
  selectedTicketIdRef.current = ticket.id;
  chatOpenRef.current = true;
  setActiveChatId(ticket.id); // 🎯 NOVA LINHA
  
  // Marcar mensagens como lidas quando abrir o chat
  if (user?.id && unreadMessages[ticket.id] > 0) {
    markMessagesAsRead(ticket.id);
  }
};

const closeChat = () => {
  setShowChat(false);
  setSelectedTicket(null);
  selectedTicketIdRef.current = null;
  chatOpenRef.current = false;
  setChatMessages([]);
  setNewMessage('');
  setUploadingFiles([]);
  setTypingUsers({});
  setActiveChatId(null); // 🎯 NOVA LINHA
  if (ticketIdParam) navigate('/tickets', { replace: true });

  // Remover canais específicos do ticket
  removeChannelSafely('messages', 'messages');
  removeChannelSafely('typing', 'typing');
};

// Função para lidar com feedback enviado
const handleFeedbackSubmitted = () => {
  // Recarregar tickets para atualizar o status de feedback
  loadTickets();
};

// Funções para filtrar tickets
const getFilteredTickets = () => {
  const searchLower = searchTerm.trim().toLowerCase();
  const statusPriority = (status: Ticket['status']) => {
    switch (status) {
      case 'in_progress':
        return 0;
      case 'open':
      case 'assigned':
        return 1;
      case 'resolved':
        return 2;
      default:
        return 3;
    }
  };

  return tickets
    .filter((ticket) => {
      if (hideResolvedTickets && ticket.status === 'resolved') {
        return false;
      }

      const categoryLabel = categoriesConfig[ticket.category]?.label ?? '';
      const subcategoryLabel =
        categoriesConfig[ticket.category]?.subcategories?.find((s) => s.value === ticket.subcategory)
          ?.label ?? '';

      const matchesSearch =
        searchLower === '' ||
        [
          ticket.title,
          ticket.description,
          ticket.id,
          ticket.createdByName,
          ticket.assignedToName,
          categoryLabel,
          subcategoryLabel,
          ticket.subcategory,
        ].some((field) => field?.toLowerCase().includes(searchLower));

      const matchesStatus =
        statusFilter === 'all' ||
        ticket.status === statusFilter ||
        (statusFilter === 'open' && ticket.status === 'assigned');

      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

      const matchesFrente = (() => {
        const isParticipant =
          Boolean(user?.id) &&
          (ticket.createdBy === user.id || ticket.assignedTo === user.id);

        if ((isFrenteRestricted || isAssignedOnly) && user?.id) {
          const inScope = isAssignedOnly
            ? isParticipant
            : FrenteAccessService.canUserAccessTicket(
                ticket,
                user.id,
                userCategoryKeys,
                strictFrenteOnly
              );
          if (!inScope) return false;
          if (frenteFilter === 'all') return true;
          return ticketMatchesFrente(ticket.category, frenteFilter, categoriesConfig) || isParticipant;
        }
        return ticketMatchesFrente(ticket.category, frenteFilter, categoriesConfig);
      })();

      const matchesAssigned =
        assignedFilter === 'all' ||
        (assignedFilter === 'assigned' && Boolean(ticket.assignedTo)) ||
        (assignedFilter === 'unassigned' && !ticket.assignedTo);

      const matchesUser = matchesUserTicketFilter(ticket, user?.id, userFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesFrente &&
        matchesAssigned &&
        matchesUser
      );
    })
    .sort((a, b) => {
      const priorityDiff = statusPriority(a.status) - statusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
};

const filteredTickets = React.useMemo(
  () => getFilteredTickets(),
  [
    tickets,
    hideResolvedTickets,
    searchTerm,
    statusFilter,
    categoryFilter,
    frenteFilter,
    assignedFilter,
    userFilter,
    categoriesConfig,
    isFrenteRestricted,
    isAssignedOnly,
    strictFrenteOnly,
    userCategoryKeys,
    user?.id,
  ]
);

// Organizar tickets por status para o quadro Kanban
const getTicketsByStatus = () => {
  // Fluxo ativo: open → in_progress → resolved (status "assigned" é legado, exibido em Abertos)
  return {
    open: filteredTickets.filter(
      (ticket) => ticket.status === 'open' || ticket.status === 'assigned'
    ),
    in_progress: filteredTickets.filter((ticket) => ticket.status === 'in_progress'),
    resolved: filteredTickets.filter((ticket) => ticket.status === 'resolved'),
  };
};

// Organizar tickets por usuário para o quadro de usuários
const getTicketsByUser = () => {
  const result: Record<string, Ticket[]> = {
    unassigned: filteredTickets.filter(ticket => !ticket.assignedTo)
  };
  
  // Adicionar tickets para cada usuário de suporte
  supportUsers.forEach(user => {
    result[user.id] = filteredTickets.filter(ticket => ticket.assignedTo === user.id);
  });
  
  return result;
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
      getStatusColor={getStatusColor}
      isTicketFinalized={isTicketFinalized}
      compact={showChat}
    />
  );
};

const headerStats = React.useMemo(() => {
  if (loading) {
    return { open: 0, inProgress: 0, resolved: 0, loading: true };
  }

  return {
    open: filteredTickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'assigned').length,
    inProgress: filteredTickets.filter((ticket) => ticket.status === 'in_progress').length,
    resolved: filteredTickets.filter((ticket) => ticket.status === 'resolved').length,
    loading: false,
  };
}, [filteredTickets, loading]);

return (
  <div className="flex flex-col overflow-hidden w-full h-[calc(100dvh-var(--layout-chrome-height))] max-h-[calc(100dvh-var(--layout-chrome-height))] pb-2 sm:pb-3 lg:pb-4">
    {/* PendingFeedbackHandler - mostra apenas tickets criados pelo próprio usuário logado */}
    <PendingFeedbackHandler
      tickets={tickets}
      onFeedbackSubmitted={handleFeedbackSubmitted}
      onOpenTicket={openChat}
      currentUserId={user?.id}
    />

{/* Cabeçalho com filtros e botões - altura fixa */}
<div className="flex-shrink-0 bg-[#F6F6F6] border-b border-[#F69F19]/20 shadow-sm w-full">
      <TicketHeader
        view={view}
        setView={handleViewChange}
        setShowCreateForm={setShowCreateForm}
        setShowCreateForUserModal={setShowCreateForUserModal}
        supportUsers={supportUsers}
        user={user}
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        ticketStatsOverride={headerStats}
        hideResolvedTickets={hideResolvedTickets}
        onToggleHideResolvedTickets={() => setHideResolvedTickets((prev) => !prev)}
        canCreateTicket={has('create_ticket')}
        canCreateTicketForUser={canCreateTicketForUser}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      />

      {/* Filtros recolhíveis (toggle no botão "Filtros" do cabeçalho) */}
      {filtersOpen && (
      <div className="px-4 pb-4">
        <TicketFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          frenteFilter={frenteFilter}
          onFrenteFilterChange={handleFrenteFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          assignedFilter={assignedFilter}
          onAssignedFilterChange={setAssignedFilter}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          supportUsers={supportUsers}
          currentUser={
            user
              ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
              : undefined
          }
          isSupport={isStaffUser}
          frentes={visibleFrentes}
          categoriesConfig={categoriesConfig}
          loadingCategories={loadingCategories}
          lockFrenteFilter={isFrenteRestricted}
          allowedCategoryKeys={isFrenteRestricted ? userCategoryKeys : undefined}
        />
      </div>
      )}

      {/* Modal para criação de ticket - sempre modal ao clicar em Novo Ticket */}
      <CreateTicketModal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateTicket}
        onOpenTicket={openChat}
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
    <div className="flex-1 flex min-h-0 overflow-hidden w-full">
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
            <div className="flex w-full min-h-0 flex-1 lg:hidden">
              {!showChat && (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden border-r border-slate-200 bg-white">
                  {view === 'list' && (
                    <TicketList
                      filteredTickets={filteredTickets}
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
                    canEditTicketCategory={has('assign_ticket')}
                    canDeleteTicket={has('delete_ticket')}
                    canFinishTicket={
                      selectedTicket
                        ? canUserFinishTicket(
                            selectedTicket,
                            user?.id,
                            has('finish_ticket'),
                            user?.role,
                          )
                        : false
                    }
                  />
                </div>
              )}
            </div>

            {/* Desktop (lg+): painel redimensionável ou lista única */}
            <div className="hidden lg:flex w-full min-h-0 flex-1">
              {!showChat ? (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden border-r border-slate-200 bg-white">
                  {view === 'list' && (
                    <TicketList
                      filteredTickets={filteredTickets}
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
                <ResizablePanelGroup direction="horizontal" className="w-full h-full min-h-0">
                  <ResizablePanel
                    defaultSize={30}
                    minSize={24}
                    maxSize={42}
                    className="flex flex-col min-w-[320px]"
                  >
                    <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200 bg-white">
                      {view === 'list' && (
                        <TicketList
                          filteredTickets={filteredTickets}
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
                        canEditTicketCategory={has('assign_ticket')}
                        canDeleteTicket={has('delete_ticket')}
                        canFinishTicket={
                      selectedTicket
                        ? canUserFinishTicket(
                            selectedTicket,
                            user?.id,
                            has('finish_ticket'),
                            user?.role,
                          )
                        : false
                    }
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
        className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
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