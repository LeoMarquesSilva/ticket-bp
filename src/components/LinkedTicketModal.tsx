import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link2, Loader2 } from 'lucide-react';
import { buildLinkedTicketTitle, LINKED_TICKET_TITLE_MAX } from '@/utils/linkedTicket';

interface LinkedTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTitle: string;
  categoryLabel: string;
  subcategoryLabel?: string;
  requesterName: string;
  assigneeName?: string;
  /** Quem está abrindo não é o solicitante (equipe abrindo em nome dele). */
  onBehalfOfRequester: boolean;
  onSubmit: (input: { title: string; description: string }) => Promise<void>;
}

const LinkedTicketModal: React.FC<LinkedTicketModalProps> = ({
  open,
  onOpenChange,
  sourceTitle,
  categoryLabel,
  subcategoryLabel,
  requesterName,
  assigneeName,
  onBehalfOfRequester,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(buildLinkedTicketTitle(sourceTitle));
    setDescription('');
    setSubmitting(false);
  }, [open, sourceTitle]);

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ title, description });
      onOpenChange(false);
    } catch {
      // O chamador já exibe o erro; mantém o modal aberto para nova tentativa.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[#F69F19]" />
              Abrir chamado vinculado
            </DialogTitle>
            <DialogDescription>
              Crie uma continuação deste chamado finalizado. O histórico fica ligado entre os dois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 space-y-1">
              <div className="truncate">
                <span className="font-medium text-slate-500">Continuação de: </span>
                {sourceTitle}
              </div>
              <div className="truncate">
                <span className="font-medium text-slate-500">Categoria: </span>
                {categoryLabel}
                {subcategoryLabel ? ` / ${subcategoryLabel}` : ''}
              </div>
              <div className="truncate">
                <span className="font-medium text-slate-500">Responsável: </span>
                {assigneeName || 'definido pela categoria'}
              </div>
              {onBehalfOfRequester && (
                <div className="truncate">
                  <span className="font-medium text-slate-500">Aberto em nome de: </span>
                  {requesterName}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linked-ticket-title">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="linked-ticket-title"
                value={title}
                maxLength={LINKED_TICKET_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linked-ticket-description">
                O que ficou pendente? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="linked-ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que ainda precisa ser feito ou o que aconteceu depois da finalização."
                className="min-h-[120px]"
                disabled={submitting}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit} className="bg-[#F69F19] hover:bg-[#e08e12] text-white">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abrindo...
                </>
              ) : (
                'Abrir chamado'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedTicketModal;
