import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  List, 
  LayoutGrid, 
  Users, 
  Plus, 
  Filter,
  SlidersHorizontal,
  Circle,
  ChevronDown
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
}

const TicketHeader: React.FC<TicketHeaderProps> = ({
  view,
  setView,
  supportUsers,
  user,
  setShowCreateForm,
  onlineUsersCount = 0
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

  // Buscar estatísticas dos tickets do Supabase
  useEffect(() => {
    async function fetchTicketStats() {
      try {
        if (!user?.id) return;
        
        let openQuery = supabase
          .from(TABLES.TICKETS)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open');
          
        let inProgressQuery = supabase
          .from(TABLES.TICKETS)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress');
          
        let resolvedQuery = supabase
          .from(TABLES.TICKETS)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'resolved');
        
        // Filtrar consultas com base no tipo de usuário
        if (isUser) {
          // Usuários comuns veem apenas seus próprios tickets
          openQuery = openQuery.eq('created_by', user.id);
          inProgressQuery = inProgressQuery.eq('created_by', user.id);
          resolvedQuery = resolvedQuery.eq('created_by', user.id);
        } else if (isSupport || isLawyer) {
          // Suporte e advogados veem apenas tickets atribuídos a eles
          openQuery = openQuery.eq('assigned_to', user.id);
          inProgressQuery = inProgressQuery.eq('assigned_to', user.id);
          resolvedQuery = resolvedQuery.eq('assigned_to', user.id);
        }
        // Admin vê todos os tickets (nenhum filtro adicional)
        
        // Executar as consultas
        const [openResult, inProgressResult, resolvedResult] = await Promise.all([
          openQuery,
          inProgressQuery,
          resolvedQuery
        ]);
        
        if (openResult.error || inProgressResult.error || resolvedResult.error) {
          console.error('Erro ao buscar estatísticas de tickets:', 
            openResult.error || inProgressResult.error || resolvedResult.error);
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
        setTicketStats(prev => ({ ...prev, loading: false }));
      }
    }
    
    fetchTicketStats();
    
    // Configurar listener para atualizações em tempo real
    const ticketsSubscription = supabase
      .channel('tickets-stats-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: TABLES.TICKETS 
      }, () => {
        // Atualizar estatísticas quando houver mudanças
        fetchTicketStats();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(ticketsSubscription);
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
    <div className="w-full bg-white border-b border-slate-200 shadow-sm mb-6 rounded-lg overflow-hidden">
      {/* Header principal com gradiente e efeito de vidro */}
      <div 
        className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white py-6 px-6 relative overflow-hidden"
        style={{ 
          backgroundImage: `
            linear-gradient(to right, rgba(16, 31, 46, 0.95), rgba(42, 63, 82, 0.95))
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Efeito de brilho */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-[#D5B170] blur-md opacity-70 rounded-full"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-[#D5B170]">
                Tickets de Suporte
              </span>
            </h1>
            <p className="text-slate-200 text-sm mt-1 max-w-md">
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
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
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
                <PopoverContent className="w-80 p-0" align="end">
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
            
            {/* Botão para criar novo ticket - APENAS para usuários comuns */}
            {isUser && (
              <Button
                onClick={() => setShowCreateForm(true)}
                size="sm"
                className="bg-[#D5B170] hover:bg-[#c9a25e] text-[#101F2E] font-medium shadow-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Ticket
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Barra de ferramentas com botões de visualização e filtros */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-4">
          {/* Botões de visualização */}
          <div className="flex rounded-md overflow-hidden border border-slate-200 shadow-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'list' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('list')}
                    className={view === 'list' ? 'bg-[#101F2E] hover:bg-[#1c3651] text-white' : ''}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
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
                    className={view === 'board' ? 'bg-[#101F2E] hover:bg-[#1c3651] text-white' : ''}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
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
                      className={view === 'users' ? 'bg-[#101F2E] hover:bg-[#1c3651] text-white' : ''}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
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
                <div className="text-sm text-slate-500">Carregando...</div>
              ) : (
                <>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                    Abertos: <span className="font-bold ml-1">{ticketStats.open}</span>
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 px-3 py-1">
                    Em andamento: <span className="font-bold ml-1">{ticketStats.inProgress}</span>
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
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
                  <Button variant="outline" size="sm" className="border-slate-200">
                    <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                    <Badge 
                      variant="outline" 
                      className="ml-1 bg-green-500/10 text-green-700 border-green-500/30 px-1.5"
                    >
                      {filteredOnlineUsers.length}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
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
              <Button variant="outline" size="sm" className="border-slate-200">
                <Filter className="h-4 w-4 mr-2" />
                <span>Filtros</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="flex-1">Prioridade</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span className="flex-1">Categoria</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span className="flex-1">Data</span>
                <SlidersHorizontal className="h-4 w-4 ml-2" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="text-blue-600">Limpar filtros</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default TicketHeader;