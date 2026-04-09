import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import type { CreateTagData, Tag as TagType } from '@/services/categoryService';

const CORES_PRESET = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#F97316'];

interface CreateProps {
  mode: 'create';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: CreateTagData;
  setData: (v: CreateTagData) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
}

interface EditProps {
  mode: 'edit';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TagType;
  setData: (v: TagType) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
}

type Props = CreateProps | EditProps;

export default function FrenteFormDialog(props: Props) {
  const { mode, open, onOpenChange, loading, onSubmit } = props;
  const isCreate = mode === 'create';

  const handleSubmit = async () => {
    const ok = await onSubmit();
    if (ok) onOpenChange(false);
  };

  if (isCreate) {
    const { data, setData } = props as CreateProps;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nova Frente de Atuação</DialogTitle>
            <DialogDescription>
              Crie uma frente de atuação para organizar categorias (ex: Controladoria Jurídica).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Chave (única)</Label>
              <Input
                value={data.key}
                onChange={(e) => setData({ ...data, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                placeholder="ex: inteligencia_dados"
              />
              <p className="text-xs text-slate-500">Apenas letras minúsculas, números e _</p>
            </div>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} placeholder="ex: Inteligência de Dados" />
            </div>
            <ColorPicker color={data.color} onChange={(c) => setData({ ...data, color: c })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading || !data.key?.trim() || !data.label?.trim()} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { data, setData } = props as EditProps;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Editar Frente de Atuação</DialogTitle>
          <DialogDescription>Altere o nome ou a cor. A chave não pode ser alterada.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Chave</Label>
            <Input value={data.key} disabled className="bg-slate-50" />
          </div>
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={data.label} onChange={(e) => setData({ ...data, label: e.target.value })} />
          </div>
          <ColorPicker color={data.color} onChange={(c) => setData({ ...data, color: c })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>Cor</Label>
      <div className="flex flex-wrap gap-2">
        {CORES_PRESET.map((cor) => (
          <button
            key={cor}
            type="button"
            className="w-8 h-8 rounded-full border-2 transition-all"
            style={{ backgroundColor: cor, borderColor: color === cor ? '#2C2D2F' : 'transparent' }}
            onClick={() => onChange(cor)}
          />
        ))}
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer border-0 p-0" />
      </div>
    </div>
  );
}
