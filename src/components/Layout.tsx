import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'tickets' | 'dashboard' | 'users' | 'database';
  onPageChange: (page: 'tickets' | 'dashboard' | 'users' | 'database') => void;
}

// Componente interno que usa o hook useSidebar
const LayoutContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();
  
  // Efeito para configurar as notificações em tempo real
  useEffect(() => {
    if (!user) return;
    
    // Função para reproduzir som de notificação
    const playNotificationSound = () => {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(err => console.error('Erro ao reproduzir som:', err));
    };
    
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
          playNotificationSound();
          toast.info('Novo ticket criado!', {
            action: {
              label: 'Ver',
              onClick: () => navigate('/tickets')
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
          playNotificationSound();
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
  }, [user, navigate]);
  
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Sidebar */}
      <AppSidebar />
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col w-full transition-all duration-200 ${state === 'collapsed' ? 'md:ml-12' : ''}`}>
        {/* Main Content - Usando toda a largura disponível */}
        <main className="flex-1 w-full">
          {children}
        </main>
        
        {/* Adicionar o indicador de status de conexão */}
        <ConnectionStatus />
      </div>
    </div>
  );
};

// Componente principal que fornece o SidebarProvider
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
};

export default Layout;