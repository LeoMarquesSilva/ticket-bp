import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw, Search, MessageSquareText, Clock3, Send } from 'lucide-react';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';

// Mantido em espelho com DEFAULT_TEMPLATE em supabase/functions/notify-stale-tickets/index.ts
const DEFAULT_TEMPLATE =
  '⚠️ *TICKET PARADO — sem resposta há {days} dia(s)*\n\n' +
  '*Título:* {title}\n' +
  '*Solicitante:* {createdByName}\n' +
  '*Responsável:* {assignedToName}\n\n' +
  '*Categoria:* {categoryLabel}\n' +
  '*Subcategoria:* {subcategoryLabel}\n\n' +
  '*Aberto em:* {createdAtLocal}\n\n' +
  'Por favor, verifique este chamado.';

const STALE_TEMPLATE_VARIABLES = [
  { token: '{title}', label: 'Título' },
  { token: '{createdByName}', label: 'Solicitante' },
  { token: '{assignedToName}', label: 'Responsável' },
  { token: '{categoryLabel}', label: 'Categoria' },
  { token: '{subcategoryLabel}', label: 'Subcategoria' },
  { token: '{days}', label: 'Dias parado' },
  { token: '{createdAtLocal}', label: 'Data de abertura' },
];

function renderTemplatePreview(template: string) {
  const parts = template.split(/(\{[a-zA-Z]+\})/g);
  return parts.map((part, i) =>
    /^\{[a-zA-Z]+\}$/.test(part) ? (
      <span key={i} className="rounded bg-amber-200/70 px-1 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

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
  const isUsingDefaultTemplate = !staleTicketTemplate.trim();
  const effectiveTemplate = isUsingDefaultTemplate ? DEFAULT_TEMPLATE : staleTicketTemplate;

  return (
    <Card className="border-amber-500/25 overflow-hidden">
      <CardHeader className="border-b border-amber-100 bg-amber-50/40">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Alerta de Tickets Parados</CardTitle>
            <CardDescription>
              Envia um aviso no WhatsApp quando um ticket fica aberto por dias sem nenhuma resposta do suporte.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {staleTicketLoading ? (
        <CardContent className="flex items-center justify-center py-10">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
        </CardContent>
      ) : (
        <CardContent className="space-y-6 pt-6">
          {/* Passo 1: Quando alertar */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2C2D2F]">
              <Clock3 className="h-4 w-4 text-amber-600" />
              Quando alertar
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-6 text-sm text-slate-600">
              <span>Um ticket é considerado parado após</span>
              <Input
                type="number"
                min={0}
                value={staleTicketDays}
                onChange={(e) => setStaleTicketDays(e.target.value)}
                placeholder="3"
                className="h-8 w-16 text-center"
              />
              <span>dia(s) sem nenhuma resposta da equipe.</span>
            </div>
            <p className="pl-6 text-xs text-slate-500">
              O sistema confere isso automaticamente <strong>uma vez por dia, às 08h (horário de Brasília)</strong>.
              Se quiser avisar antes disso, use o botão <strong>"Enviar aviso"</strong> na lista de tickets sem resposta, mais abaixo.
            </p>
          </section>

          {/* Passo 2: Para onde enviar */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2C2D2F]">
              <Send className="h-4 w-4 text-amber-600" />
              Para onde enviar
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={staleTicketRecipient}
                    onChange={(e) => setStaleTicketRecipient(e.target.value)}
                    placeholder="Número com DDD (ex: 5511999999999) ou selecione um grupo ao lado"
                    className="pl-8"
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={onLoadChats} disabled={whatsappChatsLoading}>
                  {whatsappChatsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Buscar grupos/chats'}
                </Button>
              </div>
              {whatsappChats.length > 0 && (
                <Select value={staleTicketRecipient || 'none'} onValueChange={(v) => setStaleTicketRecipient(v === 'none' ? '' : v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Ou selecione um chat/grupo já conectado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar manualmente</SelectItem>
                    {whatsappChats.map(({ jid, name }) => (
                      <SelectItem key={jid} value={jid}>{name} ({jid})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </section>

          {/* Passo 3: Mensagem */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2C2D2F]">
              <MessageSquareText className="h-4 w-4 text-amber-600" />
              Mensagem enviada
            </div>

            <div className="pl-6 space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">
                  {isUsingDefaultTemplate ? 'Modelo padrão em uso atualmente:' : 'Prévia do seu modelo personalizado:'}
                </p>
                <div className="rounded-md border border-amber-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {renderTemplatePreview(effectiveTemplate)}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Personalizar mensagem (opcional)</Label>
                <Textarea
                  value={staleTicketTemplate}
                  onChange={(e) => setStaleTicketTemplate(e.target.value)}
                  placeholder="Deixe em branco para usar o modelo padrão acima"
                  rows={4}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-slate-500">Clique para inserir uma informação na mensagem:</p>
                <div className="flex flex-wrap gap-1.5">
                  {STALE_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      title={`Insere: ${v.token}`}
                      onClick={() => setStaleTicketTemplate((prev) => prev ? `${prev} ${v.token}` : v.token)}
                      className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button
              type="button"
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={onSave}
              disabled={staleTicketSaving}
            >
              {staleTicketSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
