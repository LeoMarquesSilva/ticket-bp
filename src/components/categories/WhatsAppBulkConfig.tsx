import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, MessageSquareText, RefreshCw, Search, Send, Settings2 } from 'lucide-react';
import WhatsAppTemplateBuilder, { appendTemplateToken } from './WhatsAppTemplateBuilder';
import type { Tag as TagType, Subcategory } from '@/services/categoryService';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';

interface Props {
  tags: TagType[];
  whatsappFrenteFilter: string;
  setWhatsappFrenteFilter: (v: string) => void;
  bulkWhatsappNotifyEnabled: boolean;
  setBulkWhatsappNotifyEnabled: (v: boolean) => void;
  bulkWhatsappMessageTemplate: string;
  setBulkWhatsappMessageTemplate: (v: string) => void;
  bulkWhatsappRecipient: string;
  setBulkWhatsappRecipient: (v: string) => void;
  bulkWhatsappApplying: boolean;
  bulkTargetSubcategories: Subcategory[];
  onApplyBulk: () => void;
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
}

export default function WhatsAppBulkConfig({
  tags, whatsappFrenteFilter, setWhatsappFrenteFilter,
  bulkWhatsappNotifyEnabled, setBulkWhatsappNotifyEnabled,
  bulkWhatsappMessageTemplate, setBulkWhatsappMessageTemplate,
  bulkWhatsappRecipient, setBulkWhatsappRecipient,
  bulkWhatsappApplying, bulkTargetSubcategories,
  onApplyBulk, whatsappChats, whatsappChatsLoading, onLoadChats,
}: Props) {
  const preview = bulkWhatsappMessageTemplate.trim() || 'Escreva a mensagem que será enviada quando um novo ticket for criado.';

  return (
    <Card className="overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[#DE5532]" />
              <CardTitle className="text-lg">Configuração em lote</CardTitle>
            </div>
            <CardDescription>Defina uma regra única para as subcategorias de uma frente.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="bulk-whatsapp-enabled" className="text-sm text-slate-600">Envio ativo</Label>
            <Switch
              id="bulk-whatsapp-enabled"
              checked={bulkWhatsappNotifyEnabled}
              onCheckedChange={setBulkWhatsappNotifyEnabled}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <section className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-[minmax(240px,360px)_1fr] md:items-end">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Frente de atuação</Label>
            <Select value={whatsappFrenteFilter} onValueChange={setWhatsappFrenteFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as frentes</SelectItem>
                <SelectItem value="sem-frente">Sem frente</SelectItem>
                {tags.filter((tag) => tag.isActive).map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-0.5 text-sm text-slate-500">
            <Badge variant="outline" className="rounded border-slate-300 bg-white">
              {bulkTargetSubcategories.length} subcategorias no escopo
            </Badge>
            {whatsappFrenteFilter === 'all' && <span>Escolha uma frente para liberar a aplicação.</span>}
          </div>
        </section>

        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-[#2C2D2F]">Mensagem do novo ticket</h3>
            </div>
            <Textarea
              value={bulkWhatsappMessageTemplate}
              onChange={(event) => setBulkWhatsappMessageTemplate(event.target.value)}
              placeholder="Ex: Novo ticket: {title}"
              className="min-h-[190px] resize-y border-slate-300 font-mono text-sm leading-6 focus-visible:ring-[#DE5532]"
            />
            <WhatsAppTemplateBuilder
              onInsertVariable={(token) => setBulkWhatsappMessageTemplate(
                appendTemplateToken(bulkWhatsappMessageTemplate, token),
              )}
              onApplyQuickTemplate={setBulkWhatsappMessageTemplate}
            />
          </section>

          <aside className="space-y-5 bg-slate-50/50 p-5">
            <div>
              <Label className="mb-2 block text-xs font-semibold text-slate-600">Prévia da mensagem</Label>
              <div className="min-h-[150px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-[#e9f7ee] p-4 text-sm leading-6 text-slate-700 shadow-sm">
                {preview}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Send className="h-3.5 w-3.5" />
                  Destino
                </Label>
                <Button type="button" size="sm" variant="ghost" onClick={onLoadChats} disabled={whatsappChatsLoading}>
                  {whatsappChatsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar chats
                </Button>
              </div>
              {whatsappChats.length > 0 && (
                <Select value={bulkWhatsappRecipient || 'none'} onValueChange={(value) => setBulkWhatsappRecipient(value === 'none' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione um chat ou grupo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Informar manualmente</SelectItem>
                    {whatsappChats.map(({ jid, name }) => (
                      <SelectItem key={jid} value={jid}>{name} ({jid})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                value={bulkWhatsappRecipient}
                onChange={(event) => setBulkWhatsappRecipient(event.target.value)}
                placeholder="Número ou JID do grupo"
              />
            </div>
          </aside>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-4">
          <Button
            type="button"
            className="bg-[#2C2D2F] text-white hover:bg-black"
            onClick={onApplyBulk}
            disabled={bulkWhatsappApplying || whatsappFrenteFilter === 'all'}
          >
            {bulkWhatsappApplying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aplicar na frente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
