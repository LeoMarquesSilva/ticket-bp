import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import Header from '@/components/Header';
import { supabase, TABLES } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { useNotificationOrchestrator } from '@/hooks/useNotificationOrchestrator';
import { CategoryService } from '@/services/categoryService';
import { FrenteAccessService } from '@/services/frenteAccessService';
import { getCategoryKeysForFrenteIds } from '@/utils/ticketFilterUtils';
import {
  shouldNotifyMessage,
  shouldNotifyNewTicket,
  type TicketNotifyContext,
} from '@/utils/notificationAccessUtils';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'tickets' | 'dashboard' | 'users' | 'profile';
  onPageChange: (page: 'tickets' | 'dashboard' | 'users' | 'profile') => void;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const { notifyRealtimeEvent } = useNotificationOrchestrator();
  const normalizeRole = (role?: string | null) => String(role ?? '').trim().toLowerCase();
  const normalizeId = (value?: string | null) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  };
  const isStaffRole = (role?: string | null) => {
    const normalizedRole = normalizeRole(role);
    return (
      normalizedRole === 'support' ||
      normalizedRole === 'lawyer' ||
      normalizedRole === 'admin' ||
      normalizedRole === 'advogado' ||
      normalizedRole === 'juridico' ||
      normalizedRole === 'jurídico'
    );
  };

  const normalizedUserId = normalizeId(user?.id);
  const isStaffByRole = isStaffRole(user?.role);
  const isStaffByPermissions = Boolean(user && (has('assign_ticket') || has('view_all_tickets') || has('view_frente_tickets')));
  const isFrenteRestricted = has('view_frente_tickets') && !has('view_all_tickets');
  const canViewAllTickets = has('view_all_tickets');
  const isStaff = isStaffByRole || isStaffByPermissions;
  const userCategoryKeysRef = useRef<string[]>([]);
  const notifyRef = useRef(notifyRealtimeEvent);
  const navigateRef = useRef(navigate);
  const channelRetryCountRef = useRef<Record<string, number>>({});
  const channelRetryTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    notifyRef.current = notifyRealtimeEvent;
  }, [notifyRealtimeEvent]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const loadFrenteAccess = async () => {
      if (!normalizedUserId || !isFrenteRestricted) {
        userCategoryKeysRef.current = [];
        return;
      }

      try {
        const [frenteIds, categoriesConfig] = await Promise.all([
          FrenteAccessService.getUserFrenteIds(normalizedUserId, user?.tagId),
          CategoryService.getCategoriesConfig(),
        ]);
        userCategoryKeysRef.current = getCategoryKeysForFrenteIds(categoriesConfig, frenteIds);
      } catch (error) {
        console.warn('[notify] falha ao carregar frente do usuário', error);
        userCategoryKeysRef.current = [];
      }
    };

    if (!permissionsLoading) {
      void loadFrenteAccess();
    }
  }, [normalizedUserId, user?.tagId, isFrenteRestricted, permissionsLoading]);

  useEffect(() => {
    if (!isStaff || permissionsLoading) return;

    const requestBrowserPermission = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
      void Notification.requestPermission();
    };

    window.addEventListener('pointerdown', requestBrowserPermission, { once: true });
    return () => window.removeEventListener('pointerdown', requestBrowserPermission);
  }, [isStaff, permissionsLoading]);

  // Efeito para configurar as notificações em tempo real
  useEffect(() => {
    if (permissionsLoading) {
      return;
    }

    if (!user || !normalizedUserId) {
      return;
    }

    const ticketParticipantsCache = new Map<string, {
      assignee: string | null;
      requester: string | null;
      category: string;
      cachedAt: number;
    }>();
    const CACHE_TTL_MS = 30000;

    const resolveUserCategoryKeys = async (): Promise<string[]> => {
      if (!isFrenteRestricted) return [];
      if (userCategoryKeysRef.current.length > 0) return userCategoryKeysRef.current;

      try {
        const [frenteIds, categoriesConfig] = await Promise.all([
          FrenteAccessService.getUserFrenteIds(normalizedUserId!, user?.tagId),
          CategoryService.getCategoriesConfig(),
        ]);
        const keys = getCategoryKeysForFrenteIds(categoriesConfig, frenteIds);
        userCategoryKeysRef.current = keys;
        return keys;
      } catch (error) {
        console.warn('[notify] falha ao resolver frente sob demanda', error);
        return [];
      }
    };

    const getNotifyAccessOptions = async () => ({
      isFrenteRestricted,
      userCategoryKeys: await resolveUserCategoryKeys(),
      canViewAllTickets,
      isStaff,
    });

    const getTicketContext = async (ticketId: string): Promise<TicketNotifyContext | null> => {
      const cached = ticketParticipantsCache.get(ticketId);
      const now = Date.now();
      if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
        return {
          assignee: cached.assignee,
          requester: cached.requester,
          category: cached.category,
        };
      }

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .select('assigned_to, created_by, category')
        .eq('id', ticketId)
        .maybeSingle();

      if (error || !data) {
        console.warn('[notify] falha ao buscar contexto do ticket', { ticketId, error: error?.message });
        return null;
      }

      const context: TicketNotifyContext = {
        assignee: normalizeId((data.assigned_to as string | null | undefined) ?? null),
        requester: normalizeId((data.created_by as string | null | undefined) ?? null),
        category: String(data.category ?? '').trim(),
      };

      ticketParticipantsCache.set(ticketId, { ...context, cachedAt: now });
      return context;
    };

    const clearRetryTimer = (key: string) => {
      const timer = channelRetryTimerRef.current[key];
      if (timer) {
        clearTimeout(timer);
        channelRetryTimerRef.current[key] = null;
      }
    };

    const subscribeWithRetry = (
      key: string,
      channel: ReturnType<typeof supabase.channel>,
      onStatus?: (status: string) => void
    ) => {
      channel.subscribe((status) => {
        onStatus?.(status);
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
          console.warn(`[notify] retry ${key} status=${status} attempt=${nextAttempt}`);
          channel.subscribe((nextStatus) => {
            onStatus?.(nextStatus);
            if (nextStatus === 'SUBSCRIBED') {
              channelRetryCountRef.current[key] = 0;
              clearRetryTimer(key);
            }
          });
        }, delay);
      });
    };

    const createStatusMonitor = (channelName: string) => {
      let hadConnectionIssue = false;
      return (status: string) => {
        if (status === 'SUBSCRIBED') {
          if (hadConnectionIssue) {
            console.info(`[realtime] ${channelName} recovered`);
          }
          hadConnectionIssue = false;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!hadConnectionIssue) {
            console.warn(`[realtime] ${channelName} ${status}`);
            hadConnectionIssue = true;
          }
        }
      };
    };

    let ticketSubscription: ReturnType<typeof supabase.channel> | null = null;
    const monitorTicketChannelStatus = createStatusMonitor('layout-ticket-events');
    ticketSubscription = supabase
      .channel('public:app_c009c0e4f1_tickets')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_c009c0e4f1_tickets'
      }, (payload) => {
        if (!payload.new) return;
        const newTicketId = payload.new?.id as string | undefined;
        const assignedTo = normalizeId((payload.new.assigned_to as string | null | undefined) ?? null);
        const createdBy = normalizeId((payload.new.created_by as string | null | undefined) ?? null);
        const ticketCategory = String(payload.new.category ?? '').trim();

        void (async () => {
          const access = await getNotifyAccessOptions();
          const shouldNotify = shouldNotifyNewTicket(
            {
              assignee: assignedTo,
              requester: createdBy,
              category: ticketCategory,
              isUnassigned: !assignedTo,
            },
            normalizedUserId!,
            access
          );

          if (!shouldNotify) {
            console.info('[notify] skip_ticket_created', {
              ticketId: newTicketId,
              category: ticketCategory,
              assignedTo,
              createdBy,
              userId: normalizedUserId,
            });
            return;
          }

          console.info('[notify] notify_ticket_created', {
            ticketId: newTicketId,
            assignedTo,
            createdBy,
            userId: normalizedUserId,
          });
          await notifyRef.current({
            type: 'ticket_created',
            dedupeKey: `ticket_created:${newTicketId}:${payload.commit_timestamp ?? payload.new.created_at ?? 'na'}`,
            ticketId: newTicketId,
            title: 'Novo ticket criado!',
            description: `${payload.new.title ?? 'Sem título'} - por ${payload.new.created_by_name ?? 'usuário'}`,
            onOpen: () => navigateRef.current(newTicketId ? `/tickets/${newTicketId}` : '/tickets'),
          });
        })();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_c009c0e4f1_tickets'
      }, (payload) => {
        if (!payload.new) return;
        const ticketId = payload.new.id as string | undefined;
        if (!ticketId) return;

        const newAssignedTo = normalizeId((payload.new.assigned_to as string | null | undefined) ?? null);
        const oldAssignedTo = normalizeId((payload.old?.assigned_to as string | null | undefined) ?? null);
        if (newAssignedTo === normalizedUserId && oldAssignedTo !== normalizedUserId) {
          console.info('[notify] notify_ticket_assigned', { ticketId, oldAssignedTo, newAssignedTo, userId: normalizedUserId });
          void notifyRef.current({
            type: 'ticket_assigned',
            dedupeKey: `ticket_assigned:${ticketId}:${payload.new.updated_at ?? payload.commit_timestamp ?? 'na'}`,
            ticketId,
            title: 'Ticket transferido para você!',
            description: `${payload.new.title ?? 'Sem título'} - atribuído para seu atendimento`,
            onOpen: () => navigateRef.current(`/tickets/${ticketId}`),
          });
        }
      });

    subscribeWithRetry('layout-ticket-events', ticketSubscription, monitorTicketChannelStatus);

    const monitorMessageChannelStatus = createStatusMonitor('layout-message-events');
    const messageSubscription = supabase
      .channel('public:app_c009c0e4f1_chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_c009c0e4f1_chat_messages'
      }, (payload) => {
        if (!payload.new) return;
        if (normalizeId(payload.new.user_id as string | null | undefined) === normalizedUserId) {
          console.info('[notify] skip_self_message', { messageId: payload.new.id });
          return;
        }

        const ticketId = payload.new.ticket_id as string | undefined;
        if (!ticketId) return;

        void (async () => {
          const [ticketContext, access] = await Promise.all([
            getTicketContext(ticketId),
            getNotifyAccessOptions(),
          ]);

          if (!ticketContext) return;

          const shouldNotify = shouldNotifyMessage(ticketContext, normalizedUserId!, access);
          if (!shouldNotify) {
            console.info('[notify] skip_message_received', {
              ticketId,
              category: ticketContext.category,
              assignee: ticketContext.assignee,
              requester: ticketContext.requester,
              userId: normalizedUserId,
            });
            return;
          }

          console.info('[notify] notify_message_received', {
            ticketId,
            category: ticketContext.category,
            userId: normalizedUserId,
          });
          await notifyRef.current({
            type: 'message_received',
            dedupeKey: `message_received:${payload.new.id}`,
            ticketId,
            title: 'Nova mensagem recebida!',
            description: `${payload.new.user_name ?? 'Usuário'} enviou uma nova mensagem`,
            onOpen: () => {
              navigateRef.current(`/tickets/${ticketId}`);
            },
          });
        })();
      });

    subscribeWithRetry('layout-message-events', messageSubscription, monitorMessageChannelStatus);

    return () => {
      Object.keys(channelRetryTimerRef.current).forEach(clearRetryTimer);
      if (ticketSubscription) {
        supabase.removeChannel(ticketSubscription);
      }
      supabase.removeChannel(messageSubscription);
    };
  }, [
    permissionsLoading,
    user?.id,
    user?.role,
    user?.tagId,
    normalizedUserId,
    isStaff,
    isFrenteRestricted,
    canViewAllTickets,
    isStaffByRole,
    isStaffByPermissions,
  ]);

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-[#F6F6F6] via-[#F69F19]/5 to-[#DE5532]/15">
      <Header />
      <main className="flex-1 w-full pt-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {children}
        </div>
      </main>
      <ConnectionStatus />
    </div>
  );
};

export default Layout;
