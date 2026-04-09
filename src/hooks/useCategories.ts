import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CategoryService,
  Category,
  Subcategory,
  CreateCategoryData,
  CreateSubcategoryData,
  CreateTagData,
  Tag as TagType,
} from '@/services/categoryService';
import { UserService } from '@/services/userService';
import { User } from '@/types';
import { toast } from 'sonner';

export type SortField = 'name' | 'order' | 'created';
export type SortDir = 'asc' | 'desc';
export type StatusFilter = 'all' | 'active' | 'inactive';

export function useCategories() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { has, loading: permissionsLoading } = usePermissions();

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // CRUD loading
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [editCategoryLoading, setEditCategoryLoading] = useState(false);
  const [createSubcategoryLoading, setCreateSubcategoryLoading] = useState(false);
  const [editSubcategoryLoading, setEditSubcategoryLoading] = useState(false);
  const [createFrenteLoading, setCreateFrenteLoading] = useState(false);
  const [editFrenteLoading, setEditFrenteLoading] = useState(false);

  // Form state
  const [newCategory, setNewCategory] = useState<CreateCategoryData>({
    key: '', label: '', slaHours: undefined, defaultAssignedTo: undefined, tagId: undefined, order: undefined,
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | null>(null);
  const [newSubcategory, setNewSubcategory] = useState<CreateSubcategoryData>({
    categoryId: '', key: '', label: '', slaHours: 24, defaultAssignedTo: undefined, order: undefined,
    whatsappNotifyEnabled: false, whatsappMessageTemplate: '', whatsappRecipient: '',
  });
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [newFrente, setNewFrente] = useState<CreateTagData>({ key: '', label: '', color: '#3B82F6' });
  const [editingFrente, setEditingFrente] = useState<TagType | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<Category | null>(null);
  const [pendingDeleteSubcategory, setPendingDeleteSubcategory] = useState<Subcategory | null>(null);
  const [pendingDeleteFrente, setPendingDeleteFrente] = useState<TagType | null>(null);

  // Key validation
  const [categoryKeyError, setCategoryKeyError] = useState<string | null>(null);
  const [subcategoryKeyError, setSubcategoryKeyError] = useState<string | null>(null);
  const [isValidatingCategoryKey, setIsValidatingCategoryKey] = useState(false);
  const [isValidatingSubcategoryKey, setIsValidatingSubcategoryKey] = useState(false);

  // Search / filter / sort
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDir>('asc');

  // Accordion state
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedTags, setExpandedTags] = useState<string[]>([]);

  // Permission guard
  useEffect(() => {
    if (!user) return;
    if (permissionsLoading) return;
    if (has('manage_categories')) return;
    const isAdmin = String(user.role ?? '').toLowerCase() === 'admin';
    if (isAdmin) return;
    toast.error('Acesso negado', { description: 'Você não tem permissão para acessar esta página.' });
    navigate('/tickets');
  }, [user, has, permissionsLoading, navigate]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesData, usersData, tagsData] = await Promise.all([
        CategoryService.getAllCategories(true),
        UserService.getSupportUsers(),
        CategoryService.getAllTags(true),
      ]);
      setCategories(categoriesData);
      setSupportUsers(usersData);
      setTags(tagsData);
    } catch {
      toast.error('Erro ao carregar categorias', { description: 'Não foi possível carregar as categorias.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && has('manage_categories')) {
      loadData();
    }
  }, [user, has, loadData]);

  // --- Key validation ---
  const validateCategoryKey = async (key: string) => {
    if (!key) { setCategoryKeyError(null); return; }
    setIsValidatingCategoryKey(true);
    const fmt = CategoryService.validateKeyFormat(key);
    if (!fmt.valid) { setCategoryKeyError(fmt.error || 'Formato inválido'); setIsValidatingCategoryKey(false); return; }
    try {
      const exists = await CategoryService.categoryKeyExists(key);
      setCategoryKeyError(exists ? `A chave "${key}" já está em uso por outra categoria.` : null);
    } catch {
      setCategoryKeyError('Erro ao verificar disponibilidade da chave.');
    } finally {
      setIsValidatingCategoryKey(false);
    }
  };

  const validateSubcategoryKey = async (key: string, categoryId: string) => {
    if (!key || !categoryId) { setSubcategoryKeyError(null); return; }
    setIsValidatingSubcategoryKey(true);
    const fmt = CategoryService.validateKeyFormat(key);
    if (!fmt.valid) { setSubcategoryKeyError(fmt.error || 'Formato inválido'); setIsValidatingSubcategoryKey(false); return; }
    try {
      const exists = await CategoryService.subcategoryKeyExists(categoryId, key);
      setSubcategoryKeyError(exists ? `A chave "${key}" já está em uso por outra subcategoria nesta categoria.` : null);
    } catch {
      setSubcategoryKeyError('Erro ao verificar disponibilidade da chave.');
    } finally {
      setIsValidatingSubcategoryKey(false);
    }
  };

  // --- Category CRUD ---
  const handleCreateCategory = async () => {
    if (!newCategory.key || !newCategory.label) {
      toast.error('Campos obrigatórios', { description: 'Preencha pelo menos a chave e o nome da categoria.' });
      return;
    }
    try {
      setCreateCategoryLoading(true);
      await CategoryService.createCategory(newCategory);
      toast.success('Categoria criada', { description: `${newCategory.label} foi criada com sucesso.` });
      setNewCategory({ key: '', label: '', slaHours: undefined, defaultAssignedTo: undefined, tagId: undefined, order: undefined });
      loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar categoria', { description: error.message || 'Não foi possível criar a categoria.' });
      return false;
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.label) return false;
    try {
      setEditCategoryLoading(true);
      const val = editingCategory.defaultAssignedTo;
      const sanitized = (val === '' || val === 'none' || !val) ? null : val;
      await CategoryService.updateCategory(editingCategory.id, {
        key: editingCategory.key, label: editingCategory.label,
        slaHours: editingCategory.slaHours, defaultAssignedTo: sanitized,
        tagId: editingCategory.tagId || undefined, order: editingCategory.order,
      });
      toast.success('Categoria atualizada', { description: `${editingCategory.label} foi atualizada com sucesso.` });
      setEditingCategory(null);
      loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar categoria', { description: error.message || 'Não foi possível atualizar a categoria.' });
      return false;
    } finally {
      setEditCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    try {
      await CategoryService.deleteCategory(pendingDeleteCategory.id);
      toast.success('Categoria excluída', { description: `${pendingDeleteCategory.label} foi excluída com sucesso.` });
      setPendingDeleteCategory(null);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao excluir categoria', { description: error.message || 'Não foi possível excluir a categoria.' });
    }
  };

  // --- Subcategory CRUD ---
  const handleCreateSubcategory = async () => {
    if (!newSubcategory.key || !newSubcategory.label || !newSubcategory.categoryId) {
      toast.error('Campos obrigatórios', { description: 'Preencha todos os campos obrigatórios.' });
      return false;
    }
    const fmt = CategoryService.validateKeyFormat(newSubcategory.key);
    if (!fmt.valid) { toast.error('Chave inválida', { description: fmt.error || 'A chave não está no formato correto.' }); return false; }
    try {
      const exists = await CategoryService.subcategoryKeyExists(newSubcategory.categoryId, newSubcategory.key);
      if (exists) { toast.error('Chave já existe', { description: `A chave "${newSubcategory.key}" já está em uso nesta categoria.` }); return false; }
    } catch {
      toast.error('Erro ao validar chave', { description: 'Não foi possível verificar se a chave já existe.' });
      return false;
    }
    try {
      setCreateSubcategoryLoading(true);
      await CategoryService.createSubcategory(newSubcategory);
      toast.success('Subcategoria criada', { description: `${newSubcategory.label} foi criada com sucesso.` });
      setNewSubcategory({ categoryId: '', key: '', label: '', slaHours: 24, defaultAssignedTo: undefined, order: undefined, whatsappNotifyEnabled: false, whatsappMessageTemplate: '', whatsappRecipient: '' });
      setSubcategoryKeyError(null);
      setSelectedCategoryForSubcategory(null);
      loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar subcategoria', { description: error.message || 'Não foi possível criar a subcategoria.' });
      return false;
    } finally {
      setCreateSubcategoryLoading(false);
    }
  };

  const handleEditSubcategory = async () => {
    if (!editingSubcategory || !editingSubcategory.label) {
      toast.error('Dados inválidos', { description: 'Preencha todos os campos obrigatórios.' });
      return false;
    }
    try {
      setEditSubcategoryLoading(true);
      const val = editingSubcategory.defaultAssignedTo;
      const sanitized = (val === '' || val === 'none' || !val) ? null : val;
      await CategoryService.updateSubcategory(editingSubcategory.id, {
        categoryId: editingSubcategory.categoryId, key: editingSubcategory.key,
        label: editingSubcategory.label, slaHours: editingSubcategory.slaHours,
        defaultAssignedTo: sanitized, order: editingSubcategory.order,
        whatsappNotifyEnabled: editingSubcategory.whatsappNotifyEnabled ?? false,
        whatsappMessageTemplate: editingSubcategory.whatsappMessageTemplate ?? '',
        whatsappRecipient: editingSubcategory.whatsappRecipient ?? '',
      });
      toast.success('Subcategoria atualizada', { description: `${editingSubcategory.label} foi atualizada com sucesso.` });
      setEditingSubcategory(null);
      await loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar subcategoria', { description: error.message || 'Não foi possível atualizar a subcategoria.' });
      return false;
    } finally {
      setEditSubcategoryLoading(false);
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!pendingDeleteSubcategory) return;
    try {
      await CategoryService.deleteSubcategory(pendingDeleteSubcategory.id);
      toast.success('Subcategoria excluída', { description: `${pendingDeleteSubcategory.label} foi excluída com sucesso.` });
      setPendingDeleteSubcategory(null);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao excluir subcategoria', { description: error.message || 'Não foi possível excluir a subcategoria.' });
    }
  };

  const handleOpenCreateSubcategory = (category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setNewSubcategory({
      categoryId: category.id, key: '', label: '',
      slaHours: category.slaHours || 24, defaultAssignedTo: category.defaultAssignedTo,
      order: undefined, whatsappNotifyEnabled: false, whatsappMessageTemplate: '', whatsappRecipient: '',
    });
  };

  // --- Frentes (Tags) CRUD ---
  const handleCreateFrente = async () => {
    if (!newFrente.key?.trim() || !newFrente.label?.trim()) {
      toast.error('Campos obrigatórios', { description: 'Preencha chave e nome da frente de atuação.' });
      return false;
    }
    const key = newFrente.key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) { toast.error('Chave inválida', { description: 'Use apenas letras minúsculas, números e underscores.' }); return false; }
    try {
      setCreateFrenteLoading(true);
      await CategoryService.createTag({ ...newFrente, key });
      toast.success('Frente de atuação criada', { description: `${newFrente.label} foi criada com sucesso.` });
      setNewFrente({ key: '', label: '', color: '#3B82F6' });
      loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar frente de atuação', { description: error.message || 'Não foi possível criar a frente de atuação.' });
      return false;
    } finally {
      setCreateFrenteLoading(false);
    }
  };

  const handleEditFrente = async () => {
    if (!editingFrente) return false;
    if (!editingFrente.label?.trim()) { toast.error('Nome obrigatório'); return false; }
    try {
      setEditFrenteLoading(true);
      await CategoryService.updateTag(editingFrente.id, { label: editingFrente.label, color: editingFrente.color });
      toast.success('Frente de atuação atualizada', { description: `${editingFrente.label} foi atualizada.` });
      setEditingFrente(null);
      loadData();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar frente de atuação', { description: error.message || 'Não foi possível atualizar.' });
      return false;
    } finally {
      setEditFrenteLoading(false);
    }
  };

  const handleDeleteFrente = async () => {
    if (!pendingDeleteFrente) return;
    try {
      await CategoryService.deleteTag(pendingDeleteFrente.id);
      toast.success('Frente de atuação excluída', { description: `${pendingDeleteFrente.label} foi excluída.` });
      setPendingDeleteFrente(null);
      loadData();
    } catch (error: any) {
      toast.error('Erro ao excluir frente de atuação', { description: error.message || 'Não foi possível excluir.' });
    }
  };

  const handleToggleFrenteStatus = async (tag: TagType) => {
    try {
      await CategoryService.toggleTagStatus(tag.id, !tag.isActive);
      toast.success(tag.isActive ? 'Frente inativada' : 'Frente ativada', { description: `${tag.label} foi ${tag.isActive ? 'inativada' : 'ativada'}.` });
      loadData();
    } catch (error: any) {
      toast.error('Erro ao alterar status', { description: error.message || 'Não foi possível alterar o status.' });
    }
  };

  // --- Filtering / Sorting ---
  const getFilteredAndSortedCategories = useCallback(() => {
    let filtered = [...categories];
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(cat =>
        cat.label.toLowerCase().includes(s) || cat.key.toLowerCase().includes(s) ||
        cat.subcategories?.some(sub => sub.label.toLowerCase().includes(s) || sub.key.toLowerCase().includes(s))
      );
    }
    filtered = filtered.filter((cat) => !cat.tag || cat.tag.isActive !== false);
    if (statusFilter === 'active') filtered = filtered.filter(cat => cat.isActive);
    else if (statusFilter === 'inactive') filtered = filtered.filter(cat => !cat.isActive);
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.label.localeCompare(b.label, 'pt-BR');
      else if (sortBy === 'order') cmp = (a.order || 0) - (b.order || 0);
      else if (sortBy === 'created') cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [categories, searchTerm, statusFilter, sortBy, sortDirection]);

  const filteredCategories = getFilteredAndSortedCategories();

  const groupedByTag = filteredCategories.reduce((acc, category) => {
    const tagKey = category.tag?.id || 'sem-tag';
    const tagLabel = category.tag?.label || 'Sem Frente de Atuação';
    if (!acc[tagKey]) acc[tagKey] = { tag: category.tag || null, tagLabel, categories: [] };
    acc[tagKey].categories.push(category);
    return acc;
  }, {} as Record<string, { tag: TagType | null; tagLabel: string; categories: Category[] }>);

  const sortedTagGroups = Object.entries(groupedByTag).sort((a, b) => {
    if (a[0] === 'sem-tag') return -1;
    if (b[0] === 'sem-tag') return 1;
    return ((a[1].tag?.order || 0) - (b[1].tag?.order || 0));
  });

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || sortBy !== 'order';
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setSortBy('order'); setSortDirection('asc'); };

  const getRoleLabel = (role: string) => {
    switch (role) { case 'admin': return 'Admin'; case 'lawyer': return 'Advogado'; case 'support': return 'Suporte'; default: return 'Suporte'; }
  };

  const canAccess = !!user && has('manage_categories');

  return {
    canAccess, loading, categories, tags, supportUsers, loadData,
    // Category
    newCategory, setNewCategory, editingCategory, setEditingCategory,
    createCategoryLoading, editCategoryLoading,
    handleCreateCategory, handleEditCategory, handleDeleteCategory,
    pendingDeleteCategory, setPendingDeleteCategory,
    categoryKeyError, setCategoryKeyError, isValidatingCategoryKey, validateCategoryKey,
    // Subcategory
    newSubcategory, setNewSubcategory, editingSubcategory, setEditingSubcategory,
    selectedCategoryForSubcategory, setSelectedCategoryForSubcategory,
    createSubcategoryLoading, editSubcategoryLoading,
    handleCreateSubcategory, handleEditSubcategory, handleDeleteSubcategory,
    handleOpenCreateSubcategory,
    pendingDeleteSubcategory, setPendingDeleteSubcategory,
    subcategoryKeyError, setSubcategoryKeyError, isValidatingSubcategoryKey, validateSubcategoryKey,
    // Frentes
    newFrente, setNewFrente, editingFrente, setEditingFrente,
    createFrenteLoading, editFrenteLoading,
    handleCreateFrente, handleEditFrente, handleDeleteFrente, handleToggleFrenteStatus,
    pendingDeleteFrente, setPendingDeleteFrente,
    // Filters
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    sortBy, setSortBy, sortDirection, setSortDirection,
    filteredCategories, sortedTagGroups, hasActiveFilters, clearFilters,
    expandedCategories, setExpandedCategories, expandedTags, setExpandedTags,
    getRoleLabel,
  };
}
