import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Tag, FolderTree, MessageSquare } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useQuickReplyTemplates } from '@/hooks/useQuickReplyTemplates';
import CategoriesTab from '@/components/categories/CategoriesTab';
import FrentesTab from '@/components/categories/FrentesTab';
import QuickRepliesTab from '@/components/categories/QuickRepliesTab';
import CategoryFormDialog from '@/components/categories/CategoryFormDialog';
import SubcategoryFormDialog from '@/components/categories/SubcategoryFormDialog';
import FrenteFormDialog from '@/components/categories/FrenteFormDialog';
import QuickReplyFormDialog from '@/components/categories/QuickReplyFormDialog';
import DeleteConfirmDialog from '@/components/categories/DeleteConfirmDialog';
import type { Tag as TagType } from '@/services/categoryService';
import { getInitialCategoryManagementTab } from './categoryManagementTabs';
import { getSettingsRedirectFromCategorySearch } from './settingsTabs';

export default function CategoryManagement() {
  const cat = useCategories();
  const evo = useEvolutionApi(cat.loadData);
  const quickReplies = useQuickReplyTemplates();
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const settingsRedirect = getSettingsRedirectFromCategorySearch(search);
  const initialTab = getInitialCategoryManagementTab(search);

  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [createSubcategoryDialogOpen, setCreateSubcategoryDialogOpen] = useState(false);
  const [editSubcategoryDialogOpen, setEditSubcategoryDialogOpen] = useState(false);
  const [createFrenteDialogOpen, setCreateFrenteDialogOpen] = useState(false);
  const [editFrenteDialogOpen, setEditFrenteDialogOpen] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [deleteSubcategoryDialogOpen, setDeleteSubcategoryDialogOpen] = useState(false);
  const [deleteFrenteDialogOpen, setDeleteFrenteDialogOpen] = useState(false);

  if (settingsRedirect) return <Navigate to={settingsRedirect} replace />;
  if (!cat.canAccess) return null;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 py-5 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#2C2D2F] text-white">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#2C2D2F]">Categorias</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Organize frentes, categorias e respostas rápidas do atendimento.
              </p>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={cat.loadData} disabled={cat.loading} size="sm" title="Atualizar dados">
              <RefreshCw className={`h-4 w-4 ${cat.loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button className="bg-[#2C2D2F] text-white hover:bg-black" size="sm" onClick={() => setCreateCategoryDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue={initialTab} className="w-full">
        <div className="overflow-x-auto border-b border-slate-200">
        <TabsList className="h-11 w-max min-w-full justify-start rounded-none bg-transparent p-0">
          <TabsTrigger value="categorias" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <FolderTree className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="frentes" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <Tag className="h-4 w-4" />
            Frentes de Atuação
          </TabsTrigger>
          <TabsTrigger value="respostas-rapidas" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <MessageSquare className="h-4 w-4" />
            Respostas Rápidas
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="categorias" className="mt-6">
          <CategoriesTab
            loading={cat.loading}
            categories={cat.categories}
            filteredCategories={cat.filteredCategories}
            sortedTagGroups={cat.sortedTagGroups}
            tags={cat.tags}
            supportUsers={cat.supportUsers}
            getRoleLabel={cat.getRoleLabel}
            searchTerm={cat.searchTerm}
            setSearchTerm={cat.setSearchTerm}
            statusFilter={cat.statusFilter}
            setStatusFilter={cat.setStatusFilter}
            frenteFilter={cat.frenteFilter}
            setFrenteFilter={cat.setFrenteFilter}
            sortBy={cat.sortBy}
            setSortBy={cat.setSortBy}
            sortDirection={cat.sortDirection}
            setSortDirection={cat.setSortDirection}
            hasActiveFilters={cat.hasActiveFilters}
            clearFilters={cat.clearFilters}
            bulkAssignUserId={cat.bulkAssignUserId}
            setBulkAssignUserId={cat.setBulkAssignUserId}
            bulkAssignFrenteId={cat.bulkAssignFrenteId}
            setBulkAssignFrenteId={cat.setBulkAssignFrenteId}
            bulkAssignCategoryId={cat.bulkAssignCategoryId}
            setBulkAssignCategoryId={cat.setBulkAssignCategoryId}
            bulkAssignFrenteCategories={cat.bulkAssignFrenteCategories}
            bulkAssignTarget={cat.bulkAssignTarget}
            setBulkAssignTarget={cat.setBulkAssignTarget}
            bulkAssignApplying={cat.bulkAssignApplying}
            onApplyBulkAssign={cat.handleBulkAssign}
            expandedCategories={cat.expandedCategories}
            setExpandedCategories={cat.setExpandedCategories}
            expandedTags={cat.expandedTags}
            setExpandedTags={cat.setExpandedTags}
            onCreateSubcategory={(c) => { cat.handleOpenCreateSubcategory(c); setCreateSubcategoryDialogOpen(true); }}
            onEditCategory={(c) => { cat.setEditingCategory(c); setEditCategoryDialogOpen(true); }}
            onDeleteCategory={(c) => { cat.setPendingDeleteCategory(c); setDeleteCategoryDialogOpen(true); }}
            onToggleCategoryStatus={cat.handleToggleCategoryStatus}
            onEditSubcategory={(s) => { cat.setEditingSubcategory(s); setEditSubcategoryDialogOpen(true); }}
            onDeleteSubcategory={(s) => { cat.setPendingDeleteSubcategory(s); setDeleteSubcategoryDialogOpen(true); }}
            onToggleSubcategoryStatus={cat.handleToggleSubcategoryStatus}
            onCreateCategoryForFrente={(tag) => {
              cat.setNewCategory({
                key: '', label: '', slaHours: undefined,
                defaultAssignedTo: undefined, tagId: tag?.id, order: undefined,
              });
              cat.setCategoryKeyError(null);
              setCreateCategoryDialogOpen(true);
            }}
            onToggleFrenteStatus={cat.handleToggleFrenteStatus}
          />
        </TabsContent>

        <TabsContent value="frentes" className="mt-6">
          <FrentesTab
            loading={cat.loading}
            tags={cat.tags}
            onCreateFrente={() => { cat.setNewFrente({ key: '', label: '', color: '#3B82F6' }); setCreateFrenteDialogOpen(true); }}
            onEditFrente={(t) => { cat.setEditingFrente(t); setEditFrenteDialogOpen(true); }}
            onDeleteFrente={(t) => { cat.setPendingDeleteFrente(t); setDeleteFrenteDialogOpen(true); }}
            onToggleStatus={cat.handleToggleFrenteStatus}
          />
        </TabsContent>

        <TabsContent value="respostas-rapidas" className="mt-6">
          <QuickRepliesTab
            loading={quickReplies.loading}
            templates={quickReplies.templates}
            onCreate={quickReplies.openCreateDialog}
            onEdit={quickReplies.openEditDialog}
            onDelete={(t) => quickReplies.setPendingDelete(t)}
            onMove={(t, dir) => void quickReplies.moveTemplate(t, dir)}
          />
        </TabsContent>
      </Tabs>

      {/* ---- Dialogs ---- */}

      {/* Create Category */}
      <CategoryFormDialog
        mode="create"
        open={createCategoryDialogOpen}
        onOpenChange={setCreateCategoryDialogOpen}
        data={cat.newCategory}
        setData={cat.setNewCategory}
        loading={cat.createCategoryLoading}
        onSubmit={cat.handleCreateCategory}
        tags={cat.tags}
        supportUsers={cat.supportUsers}
        getRoleLabel={cat.getRoleLabel}
      />

      {/* Edit Category */}
      {cat.editingCategory && (
        <CategoryFormDialog
          mode="edit"
          open={editCategoryDialogOpen}
          onOpenChange={setEditCategoryDialogOpen}
          data={cat.editingCategory}
          setData={cat.setEditingCategory as (v: any) => void}
          loading={cat.editCategoryLoading}
          onSubmit={cat.handleEditCategory}
          tags={cat.tags}
          supportUsers={cat.supportUsers}
          getRoleLabel={cat.getRoleLabel}
        />
      )}

      {/* Create Subcategory */}
      <SubcategoryFormDialog
        mode="create"
        open={createSubcategoryDialogOpen}
        onOpenChange={setCreateSubcategoryDialogOpen}
        parentCategory={cat.selectedCategoryForSubcategory}
        data={cat.newSubcategory}
        setData={cat.setNewSubcategory}
        loading={cat.createSubcategoryLoading}
        onSubmit={cat.handleCreateSubcategory}
        supportUsers={cat.supportUsers}
        getRoleLabel={cat.getRoleLabel}
        whatsappChats={evo.whatsappChats}
        whatsappChatsLoading={evo.whatsappChatsLoading}
        onLoadChats={() => void evo.loadWhatsappChats()}
      />

      {/* Edit Subcategory */}
      {cat.editingSubcategory && (
        <SubcategoryFormDialog
          mode="edit"
          open={editSubcategoryDialogOpen}
          onOpenChange={setEditSubcategoryDialogOpen}
          data={cat.editingSubcategory}
          setData={cat.setEditingSubcategory as (v: any) => void}
          loading={cat.editSubcategoryLoading}
          onSubmit={cat.handleEditSubcategory}
          supportUsers={cat.supportUsers}
          getRoleLabel={cat.getRoleLabel}
          whatsappChats={evo.whatsappChats}
          whatsappChatsLoading={evo.whatsappChatsLoading}
          onLoadChats={() => void evo.loadWhatsappChats()}
        />
      )}

      {/* Create Frente */}
      <FrenteFormDialog
        mode="create"
        open={createFrenteDialogOpen}
        onOpenChange={setCreateFrenteDialogOpen}
        data={cat.newFrente}
        setData={cat.setNewFrente}
        loading={cat.createFrenteLoading}
        onSubmit={cat.handleCreateFrente}
      />

      {/* Edit Frente */}
      {cat.editingFrente && (
        <FrenteFormDialog
          mode="edit"
          open={editFrenteDialogOpen}
          onOpenChange={setEditFrenteDialogOpen}
          data={cat.editingFrente}
          setData={cat.setEditingFrente as (v: TagType) => void}
          loading={cat.editFrenteLoading}
          onSubmit={cat.handleEditFrente}
        />
      )}

      {/* Create Quick Reply */}
      <QuickReplyFormDialog
        mode="create"
        open={quickReplies.createDialogOpen}
        onOpenChange={quickReplies.setCreateDialogOpen}
        data={quickReplies.createForm}
        setData={quickReplies.setCreateForm}
        loading={quickReplies.createLoading}
        onSubmit={quickReplies.handleCreate}
      />

      {/* Edit Quick Reply */}
      {quickReplies.editingTemplate && (
        <QuickReplyFormDialog
          mode="edit"
          open={!!quickReplies.editingTemplate}
          onOpenChange={(open) => { if (!open) quickReplies.setEditingTemplate(null); }}
          data={quickReplies.editForm}
          setData={quickReplies.setEditForm}
          loading={quickReplies.editLoading}
          onSubmit={quickReplies.handleEdit}
        />
      )}

      {/* Delete Confirmations */}
      <DeleteConfirmDialog
        open={!!quickReplies.pendingDelete}
        onOpenChange={(open) => { if (!open) quickReplies.setPendingDelete(null); }}
        title="Excluir Resposta Rápida"
        itemLabel={quickReplies.pendingDelete?.label}
        onConfirm={() => { void quickReplies.handleDelete(); }}
        onCancel={() => quickReplies.setPendingDelete(null)}
      />
      <DeleteConfirmDialog
        open={deleteCategoryDialogOpen}
        onOpenChange={setDeleteCategoryDialogOpen}
        title="Excluir Categoria Permanentemente"
        itemLabel={cat.pendingDeleteCategory?.label}
        onConfirm={() => { cat.handleDeleteCategory(); setDeleteCategoryDialogOpen(false); }}
        onCancel={() => cat.setPendingDeleteCategory(null)}
      />
      <DeleteConfirmDialog
        open={deleteSubcategoryDialogOpen}
        onOpenChange={setDeleteSubcategoryDialogOpen}
        title="Excluir Subcategoria Permanentemente"
        itemLabel={cat.pendingDeleteSubcategory?.label}
        onConfirm={() => { cat.handleDeleteSubcategory(); setDeleteSubcategoryDialogOpen(false); }}
        onCancel={() => cat.setPendingDeleteSubcategory(null)}
      />
      <DeleteConfirmDialog
        open={deleteFrenteDialogOpen}
        onOpenChange={setDeleteFrenteDialogOpen}
        title="Excluir Frente de Atuação"
        itemLabel={cat.pendingDeleteFrente?.label}
        onConfirm={() => { cat.handleDeleteFrente(); setDeleteFrenteDialogOpen(false); }}
        onCancel={() => cat.setPendingDeleteFrente(null)}
      />
    </div>
  );
}
