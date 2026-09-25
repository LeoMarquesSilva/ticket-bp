import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  List, 
  LayoutGrid, 
  Users, 
  Plus,
  Filter,
  Circle,
  ChevronDown,
  UserPlus,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ticketEventService from '@/services/ticketEventService';
import UserAvatar from '@/components/UserAvatar';
import { usePermissions } from '@/hooks/usePermissions';
import { CategoryService } from '@/services/categoryService';
import { FrenteAccessService, isStrictFrenteRole, isAssignedOnlyRole } from '@/services/frenteAccessService';
import { getCategoryKeysForFrenteIds } from '@/utils/ticketFilterUtils';

interface User {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

interface TicketHeaderProps {
  view: 'list' | 'board' | 'users';
  setView: (view: 'list' | 'board' | 'users') => void;
  supportUsers: User[];
  user: { role: string; id?: string; tagId?: string; name?: string } | null;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  hideResolvedTickets: boolean;
  onToggleHideResolvedTickets: () => void;
  ticketStatsOverride?: {
    open: number;
    inProgress: number;
    resolved: number;
    loading: boolean;
  };
  setShowCreateForm: (show: boolean) => void;
  setShowCreateForUserModal?: (show: boolean) => void;
  /** Criar ticket próprio (permissão create_ticket) */
  canCreateTicket?: boolean;
  /** Criar ticket em nome de usuário (permissão create_ticket_for_user) */
  canCreateTicketForUser?: boolean;
  /** Se o painel de filtros está visível */
  filtersOpen?: boolean;
  /** Alterna a visibilidade do painel de filtros */
  onToggleFilters?: () => void;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({
  view,
  setView,
  supportUsers,
  user,
  userFilter,
  onUserFilterChange,
  hideResolvedTickets,
  onToggleHideResolvedTickets,
  ticketStatsOverride,
  setShowCreateForm,
  setShowCreateForUserModal,
  canCreateTicket = false,
  canCreateTicketForUser = false,
  filtersOpen = true,
  onToggleFilters,
}) => {
  const { has, loading: permissionsLoading } = usePermissions();
  const isAdmin = user?.role === 'admin';
  const isSupport = user?.role === 'support';
  const isLawyer = user?.role === 'lawyer';
  const isUser = user?.role === 'user';
  const isStaff = isAdmin || isSupport || isLawyer;
  const isFrenteRestricted = has('view_frente_tickets') && !has('view_all_tickets');
  const isAssignedOnly = isAssignedOnlyRole(user?.role);
  const strictFrenteOnly = isStrictFrenteRole(user?.role);
  const isFrenteScoped = isFrenteRestricted && !isAssignedOnly;
  const onlyMyTickets = userFilter === 'mine';
  const [userCategoryKeys, setUserCategoryKeys] = useState<string[]>([]);
  const [frenteAccessReady, setFrenteAccessReady] = useState(false);

  const normalizeRole = (role?: string) => String(role || '').trim().toLowerCase();
  const isUserRole = (role?: string) => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'user' || normalizedRole === 'usuario' || normalizedRole === 'usuário';
  };
  const isSupportOrLawyerRole = (role?: string) => {
    const normalizedRole = normalizeRole(role);
    return (
      normalizedRole === 'support' ||
      normalizedRole === 'suporte' ||
      normalizedRole === 'lawyer' ||
      normalizedRole === 'advogado'
    );
  };
  
  // Estado para armazenar as estatísticas dos tickets
  const [ticketStats, setTicketStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    loading: true
  });
  const statsToDisplay = ticketStatsOverride ?? ticketStats;

  // Referências para controlar inscrições e evitar vazamentos de memória
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
        u.isOnline && isSupportOrLawyerRole(u.role)
      );
    }
    
    // Membros da equipe veem qualquer colaborador online que não seja usuário comum
    if (isSupport || isLawyer || isAdmin) {
      return supportUsers.filter((u) => u.isOnline && !isUserRole(u.role));
    }
    
    // Admin vê todos os membros da equipe online
    return supportUsers.filter((u) => u.isOnline && !isUserRole(u.role));
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

  useEffect(() => {
    const loadFrenteAccess = async () => {
      if (permissionsLoading) return;

      if (!user?.id || !isFrenteScoped) {
        setUserCategoryKeys([]);
        setFrenteAccessReady(true);
        return;
      }

      setFrenteAccessReady(false);
      try {
        const [frenteIds, categoriesConfig] = await Promise.all([
          FrenteAccessService.getUserFrenteIds(user.id, user.tagId, user.role),
          CategoryService.getCategoriesConfig(),
        ]);
        setUserCategoryKeys(getCategoryKeysForFrenteIds(categoriesConfig, frenteIds));
      } catch (error) {
        console.error('Erro ao carregar frente para estatísticas:', error);
        setUserCategoryKeys([]);
      } finally {
        setFrenteAccessReady(true);
      }
    };

    void loadFrenteAccess();
  }, [user?.id, user?.tagId, isFrenteScoped, permissionsLoading]);

  // Função para buscar estatísticas dos tickets
  const fetchTicketStats = async () => {
    try {
      if (!user?.id || !isMountedRef.current) return;
      if (permissionsLoading) return;
      if (isFrenteScoped && !frenteAccessReady) return;
      
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
      if (onlyMyTickets && user?.id) {
        openQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
        inProgressQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
        resolvedQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
      } else if (isUser) {
        openQuery.eq('created_by', user.id);
        inProgressQuery.eq('created_by', user.id);
        resolvedQuery.eq('created_by', user.id);
      } else if (isAssignedOnly) {
        openQuery.or(FrenteAccessService.buildParticipantOrFilter(user.id));
        inProgressQuery.or(FrenteAccessService.buildParticipantOrFilter(user.id));
        resolvedQuery.or(FrenteAccessService.buildParticipantOrFilter(user.id));
      } else if (isFrenteScoped) {
        const orFilter = FrenteAccessService.buildFrenteAccessOrFilter(
          user.id,
          userCategoryKeys,
          strictFrenteOnly
        );
        openQuery.or(orFilter);
        inProgressQuery.or(orFilter);
        resolvedQuery.or(orFilter);
      } else if (isSupport || isLawyer) {
        openQuery.eq('assigned_to', user.id);
        inProgressQuery.eq('assigned_to', user.id);
        resolvedQuery.eq('assigned_to', user.id);
      } else if (has('view_all_tickets')) {
        // Admin / analista: sem filtro adicional
      } else if (user.id) {
        openQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
        inProgressQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
        resolvedQuery.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
      }
      
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

    if (permissionsLoading || (isFrenteScoped && !frenteAccessReady)) {
      return () => {
        isMountedRef.current = false;
      };
    }

    // Buscar estatísticas iniciais
    fetchTicketStats();

    if (!user?.id) {
      return () => {
        isMountedRef.current = false;
      };
    }

    let statsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFetchTicketStats = () => {
      if (!isMountedRef.current) return;
      if (statsRefreshTimer) {
        clearTimeout(statsRefreshTimer);
      }
      statsRefreshTimer = setTimeout(() => {
        if (isMountedRef.current) {
          fetchTicketStats();
        }
      }, 250);
    };

    // Canal sem filtro para garantir refresh ao entrar/sair da carteira por transferência.
    const channel = supabase
      .channel('ticket-stats-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.TICKETS
      }, scheduleFetchTicketStats)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.TICKETS
      }, scheduleFetchTicketStats)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: TABLES.TICKETS
      }, scheduleFetchTicketStats);

    // Inscrever-se no canal
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('Erro no canal de tempo real para estatísticas de tickets');
        setTimeout(() => {
          if (isMountedRef.current && channelRef.current) {
            channelRef.current.subscribe();
          }
        }, 5000);
      }
    });

    // Armazenar referência ao canal
    channelRef.current = channel;
    
    // Limpar ao desmontar
    return () => {
      isMountedRef.current = false;
      if (statsRefreshTimer) {
        clearTimeout(statsRefreshTimer);
      }
      
      // Remover canal
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isUser, isSupport, isLawyer, isAdmin, isFrenteScoped, isAssignedOnly, userCategoryKeys.join(','), user?.id, userFilter, permissionsLoading, frenteAccessReady]);

  // Função para obter o título das estatísticas com base no tipo de usuário
  const getStatsTitle = () => {
    if (onlyMyTickets) return "Meus tickets";
    if (isUser) return "Seus tickets";
    if (isAssignedOnly) return "Seus tickets";
    if (isFrenteScoped) return "Tickets da sua frente";
    if (isSupport || isLawyer) return "Seus tickets atribuídos";
    if (isAdmin) return "Todos os tickets";
    return "Tickets";
  };

  return (
    <div className="w-full border-b border-[#F69F19]/15 bg-white">
      <div
        className="relative overflow-hidden px-3 py-2 sm:px-4"
        style={{
          background: 'linear-gradient(135deg, #2C2D2F 0%, #444546 100%)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F69F19] to-transparent opacity-70" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-white">
            Tickets de Suporte
          </h1>
          
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Equipe Online Popover */}
            {!isUser && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="density-control group hidden gap-1.5 rounded-lg border-white/20 bg-white/10 px-3 text-sm text-white hover:border-[#F69F19]/45 hover:bg-[#F69F19]/15 hover:text-white md:inline-flex"
                  >
                    <Circle className="h-2.5 w-2.5 animate-pulse fill-emerald-400 text-emerald-400" />
                    <span className="hidden font-medium lg:inline">Equipe Online</span>
                    <Badge 
                      variant="outline" 
                      className="density-badge h-5 min-w-5 border-emerald-300/40 bg-emerald-400/20 px-1.5 text-emerald-50"
                    >
                      {filteredOnlineUsers.length}
                    </Badge>
                    <ChevronDown className="h-3.5 w-3.5 opacity-80 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
                                  <UserAvatar
                                    name={user.name}
                                    userId={user.id}
                                    avatarUrl={user.avatarUrl}
                                    size="md"
                                    className="h-8 w-8 shrink-0"
                                    fallbackClassName="bg-slate-200 text-slate-600"
                                  />
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
            
            <div className="flex items-center gap-1.5">
              {canCreateTicket && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  size="sm"
                  className="density-control gap-1.5 bg-[#F69F19] px-3 text-sm font-medium text-white hover:bg-[#DE5532]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Novo Ticket</span>
                </Button>
              )}
              {canCreateTicketForUser && setShowCreateForUserModal && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowCreateForUserModal(true)}
                        size="sm"
                        className="density-control gap-1.5 bg-[#F69F19] px-3 text-sm font-medium text-white hover:bg-[#DE5532]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">+ Ticket</span>
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
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-1.5 sm:px-4">
        <div className="flex items-center gap-3">
          {/* Botões de visualização com design mais sofisticado */}
          <div className="flex rounded-md overflow-hidden border border-[#F69F19]/20 shadow-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'list' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('list')}
                    aria-label="Visualização em lista"
                    className={cn(
                      'density-icon-control',
                      view === 'list'
                        ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white'
                        : 'hover:bg-[#F69F19]/5'
                    )}
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
                    aria-label="Visualização em quadro"
                    className={cn(
                      'density-icon-control',
                      view === 'board'
                        ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white'
                        : 'hover:bg-[#F69F19]/5'
                    )}
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
                      aria-label="Visualização por usuários"
                      className={cn(
                        'density-icon-control',
                        view === 'users'
                          ? 'bg-gradient-to-r from-[#F69F19] to-[#DE5532] text-white'
                          : 'hover:bg-[#F69F19]/5'
                      )}
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
          <div className="ticket-header-stats items-center gap-2">
            <span className="ticket-header-stats-title density-meta text-slate-500">{getStatsTitle()}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {statsToDisplay.loading ? (
                <div className="flex items-center text-xs text-slate-500">
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#F69F19]/30 border-t-[#F69F19]"></div>
                  Carregando...
                </div>
              ) : (
                <>
                  <Badge variant="outline" className="density-badge border-[#F69F19]/20 bg-[#F69F19]/10 px-2 py-0.5 text-[#F69F19]">
                    Abertos: <span className="ml-1 font-bold">{statsToDisplay.open}</span>
                  </Badge>
                  <Badge variant="outline" className="density-badge border-[#DE5532]/20 bg-[#DE5532]/10 px-2 py-0.5 text-[#DE5532]">
                    Andamento: <span className="ml-1 font-bold">{statsToDisplay.inProgress}</span>
                  </Badge>
                  <Badge variant="outline" className="density-badge border-[#2C2D2F]/20 bg-[#2C2D2F]/10 px-2 py-0.5 text-[#2C2D2F]">
                    Resolvidos: <span className="ml-1 font-bold">{statsToDisplay.resolved}</span>
                  </Badge>
                </>
              )}
              {!isUser && user?.id && (
                <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1">
                  <Switch
                    id="header-only-my-tickets"
                    checked={onlyMyTickets}
                    onCheckedChange={(checked) => onUserFilterChange(checked ? 'mine' : 'all')}
                    className="data-[state=checked]:bg-[#F69F19]"
                  />
                  <Label
                    htmlFor="header-only-my-tickets"
                    className="density-meta cursor-pointer font-medium text-[#2C2D2F]"
                  >
                    Meus tickets
                  </Label>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleHideResolvedTickets}
            className={cn(
              'density-control border-[#F69F19]/20 px-3 text-sm hover:border-[#F69F19]/40 hover:bg-[#F69F19]/5',
              hideResolvedTickets && 'bg-[#F69F19]/10 border-[#F69F19]/40 text-[#F69F19]'
            )}
          >
            {hideResolvedTickets ? (
              <>
                <Eye className="mr-0 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mostrar resolvidos</span>
              </>
            ) : (
              <>
                <EyeOff className="mr-0 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ocultar resolvidos</span>
              </>
            )}
          </Button>

          {/* Botão de Equipe Online para dispositivos móveis */}
          {!isUser && (
            <div className="md:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="density-control border-[#F69F19]/20 transition-colors hover:border-[#F69F19]/40 hover:bg-[#F69F19]/5"
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
                                  <UserAvatar
                                    name={user.name}
                                    userId={user.id}
                                    avatarUrl={user.avatarUrl}
                                    size="md"
                                    className="h-8 w-8 shrink-0"
                                    fallbackClassName="bg-slate-200 text-slate-600"
                                  />
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            className={cn(
              'density-control border-[#F69F19]/20 px-3 text-sm hover:border-[#F69F19]/40 hover:bg-[#F69F19]/5',
              filtersOpen && 'bg-[#F69F19]/10 border-[#F69F19]/40 text-[#F69F19]'
            )}
          >
            <Filter className="mr-0 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filtros</span>
            <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform sm:ml-2', filtersOpen && 'rotate-180')} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TicketHeader;
