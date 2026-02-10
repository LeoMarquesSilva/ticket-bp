import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'tickets' | 'dashboard' | 'users' | 'profile';
  onPageChange: (page: 'tickets' | 'dashboard' | 'users' | 'profile') => void;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playNotificationSound } = useNotificationSound();

  // Efeito para configurar as notificações em tempo real
  useEffect(() => {
    if (!user) return;

    // Inscrever para notificações de novos tickets (para suporte e advogados)
    let ticketSubscription: any;
    if (user.role === 'support' || user.role === 'lawyer' || user.role === 'admin') {
      ticketSubscription = supabase
        .channel('public:app_c009c0e4f1_tickets')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'app_c009c0e4f1_tickets'
        }, (payload) => {
          console.log('Novo ticket criado:', payload);
          const newTicketId = payload.new?.id;
          playNotificationSound();
          toast.info('Novo ticket criado!', {
            action: {
              label: 'Ver',
              onClick: () => navigate(newTicketId ? `/tickets/${newTicketId}` : '/tickets')
            }
          });
        })
        .subscribe();
    }

    // Inscrever para notificações de novas mensagens
    const messageSubscription = supabase
      .channel('public:app_c009c0e4f1_chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_c009c0e4f1_chat_messages'
      }, (payload) => {
        // Verificar se a mensagem não é do usuário atual
        if (payload.new && payload.new.user_id !== user.id) {
          console.log('Nova mensagem recebida:', payload);
          // Passa o ticket_id para verificar se o chat específico está aberto
          playNotificationSound(payload.new.ticket_id);
          toast.info('Nova mensagem recebida!', {
            action: {
              label: 'Ver',
              onClick: () => {
                if (payload.new && payload.new.ticket_id) {
                  navigate(`/tickets/${payload.new.ticket_id}`);
                } else {
                  navigate('/tickets');
                }
              }
            }
          });
        }
      })
      .subscribe();

    // Limpeza ao desmontar o componente
    return () => {
      if (ticketSubscription) {
        supabase.removeChannel(ticketSubscription);
      }
      supabase.removeChannel(messageSubscription);
    };
  }, [user, navigate, playNotificationSound]);

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
