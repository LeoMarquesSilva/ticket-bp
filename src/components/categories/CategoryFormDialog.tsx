import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserAssigneePicker from '@/components/UserAssigneePicker';
import { RefreshCw } from 'lucide-react';
import type { Category, CreateCategoryData, Tag as TagType } from '@/services/categoryService';
import type { User } from '@/types';

interface CreateProps {
  mode: 'create';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: CreateCategoryData;
  setData: (v: CreateCategoryData) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
  tags: TagType[];
  supportUsers: User[];
  getRoleLabel: (role: string) => string;
}

interface EditProps {
  mode: 'edit';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Category;
  setData: (v: Category) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
  tags: TagType[];
  supportUsers: User[];
  getRoleLabel: (role: string) => string;
}

type Props = CreateProps | EditProps;

export default function CategoryFormDialog(props: Props) {
  const { mode, open, onOpenChange, loading, onSubmit, tags, supportUsers, getRoleLabel } = props;
  const isCreate = mode === 'create';
  const title = isCreate ? 'Criar Nova Categoria' : 'Editar Categoria';
  const description = isCreate
    ? 'Informe o nome da categoria. A chave interna é gerada automaticamente pelo sistema.'
    : 'Atualize as informações da categoria.';

  const handleSubmit = async () => {
    const ok = await onSubmit();
    if (ok) onOpenChange(false);
  };

  if (isCreate) {
    const { data, setData } = props as CreateProps;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome <span className="text-red-500">*</span></Label>
              <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} placeholder="ex: Protocolo" />
            </div>
            <div className="grid gap-2">
              <Label>SLA Padrão (horas)</Label>
              <Input type="number" min="0" value={data.slaHours || ''} onChange={(e) => setData({ ...data, slaHours: e.target.value ? Number(e.target.value) : undefined })} placeholder="24" />
              <p className="text-xs text-slate-500">SLA padrão caso a subcategoria não tenha um específico</p>
            </div>
            <div className="grid gap-2">
              <Label>Atribuição Automática</Label>
              <UserAssigneePicker
                value={data.defaultAssignedTo}
                onChange={(userId) => setData({ ...data, defaultAssignedTo: userId })}
                users={supportUsers}
                getRoleLabel={getRoleLabel}
              />
            </div>
            <div className="grid gap-2">
              <Label>Frente de Atuação</Label>
              <Select value={data.tagId || 'none'} onValueChange={(v) => setData({ ...data, tagId: v === 'none' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma frente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.label}{!tag.isActive ? ' (Inativa)' : ''}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading || !data.label?.trim()} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]">
              {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Categoria'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit mode
  const { data, setData } = props as EditProps;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Chave</Label>
            <Input value={data.key} disabled className="bg-gray-50" />
            <p className="text-xs text-slate-500">Identificador interno gerado na criação. Não pode ser alterado.</p>
          </div>
          <div className="grid gap-2">
            <Label>Nome <span className="text-red-500">*</span></Label>
            <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} placeholder="ex: Protocolo" />
          </div>
          <div className="grid gap-2">
            <Label>SLA Padrão (horas)</Label>
            <Input type="number" min="0" value={data.slaHours || ''} onChange={(e) => setData({ ...data, slaHours: e.target.value ? Number(e.target.value) : undefined })} placeholder="24" />
          </div>
            <div className="grid gap-2">
              <Label>Atribuição Automática</Label>
              <UserAssigneePicker
                value={data.defaultAssignedTo}
                onChange={(userId) => setData({ ...data, defaultAssignedTo: userId })}
                users={supportUsers}
                getRoleLabel={getRoleLabel}
              />
            </div>
            <div className="grid gap-2">
              <Label>Frente de Atuação</Label>
            <Select value={data.tagId || 'none'} onValueChange={(v) => setData({ ...data, tagId: v === 'none' ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione uma frente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.label}{!tag.isActive ? ' (Inativa)' : ''}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
