import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, LayoutGrid, Users, Plus, Search, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import OnlineStatusToggle from '@/components/OnlineStatusToggle';

interface User {
  id: string;
  name: string;
  role: string;
}

interface TicketHeaderProps {
  view: 'list' | 'board' | 'users';
  setView: (view: 'list' | 'board' | 'users') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  priorityFilter: string;
  setPriorityFilter: (priority: string) => void;
  assignedFilter: string;
  setAssignedFilter: (assigned: string) => void;
  userFilter: string;
  setUserFilter: (userId: string) => void;
  supportUsers: User[];
  user: { role: string } | null;
  setShowCreateForm: (show: boolean) => void;
  onlineUsersCount?: number;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({
  view,
  setView,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  assignedFilter,
  setAssignedFilter,
  userFilter,
  setUserFilter,
  supportUsers,
  user,
  setShowCreateForm,
  onlineUsersCount = 0
}) => {
  // Estado para controlar a exibição dos filtros avançados
  const [showFilters, setShowFilters] = React.useState(false);
  
  // Verificar se algum filtro está ativo
  const hasActiveFilters = statusFilter !== 'all' || 
                          priorityFilter !== 'all' || 
                          assignedFilter !== 'all' || 
                          userFilter !== 'all';

  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssignedFilter('all');
    setUserFilter('all');
    setSearchTerm('');
  };
  
  // Função para obter a cor do status para os badges
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open': return 'secondary';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'closed': return 'outline';
      default: return 'secondary';
    }
  };
  
  // Função para obter a cor da prioridade para os badges
  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'secondary';
      case 'high': return 'warning';
      case 'urgent': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm">
      {/* Header principal com gradiente */}
      <div className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white py-6 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Tickets de Suporte</h1>
            <p className="text-slate-200 text-sm mt-1">
              {user?.role === 'user' 
                ? 'Suas solicitações de suporte jurídico'
                : 'Gerenciamento centralizado de tickets'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Toggle de status online/offline - APENAS para support e lawyer */}
            {(user?.role === 'support' || user?.role === 'lawyer') && (
              <div className="bg-white/10 rounded-md py-1 px-3">
                <OnlineStatusToggle />
              </div>
            )}
            
            {/* Botão para criar novo ticket */}
            {user?.role === 'user' && (
              <Button
                onClick={() => setShowCreateForm(true)}
                size="sm"
                className="bg-[#D5B170] hover:bg-[#c9a25e] text-[#101F2E] font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Ticket
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Barra de ferramentas com filtros e botões de visualização */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-2">
        {/* Botões de visualização */}
        <div className="flex rounded-md overflow-hidden border border-slate-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === 'list' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView('list')}
                  className={view === 'list' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
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
                  className={view === 'board' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visualização em quadro</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Botão de visualização por usuários (apenas para admin, support e lawyer) */}
          {(user?.role === 'admin' || user?.role === 'support' || user?.role === 'lawyer') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'users' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('users')}
                    className={view === 'users' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Visualização por usuários</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <Separator orientation="vertical" className="h-8 mx-2" />
        
        {/* Campo de pesquisa */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              type="search"
              placeholder="Buscar tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-slate-50 border-slate-200 focus-visible:ring-[#D5B170]"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Botão de filtros */}
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? "bg-[#D5B170] hover:bg-[#c9a25e] text-[#101F2E]" : ""}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge variant="secondary" size="sm" className="ml-2 bg-white text-[#101F2E]">
              {Object.values([statusFilter, priorityFilter, assignedFilter, userFilter]).filter(f => f !== 'all').length}
            </Badge>
          )}
        </Button>
        
        {/* Botão para limpar filtros - visível apenas quando há filtros ativos */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
      
      {/* Filtros avançados - visíveis apenas quando o botão de filtros é clicado */}
      {showFilters && (
        <div className="px-6 py-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filtro de status */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">
                  <div className="flex items-center">
                    <Badge variant={getStatusBadgeVariant('open')} size="sm" className="mr-2">
                      Aberto
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="in_progress">
                  <div className="flex items-center">
                    <Badge variant={getStatusBadgeVariant('in_progress')} size="sm" className="mr-2">
                      Em andamento
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="resolved">
                  <div className="flex items-center">
                    <Badge variant={getStatusBadgeVariant('resolved')} size="sm" className="mr-2">
                      Resolvido
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="closed">
                  <div className="flex items-center">
                    <Badge variant={getStatusBadgeVariant('closed')} size="sm" className="mr-2">
                      Fechado
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Filtro de prioridade */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Prioridade</label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center">
                    <Badge variant={getPriorityBadgeVariant('low')} size="sm" className="mr-2">
                      Baixa
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center">
                    <Badge variant={getPriorityBadgeVariant('medium')} size="sm" className="mr-2">
                      Média
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center">
                    <Badge variant={getPriorityBadgeVariant('high')} size="sm" className="mr-2">
                      Alta
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="urgent">
                  <div className="flex items-center">
                    <Badge variant={getPriorityBadgeVariant('urgent')} size="sm" className="mr-2">
                      Urgente
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Filtro de atribuição */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Atribuição</label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Todos os tickets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tickets</SelectItem>
                <SelectItem value="assigned">Atribuídos</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Filtro de usuário (para admin, support e lawyer) */}
          {(user?.role === 'admin' || user?.role === 'support' || user?.role === 'lawyer') && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Responsável</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-9 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Todos os usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="mine">Meus tickets</SelectItem>
                  {supportUsers.map(supportUser => (
                    <SelectItem key={supportUser.id} value={supportUser.id}>
                      {supportUser.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TicketHeader;