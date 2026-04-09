import { useEffect, useState, useCallback } from 'react';
import { evolutionAdminInvoke, type EvolutionChatOption } from '@/services/evolutionEdgeService';
import { CategoryService, type Subcategory, type Tag as TagType } from '@/services/categoryService';
import { toast } from 'sonner';

export function isEvolutionConnected(state: string | null | undefined) {
  const normalized = String(state ?? '').toLowerCase();
  return normalized === 'open' || normalized === 'connected';
}

export function useEvolutionApi(loadCategoriesData: () => Promise<void>) {
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');
  const [evolutionState, setEvolutionState] = useState<string | null>(null);
  const [evolutionOpsLoading, setEvolutionOpsLoading] = useState(false);
  const [evolutionInstances, setEvolutionInstances] = useState<Array<{ name: string; state: string | null }>>([]);
  const [evolutionInstancesLoading, setEvolutionInstancesLoading] = useState(false);

  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [whatsappChats, setWhatsappChats] = useState<EvolutionChatOption[]>([]);
  const [whatsappChatsLoading, setWhatsappChatsLoading] = useState(false);
  const [saveInstanceLoading, setSaveInstanceLoading] = useState(false);
  const [createInstanceLoading, setCreateInstanceLoading] = useState(false);

  // Bulk config
  const [whatsappFrenteFilter, setWhatsappFrenteFilter] = useState<string>('all');
  const [bulkWhatsappNotifyEnabled, setBulkWhatsappNotifyEnabled] = useState(true);
  const [bulkWhatsappMessageTemplate, setBulkWhatsappMessageTemplate] = useState('');
  const [bulkWhatsappRecipient, setBulkWhatsappRecipient] = useState('');
  const [bulkWhatsappApplying, setBulkWhatsappApplying] = useState(false);

  // Load instance name on mount
  const loadInstanceName = useCallback(async () => {
    try {
      const res = await evolutionAdminInvoke<{ instanceName?: string }>({ action: 'getInstanceName' });
      setEvolutionInstanceName((res?.instanceName ?? '').trim());
    } catch {
      setEvolutionInstanceName('');
    }
  }, []);

  const loadEvolutionInstances = useCallback(async () => {
    try {
      setEvolutionInstancesLoading(true);
      const res = await evolutionAdminInvoke<{ instances?: Array<{ name?: string; state?: string | null }> }>({
        action: 'listInstances',
      });
      const normalized = (res?.instances ?? [])
        .map((it) => ({ name: String(it.name ?? '').trim(), state: it.state ? String(it.state) : null }))
        .filter((it) => it.name.length > 0);
      setEvolutionInstances(normalized);
    } catch (e) {
      setEvolutionInstances([]);
      toast.error('Instâncias Evolution', { description: e instanceof Error ? e.message : 'Não foi possível listar as instâncias.' });
    } finally {
      setEvolutionInstancesLoading(false);
    }
  }, []);

  const refreshEvolutionConnection = useCallback(async () => {
    try {
      setEvolutionOpsLoading(true);
      const instanceName = evolutionInstanceName.trim();
      const res = await evolutionAdminInvoke<{ instance?: { state?: string } }>({
        action: 'connectionState', instanceName,
      });
      setEvolutionState(res?.instance?.state ?? null);
    } catch (e) {
      setEvolutionState(null);
      toast.error('Evolution API', { description: e instanceof Error ? e.message : 'Não foi possível consultar o estado da conexão.' });
    } finally {
      setEvolutionOpsLoading(false);
    }
  }, [evolutionInstanceName]);

  const openQrDialog = useCallback(async () => {
    const instanceName = evolutionInstanceName.trim();
    if (!instanceName) { toast.error('Informe o nome da instância antes de gerar o QR Code.'); return; }
    try {
      setEvolutionOpsLoading(true);
      await evolutionAdminInvoke({ action: 'saveInstanceName', instanceName });
      const res = await evolutionAdminInvoke<{ code?: string; pairingCode?: string }>({ action: 'getQr', instanceName });
      const code = res?.code;
      if (!code) {
        toast.error('QR Code', { description: 'A Evolution não retornou o código. Confira se a instância existe e está acessível.' });
        return;
      }
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(code, { width: 280, margin: 2 });
      setQrDataUrl(url);
      setQrDialogOpen(true);
    } catch (e) {
      toast.error('QR Code', { description: e instanceof Error ? e.message : 'Erro ao gerar o QR.' });
    } finally {
      setEvolutionOpsLoading(false);
    }
  }, [evolutionInstanceName]);

  // Poll connection while QR dialog is open
  useEffect(() => {
    if (!qrDialogOpen) return;
    const instanceName = evolutionInstanceName.trim();
    if (!instanceName) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await evolutionAdminInvoke<{ instance?: { state?: string } }>({ action: 'connectionState', instanceName });
        const state = res?.instance?.state ?? null;
        if (cancelled) return;
        setEvolutionState(state);
        if (isEvolutionConnected(state)) {
          setQrDialogOpen(false);
          setQrDataUrl(null);
          toast.success('WhatsApp conectado com sucesso.');
        }
      } catch { /* silent polling */ }
    };
    const timer = window.setInterval(poll, 5000);
    poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [qrDialogOpen, evolutionInstanceName]);

  const loadWhatsappChats = useCallback(async () => {
    try {
      setWhatsappChatsLoading(true);
      const instanceName = evolutionInstanceName.trim();
      const res = await evolutionAdminInvoke<{ chats?: EvolutionChatOption[] }>({ action: 'listChats', instanceName });
      setWhatsappChats(res?.chats ?? []);
      if (!res?.chats?.length) {
        toast.info('Lista vazia', { description: 'Conecte o WhatsApp e tente novamente, ou digite o JID manualmente.' });
      }
    } catch (e) {
      toast.error('Conversas', { description: e instanceof Error ? e.message : 'Erro ao listar chats.' });
    } finally {
      setWhatsappChatsLoading(false);
    }
  }, [evolutionInstanceName]);

  const saveEvolutionInstanceName = useCallback(async () => {
    const name = evolutionInstanceName.trim();
    if (!name) { toast.error('Informe o nome da instância Evolution.'); return; }
    try {
      setSaveInstanceLoading(true);
      await evolutionAdminInvoke({ action: 'saveInstanceName', instanceName: name });
      toast.success('Nome da instância salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaveInstanceLoading(false);
    }
  }, [evolutionInstanceName]);

  const createEvolutionInstance = useCallback(async () => {
    const name = evolutionInstanceName.trim();
    if (!name) { toast.error('Informe o nome da instância antes de criar.'); return; }
    try {
      setCreateInstanceLoading(true);
      await evolutionAdminInvoke({ action: 'createInstance', instanceName: name });
      toast.success('Instância criada na Evolution', { description: 'Use o QR Code para conectar o WhatsApp.' });
      void refreshEvolutionConnection();
      void loadEvolutionInstances();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar instância.');
    } finally {
      setCreateInstanceLoading(false);
    }
  }, [evolutionInstanceName, refreshEvolutionConnection, loadEvolutionInstances]);

  const applyBulkWhatsapp = useCallback(async (targetSubcategories: Subcategory[]) => {
    if (whatsappFrenteFilter === 'all') {
      toast.error('Selecione uma frente específica para aplicar em lote.');
      return;
    }
    const recipient = bulkWhatsappRecipient.trim();
    if (bulkWhatsappNotifyEnabled && !recipient) {
      toast.error('Informe destino (número/JID/grupo) para aplicar em lote.');
      return;
    }
    if (targetSubcategories.length === 0) {
      toast.error('Nenhuma subcategoria encontrada na frente selecionada.');
      return;
    }
    try {
      setBulkWhatsappApplying(true);
      await Promise.all(
        targetSubcategories.map((sub) =>
          CategoryService.updateSubcategory(sub.id, {
            whatsappNotifyEnabled: bulkWhatsappNotifyEnabled,
            whatsappMessageTemplate: bulkWhatsappMessageTemplate,
            whatsappRecipient: recipient,
          }),
        ),
      );
      toast.success('Configuração WhatsApp aplicada em lote', { description: `${targetSubcategories.length} subcategorias atualizadas.` });
      await loadCategoriesData();
    } catch (error: any) {
      toast.error('Erro ao aplicar configuração em lote', { description: error?.message || 'Não foi possível atualizar todas as subcategorias.' });
    } finally {
      setBulkWhatsappApplying(false);
    }
  }, [whatsappFrenteFilter, bulkWhatsappNotifyEnabled, bulkWhatsappMessageTemplate, bulkWhatsappRecipient, loadCategoriesData]);

  return {
    // Instance
    evolutionInstanceName, setEvolutionInstanceName,
    evolutionState, evolutionOpsLoading,
    evolutionInstances, evolutionInstancesLoading,
    loadInstanceName, loadEvolutionInstances, refreshEvolutionConnection,
    saveEvolutionInstanceName, saveInstanceLoading,
    createEvolutionInstance, createInstanceLoading,
    // QR
    qrDialogOpen, setQrDialogOpen, qrDataUrl, openQrDialog,
    // Chats
    whatsappChats, whatsappChatsLoading, loadWhatsappChats,
    // Bulk
    whatsappFrenteFilter, setWhatsappFrenteFilter,
    bulkWhatsappNotifyEnabled, setBulkWhatsappNotifyEnabled,
    bulkWhatsappMessageTemplate, setBulkWhatsappMessageTemplate,
    bulkWhatsappRecipient, setBulkWhatsappRecipient,
    bulkWhatsappApplying, applyBulkWhatsapp,
  };
}
