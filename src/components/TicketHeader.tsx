import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  List, 
  LayoutGrid, 
  Users, 
  Plus, 
  Filter,
  SlidersHorizontal,
  Circle,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import ticketEventService from '@/services/ticketEventService';

interface User {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
}

interface TicketHeaderProps {
  view: 'list' | 'board' | 'users';
  setView: (view: 'list' | 'board' | 'users') => void;
  supportUsers: User[];
  user: { role: string; id?: string } | null;
  setShowCreateForm: (show: boolean) => void;
  onlineUsersCount?: number;
  setShowCreateForUserModal?: (show: boolean) => void;
  /** Criar ticket próprio (permissão create_ticket) */
  canCreateTicket?: boolean;
  /** Criar ticket em nome de usuário (permissão create_ticket_for_user) */
  canCreateTicketForUser?: boolean;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({
  view,
  setView,
  supportUsers,
  user,
  setShowCreateForm,
  onlineUsersCount = 0,
  setShowCreateForUserModal,
  canCreateTicket = false,
  canCreateTicketForUser = false
}) => {
  const isAdmin = user?.role === 'admin';
  const isSupport = user?.role === 'support';
  const isLawyer = user?.role === 'lawyer';
  const isUser = user?.role === 'user';
  const isStaff = isAdmin || isSupport || isLawyer;
  
  // Estado para armazenar as estatísticas dos tickets
  const [ticketStats, setTicketStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    loading: true
  });

  // Referências para controlar inscrições e evitar vazamentos de memória
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Escutar mudanças de status de tickets usando o serviço
  useEffect(() => {
    // Registrar o callback para mudanças de status de tickets
    const cleanup = ticketEventService.onTicketStatusChanged(() => {
      if (isMountedRef.current) {
        fetchTicketStats();
      }
    });
    
    // Armazenar a função de limpeza para uso posterior
    cleanupRef.current = cleanup;

    // Limpar o ouvinte de evento ao desmontar o componente
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Filtrar usuários online com base na role do usuário atual
  const filteredOnlineUsers = React.useMemo(() => {
    // Usuários comuns veem apenas equipe de suporte e advogados
    if (isUser) {
      return supportUsers.filter(u => 
        u.isOnline && (u.role === 'support' || u.role === 'lawyer')
      );
    }
    
    // Suporte vê outros suportes e advogados
    if (isSupport) {
      return supportUsers.filter(u => 
        u.isOnline && (u.role === 'support' || u.role === 'lawyer')
      );
    }
    
    // Advogados veem suporte e outros advogados
    if (isLawyer) {
      return supportUsers.filter(u => 
        u.isOnline && (u.role === 'support' || u.role === 'lawyer')
      );
    }
    
    // Admin vê todos os membros da equipe online
    return supportUsers.filter(u => u.isOnline && u.role !== 'user');
  }, [supportUsers, isUser, isSupport, isLawyer, isAdmin]);

  // Função para obter o texto do papel do usuário em português
  const getUserRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'lawyer':
        return 'Advogado';
      case 'support':
        return 'Suporte';
      default:
        return role;
    }
  };

  // Função para buscar estatísticas dos tickets
  const fetchTicketStats = async () => {
    try {
      if (!user?.id || !isMountedRef.current) return;
      
      // Atualizar estado para mostrar carregamento
      setTicketStats(prev => ({ ...prev, loading: true }));
      
      // Consultas para contar tickets por status
      const openQuery = supabase
        .from(TABLES.TICKETS)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
        
      const inProgressQuery = supabase
        .from(TABLES.TICKETS)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_progress');
        
      const resolvedQuery = supabase
        .from(TABLES.TICKETS)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved');
      
      // Filtrar consultas com base no tipo de usuário
      if (isUser) {
        // Usuários comuns veem apenas seus próprios tickets
        openQuery.eq('created_by', user.id);
        inProgressQuery.eq('created_by', user.id);
        resolvedQuery.eq('created_by', user.id);
      } else if (isSupport || isLawyer) {
        // Suporte e advogados veem apenas tickets atribuídos a eles
        openQuery.eq('assigned_to', user.id);
        inProgressQuery.eq('assigned_to', user.id);
        resolvedQuery.eq('assigned_to', user.id);
      }
      // Admin vê todos os tickets (nenhum filtro adicional)
      
      // Executar as consultas
      const [openResult, inProgressResult, resolvedResult] = await Promise.all([
        openQuery,
        inProgressQuery,
        resolvedQuery
      ]);
      
      if (!isMountedRef.current) return;
      
      if (openResult.error || inProgressResult.error || resolvedResult.error) {
        console.error('Erro ao buscar estatísticas de tickets:', 
          openResult.error || inProgressResult.error || resolvedResult.error);
        setTicketStats(prev => ({ ...prev, loading: false }));
        return;
      }
      
      setTicketStats({
        open: openResult.count || 0,
        inProgress: inProgressResult.count || 0,
        resolved: resolvedResult.count || 0,
        loading: false
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas de tickets:', error);
      if (isMountedRef.current) {
        setTicketStats(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Configurar um único canal de tempo real para todas as atualizações necessárias
  useEffect(() => {
    isMountedRef.current = true;
    
    // Buscar estatísticas iniciais
    fetchTicketStats();
    
    // Filtros para eventos em tempo real com base no tipo de usuário
    const filters = [];
    
    if (isUser && user?.id) {
      // Usuários comuns: apenas seus próprios tickets
      filters.push({
        schema: 'public',
        table: TABLES.TICKETS,
        filter: `created_by=eq.${user.id}`
      });
    } else if ((isSupport || isLawyer) && user?.id) {
      // Suporte/Advogados: tickets atribuídos a eles
      filters.push({
        schema: 'public',
        table: TABLES.TICKETS,
        filter: `assigned_to=eq.${user.id}`
      });
    } else if (isAdmin) {
      // Admin: todos os tickets (sem filtro adicional)
      filters.push({
        schema: 'public',
        table: TABLES.TICKETS
      });
    }
    
    // Configurar um único canal para todas as atualizações
    if (filters.length > 0) {
      let channel = supabase.channel('ticket-stats-channel');
      
      // Adicionar eventos para cada filtro
      filters.forEach(filter => {
        // Inserções (novos tickets)
        channel = channel.on('postgres_changes', {
          event: 'INSERT',
          ...filter
        }, () => {
          if (isMountedRef.current) fetchTicketStats();
        });
        
        // Atualizações (mudanças de status)
        channel = channel.on('postgres_changes', {
          event: 'UPDATE',
          ...filter
        }, () => {
          if (isMountedRef.current) fetchTicketStats();
        });
      });
      
      // Inscrever-se no canal
      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal de tempo real para estatísticas de tickets');
          // Tentar reconectar após um pequeno atraso
          setTimeout(() => {
            if (isMountedRef.current && channelRef.current) {
              channelRef.current.subscribe();
            }
          }, 5000);
        }
      });
      
      // Armazenar referência ao canal
      channelRef.current = channel;
    }
    
    // Limpar ao desmontar
    return () => {
      isMountedRef.current = false;
      
      // Remover canal
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isUser, isSupport, isLawyer, isAdmin, user?.id]);

  // Função para obter o título das estatísticas com base no tipo de usuário
  const getStatsTitle = () => {
    if (isUser) return "Seus tickets";
    if (isSupport || isLawyer) return "Seus tickets atribuídos";
    if (isAdmin) return "Todos os tickets";
    return "Tickets";
  };

  return (
    <div className="w-full bg-white border-b border-[#F69F19]/10 shadow-sm mb-6 rounded-lg overflow-hidden">
      {/* Header principal com design sofisticado */}
      <div 
        className="relative py-6 px-6 overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, #2C2D2F 0%, #444546 100%)`,
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.2)'
        }}
      >
        {/* Efeito de brilho superior - mais sutil e elegante */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#F69F19] to-transparent opacity-70"></div>
        
        {/* Elementos decorativos sutis */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-[#F69F19]/5 blur-2xl"></div>
        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-[#DE5532]/5 blur-xl"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <span className="text-white relative">
                Tickets de Suporte
                <span className="absolute -bottom-1 left-0 w-1/2 h-[2px] bg-[#F69F19]"></span>
              </span>
            </h1>
            <p className="text-slate-200 text-sm mt-2 max-w-md">
              {isUser 
                ? 'Suas solicitações de suporte jurídico'
                : isSupport || isLawyer
                  ? 'Tickets atribuídos a você'
                  : 'Gerenciamento centralizado de tickets para equipe jurídica'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Equipe Online Popover */}
            {!isUser && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-[#F69F19]/20 hover:text-white transition-all"
                  >
                    <Circle className="h-3 w-3 fill-green-500 text-green-500 mr-2" />
                    <span>Equipe Online</span>
                    <Badge 
                      variant="outline" 
                      className="ml-2 bg-green-500/20 text-green-100 border-green-500/30 px-1.5"
                    >
                      {filteredOnlineUsers.length}
                    </Badge>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 rounded-lg border-[#F69F19]/20 shadow-lg" align="end">
                  <div className="max-h-96 overflow-auto">
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="font-medium text-slate-800">Equipe Online</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {filteredOnlineUsers.length === 0 
                          ? 'Nenhum membro online' 
                          : `${filteredOnlineUsers.length} membro(s) online`}
                      </p>
                    </div>
                    
                    <div className="p-2">
                      {filteredOnlineUsers.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">
                          Nenhum membro da equipe online no momento
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredOnlineUsers.map(user => (
                            <Card key={user.id} className="p-3 hover:bg-slate-50">
                              <div className="flex items-center">
                                <div className="relative">
                                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    <span className="text-sm font-medium text-slate-600">
                                      {user.name.substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <Circle 
                                    className="absolute -bottom-1 -right-1 h-3 w-3 fill-green-500 text-green-500" 
                                  />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                  <div className="text-xs text-slate-500">{getUserRoleText(user.role)}</div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Botões de criação de tickets - por permissão create_ticket */}
            <div className="flex items-center gap-2">
              {/* Botão para criar novo ticket */}
              {canCreateTicket && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  size="sm"
                  className="relative overflow-hidden bg-[#F69F19] hover:bg-[#DE5532] text-white font-medium shadow-md transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#F69F19] to-[#DE5532] opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                  <Plus className="h-4 w-4 mr-2 relative z-10" />
                  <span className="relative z-10">Novo Ticket</span>
                </Button>
              )}
              {/* Botão para criar ticket em nome de usuário (permissão create_ticket_for_user) */}
              {canCreateTicketForUser && setShowCreateForUserModal && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowCreateForUserModal(true)}
                        size="sm"
                        className="relative overflow-hidden bg-[#F69F19] hover:bg-[#DE5532] text-white font-medium shadow-md transition-all duration-300"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#F69F19] to-[#DE5532] opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                        <UserPlus className="h-4 w-4 mr-2 relative z-10" />
                        <span className="relative z-10">+ Ticket</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[#2C2D2F] text-white border-[#F69F19]/20">
                      <p>Criar ticket em nome de um usuário</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Barra de ferramentas com botões de visualização e filtros */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-4">
          {/* Botões de visualização com design mais sofisticado */}
          <div className="flex rounded-md overflow-hidden border border-[#F69F19]/20 shadow-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'list' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('list')}
                    className={view === 'list' 
                      ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white' 
                      : 'hover:bg-[#F69F19]/5'
                    }
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#2C2D2F] text-white border-[#F69F19]/20">
                  <p>Visualização em lista</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'board' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('board')}
                    className={view === 'board' 
                      ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white' 
                      : 'hover:bg-[#F69F19]/5'
                    }
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#2C2D2F] text-white border-[#F69F19]/20">
                  <p>Visualização em quadro</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Botão de visualização por usuários (apenas para admin, support e lawyer) */}
            {isStaff && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={view === 'users' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setView('users')}
                      className={view === 'users' 
                        ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white' 
                        : 'hover:bg-[#F69F19]/5'
                      }
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#2C2D2F] text-white border-[#F69F19]/20">
                    <p>Visualização por usuários</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Estatísticas reais do banco de dados - apenas em desktop */}
          <div className="hidden md:flex flex-col items-start">
            <div className="text-xs text-slate-500 mb-1">{getStatsTitle()}</div>
            <div className="flex items-center gap-3">
              {ticketStats.loading ? (
                <div className="text-sm text-slate-500 flex items-center">
                  <div className="h-4 w-4 border-2 border-[#F69F19]/30 border-t-[#F69F19] rounded-full animate-spin mr-2"></div>
                  Carregando...
                </div>
              ) : (
                <>
                  <Badge variant="outline" className="bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20 px-3 py-1 hover:bg-[#F69F19]/15 transition-colors">
                    Abertos: <span className="font-bold ml-1">{ticketStats.open}</span>
                  </Badge>
                  <Badge variant="outline" className="bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20 px-3 py-1 hover:bg-[#DE5532]/15 transition-colors">
                    Em andamento: <span className="font-bold ml-1">{ticketStats.inProgress}</span>
                  </Badge>
                  <Badge variant="outline" className="bg-[#2C2D2F]/10 text-[#2C2D2F] border-[#2C2D2F]/20 px-3 py-1 hover:bg-[#2C2D2F]/15 transition-colors">
                    Resolvidos: <span className="font-bold ml-1">{ticketStats.resolved}</span>
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="flex items-center gap-2">
          {/* Botão de Equipe Online para dispositivos móveis */}
          {!isUser && (
            <div className="md:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[#F69F19]/20 hover:border-[#F69F19]/40 hover:bg-[#F69F19]/5 transition-colors"
                  >
                    <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                    <Badge 
                      variant="outline" 
                      className="ml-1 bg-green-500/10 text-green-700 border-green-500/30 px-1.5"
                    >
                      {filteredOnlineUsers.length}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 border-[#F69F19]/20 shadow-lg" align="end">
                  {/* Mesmo conteúdo do popover desktop */}
                  <div className="max-h-96 overflow-auto">
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="font-medium text-slate-800">Equipe Online</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {filteredOnlineUsers.length === 0 
                          ? 'Nenhum membro online' 
                          : `${filteredOnlineUsers.length} membro(s) online`}
                      </p>
                    </div>
                    
                    <div className="p-2">
                      {filteredOnlineUsers.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">
                          Nenhum membro da equipe online no momento
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredOnlineUsers.map(user => (
                            <Card key={user.id} className="p-3 hover:bg-slate-50">
                              <div className="flex items-center">
                                <div className="relative">
                                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    <span className="text-sm font-medium text-slate-600">
                                      {user.name.substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <Circle 
                                    className="absolute -bottom-1 -right-1 h-3 w-3 fill-green-500 text-green-500" 
                                  />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                  <div className="text-xs text-slate-500">{getUserRoleText(user.role)}</div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-[#F69F19]/20 hover:border-[#F69F19]/40 hover:bg-[#F69F19]/5 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                <span>Filtros</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-[#F69F19]/20">
              <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="hover:bg-[#F69F19]/5 cursor-pointer">
                <span className="flex-1">Prioridade</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-[#F69F19]/5 cursor-pointer">
                <span className="flex-1">Categoria</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-[#F69F19]/5 cursor-pointer">
                <span className="flex-1">Data</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="hover:bg-[#F69F19]/5 cursor-pointer">
                <span className="text-[#F69F19]">Limpar filtros</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default TicketHeader;