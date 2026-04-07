import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import Header from '@/components/Header';
import { supabase, TABLES } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { useNotificationOrchestrator } from '@/hooks/useNotificationOrchestrator';

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
  const isStaffByPermissions = Boolean(user && (has('assign_ticket') || has('view_all_tickets')));
  const isStaff = isStaffByRole || isStaffByPermissions;
  const notifyRef = useRef(notifyRealtimeEvent);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    notifyRef.current = notifyRealtimeEvent;
  }, [notifyRealtimeEvent]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

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
      cachedAt: number;
    }>();
    const CACHE_TTL_MS = 30000;

    const getTicketParticipants = async (ticketId: string): Promise<{ assignee: string | null; requester: string | null }> => {
      const cached = ticketParticipantsCache.get(ticketId);
      const now = Date.now();
      if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
        return { assignee: cached.assignee, requester: cached.requester };
      }

      const { data, error } = await supabase
        .from(TABLES.TICKETS)
        .select('assigned_to, created_by')
        .eq('id', ticketId)
        .maybeSingle();

      if (error) {
        console.warn('[notify] falha ao buscar participantes do ticket', { ticketId, error: error.message });
        return { assignee: null, requester: null };
      }

      const assignee = normalizeId((data?.assigned_to as string | null | undefined) ?? null);
      const requester = normalizeId((data?.created_by as string | null | undefined) ?? null);
      ticketParticipantsCache.set(ticketId, { assignee, requester, cachedAt: now });
      return { assignee, requester };
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
        if (status === 'CHANNEL_ERROR') {
          if (!hadConnectionIssue) {
            console.warn(`[realtime] ${channelName} ${status}`);
            hadConnectionIssue = true;
          }
        }
      };
    };

    // Inscrever para notificações de novos tickets (para suporte e advogados)
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

        // Novo ticket sem responsável: todos da equipe recebem.
        // Novo ticket com responsável: só o responsável recebe.
        if (!assignedTo && !isStaff) {
          console.info('[notify] skip_not_staff', {
            type: 'ticket_created_unassigned',
            role: normalizeRole(user.role),
            isStaffByRole,
            isStaffByPermissions,
          });
          return;
        }

        if (assignedTo && assignedTo !== normalizedUserId) {
          console.info('[notify] skip_not_assignee', { type: 'ticket_created', ticketId: newTicketId, assignedTo, userId: normalizedUserId });
          return;
        }

        console.info('[notify] notify_ticket_created', { ticketId: newTicketId, assignedTo, userId: normalizedUserId });
        void notifyRef.current({
          type: 'ticket_created',
          dedupeKey: `ticket_created:${newTicketId}:${payload.commit_timestamp ?? payload.new.created_at ?? 'na'}`,
          ticketId: newTicketId,
          title: 'Novo ticket criado!',
          description: `${payload.new.title ?? 'Sem título'} - por ${payload.new.created_by_name ?? 'usuário'}`,
          onOpen: () => navigateRef.current(newTicketId ? `/tickets/${newTicketId}` : '/tickets'),
        });
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

        // Ticket transferido para o usuário atual: dispara notificação com som de novo ticket.
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
      })
      .subscribe((status) => {
        monitorTicketChannelStatus(status);
      });

    // Inscrever para notificações de novas mensagens
    const monitorMessageChannelStatus = createStatusMonitor('layout-message-events');
    const messageSubscription = supabase
      .channel('public:app_c009c0e4f1_chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_c009c0e4f1_chat_messages'
      }, (payload) => {
        if (!payload.new) return;
        // Ignorar mensagens do próprio usuário.
        if (normalizeId(payload.new.user_id as string | null | undefined) === normalizedUserId) {
          console.info('[notify] skip_self_message', { messageId: payload.new.id });
          return;
        }

        const ticketId = payload.new.ticket_id as string | undefined;
        if (!ticketId) return;

        // Nova mensagem: responsável OU solicitante do ticket recebe notificação.
        void (async () => {
          const { assignee, requester } = await getTicketParticipants(ticketId);
          const isAssignee = Boolean(assignee && assignee === normalizedUserId);
          const isRequester = Boolean(requester && requester === normalizedUserId);
          if (!isAssignee && !isRequester) {
            console.info('[notify] skip_not_recipient', {
              type: 'message_received',
              ticketId,
              assignee,
              requester,
              userId: normalizedUserId
            });
            return;
          }

          console.info('[notify] notify_message_received', {
            ticketId,
            assignee,
            requester,
            userId: normalizedUserId,
            recipientType: isAssignee && isRequester ? 'assignee_and_requester' : isAssignee ? 'assignee' : 'requester'
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
      })
      .subscribe((status) => {
        monitorMessageChannelStatus(status);
      });

    // Limpeza ao desmontar o componente
    return () => {
      if (ticketSubscription) {
        supabase.removeChannel(ticketSubscription);
      }
      supabase.removeChannel(messageSubscription);
    };
  }, [permissionsLoading, user?.id, user?.role, normalizedUserId, isStaff, isStaffByRole, isStaffByPermissions]);

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-[#F6F6F6] via-[#F69F19]/5 to-[#DE5532]/15">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <main className="flex-1 w-full pt-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {children}
        </div>
      </main>
      
      {/* Adicionar o indicador de status de conexão */}
      <ConnectionStatus />
    </div>
  );
};

export default Layout;
