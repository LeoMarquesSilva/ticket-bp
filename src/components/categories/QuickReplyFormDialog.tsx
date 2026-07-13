import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw } from 'lucide-react';
import type { QuickReplyTemplateInput } from '@/services/quickReplyTemplates';

interface Props {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: QuickReplyTemplateInput;
  setData: (v: QuickReplyTemplateInput) => void;
  loading: boolean;
  onSubmit: () => Promise<boolean | void>;
}

export default function QuickReplyFormDialog({ mode, open, onOpenChange, data, setData, loading, onSubmit }: Props) {
  const isCreate = mode === 'create';

  const handleSubmit = async () => {
    const ok = await onSubmit();
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Nova Resposta Rápida' : 'Editar Resposta Rápida'}</DialogTitle>
          <DialogDescription>
            Esse texto vai aparecer no menu de respostas rápidas do chat, pra quem atende os tickets.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nome (aparece no menu) <span className="text-red-500">*</span></Label>
            <Input
              value={data.label}
              onChange={(e) => setData({ ...data, label: e.target.value })}
              placeholder="Ex: Saudação inicial"
            />
          </div>
          <div className="grid gap-2">
            <Label>Mensagem <span className="text-red-500">*</span></Label>
            <Textarea
              value={data.message}
              onChange={(e) => setData({ ...data, message: e.target.value })}
              placeholder="Ex: Olá! Recebi sua solicitação e vou verificar para você. Retorno em breve."
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !data.label.trim() || !data.message.trim()}
            className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isCreate ? 'Criar' : 'Salvar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
