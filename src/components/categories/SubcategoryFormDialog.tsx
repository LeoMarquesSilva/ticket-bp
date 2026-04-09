import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import WhatsAppTemplateBuilder, { appendTemplateToken } from './WhatsAppTemplateBuilder';
import type { Subcategory, CreateSubcategoryData, Category } from '@/services/categoryService';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';
import type { User } from '@/types';

interface CreateProps {
  mode: 'create';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentCategory: Category | null;
  data: CreateSubcategoryData;
  setData: (v: CreateSubcategoryData) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
  supportUsers: User[];
  getRoleLabel: (role: string) => string;
  keyError: string | null;
  isValidatingKey: boolean;
  onValidateKey: (key: string, categoryId: string) => void;
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
}

interface EditProps {
  mode: 'edit';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Subcategory;
  setData: (v: Subcategory) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
  supportUsers: User[];
  getRoleLabel: (role: string) => string;
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
}

type Props = CreateProps | EditProps;

export default function SubcategoryFormDialog(props: Props) {
  const { mode, open, onOpenChange, loading, onSubmit, supportUsers, getRoleLabel, whatsappChats, whatsappChatsLoading, onLoadChats } = props;
  const isCreate = mode === 'create';

  const handleSubmit = async () => {
    const ok = await onSubmit();
    if (ok) onOpenChange(false);
  };

  if (isCreate) {
    const { data, setData, parentCategory, keyError, isValidatingKey, onValidateKey } = props as CreateProps;
    const whatsappEnabled = data.whatsappNotifyEnabled ?? false;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Subcategoria</DialogTitle>
            <DialogDescription>
              Nova subcategoria para <strong>{parentCategory?.label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Chave (Única) <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  value={data.key}
                  onChange={(e) => {
                    const k = e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    setData({ ...data, key: k });
                    if (data.categoryId) setTimeout(() => onValidateKey(k, data.categoryId), 500);
                  }}
                  placeholder="ex: pedido_urgencia"
                  className={keyError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {isValidatingKey && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
              </div>
              {keyError ? (
                <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{keyError}</p>
              ) : data.key && !isValidatingKey ? (
                <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Chave disponível</p>
              ) : (
                <p className="text-xs text-slate-500">Apenas letras minúsculas, números e underscores (_)</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Nome <span className="text-red-500">*</span></Label>
              <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} placeholder="ex: Pedido de urgência" />
            </div>
            <div className="grid gap-2">
              <Label>SLA (horas) <span className="text-red-500">*</span></Label>
              <Input type="number" min="0" value={data.slaHours} onChange={(e) => setData({ ...data, slaHours: Number(e.target.value) })} placeholder="24" />
            </div>
            <div className="grid gap-2">
              <Label>Atribuição Automática</Label>
              <Select value={data.defaultAssignedTo || 'none'} onValueChange={(v) => setData({ ...data, defaultAssignedTo: v === 'none' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Padrão da Categoria)</SelectItem>
                  {supportUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({getRoleLabel(u.role)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <WhatsAppSection
              enabled={whatsappEnabled}
              onEnabledChange={(c) => setData({ ...data, whatsappNotifyEnabled: c })}
              template={data.whatsappMessageTemplate ?? ''}
              onTemplateChange={(t) => setData({ ...data, whatsappMessageTemplate: t })}
              recipient={data.whatsappRecipient ?? ''}
              onRecipientChange={(r) => setData({ ...data, whatsappRecipient: r })}
              whatsappChats={whatsappChats}
              whatsappChatsLoading={whatsappChatsLoading}
              onLoadChats={onLoadChats}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading || !!keyError || isValidatingKey} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]">
              {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Subcategoria'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit mode
  const { data, setData } = props as EditProps;
  const whatsappEnabled = data.whatsappNotifyEnabled ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Subcategoria</DialogTitle>
          <DialogDescription>Atualize as informações da subcategoria.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Chave</Label>
            <Input value={data.key} disabled className="bg-gray-50" />
            <p className="text-xs text-slate-500">A chave não pode ser alterada.</p>
          </div>
          <div className="grid gap-2">
            <Label>Nome <span className="text-red-500">*</span></Label>
            <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} placeholder="ex: Pedido de urgência" />
          </div>
          <div className="grid gap-2">
            <Label>SLA (horas) <span className="text-red-500">*</span></Label>
            <Input type="number" min="0" value={data.slaHours} onChange={(e) => setData({ ...data, slaHours: Number(e.target.value) })} placeholder="24" />
          </div>
          <div className="grid gap-2">
            <Label>Atribuição Automática</Label>
            <Select
              value={data.defaultAssignedTo || 'none'}
              onValueChange={(v) => setData({ ...data, defaultAssignedTo: v === 'none' || v === '' ? undefined : v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Padrão da Categoria)</SelectItem>
                {supportUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({getRoleLabel(u.role)})</SelectItem>)}
              </SelectContent>
            </Select>
            {data.defaultAssignedTo && (
              <p className="text-xs text-slate-500">Selecionado: {supportUsers.find(u => u.id === data.defaultAssignedTo)?.name}</p>
            )}
          </div>
          <Separator />
          <WhatsAppSection
            enabled={whatsappEnabled}
            onEnabledChange={(c) => setData({ ...data, whatsappNotifyEnabled: c })}
            template={data.whatsappMessageTemplate ?? ''}
            onTemplateChange={(t) => setData({ ...data, whatsappMessageTemplate: t })}
            recipient={data.whatsappRecipient ?? ''}
            onRecipientChange={(r) => setData({ ...data, whatsappRecipient: r })}
            whatsappChats={whatsappChats}
            whatsappChatsLoading={whatsappChatsLoading}
            onLoadChats={onLoadChats}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]">
            {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppSection({
  enabled, onEnabledChange, template, onTemplateChange,
  recipient, onRecipientChange,
  whatsappChats, whatsappChatsLoading, onLoadChats,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  recipient: string;
  onRecipientChange: (v: string) => void;
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-green-200/80 bg-green-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Notificar WhatsApp ao abrir ticket</Label>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      <div className="grid gap-2">
        <Label>Mensagem (modelo)</Label>
        <Textarea
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          placeholder={`🎫 Novo ticket\n*{title}*\n📁 {categoryLabel} / {subcategoryLabel}`}
          rows={4}
          disabled={!enabled}
          className="text-sm"
        />
        <WhatsAppTemplateBuilder
          disabled={!enabled}
          onInsertVariable={(token) => onTemplateChange(appendTemplateToken(template, token))}
          onApplyQuickTemplate={onTemplateChange}
        />
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Destino (número ou grupo)</Label>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onLoadChats} disabled={whatsappChatsLoading || !enabled}>
            {whatsappChatsLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Carregar conversas'}
          </Button>
        </div>
        {whatsappChats.length > 0 && (
          <Select onValueChange={onRecipientChange} disabled={!enabled}>
            <SelectTrigger><SelectValue placeholder="Escolher da lista" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {whatsappChats.map((c) => <SelectItem key={c.jid} value={c.jid}>{c.name} — {c.jid}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input
          value={recipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          placeholder="5511999999999 ou ID do grupo @g.us"
          disabled={!enabled}
        />
      </div>
    </div>
  );
}
