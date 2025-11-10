import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TicketFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  assignedFilter: string;
  setAssignedFilter: (value: string) => void;
  userFilter: string;
  setUserFilter: (value: string) => void;
  supportUsers: any[];
  isSupport: boolean;
}

const TicketFilters: React.FC<TicketFiltersProps> = ({
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
  isSupport
}) => {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Busca */}
          <div>
            <Label htmlFor="search" className="mb-2 block text-sm font-medium">
              Buscar
            </Label>
            <Input
              id="search"
              placeholder="Buscar tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status" className="mb-2 block text-sm font-medium">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="assigned">Atribuído</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div>
            <Label htmlFor="priority" className="mb-2 block text-sm font-medium">
              Prioridade
            </Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger id="priority">
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
          </div>

          {/* Atribuição */}
          <div>
            <Label htmlFor="assigned" className="mb-2 block text-sm font-medium">
              Atribuição
            </Label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger id="assigned">
                <SelectValue placeholder="Atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="assigned">Atribuídos</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por usuário (apenas para suporte) */}
          {isSupport && (
            <div>
              <Label htmlFor="user" className="mb-2 block text-sm font-medium">
                Atribuído para
              </Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="mine">Meus tickets</SelectItem>
                  {supportUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketFilters;