import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CalendarClock, Check, Clock3, MessageSquareText, RefreshCw, RotateCcw, Search, Send } from 'lucide-react';
import { appendTemplateToken } from './WhatsAppTemplateBuilder';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';

const DEFAULT_TEMPLATE =
  '⚠️ *TICKET PARADO — sem interação há {days} dia(s)*\n\n' +
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
  return parts.map((part, index) =>
    /^\{[a-zA-Z]+\}$/.test(part) ? (
      <span key={index} className="rounded-sm bg-amber-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
        {part}
      </span>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
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
    <Card className="overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[#DE5532]" />
          <div>
            <CardTitle className="text-lg">Alerta de tickets parados</CardTitle>
            <CardDescription className="mt-1">
              Avisa diariamente enquanto o ticket continuar aberto e sem nova interação.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {staleTicketLoading ? (
        <CardContent className="flex items-center justify-center py-14">
          <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="grid xl:grid-cols-[0.78fr_1.12fr_0.9fr]">
            <section className="space-y-6 border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-[#2C2D2F]">Regra de inatividade</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Alertar após</span>
                  <Input
                    type="number"
                    min={1}
                    value={staleTicketDays}
                    onChange={(event) => setStaleTicketDays(event.target.value)}
                    className="h-9 w-16 text-center tabular-nums"
                  />
                  <span className="text-sm text-slate-600">dias</span>
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2">
                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p className="text-xs leading-5 text-amber-900">
                    Se nada mudar, o aviso será enviado novamente a cada 24 horas. Qualquer nova interação, como mensagem ou mudança no atendimento, reinicia a contagem.
                  </p>
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
                  <Select value={staleTicketRecipient || 'none'} onValueChange={(value) => setStaleTicketRecipient(value === 'none' ? '' : value)}>
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
                  value={staleTicketRecipient}
                  onChange={(event) => setStaleTicketRecipient(event.target.value)}
                  placeholder="Número ou JID do grupo"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarClock className="h-4 w-4" />
                Verificação diária às 08h, horário de Brasília.
              </div>
            </section>

            <section className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-[#2C2D2F]">Compor mensagem</h3>
                </div>
                {!isUsingDefaultTemplate && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setStaleTicketTemplate('')}>
                    <RotateCcw className="h-4 w-4" />
                    Restaurar padrão
                  </Button>
                )}
              </div>
              <Textarea
                value={staleTicketTemplate}
                onChange={(event) => setStaleTicketTemplate(event.target.value)}
                placeholder={DEFAULT_TEMPLATE}
                className="min-h-[255px] resize-y border-slate-300 font-mono text-sm leading-6 focus-visible:ring-[#DE5532]"
              />
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-medium text-slate-500">Inserir informação</p>
                <div className="flex flex-wrap gap-1.5">
                  {STALE_TEMPLATE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.token}
                      type="button"
                      variant="outline"
                      size="sm"
                      title={variable.token}
                      onClick={() => setStaleTicketTemplate(
                        appendTemplateToken(staleTicketTemplate, variable.token),
                      )}
                      className="h-7 rounded border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-[#DE5532]/40 hover:bg-[#DE5532]/5"
                    >
                      {variable.label}
                    </Button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="bg-slate-50/50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Label className="text-xs font-semibold text-slate-600">Prévia no WhatsApp</Label>
                <span className="text-[11px] text-slate-400">{isUsingDefaultTemplate ? 'Modelo padrão' : 'Personalizado'}</span>
              </div>
              <div className="min-h-[285px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-[#e9f7ee] p-4 font-sans text-sm leading-6 text-slate-700 shadow-sm">
                {renderTemplatePreview(effectiveTemplate)}
              </div>
            </aside>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-4">
            <Button
              type="button"
              className="bg-[#2C2D2F] text-white hover:bg-black"
              onClick={onSave}
              disabled={staleTicketSaving}
            >
              {staleTicketSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
