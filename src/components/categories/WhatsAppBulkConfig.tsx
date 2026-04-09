import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Settings2 } from 'lucide-react';
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
  return (
    <Card className="border-green-600/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-600/10 p-2 text-green-700">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Configuração em Lote</CardTitle>
            <CardDescription>
              Aplique modelo, destino e habilitação para todas as subcategorias de uma frente de atuação.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-[280px]">
            <Label className="mb-1 block text-xs text-slate-600">Filtrar frente</Label>
            <Select value={whatsappFrenteFilter} onValueChange={setWhatsappFrenteFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as frentes</SelectItem>
                <SelectItem value="sem-frente">Sem frente</SelectItem>
                {tags.filter((t) => t.isActive).map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="h-8 px-3">
            {bulkTargetSubcategories.length} subcategorias
          </Badge>
        </div>

        <div className="rounded-md border border-green-200 bg-green-50/60 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={bulkWhatsappNotifyEnabled} onCheckedChange={setBulkWhatsappNotifyEnabled} />
            <span className="text-sm font-medium text-slate-700">Habilitar envio WhatsApp para toda a frente</span>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs text-slate-600">Modelo da mensagem</Label>
            <Textarea
              value={bulkWhatsappMessageTemplate}
              onChange={(e) => setBulkWhatsappMessageTemplate(e.target.value)}
              placeholder="Ex: Novo ticket: {title}"
              rows={3}
            />
            <WhatsAppTemplateBuilder
              onInsertVariable={(token) => setBulkWhatsappMessageTemplate((prev) => appendTemplateToken(prev, token))}
              onApplyQuickTemplate={setBulkWhatsappMessageTemplate}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600">Destino (número/JID/grupo)</Label>
              <Button type="button" size="sm" variant="outline" onClick={onLoadChats} disabled={whatsappChatsLoading}>
                {whatsappChatsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Buscar grupos/chats'}
              </Button>
            </div>
            {whatsappChats.length > 0 && (
              <Select value={bulkWhatsappRecipient || 'none'} onValueChange={(v) => setBulkWhatsappRecipient(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um chat/grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar manualmente</SelectItem>
                  {whatsappChats.map(({ jid, name }) => (
                    <SelectItem key={jid} value={jid}>{name} ({jid})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={bulkWhatsappRecipient}
              onChange={(e) => setBulkWhatsappRecipient(e.target.value)}
              placeholder="5511999999999 ou 120363...@g.us"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-green-700 text-white hover:bg-green-800"
              onClick={onApplyBulk}
              disabled={bulkWhatsappApplying || whatsappFrenteFilter === 'all'}
            >
              {bulkWhatsappApplying ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Aplicar para toda a frente'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
