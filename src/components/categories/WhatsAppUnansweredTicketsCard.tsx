import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListChecks, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { Ticket } from '@/services/ticketService';

interface Props {
  tickets: Ticket[];
  loading: boolean;
  staleTicketDays: string;
  onRefresh: () => void;
}

function daysSince(dateStr: string): number {
  const createdMs = new Date(dateStr).getTime();
  if (Number.isNaN(createdMs)) return 0;
  return Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000));
}

function StatusBadge({ ticket, daysConfigured }: { ticket: Ticket; daysConfigured: number }) {
  const daysOpen = daysSince(ticket.createdAt);
  const daysRemaining = daysConfigured - daysOpen;

  if (ticket.staleWhatsappNotifiedAt) {
    return (
      <Badge variant="outline" className="border-slate-300 text-slate-500 whitespace-nowrap">
        Alerta já enviado
      </Badge>
    );
  }
  if (daysRemaining <= 0) {
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-white whitespace-nowrap">
        Dispara no próximo envio
      </Badge>
    );
  }
  if (daysRemaining === 1) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-white whitespace-nowrap">
        Falta 1 dia
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-200 text-amber-700 whitespace-nowrap">
      Faltam {daysRemaining} dias
    </Badge>
  );
}

export default function WhatsAppUnansweredTicketsCard({ tickets, loading, staleTicketDays, onRefresh }: Props) {
  const daysConfigured = Number.parseInt(staleTicketDays, 10) || 3;

  const sorted = [...tickets].sort((a, b) => {
    const remA = daysConfigured - daysSince(a.createdAt);
    const remB = daysConfigured - daysSince(b.createdAt);
    return remA - remB;
  });

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Tickets Sem Resposta</CardTitle>
              <CardDescription>
                Acompanhe quais tickets estão próximos de disparar o alerta automático.
              </CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">Atualizar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Nenhum ticket sem resposta no momento.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((ticket) => {
              const daysOpen = daysSince(ticket.createdAt);
              return (
                <div
                  key={ticket.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#2C2D2F]">{ticket.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {ticket.createdByName}
                      {ticket.assignedToName ? ` · Responsável: ${ticket.assignedToName}` : ' · Não atribuído'}
                      {' · '}{daysOpen === 0 ? 'aberto hoje' : `${daysOpen} dia(s) sem resposta`}
                    </p>
                  </div>
                  <StatusBadge ticket={ticket} daysConfigured={daysConfigured} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
