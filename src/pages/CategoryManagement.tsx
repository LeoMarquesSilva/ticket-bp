import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, RefreshCw, Tag, MessageCircle, FolderTree } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import CategoriesTab from '@/components/categories/CategoriesTab';
import FrentesTab from '@/components/categories/FrentesTab';
import WhatsAppTab from '@/components/categories/WhatsAppTab';
import CategoryFormDialog from '@/components/categories/CategoryFormDialog';
import SubcategoryFormDialog from '@/components/categories/SubcategoryFormDialog';
import FrenteFormDialog from '@/components/categories/FrenteFormDialog';
import DeleteConfirmDialog from '@/components/categories/DeleteConfirmDialog';
import type { Tag as TagType } from '@/services/categoryService';

export default function CategoryManagement() {
  const cat = useCategories();
  const evo = useEvolutionApi(cat.loadData);

  // Load Evolution data on mount
  useEffect(() => {
    if (cat.canAccess) {
      evo.loadInstanceName();
      evo.loadEvolutionInstances();
    }
  }, [cat.canAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dialog state
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [createSubcategoryDialogOpen, setCreateSubcategoryDialogOpen] = useState(false);
  const [editSubcategoryDialogOpen, setEditSubcategoryDialogOpen] = useState(false);
  const [createFrenteDialogOpen, setCreateFrenteDialogOpen] = useState(false);
  const [editFrenteDialogOpen, setEditFrenteDialogOpen] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [deleteSubcategoryDialogOpen, setDeleteSubcategoryDialogOpen] = useState(false);
  const [deleteFrenteDialogOpen, setDeleteFrenteDialogOpen] = useState(false);

  // WhatsApp tag groups filtered for the bulk config filter
  const filteredWhatsappTagGroups = useMemo(() =>
    cat.sortedTagGroups.filter(([tagKey, group]) => {
      if (evo.whatsappFrenteFilter === 'all') return true;
      if (evo.whatsappFrenteFilter === 'sem-frente') return tagKey === 'sem-tag';
      return group.tag?.id === evo.whatsappFrenteFilter;
    }),
  [cat.sortedTagGroups, evo.whatsappFrenteFilter]);

  const bulkTargetSubcategories = useMemo(() =>
    filteredWhatsappTagGroups.flatMap(([, g]) => g.categories.flatMap((c) => c.subcategories ?? [])),
  [filteredWhatsappTagGroups]);

  // Count active WhatsApp notifications for badge
  const whatsappActiveCount = useMemo(() =>
    cat.categories.flatMap(c => c.subcategories ?? []).filter(s => s.whatsappNotifyEnabled).length,
  [cat.categories]);

  if (!cat.canAccess) return null;

  return (
    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-[#2C2D2F] shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#F69F19]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#DE5532]/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Gerenciamento de Categorias</h1>
            <p className="text-slate-400 max-w-xl">
              Gerencie categorias, subcategorias, frentes de atuação e notificações WhatsApp do sistema.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={cat.loadData} disabled={cat.loading} className="bg-white/5 text-white border-white/20 hover:bg-white/10" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${cat.loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button className="bg-[#F69F19] hover:bg-[#e08e12] text-white border-0" size="sm" onClick={() => setCreateCategoryDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="categorias" className="gap-2 text-sm">
            <FolderTree className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="frentes" className="gap-2 text-sm">
            <Tag className="h-4 w-4" />
            Frentes de Atuação
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 text-sm">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
            {whatsappActiveCount > 0 && (
              <Badge variant="success" className="ml-1 h-5 min-w-5 px-1.5 text-xs">{whatsappActiveCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-6">
          <CategoriesTab
            loading={cat.loading}
            categories={cat.categories}
            filteredCategories={cat.filteredCategories}
            sortedTagGroups={cat.sortedTagGroups}
            searchTerm={cat.searchTerm}
            setSearchTerm={cat.setSearchTerm}
            statusFilter={cat.statusFilter}
            setStatusFilter={cat.setStatusFilter}
            sortBy={cat.sortBy}
            setSortBy={cat.setSortBy}
            sortDirection={cat.sortDirection}
            setSortDirection={cat.setSortDirection}
            hasActiveFilters={cat.hasActiveFilters}
            clearFilters={cat.clearFilters}
            expandedCategories={cat.expandedCategories}
            setExpandedCategories={cat.setExpandedCategories}
            expandedTags={cat.expandedTags}
            setExpandedTags={cat.setExpandedTags}
            onCreateSubcategory={(c) => { cat.handleOpenCreateSubcategory(c); setCreateSubcategoryDialogOpen(true); }}
            onEditCategory={(c) => { cat.setEditingCategory(c); setEditCategoryDialogOpen(true); }}
            onDeleteCategory={(c) => { cat.setPendingDeleteCategory(c); setDeleteCategoryDialogOpen(true); }}
            onEditSubcategory={(s) => { cat.setEditingSubcategory(s); setEditSubcategoryDialogOpen(true); }}
            onDeleteSubcategory={(s) => { cat.setPendingDeleteSubcategory(s); setDeleteSubcategoryDialogOpen(true); }}
            loadData={cat.loadData}
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

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppTab
            evolutionInstanceName={evo.evolutionInstanceName}
            setEvolutionInstanceName={evo.setEvolutionInstanceName}
            evolutionState={evo.evolutionState}
            evolutionOpsLoading={evo.evolutionOpsLoading}
            evolutionInstances={evo.evolutionInstances}
            evolutionInstancesLoading={evo.evolutionInstancesLoading}
            saveInstanceLoading={evo.saveInstanceLoading}
            createInstanceLoading={evo.createInstanceLoading}
            qrDialogOpen={evo.qrDialogOpen}
            setQrDialogOpen={evo.setQrDialogOpen}
            qrDataUrl={evo.qrDataUrl}
            onRefreshConnection={() => void evo.refreshEvolutionConnection()}
            onListInstances={() => void evo.loadEvolutionInstances()}
            onOpenQr={() => void evo.openQrDialog()}
            onSaveInstanceName={() => void evo.saveEvolutionInstanceName()}
            onCreateInstance={() => void evo.createEvolutionInstance()}
            tags={cat.tags}
            whatsappFrenteFilter={evo.whatsappFrenteFilter}
            setWhatsappFrenteFilter={evo.setWhatsappFrenteFilter}
            bulkWhatsappNotifyEnabled={evo.bulkWhatsappNotifyEnabled}
            setBulkWhatsappNotifyEnabled={evo.setBulkWhatsappNotifyEnabled}
            bulkWhatsappMessageTemplate={evo.bulkWhatsappMessageTemplate}
            setBulkWhatsappMessageTemplate={evo.setBulkWhatsappMessageTemplate}
            bulkWhatsappRecipient={evo.bulkWhatsappRecipient}
            setBulkWhatsappRecipient={evo.setBulkWhatsappRecipient}
            bulkWhatsappApplying={evo.bulkWhatsappApplying}
            bulkTargetSubcategories={bulkTargetSubcategories}
            onApplyBulk={() => void evo.applyBulkWhatsapp(bulkTargetSubcategories)}
            whatsappChats={evo.whatsappChats}
            whatsappChatsLoading={evo.whatsappChatsLoading}
            onLoadChats={() => void evo.loadWhatsappChats()}
            filteredWhatsappTagGroups={filteredWhatsappTagGroups}
            onConfigureSubcategory={(s) => { cat.setEditingSubcategory(s); setEditSubcategoryDialogOpen(true); }}
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
        keyError={cat.categoryKeyError}
        isValidatingKey={cat.isValidatingCategoryKey}
        onValidateKey={cat.validateCategoryKey}
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
        keyError={cat.subcategoryKeyError}
        isValidatingKey={cat.isValidatingSubcategoryKey}
        onValidateKey={cat.validateSubcategoryKey}
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

      {/* Delete Confirmations */}
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
