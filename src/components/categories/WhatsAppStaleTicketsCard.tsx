import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';

const STALE_TEMPLATE_VARIABLES = [
  '{title}', '{createdByName}', '{categoryLabel}', '{subcategoryLabel}', '{days}', '{createdAtLocal}',
];

interface Props {
  staleTicketDays: string;
  setStaleTicketDays: (v: string) => void;
  staleTicketRecipient: string;
  setStaleTicketRecipient: (v: string) => void;
  staleTicketTemplate: string;
  setStaleTicketTemplate: (v: string) => void;
  staleTicketLoading: boolean;
  staleTicketSaving: boolean;
  onSave: () => void;
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
}

export default function WhatsAppStaleTicketsCard({
  staleTicketDays, setStaleTicketDays,
  staleTicketRecipient, setStaleTicketRecipient,
  staleTicketTemplate, setStaleTicketTemplate,
  staleTicketLoading, staleTicketSaving, onSave,
  whatsappChats, whatsappChatsLoading, onLoadChats,
}: Props) {
  return (
    <Card className="border-amber-500/25">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Alerta de Tickets Parados</CardTitle>
            <CardDescription>
              Envia um aviso no WhatsApp quando um ticket ficar aberto por mais de X dias sem nenhuma resposta do suporte.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {staleTicketLoading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 space-y-4">
            <div className="grid gap-2 max-w-[200px]">
              <Label className="text-xs text-slate-600">Dias sem resposta</Label>
              <Input
                type="number"
                min={1}
                value={staleTicketDays}
                onChange={(e) => setStaleTicketDays(e.target.value)}
                placeholder="3"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-600">Grupo/número de destino</Label>
                <Button type="button" size="sm" variant="outline" onClick={onLoadChats} disabled={whatsappChatsLoading}>
                  {whatsappChatsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Buscar grupos/chats'}
                </Button>
              </div>
              {whatsappChats.length > 0 && (
                <Select value={staleTicketRecipient || 'none'} onValueChange={(v) => setStaleTicketRecipient(v === 'none' ? '' : v)}>
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
                value={staleTicketRecipient}
                onChange={(e) => setStaleTicketRecipient(e.target.value)}
                placeholder="5511999999999 ou 120363...@g.us"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-slate-600">Modelo da mensagem (opcional)</Label>
              <Textarea
                value={staleTicketTemplate}
                onChange={(e) => setStaleTicketTemplate(e.target.value)}
                placeholder="Deixe em branco para usar o modelo padrão"
                rows={4}
              />
              <p className="text-xs text-slate-500">
                Variáveis disponíveis: {STALE_TEMPLATE_VARIABLES.join(' ')}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={onSave}
                disabled={staleTicketSaving}
              >
                {staleTicketSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Salvar configuração'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
