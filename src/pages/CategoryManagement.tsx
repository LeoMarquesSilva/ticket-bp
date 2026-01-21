import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CategoryService, Category, Subcategory, CreateCategoryData, CreateSubcategoryData, Tag as TagType } from '@/services/categoryService';
import { UserService } from '@/services/userService';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, RefreshCw, Pencil, Tag, Clock, User as UserIcon, ChevronDown, ChevronUp, Settings2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, X, Info, HelpCircle, ArrowRight, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

export default function CategoryManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createSubcategoryLoading, setCreateSubcategoryLoading] = useState(false);
  const [editCategoryLoading, setEditCategoryLoading] = useState(false);
  const [editSubcategoryLoading, setEditSubcategoryLoading] = useState(false);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  
  // Dialogs
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [createSubcategoryDialogOpen, setCreateSubcategoryDialogOpen] = useState(false);
  const [editSubcategoryDialogOpen, setEditSubcategoryDialogOpen] = useState(false);
  
  // Estados para formulários
  const [newCategory, setNewCategory] = useState<CreateCategoryData>({
    key: '',
    label: '',
    slaHours: undefined,
    defaultAssignedTo: undefined,
    tagId: undefined,
    order: undefined
  });
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | null>(null);
  
  const [newSubcategory, setNewSubcategory] = useState<CreateSubcategoryData>({
    categoryId: '',
    key: '',
    label: '',
    slaHours: 24,
    defaultAssignedTo: undefined,
    order: undefined
  });
  
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedTags, setExpandedTags] = useState<string[]>([]);
  const [isAssignmentInfoExpanded, setIsAssignmentInfoExpanded] = useState(false);
  
  // Estados para validação
  const [categoryKeyError, setCategoryKeyError] = useState<string | null>(null);
  const [subcategoryKeyError, setSubcategoryKeyError] = useState<string | null>(null);
  const [isValidatingCategoryKey, setIsValidatingCategoryKey] = useState(false);
  const [isValidatingSubcategoryKey, setIsValidatingSubcategoryKey] = useState(false);
  
  // Estados para modais de confirmação
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<Category | null>(null);
  const [deleteSubcategoryDialogOpen, setDeleteSubcategoryDialogOpen] = useState(false);
  const [pendingDeleteSubcategory, setPendingDeleteSubcategory] = useState<Subcategory | null>(null);

  // Estados para busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'order' | 'created'>('order');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Redirecionar se não for admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
      navigate('/tickets');
    }
  }, [user, navigate]);

  // Carregar categorias e usuários
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Carregando dados...');
      const [categoriesData, usersData, tagsData] = await Promise.all([
        CategoryService.getAllCategories(true), // Incluir inativas
        UserService.getSupportUsers(),
        CategoryService.getAllTags(true) // Incluir inativas
      ]);
      console.log('Dados carregados:', { categoriesData, usersData, tagsData });
      setCategories(categoriesData);
      setSupportUsers(usersData);
      setTags(tagsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as categorias.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [user]);

  // Validar chave de categoria em tempo real
  const validateCategoryKey = async (key: string) => {
    if (!key) {
      setCategoryKeyError(null);
      return;
    }

    setIsValidatingCategoryKey(true);
    
    // Validar formato
    const formatValidation = CategoryService.validateKeyFormat(key);
    if (!formatValidation.valid) {
      setCategoryKeyError(formatValidation.error || 'Formato inválido');
      setIsValidatingCategoryKey(false);
      return;
    }

    // Verificar se já existe (com delay para evitar muitas chamadas)
    try {
      const exists = await CategoryService.categoryKeyExists(key);
      if (exists) {
        setCategoryKeyError(`A chave "${key}" já está em uso por outra categoria.`);
      } else {
        setCategoryKeyError(null);
      }
    } catch (error: any) {
      console.error('Erro ao verificar chave:', error);
      setCategoryKeyError('Erro ao verificar disponibilidade da chave.');
    } finally {
      setIsValidatingCategoryKey(false);
    }
  };

  // Criar categoria
  const handleCreateCategory = async () => {
    if (!newCategory.key || !newCategory.label) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha pelo menos a chave e o nome da categoria.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreateCategoryLoading(true);
      await CategoryService.createCategory(newCategory);
      toast({
        title: 'Categoria criada',
        description: `${newCategory.label} foi criada com sucesso.`,
      });
      setNewCategory({
        key: '',
        label: '',
        slaHours: undefined,
        defaultAssignedTo: undefined,
        tagId: undefined,
        order: undefined
      });
      setCreateCategoryDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: 'Erro ao criar categoria',
        description: error.message || 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  // Editar categoria
  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.label) {
      return;
    }

    try {
      setEditCategoryLoading(true);
      
      // Preparar dados para atualização
      // IMPORTANTE: Se defaultAssignedTo for undefined (nenhum selecionado), enviar null explicitamente
      // para remover a atribuição existente no banco
      const defaultAssignedToValue = editingCategory.defaultAssignedTo;
      const sanitizedValue = (defaultAssignedToValue === '' || defaultAssignedToValue === 'none' || !defaultAssignedToValue) 
        ? null  // Enviar null explicitamente para remover atribuição
        : defaultAssignedToValue;
      
      await CategoryService.updateCategory(editingCategory.id, {
        key: editingCategory.key,
        label: editingCategory.label,
        slaHours: editingCategory.slaHours,
        defaultAssignedTo: sanitizedValue, // null quando "nenhum", userId quando selecionado
        tagId: editingCategory.tagId || undefined,
        order: editingCategory.order
      });
      toast({
        title: 'Categoria atualizada',
        description: `${editingCategory.label} foi atualizada com sucesso.`,
      });
      setEditCategoryDialogOpen(false);
      setEditingCategory(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao atualizar categoria:', error);
      toast({
        title: 'Erro ao atualizar categoria',
        description: error.message || 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      });
    } finally {
      setEditCategoryLoading(false);
    }
  };

  // Validar chave de subcategoria em tempo real
  const validateSubcategoryKey = async (key: string, categoryId: string) => {
    if (!key || !categoryId) {
      setSubcategoryKeyError(null);
      return;
    }

    setIsValidatingSubcategoryKey(true);
    
    // Validar formato
    const formatValidation = CategoryService.validateKeyFormat(key);
    if (!formatValidation.valid) {
      setSubcategoryKeyError(formatValidation.error || 'Formato inválido');
      setIsValidatingSubcategoryKey(false);
      return;
    }

    // Verificar se já existe na mesma categoria
    try {
      const exists = await CategoryService.subcategoryKeyExists(categoryId, key);
      if (exists) {
        setSubcategoryKeyError(`A chave "${key}" já está em uso por outra subcategoria nesta categoria.`);
      } else {
        setSubcategoryKeyError(null);
      }
    } catch (error: any) {
      console.error('Erro ao verificar chave:', error);
      setSubcategoryKeyError('Erro ao verificar disponibilidade da chave.');
    } finally {
      setIsValidatingSubcategoryKey(false);
    }
  };

  // Criar subcategoria
  const handleCreateSubcategory = async () => {
    if (!newSubcategory.key || !newSubcategory.label || !newSubcategory.categoryId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    // Validar formato da chave antes de criar
    const formatValidation = CategoryService.validateKeyFormat(newSubcategory.key);
    if (!formatValidation.valid) {
      toast({
        title: 'Chave inválida',
        description: formatValidation.error || 'A chave não está no formato correto.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se a chave já existe na mesma categoria
    try {
      const keyExists = await CategoryService.subcategoryKeyExists(newSubcategory.categoryId, newSubcategory.key);
      if (keyExists) {
        toast({
          title: 'Chave já existe',
          description: `A chave "${newSubcategory.key}" já está em uso por outra subcategoria nesta categoria. Por favor, escolha uma chave diferente.`,
          variant: 'destructive',
        });
        return;
      }
    } catch (error: any) {
      console.error('Erro ao verificar chave:', error);
      toast({
        title: 'Erro ao validar chave',
        description: 'Não foi possível verificar se a chave já existe. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreateSubcategoryLoading(true);
      await CategoryService.createSubcategory(newSubcategory);
      toast({
        title: 'Subcategoria criada',
        description: `${newSubcategory.label} foi criada com sucesso.`,
      });
      setNewSubcategory({
        categoryId: '',
        key: '',
        label: '',
        slaHours: 24,
        defaultAssignedTo: undefined,
        order: undefined
      });
      setSubcategoryKeyError(null);
      setCreateSubcategoryDialogOpen(false);
      setSelectedCategoryForSubcategory(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar subcategoria:', error);
      
      // Mensagens de erro mais específicas
      let errorMessage = 'Não foi possível criar a subcategoria.';
      if (error.message) {
        if (error.message.includes('already exists') || error.message.includes('já está em uso')) {
          errorMessage = error.message;
        } else if (error.message.includes('Formato')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Erro ao criar subcategoria',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCreateSubcategoryLoading(false);
    }
  };

  // Editar subcategoria
  const handleEditSubcategory = async () => {
    if (!editingSubcategory || !editingSubcategory.label) {
      toast({
        title: 'Dados inválidos',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setEditSubcategoryLoading(true);
      
      // Preparar dados para atualização
      // IMPORTANTE: Se defaultAssignedTo for undefined (nenhum selecionado), enviar null explicitamente
      // para remover a atribuição existente no banco
      const defaultAssignedToValue = editingSubcategory.defaultAssignedTo;
      const sanitizedValue = (defaultAssignedToValue === '' || defaultAssignedToValue === 'none' || !defaultAssignedToValue) 
        ? null  // Enviar null explicitamente para remover atribuição
        : defaultAssignedToValue;
      
      const updateData = {
        categoryId: editingSubcategory.categoryId,
        key: editingSubcategory.key,
        label: editingSubcategory.label,
        slaHours: editingSubcategory.slaHours,
        defaultAssignedTo: sanitizedValue, // null quando "nenhum", userId quando selecionado
        order: editingSubcategory.order
      };
      
      console.log('=== INÍCIO DA ATUALIZAÇÃO ===');
      console.log('Estado da subcategoria antes de atualizar:', editingSubcategory);
      console.log('Dados para atualizar subcategoria:', updateData);
      console.log('ID da subcategoria:', editingSubcategory.id);
      
      try {
        const updated = await CategoryService.updateSubcategory(editingSubcategory.id, updateData);
        console.log('✅ Subcategoria atualizada com sucesso:', updated);
        console.log('defaultAssignedTo após update:', updated.defaultAssignedTo);
        console.log('defaultAssignedToName após update:', updated.defaultAssignedToName);
        
        // Toast de sucesso
        toast({
          title: 'Subcategoria atualizada',
          description: `${editingSubcategory.label} foi atualizada com sucesso.`,
        });
        
        // Fechar modal
        setEditSubcategoryDialogOpen(false);
        setEditingSubcategory(null);
        
        // Aguardar um pouco para garantir que o modal fechou
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Recarregar dados
        console.log('🔄 Recarregando dados...');
        await loadData();
        console.log('✅ Dados recarregados após atualização');
        console.log('=== FIM DA ATUALIZAÇÃO ===');
      } catch (updateError) {
        console.error('❌ ERRO na atualização:', updateError);
        throw updateError;
      }
    } catch (error: any) {
      console.error('❌ ERRO COMPLETO ao atualizar subcategoria:', error);
      console.error('Stack trace:', error.stack);
      console.error('Mensagem:', error.message);
      console.error('Código:', error.code);
      
      toast({
        title: 'Erro ao atualizar subcategoria',
        description: error.message || error.code || 'Não foi possível atualizar a subcategoria.',
        variant: 'destructive',
      });
      
      // Não fechar o modal se houver erro
      // setEditSubcategoryDialogOpen(false);
      // setEditingSubcategory(null);
    } finally {
      setEditSubcategoryLoading(false);
      console.log('=== FIM DA ATUALIZAÇÃO (finally) ===');
    }
  };

  // Excluir categoria
  const handleDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    
    try {
      await CategoryService.deleteCategory(pendingDeleteCategory.id);
      toast({
        title: 'Categoria excluída',
        description: `${pendingDeleteCategory.label} foi excluída com sucesso.`,
      });
      setDeleteCategoryDialogOpen(false);
      setPendingDeleteCategory(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: 'Erro ao excluir categoria',
        description: error.message || 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
    }
  };

  // Excluir subcategoria
  const handleDeleteSubcategory = async () => {
    if (!pendingDeleteSubcategory) return;
    
    try {
      await CategoryService.deleteSubcategory(pendingDeleteSubcategory.id);
      toast({
        title: 'Subcategoria excluída',
        description: `${pendingDeleteSubcategory.label} foi excluída com sucesso.`,
      });
      setDeleteSubcategoryDialogOpen(false);
      setPendingDeleteSubcategory(null);
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir subcategoria:', error);
      toast({
        title: 'Erro ao excluir subcategoria',
        description: error.message || 'Não foi possível excluir a subcategoria.',
        variant: 'destructive',
      });
    }
  };

  // Abrir dialog para criar subcategoria
  const handleOpenCreateSubcategory = (category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setNewSubcategory({
      categoryId: category.id,
      key: '',
      label: '',
      slaHours: category.slaHours || 24,
      defaultAssignedTo: category.defaultAssignedTo,
      order: undefined
    });
    setCreateSubcategoryDialogOpen(true);
  };

  // Função para filtrar e ordenar categorias
  const getFilteredAndSortedCategories = () => {
    let filtered = [...categories];

    // Aplicar busca
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.label.toLowerCase().includes(searchLower) ||
        cat.key.toLowerCase().includes(searchLower) ||
        cat.subcategories?.some(sub => 
          sub.label.toLowerCase().includes(searchLower) ||
          sub.key.toLowerCase().includes(searchLower)
        )
      );
    }

    // Aplicar filtro de status
    if (statusFilter === 'active') {
      filtered = filtered.filter(cat => cat.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(cat => !cat.isActive);
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.label.localeCompare(b.label, 'pt-BR');
      } else if (sortBy === 'order') {
        comparison = (a.order || 0) - (b.order || 0);
      } else if (sortBy === 'created') {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        comparison = aDate - bDate;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredCategories = getFilteredAndSortedCategories();

  // Agrupar categorias por tag
  const groupedByTag = filteredCategories.reduce((acc, category) => {
    const tagKey = category.tag?.id || 'sem-tag';
    const tagLabel = category.tag?.label || 'Sem Tag';
    
    if (!acc[tagKey]) {
      acc[tagKey] = {
        tag: category.tag || null,
        tagLabel,
        categories: []
      };
    }
    acc[tagKey].categories.push(category);
    return acc;
  }, {} as Record<string, { tag: TagType | null; tagLabel: string; categories: Category[] }>);

  // Ordenar tags: sem tag primeiro, depois por ordem
  const sortedTagGroups = Object.entries(groupedByTag).sort((a, b) => {
    if (a[0] === 'sem-tag') return -1;
    if (b[0] === 'sem-tag') return 1;
    const tagA = a[1].tag;
    const tagB = b[1].tag;
    if (!tagA) return 1;
    if (!tagB) return -1;
    return (tagA.order || 0) - (tagB.order || 0);
  });

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || sortBy !== 'order';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('order');
    setSortDirection('asc');
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium - Mesmo estilo do Dashboard */}
      <div className="relative rounded-2xl overflow-hidden bg-[#2C2D2F] shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#F69F19]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#DE5532]/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Gerenciamento de Categorias
            </h1>
            <p className="text-slate-400 max-w-xl">
              Gerencie categorias, subcategorias, SLAs e atribuições automáticas do sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              onClick={loadData} 
              disabled={loading} 
              className="bg-white/5 text-white border-white/20 hover:bg-white/10"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={createCategoryDialogOpen} onOpenChange={setCreateCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#F69F19] hover:bg-[#e08e12] text-white border-0" size="sm">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Nova Categoria</DialogTitle>
                <DialogDescription>
                  Preencha os dados abaixo para criar uma nova categoria.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="category-key">Chave (Única) <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      id="category-key"
                      value={newCategory.key}
                      onChange={(e) => {
                        const formattedKey = e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        setNewCategory({ ...newCategory, key: formattedKey });
                        // Validar após um pequeno delay
                        setTimeout(() => validateCategoryKey(formattedKey), 500);
                      }}
                      placeholder="ex: protocolo"
                      className={categoryKeyError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {isValidatingCategoryKey && (
                      <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  {categoryKeyError ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {categoryKeyError}
                    </p>
                  ) : newCategory.key && !categoryKeyError && !isValidatingCategoryKey ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Chave disponível
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Usada internamente. Apenas letras minúsculas, números e underscores (_)</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category-label">Nome <span className="text-red-500">*</span></Label>
                  <Input
                    id="category-label"
                    value={newCategory.label}
                    onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                    placeholder="ex: Protocolo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category-sla">SLA Padrão (horas)</Label>
                  <Input
                    id="category-sla"
                    type="number"
                    min="0"
                    value={newCategory.slaHours || ''}
                    onChange={(e) => setNewCategory({ ...newCategory, slaHours: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="24"
                  />
                  <p className="text-xs text-slate-500">SLA padrão caso a subcategoria não tenha um específico</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category-assigned">Atribuição Automática</Label>
                  <Select
                    value={newCategory.defaultAssignedTo || 'none'}
                    onValueChange={(value) => setNewCategory({ ...newCategory, defaultAssignedTo: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger id="category-assigned">
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (Atribuição Manual)</SelectItem>
                      {supportUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.role === 'lawyer' ? 'Advogado' : 'Suporte'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Usuário que receberá automaticamente tickets desta categoria</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category-tag">Tag (Área de Negócio)</Label>
                  <Select
                    value={newCategory.tagId || 'none'}
                    onValueChange={(value) => setNewCategory({ ...newCategory, tagId: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger id="category-tag">
                      <SelectValue placeholder="Selecione uma tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {tags.filter(t => t.isActive).map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Área de negócio para organizar categorias (ex: Jurídico, T.I, Marketing)</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                    onClick={handleCreateCategory}
                    disabled={createCategoryLoading || !!categoryKeyError || isValidatingCategoryKey}
                    className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                  {createCategoryLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Categoria'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <Card className="border-[#F69F19]/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome da categoria ou subcategoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtro de Status */}
            <div className="w-full md:w-[180px]">
              <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordenação */}
            <div className="w-full md:w-[200px]">
              <Select value={`${sortBy}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-');
                setSortBy(field as 'name' | 'order' | 'created');
                setSortDirection(direction as 'asc' | 'desc');
              }}>
                <SelectTrigger>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
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

            {/* Botão Limpar Filtros */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {/* Contador de resultados */}
          {hasActiveFilters && (
            <div className="mt-4 text-sm text-slate-500">
              Mostrando {filteredCategories.length} de {categories.length} categorias
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações sobre Atribuição Automática - Colapsável */}
      <Card className="border-[#F69F19]/20 bg-gradient-to-r from-[#F69F19]/5 to-transparent">
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="assignment-info" className="border-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F69F19]/10">
                      <Info className="h-5 w-5 text-[#F69F19]" />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-[#2C2D2F]">
                      Como Funciona a Atribuição Automática de Tickets
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Clique para expandir e ver detalhes</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-[#2C2D2F] mb-1">🎯 Quando há um usuário atribuído:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Prioridade 1:</strong> Se a subcategoria tem um usuário atribuído, os tickets vão <strong>direto para ele</strong>.</li>
                      <li><strong>Prioridade 2:</strong> Se a categoria tem um usuário atribuído (mas a subcategoria não), os tickets vão para o usuário da categoria.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-[#2C2D2F] mb-1">📋 Quando não há ninguém atribuído:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Opção 1:</strong> Sistema busca um <strong>advogado online e ativo</strong> (com menor tempo de inatividade).</li>
                      <li><strong>Opção 2:</strong> Se não houver advogados online, busca <strong>qualquer advogado ativo</strong> disponível.</li>
                      <li>A distribuição é feita de forma justa, priorizando quem está menos ocupado.</li>
                    </ul>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-xs">
                      <strong>💡 Dica:</strong> Configure a atribuição automática quando quiser que tickets específicos sempre vão para uma pessoa ou área. 
                      Deixe "Nenhum" quando quiser que o sistema distribua automaticamente entre os advogados disponíveis.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <CardTitle>Categorias e Subcategorias</CardTitle>
          <CardDescription>
            Gerencie as categorias do sistema e configure SLAs e atribuições automáticas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-[#F69F19]" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma categoria encontrada. Crie uma nova categoria para começar.
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma categoria encontrada com os filtros aplicados.
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={clearFilters}
                  className="mt-2 text-[#F69F19]"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="multiple" value={expandedTags} onValueChange={setExpandedTags} className="w-full space-y-4">
              {sortedTagGroups.map(([tagKey, group]) => (
                <AccordionItem key={tagKey} value={tagKey} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 w-full">
                      {group.tag ? (
                        <div 
                          className="flex items-center justify-center w-10 h-10 rounded-full"
                          style={{ 
                            backgroundColor: `${group.tag.color}15`,
                            border: `2px solid ${group.tag.color}`
                          }}
                        >
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
                                  {category.slaHours && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      SLA: {category.slaHours}h
                                    </span>
                                  )}
                                  {category.defaultAssignedToName && (
                                    <span className="flex items-center gap-1">
                                      <UserIcon className="h-3 w-3" />
                                      Atribuição: {category.defaultAssignedToName}
                                    </span>
                                  )}
                                  <span>Subcategorias: {category.subcategories?.length || 0}</span>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pt-4 space-y-4 pl-7">
                              <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCreateSubcategory(category)}
                          className="border-[#F69F19] text-[#F69F19] hover:bg-[#F69F19]/5"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Adicionar Subcategoria
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setEditCategoryDialogOpen(true);
                          }}
                          className="border-[#DE5532] text-[#DE5532] hover:bg-[#DE5532]/5"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar Categoria
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => CategoryService.toggleCategoryStatus(category.id, !category.isActive).then(() => loadData())}
                          className={category.isActive ? 'border-orange-500 text-orange-600 hover:bg-orange-50' : 'border-green-500 text-green-600 hover:bg-green-50'}
                        >
                          {category.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingDeleteCategory(category);
                            setDeleteCategoryDialogOpen(true);
                          }}
                          className="border-[#BD2D29] text-[#BD2D29] hover:bg-[#BD2D29]/5"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
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
                            {category.subcategories.map((subcategory) => (
                              <TableRow key={subcategory.id}>
                                <TableCell className="font-medium">{subcategory.label}</TableCell>
                                <TableCell className="text-sm text-slate-500">{subcategory.key}</TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3 text-[#F69F19]" />
                                    {subcategory.slaHours}h
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {subcategory.defaultAssignedToName ? (
                                    <span className="text-sm text-slate-700">{subcategory.defaultAssignedToName}</span>
                                  ) : (
                                    <span className="text-sm text-slate-400 italic">Manual</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={subcategory.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                    {subcategory.isActive ? 'Ativa' : 'Inativa'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingSubcategory(subcategory);
                                        setEditSubcategoryDialogOpen(true);
                                      }}
                                      className="h-8 w-8"
                                    >
                                      <Pencil className="h-4 w-4 text-[#DE5532]" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => CategoryService.toggleSubcategoryStatus(subcategory.id, !subcategory.isActive).then(() => loadData())}
                                      className="h-8 w-8"
                                    >
                                      {subcategory.isActive ? (
                                        <Settings2 className="h-4 w-4 text-orange-600" />
                                      ) : (
                                        <Settings2 className="h-4 w-4 text-green-600" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setPendingDeleteSubcategory(subcategory);
                                        setDeleteSubcategoryDialogOpen(true);
                                      }}
                                      className="h-8 w-8"
                                    >
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

      {/* Dialog de Editar Categoria */}
      <Dialog open={editCategoryDialogOpen} onOpenChange={setEditCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>
              Atualize as informações da categoria.
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category-key">Chave</Label>
                <Input
                  id="edit-category-key"
                  value={editingCategory.key}
                  onChange={(e) => setEditingCategory({ ...editingCategory, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-slate-500">A chave não pode ser alterada.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category-label">Nome <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-category-label"
                  value={editingCategory.label}
                  onChange={(e) => setEditingCategory({ ...editingCategory, label: e.target.value })}
                  placeholder="ex: Protocolo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category-sla">SLA Padrão (horas)</Label>
                <Input
                  id="edit-category-sla"
                  type="number"
                  min="0"
                  value={editingCategory.slaHours || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slaHours: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="24"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category-assigned">Atribuição Automática</Label>
                <Select
                  value={editingCategory.defaultAssignedTo || 'none'}
                  onValueChange={(value) => setEditingCategory({ ...editingCategory, defaultAssignedTo: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="edit-category-assigned">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Atribuição Manual)</SelectItem>
                    {supportUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role === 'lawyer' ? 'Advogado' : 'Suporte'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category-tag">Tag (Área de Negócio)</Label>
                <Select
                  value={editingCategory.tagId || 'none'}
                  onValueChange={(value) => setEditingCategory({ ...editingCategory, tagId: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="edit-category-tag">
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {tags.filter(t => t.isActive).map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditCategoryDialogOpen(false)} disabled={editCategoryLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditCategory}
              disabled={editCategoryLoading}
              className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm"
            >
              {editCategoryLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criar Subcategoria */}
      <Dialog open={createSubcategoryDialogOpen} onOpenChange={setCreateSubcategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Nova Subcategoria</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para criar uma nova subcategoria para <strong>{selectedCategoryForSubcategory?.label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subcategory-key">Chave (Única) <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="subcategory-key"
                  value={newSubcategory.key}
                  onChange={(e) => {
                    const formattedKey = e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    setNewSubcategory({ ...newSubcategory, key: formattedKey });
                    // Validar após um pequeno delay
                    if (newSubcategory.categoryId) {
                      setTimeout(() => validateSubcategoryKey(formattedKey, newSubcategory.categoryId), 500);
                    }
                  }}
                  placeholder="ex: pedido_urgencia"
                  className={subcategoryKeyError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {isValidatingSubcategoryKey && (
                  <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              {subcategoryKeyError ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {subcategoryKeyError}
                </p>
              ) : newSubcategory.key && !subcategoryKeyError && !isValidatingSubcategoryKey ? (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Chave disponível
                </p>
              ) : (
                <p className="text-xs text-slate-500">Apenas letras minúsculas, números e underscores (_)</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategory-label">Nome <span className="text-red-500">*</span></Label>
              <Input
                id="subcategory-label"
                value={newSubcategory.label}
                onChange={(e) => setNewSubcategory({ ...newSubcategory, label: e.target.value })}
                placeholder="ex: Pedido de urgência"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategory-sla">SLA (horas) <span className="text-red-500">*</span></Label>
              <Input
                id="subcategory-sla"
                type="number"
                min="0"
                value={newSubcategory.slaHours}
                onChange={(e) => setNewSubcategory({ ...newSubcategory, slaHours: Number(e.target.value) })}
                placeholder="24"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcategory-assigned">Atribuição Automática</Label>
              <Select
                value={newSubcategory.defaultAssignedTo || 'none'}
                onValueChange={(value) => setNewSubcategory({ ...newSubcategory, defaultAssignedTo: value === 'none' ? undefined : value })}
              >
                <SelectTrigger id="subcategory-assigned">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Atribuição Manual ou Padrão da Categoria)</SelectItem>
                  {supportUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role === 'lawyer' ? 'Advogado' : 'Suporte'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Se não especificado, usa a atribuição da categoria ou atribuição manual</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleCreateSubcategory}
                    disabled={createSubcategoryLoading || !!subcategoryKeyError || isValidatingSubcategoryKey}
                    className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
              {createSubcategoryLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Subcategoria'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Editar Subcategoria */}
      <Dialog open={editSubcategoryDialogOpen} onOpenChange={setEditSubcategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Subcategoria</DialogTitle>
            <DialogDescription>
              Atualize as informações da subcategoria.
            </DialogDescription>
          </DialogHeader>
          {editingSubcategory && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-subcategory-key">Chave</Label>
                <Input
                  id="edit-subcategory-key"
                  value={editingSubcategory.key}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-slate-500">A chave não pode ser alterada.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subcategory-label">Nome <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-subcategory-label"
                  value={editingSubcategory.label}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, label: e.target.value })}
                  placeholder="ex: Pedido de urgência"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subcategory-sla">SLA (horas) <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-subcategory-sla"
                  type="number"
                  min="0"
                  value={editingSubcategory.slaHours}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, slaHours: Number(e.target.value) })}
                  placeholder="24"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subcategory-assigned">Atribuição Automática</Label>
                <Select
                  value={editingSubcategory.defaultAssignedTo || 'none'}
                  onValueChange={(value) => {
                    console.log('Mudança no Select de atribuição:', value);
                    const newValue = value === 'none' || value === '' ? undefined : value;
                    console.log('Novo valor para defaultAssignedTo:', newValue);
                    setEditingSubcategory({ 
                      ...editingSubcategory, 
                      defaultAssignedTo: newValue 
                    });
                  }}
                >
                  <SelectTrigger id="edit-subcategory-assigned">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Atribuição Manual ou Padrão da Categoria)</SelectItem>
                    {supportUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role === 'lawyer' ? 'Advogado' : 'Suporte'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingSubcategory.defaultAssignedTo && (
                  <p className="text-xs text-slate-500">
                    Usuário selecionado: {supportUsers.find(u => u.id === editingSubcategory.defaultAssignedTo)?.name}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditSubcategoryDialogOpen(false)} disabled={editSubcategoryLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSubcategory}
              disabled={editSubcategoryLoading}
              className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm"
            >
              {editSubcategoryLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão de Categoria */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px] border-[#BD2D29]/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-[#2C2D2F]">
                Excluir Categoria Permanentemente
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 mt-4">
              Tem certeza que deseja <strong className="text-red-600 font-semibold">excluir permanentemente</strong> a categoria{' '}
              <strong className="text-[#2C2D2F]">{pendingDeleteCategory?.label}</strong>?
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">⚠️ ATENÇÃO: Esta ação não pode ser desfeita!</p>
                    <p className="mb-2 text-red-700">O que acontece:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li>A categoria será removida permanentemente do sistema</li>
                      <li>Todas as subcategorias associadas serão excluídas</li>
                      <li>Tickets existentes que usam esta categoria serão mantidos, mas a categoria não estará mais disponível</li>
                      <li>Esta ação não pode ser revertida</li>
                    </ul>
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-orange-800 text-xs font-medium">
                        💡 Recomendamos <strong>DESATIVAR</strong> a categoria em vez de excluí-la para preservar dados históricos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel
              onClick={() => {
                setDeleteCategoryDialogOpen(false);
                setPendingDeleteCategory(null);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Confirmação de Exclusão de Subcategoria */}
      <AlertDialog open={deleteSubcategoryDialogOpen} onOpenChange={setDeleteSubcategoryDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px] border-[#BD2D29]/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-[#2C2D2F]">
                Excluir Subcategoria Permanentemente
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 mt-4">
              Tem certeza que deseja <strong className="text-red-600 font-semibold">excluir permanentemente</strong> a subcategoria{' '}
              <strong className="text-[#2C2D2F]">{pendingDeleteSubcategory?.label}</strong>?
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">⚠️ ATENÇÃO: Esta ação não pode ser desfeita!</p>
                    <p className="mb-2 text-red-700">O que acontece:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li>A subcategoria será removida permanentemente do sistema</li>
                      <li>Tickets existentes que usam esta subcategoria serão mantidos, mas a subcategoria não estará mais disponível</li>
                      <li>Esta ação não pode ser revertida</li>
                    </ul>
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-orange-800 text-xs font-medium">
                        💡 Recomendamos <strong>DESATIVAR</strong> a subcategoria em vez de excluí-la para preservar dados históricos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel
              onClick={() => {
                setDeleteSubcategoryDialogOpen(false);
                setPendingDeleteSubcategory(null);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubcategory}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
