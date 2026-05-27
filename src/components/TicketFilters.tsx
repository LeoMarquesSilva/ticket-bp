import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { CategoriesConfigMap } from '@/utils/ticketFilterUtils';
import { getCategoryKeysForFrente } from '@/utils/ticketFilterUtils';

interface TicketFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  frenteFilter: string;
  onFrenteFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  assignedFilter: string;
  onAssignedFilterChange: (value: string) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  supportUsers: Array<{ id: string; name: string; role: string }>;
  isSupport: boolean;
  frentes: Array<{ id: string; label: string; color: string }>;
  categoriesConfig: CategoriesConfigMap;
  loadingCategories: boolean;
}

const TicketFilters: React.FC<TicketFiltersProps> = ({
  searchTerm,
  onSearchChange,
  frenteFilter,
  onFrenteFilterChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  assignedFilter,
  onAssignedFilterChange,
  userFilter,
  onUserFilterChange,
  supportUsers,
  isSupport,
  frentes,
  categoriesConfig,
  loadingCategories,
}) => {
  const categoriesForSelect = useMemo(() => {
    const entries = Object.entries(categoriesConfig);
    if (frenteFilter === 'all') return entries;
    const keys = new Set(getCategoryKeysForFrente(categoriesConfig, frenteFilter));
    return entries.filter(([key]) => keys.has(key));
  }, [categoriesConfig, frenteFilter]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    frenteFilter !== 'all' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    assignedFilter !== 'all' ||
    userFilter !== 'all';

  const clearFilters = () => {
    onSearchChange('');
    onFrenteFilterChange('all');
    onStatusFilterChange('all');
    onCategoryFilterChange('all');
    onAssignedFilterChange('all');
    onUserFilterChange('all');
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 xl:col-span-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por título, descrição, ID, solicitante ou atendente..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={frenteFilter} onValueChange={onFrenteFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Frente de atuação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as frentes</SelectItem>
            <SelectItem value="sem-frente">Sem frente de atuação</SelectItem>
            {frentes.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: f.color }}
                  />
                  {f.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="assigned">Atribuído</SelectItem>
            <SelectItem value="in_progress">Em progresso</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {loadingCategories ? (
              <div className="px-2 py-1.5 text-sm text-slate-500">Carregando...</div>
            ) : categoriesForSelect.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-slate-500">Nenhuma categoria nesta frente</div>
            ) : (
              categoriesForSelect.map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {isSupport && (
          <Select value={assignedFilter} onValueChange={onAssignedFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Atribuição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as atribuições</SelectItem>
              <SelectItem value="assigned">Com responsável</SelectItem>
              <SelectItem value="unassigned">Sem responsável</SelectItem>
            </SelectContent>
          </Select>
        )}

        {isSupport && (
          <Select value={userFilter} onValueChange={onUserFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              <SelectItem value="mine">Meus tickets</SelectItem>
              {supportUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={clearFilters} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
};

export default TicketFilters;
