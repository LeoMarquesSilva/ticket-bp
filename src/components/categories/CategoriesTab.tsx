import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Info } from 'lucide-react';
import {
  PlusCircle, Trash2, Pencil, Tag, Clock, User as UserIcon,
  Settings2, Search, ArrowUpDown, X, RefreshCw,
  Filter,
} from 'lucide-react';
import { CategoryService, type Category, type Subcategory, type Tag as TagType } from '@/services/categoryService';
import type { StatusFilter, SortField, SortDir } from '@/hooks/useCategories';

interface TagGroup {
  tag: TagType | null;
  tagLabel: string;
  categories: Category[];
}

interface Props {
  loading: boolean;
  categories: Category[];
  filteredCategories: Category[];
  sortedTagGroups: [string, TagGroup][];
  // Filter
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  sortBy: SortField;
  setSortBy: (v: SortField) => void;
  sortDirection: SortDir;
  setSortDirection: (v: SortDir) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  // Accordion
  expandedCategories: string[];
  setExpandedCategories: (v: string[]) => void;
  expandedTags: string[];
  setExpandedTags: (v: string[]) => void;
  // Actions
  onCreateSubcategory: (cat: Category) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (cat: Category) => void;
  onEditSubcategory: (sub: Subcategory) => void;
  onDeleteSubcategory: (sub: Subcategory) => void;
  loadData: () => void;
}

export default function CategoriesTab({
  loading, categories, filteredCategories, sortedTagGroups,
  searchTerm, setSearchTerm, statusFilter, setStatusFilter,
  sortBy, setSortBy, sortDirection, setSortDirection,
  hasActiveFilters, clearFilters,
  expandedCategories, setExpandedCategories, expandedTags, setExpandedTags,
  onCreateSubcategory, onEditCategory, onDeleteCategory,
  onEditSubcategory, onDeleteSubcategory, loadData,
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

      {/* Categories List */}
      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <CardTitle>Categorias e Subcategorias</CardTitle>
          <CardDescription>Gerencie as categorias do sistema e configure SLAs e atribuições automáticas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-[#F69F19]" /></div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Nenhuma categoria encontrada. Crie uma nova categoria para começar.</div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma categoria encontrada com os filtros aplicados.
              {hasActiveFilters && <Button variant="link" onClick={clearFilters} className="mt-2 text-[#F69F19]">Limpar filtros</Button>}
            </div>
          ) : (
            <Accordion type="multiple" value={expandedTags} onValueChange={setExpandedTags} className="w-full space-y-4">
              {sortedTagGroups.map(([tagKey, group]) => (
                <AccordionItem key={tagKey} value={tagKey} className="border rounded-lg px-4">
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
                  <AccordionContent className="pb-4">
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
                                  <span>Subcategorias: {category.subcategories?.length || 0}</span>
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
                                  onClick={() => CategoryService.toggleCategoryStatus(category.id, !category.isActive).then(() => loadData())}
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
                                          {sub.defaultAssignedToName
                                            ? <span className="text-sm text-slate-700">{sub.defaultAssignedToName}</span>
                                            : <span className="text-sm text-slate-400 italic">Manual</span>
                                          }
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
                                              onClick={() => CategoryService.toggleSubcategoryStatus(sub.id, !sub.isActive).then(() => loadData())}
                                              className="h-8 w-8"
                                            >
                                              <Settings2 className={`h-4 w-4 ${sub.isActive ? 'text-orange-600' : 'text-green-600'}`} />
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
