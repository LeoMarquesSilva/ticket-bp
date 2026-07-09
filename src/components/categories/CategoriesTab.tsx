import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Info } from 'lucide-react';
import {
  PlusCircle, Trash2, Pencil, Tag, Clock, User as UserIcon,
  Search, ArrowUpDown, X, RefreshCw,
  Filter, Power, CheckCircle2, Users, CornerDownRight,
} from 'lucide-react';
import { type Category, type Subcategory, type Tag as TagType } from '@/services/categoryService';
import type { StatusFilter, SortField, SortDir } from '@/hooks/useCategories';
import type { User } from '@/types';

interface TagGroup {
  tag: TagType | null;
  tagLabel: string;
  categories: Category[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  loading: boolean;
  categories: Category[];
  filteredCategories: Category[];
  sortedTagGroups: [string, TagGroup][];
  tags: TagType[];
  supportUsers: User[];
  getRoleLabel: (role: string) => string;
  // Filter
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  frenteFilter: string;
  setFrenteFilter: (v: string) => void;
  sortBy: SortField;
  setSortBy: (v: SortField) => void;
  sortDirection: SortDir;
  setSortDirection: (v: SortDir) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  // Bulk assignment
  bulkAssignUserId: string;
  setBulkAssignUserId: (v: string) => void;
  bulkAssignFrenteId: string;
  setBulkAssignFrenteId: (v: string) => void;
  bulkAssignCategoryId: string;
  setBulkAssignCategoryId: (v: string) => void;
  bulkAssignFrenteCategories: Category[];
  bulkAssignTarget: 'categories' | 'subcategories' | 'both';
  setBulkAssignTarget: (v: 'categories' | 'subcategories' | 'both') => void;
  bulkAssignApplying: boolean;
  onApplyBulkAssign: () => void;
  // Accordion
  expandedCategories: string[];
  setExpandedCategories: (v: string[]) => void;
  expandedTags: string[];
  setExpandedTags: (v: string[]) => void;
  // Actions
  onCreateSubcategory: (cat: Category) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (cat: Category) => void;
  onToggleCategoryStatus: (cat: Category) => void;
  onEditSubcategory: (sub: Subcategory) => void;
  onDeleteSubcategory: (sub: Subcategory) => void;
  onToggleSubcategoryStatus: (sub: Subcategory) => void;
  onCreateCategoryForFrente: (tag: TagType | null) => void;
  onToggleFrenteStatus: (tag: TagType) => void;
}

export default function CategoriesTab({
  loading, categories, filteredCategories, sortedTagGroups, tags, supportUsers, getRoleLabel,
  searchTerm, setSearchTerm, statusFilter, setStatusFilter,
  frenteFilter, setFrenteFilter,
  sortBy, setSortBy, sortDirection, setSortDirection,
  hasActiveFilters, clearFilters,
  bulkAssignUserId, setBulkAssignUserId,
  bulkAssignFrenteId, setBulkAssignFrenteId,
  bulkAssignCategoryId, setBulkAssignCategoryId, bulkAssignFrenteCategories,
  bulkAssignTarget, setBulkAssignTarget,
  bulkAssignApplying, onApplyBulkAssign,
  expandedCategories, setExpandedCategories, expandedTags, setExpandedTags,
  onCreateSubcategory, onEditCategory, onDeleteCategory, onToggleCategoryStatus,
  onEditSubcategory, onDeleteSubcategory, onToggleSubcategoryStatus,
  onCreateCategoryForFrente, onToggleFrenteStatus,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Search / Filter Bar */}
      <Card className="border-[#F69F19]/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome da categoria ou subcategoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={frenteFilter} onValueChange={setFrenteFilter}>
                <SelectTrigger><Tag className="h-4 w-4 mr-2" /><SelectValue placeholder="Frente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as frentes</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="sem-tag">Sem frente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[180px]">
              <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                <SelectTrigger><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={`${sortBy}-${sortDirection}`} onValueChange={(v) => {
                const [f, d] = v.split('-');
                setSortBy(f as SortField);
                setSortDirection(d as SortDir);
              }}>
                <SelectTrigger><ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order-asc">Ordem (crescente)</SelectItem>
                  <SelectItem value="order-desc">Ordem (decrescente)</SelectItem>
                  <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="created-asc">Data (mais antiga)</SelectItem>
                  <SelectItem value="created-desc">Data (mais recente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="border-slate-300 text-slate-600 hover:bg-slate-100">
                <X className="h-4 w-4 mr-2" />Limpar
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="mt-4 text-sm text-slate-500">
              Mostrando {filteredCategories.length} de {categories.length} categorias
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Info */}
      <Card className="border-[#F69F19]/20 bg-gradient-to-r from-[#F69F19]/5 to-transparent">
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="assignment-info" className="border-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F69F19]/10">
                    <Info className="h-5 w-5 text-[#F69F19]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-[#2C2D2F]">Como Funciona a Atribuição Automática de Tickets</h3>
                    <p className="text-xs text-slate-500 mt-1">Clique para expandir e ver detalhes</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-[#2C2D2F] mb-1">Quando há um usuário atribuído:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Prioridade 1:</strong> Subcategoria tem usuário atribuído = tickets vão direto para ele.</li>
                      <li><strong>Prioridade 2:</strong> Categoria tem usuário atribuído (subcategoria não) = vai para o da categoria.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-[#2C2D2F] mb-1">Quando não há ninguém atribuído:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Sistema busca um advogado online e ativo com menor tempo de inatividade.</li>
                      <li>Se nenhum estiver online, busca qualquer advogado ativo disponível.</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Bulk assignment */}
      <Card className="border-[#F69F19]/20 bg-gradient-to-r from-[#DE5532]/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#DE5532]/10">
              <Users className="h-5 w-5 text-[#DE5532]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#2C2D2F]">Atribuição em Massa de Responsável</h3>
              <p className="text-xs text-slate-500">
                Escolha a frente e a categoria, defina o responsável e aplique de uma vez.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* Frente */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">1. Frente</label>
              <Select value={bulkAssignFrenteId} onValueChange={setBulkAssignFrenteId}>
                <SelectTrigger><Tag className="h-4 w-4 mr-2 shrink-0" /><SelectValue placeholder="Selecione a frente" /></SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="sem-tag">Sem frente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">2. Categoria</label>
              <Select value={bulkAssignCategoryId} onValueChange={setBulkAssignCategoryId} disabled={!bulkAssignFrenteId}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias da frente</SelectItem>
                  {bulkAssignFrenteCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">3. Responsável</label>
              <Select value={bulkAssignUserId} onValueChange={setBulkAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="flex items-center gap-2 text-slate-500">
                      <UserIcon className="h-4 w-4" /> Remover responsável (manual)
                    </span>
                  </SelectItem>
                  {supportUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                          <AvatarFallback className="text-[10px] bg-[#F69F19]/15 text-[#DE5532]">{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{u.name}</span>
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600">{getRoleLabel(u.role)}</Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aplicar em */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">4. Aplicar em</label>
              <Select value={bulkAssignTarget} onValueChange={(v) => setBulkAssignTarget(v as 'categories' | 'subcategories' | 'both')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Categorias e subcategorias</SelectItem>
                  <SelectItem value="categories">Apenas categorias</SelectItem>
                  <SelectItem value="subcategories">Apenas subcategorias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="text-xs text-slate-500">
              {bulkAssignFrenteId
                ? `Escopo: ${bulkAssignCategoryId === 'all' ? `${bulkAssignFrenteCategories.length} categoria(s)` : '1 categoria'} selecionada(s).`
                : 'Selecione uma frente para começar.'}
            </p>
            <Button
              className="bg-[#DE5532] hover:bg-[#DE5532]/90 text-white border-0"
              disabled={bulkAssignApplying || !bulkAssignFrenteId}
              onClick={() => onApplyBulkAssign()}
            >
              {bulkAssignApplying ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
              Aplicar em massa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <CardTitle>Categorias e Subcategorias</CardTitle>
          <CardDescription>Gerencie as categorias do sistema e configure SLAs e atribuições automáticas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-[#F69F19]" /></div>
          ) : sortedTagGroups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Nenhuma categoria encontrada. Crie uma nova categoria para começar.</div>
          ) : filteredCategories.length === 0 && hasActiveFilters ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma categoria encontrada com os filtros aplicados.
              {hasActiveFilters && <Button variant="link" onClick={clearFilters} className="mt-2 text-[#F69F19]">Limpar filtros</Button>}
            </div>
          ) : (
            <Accordion type="multiple" value={expandedTags} onValueChange={setExpandedTags} className="w-full space-y-4">
              {sortedTagGroups.map(([tagKey, group]) => (
                <AccordionItem key={tagKey} value={tagKey} className="border rounded-lg px-4">
                  <div className="flex items-center w-full">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 w-full">
                        {group.tag ? (
                          <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ backgroundColor: `${group.tag.color}15`, border: `2px solid ${group.tag.color}` }}>
                            <Tag className="h-5 w-5" style={{ color: group.tag.color }} />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300">
                            <Tag className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-lg">{group.tagLabel}</span>
                            {group.tag && !group.tag.isActive && (
                              <Badge variant="secondary" className="text-xs">Frente inativa</Badge>
                            )}
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                              {group.categories.length} {group.categories.length === 1 ? 'categoria' : 'categorias'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Clique para {expandedTags.includes(tagKey) ? 'minimizar' : 'expandir'} categorias
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1.5 mr-3 shrink-0">
                      {group.tag && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={`shrink-0 h-9 w-9 ${group.tag.isActive ? 'border-amber-500 text-amber-600 hover:bg-amber-50' : 'border-green-500 text-green-600 hover:bg-green-50'}`}
                          title={group.tag.isActive ? `Inativar frente ${group.tagLabel}` : `Ativar frente ${group.tagLabel}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFrenteStatus(group.tag!);
                          }}
                        >
                          {group.tag.isActive ? <Power className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      )}
                      {group.categories.length === 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="shrink-0 h-9 w-9 border-[#F69F19] text-[#F69F19] hover:bg-[#F69F19]/10"
                          title={`Adicionar categoria em ${group.tagLabel}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateCategoryForFrente(group.tag);
                          }}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <AccordionContent className="pb-4">
                    {group.categories.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <p className="text-sm text-slate-500 text-center">
                          Nenhuma categoria nesta frente ainda.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => onCreateCategoryForFrente(group.tag)}
                          className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Adicionar categoria
                        </Button>
                      </div>
                    ) : (
                    <Accordion type="multiple" value={expandedCategories} onValueChange={setExpandedCategories} className="w-full space-y-2 mt-2">
                      {group.categories.map((category) => (
                        <AccordionItem key={category.id} value={category.id} className="border rounded-md px-3">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 w-full">
                              <Tag className="h-4 w-4 text-[#F69F19]" />
                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">{category.label}</span>
                                  <Badge variant="outline" className={category.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                    {category.isActive ? 'Ativa' : 'Inativa'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                  <span>Chave: {category.key}</span>
                                  {category.slaHours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />SLA: {category.slaHours}h</span>}
                                  {category.defaultAssignedToName && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />Atribuição: {category.defaultAssignedToName}</span>}
                                  {(() => {
                                    const subs = category.subcategories ?? [];
                                    const active = subs.filter((s) => s.isActive).length;
                                    const inactive = subs.length - active;
                                    return (
                                      <span>
                                        Subcategorias: {subs.length}
                                        {subs.length > 0 && (
                                          <span className="text-slate-400"> ({active} ativa{active !== 1 ? 's' : ''}{inactive > 0 ? ` · ${inactive} inativa${inactive !== 1 ? 's' : ''}` : ''})</span>
                                        )}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pt-4 space-y-4 pl-7">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => onCreateSubcategory(category)} className="border-[#F69F19] text-[#F69F19] hover:bg-[#F69F19]/5">
                                  <PlusCircle className="h-4 w-4 mr-2" />Adicionar Subcategoria
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => onEditCategory(category)} className="border-[#DE5532] text-[#DE5532] hover:bg-[#DE5532]/5">
                                  <Pencil className="h-4 w-4 mr-2" />Editar Categoria
                                </Button>
                                <Button variant="outline" size="sm"
                                  onClick={() => onToggleCategoryStatus(category)}
                                  className={category.isActive ? 'border-orange-500 text-orange-600 hover:bg-orange-50' : 'border-green-500 text-green-600 hover:bg-green-50'}
                                >
                                  {category.isActive ? 'Desativar' : 'Ativar'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => onDeleteCategory(category)} className="border-[#BD2D29] text-[#BD2D29] hover:bg-[#BD2D29]/5">
                                  <Trash2 className="h-4 w-4 mr-2" />Excluir
                                </Button>
                              </div>
                              {category.subcategories && category.subcategories.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Nome</TableHead>
                                      <TableHead>Chave</TableHead>
                                      <TableHead>SLA</TableHead>
                                      <TableHead>Atribuição</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {category.subcategories.map((sub) => (
                                      <TableRow key={sub.id}>
                                        <TableCell className="font-medium">{sub.label}</TableCell>
                                        <TableCell className="text-sm text-slate-500">{sub.key}</TableCell>
                                        <TableCell>
                                          <span className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3 text-[#F69F19]" />{sub.slaHours}h</span>
                                        </TableCell>
                                        <TableCell>
                                          {sub.defaultAssignedToName ? (
                                            <span className="text-sm text-slate-700">{sub.defaultAssignedToName}</span>
                                          ) : category.defaultAssignedToName ? (
                                            <span className="flex items-center gap-1 text-sm text-slate-500" title={`Herda o responsável da categoria ${category.label}`}>
                                              <CornerDownRight className="h-3 w-3 text-slate-400" />
                                              Herda: {category.defaultAssignedToName}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-slate-400 italic">Manual</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={sub.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                            {sub.isActive ? 'Ativa' : 'Inativa'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => onEditSubcategory(sub)} className="h-8 w-8">
                                              <Pencil className="h-4 w-4 text-[#DE5532]" />
                                            </Button>
                                            <Button variant="ghost" size="icon"
                                              onClick={() => onToggleSubcategoryStatus(sub)}
                                              title={sub.isActive ? 'Desativar' : 'Ativar'}
                                              className="h-8 w-8"
                                            >
                                              {sub.isActive
                                                ? <Power className="h-4 w-4 text-orange-600" />
                                                : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => onDeleteSubcategory(sub)} className="h-8 w-8">
                                              <Trash2 className="h-4 w-4 text-[#BD2D29]" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <div className="text-center py-4 text-slate-400 text-sm">
                                  Nenhuma subcategoria cadastrada. Clique em "Adicionar Subcategoria" para criar uma.
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
