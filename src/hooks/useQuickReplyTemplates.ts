import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  QuickReplyTemplateService,
  type QuickReplyTemplate,
  type QuickReplyTemplateInput,
} from '@/services/quickReplyTemplates';

const emptyForm: QuickReplyTemplateInput = { label: '', message: '' };

export function useQuickReplyTemplates() {
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<QuickReplyTemplateInput>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null);
  const [editForm, setEditForm] = useState<QuickReplyTemplateInput>(emptyForm);
  const [editLoading, setEditLoading] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<QuickReplyTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await QuickReplyTemplateService.getAll();
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const openCreateDialog = () => {
    setCreateForm(emptyForm);
    setCreateDialogOpen(true);
  };

  const handleCreate = async (): Promise<boolean> => {
    if (!createForm.label.trim() || !createForm.message.trim()) {
      toast.error('Preencha o nome e a mensagem.');
      return false;
    }
    setCreateLoading(true);
    try {
      await QuickReplyTemplateService.create(createForm);
      toast.success('Resposta rápida criada com sucesso!');
      await loadTemplates();
      return true;
    } catch (error) {
      console.error('Erro ao criar resposta rápida:', error);
      toast.error('Erro ao criar resposta rápida.');
      return false;
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditDialog = (template: QuickReplyTemplate) => {
    setEditingTemplate(template);
    setEditForm({ label: template.label, message: template.message });
  };

  const handleEdit = async (): Promise<boolean> => {
    if (!editingTemplate) return false;
    if (!editForm.label.trim() || !editForm.message.trim()) {
      toast.error('Preencha o nome e a mensagem.');
      return false;
    }
    setEditLoading(true);
    try {
      await QuickReplyTemplateService.update(editingTemplate.id, editForm);
      toast.success('Resposta rápida atualizada com sucesso!');
      await loadTemplates();
      return true;
    } catch (error) {
      console.error('Erro ao editar resposta rápida:', error);
      toast.error('Erro ao editar resposta rápida.');
      return false;
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await QuickReplyTemplateService.remove(pendingDelete.id);
      toast.success('Resposta rápida excluída.');
      setPendingDelete(null);
      await loadTemplates();
    } catch (error) {
      console.error('Erro ao excluir resposta rápida:', error);
      toast.error('Erro ao excluir resposta rápida.');
    }
  };

  const moveTemplate = async (template: QuickReplyTemplate, direction: 'up' | 'down') => {
    const index = templates.findIndex((t) => t.id === template.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= templates.length) return;

    const reordered = [...templates];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setTemplates(reordered);

    try {
      await QuickReplyTemplateService.reorder(reordered.map((t, i) => ({ id: t.id, order: i + 1 })));
    } catch (error) {
      console.error('Erro ao reordenar respostas rápidas:', error);
      toast.error('Erro ao reordenar. Atualizando lista...');
      await loadTemplates();
    }
  };

  return {
    templates,
    loading,
    loadTemplates,
    createDialogOpen,
    setCreateDialogOpen,
    createForm,
    setCreateForm,
    createLoading,
    openCreateDialog,
    handleCreate,
    editingTemplate,
    setEditingTemplate,
    editForm,
    setEditForm,
    editLoading,
    openEditDialog,
    handleEdit,
    pendingDelete,
    setPendingDelete,
    handleDelete,
    moveTemplate,
  };
}
