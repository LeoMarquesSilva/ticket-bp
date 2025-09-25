import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { List, LayoutGrid, Users, Plus, Search } from 'lucide-react';

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
  setShowCreateForm
}) => {
  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#101F2E]">Tickets de Suporte</h1>
          <p className="text-slate-600 text-sm">
            {user?.role === 'user' 
              ? 'Suas solicitações de suporte jurídico'
              : 'Todos os tickets do sistema'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Alternador de visualização */}
          <div className="bg-slate-100 rounded-md p-1 flex">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={view === 'list' 
                ? 'bg-[#101F2E] text-white hover:bg-[#1a3349]' 
                : 'bg-transparent hover:bg-slate-200'}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
            <Button
              variant={view === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('board')}
              className={view === 'board' 
                ? 'bg-[#101F2E] text-white hover:bg-[#1a3349]' 
                : 'bg-transparent hover:bg-slate-200'}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Kanban
            </Button>
            {(user?.role === 'admin' || user?.role === 'lawyer') && (
              <Button
                variant={view === 'users' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('users')}
                className={view === 'users' 
                  ? 'bg-[#101F2E] text-white hover:bg-[#1a3349]' 
                  : 'bg-transparent hover:bg-slate-200'}
              >
                <Users className="h-4 w-4 mr-1" />
                Usuários
              </Button>
            )}
          </div>
          
          {user?.role === 'user' && (
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          
          {(user?.role === 'admin' || user?.role === 'lawyer') && view === 'list' && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Atribuído para" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {supportUsers.map(supportUser => (
                  <SelectItem key={supportUser.id} value={supportUser.id}>
                    {supportUser.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {(user?.role === 'support' || user?.role === 'admin' || user?.role === 'lawyer') && view !== 'users' && (
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="assigned">Atribuídos</SelectItem>
                <SelectItem value="unassigned">Não Atribuídos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TicketHeader;