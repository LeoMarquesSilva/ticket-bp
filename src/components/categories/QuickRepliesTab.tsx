import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, RefreshCw, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';
import type { QuickReplyTemplate } from '@/services/quickReplyTemplates';

interface Props {
  loading: boolean;
  templates: QuickReplyTemplate[];
  onCreate: () => void;
  onEdit: (template: QuickReplyTemplate) => void;
  onDelete: (template: QuickReplyTemplate) => void;
  onMove: (template: QuickReplyTemplate, direction: 'up' | 'down') => void;
}

export default function QuickRepliesTab({ loading, templates, onCreate, onEdit, onDelete, onMove }: Props) {
  return (
    <div className="space-y-6">
      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Respostas Rápidas</CardTitle>
              <CardDescription>
                Mensagens prontas que aparecem no chat pra quem atende os tickets, poupando tempo em respostas repetitivas.
              </CardDescription>
            </div>
            <Button onClick={onCreate} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]" size="sm">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Resposta Rápida
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin text-[#F69F19]" /></div>
          ) : templates.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Nenhuma resposta rápida cadastrada. Crie uma para agilizar o atendimento.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((template, index) => (
                <div
                  key={template.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow"
                >
                  <MessageSquare className="h-4 w-4 text-[#F69F19] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[#2C2D2F] block">{template.label}</span>
                    <span className="text-sm text-slate-500 line-clamp-2">{template.message}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Mover para cima"
                      disabled={index === 0}
                      onClick={() => onMove(template, 'up')}
                    >
                      <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Mover para baixo"
                      disabled={index === templates.length - 1}
                      onClick={() => onMove(template, 'down')}
                    >
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => onEdit(template)}>
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" title="Excluir" onClick={() => onDelete(template)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
