import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, ListChecks, RefreshCw, RotateCcw, Send, UserRound } from 'lucide-react';
import { useOfficialPhoto } from '@/contexts/OfficialPhotosContext';
import { officialPhotoSrc } from '@/services/officialPhotosService';
import type { Ticket } from '@/services/ticketService';

interface Props {
  tickets: Ticket[];
  loading: boolean;
  staleTicketDays: string;
  onRefresh: () => void;
  sendingAlertTicketId: string | null;
  onSendAlertNow: (ticketId: string) => void;
}

function daysSince(dateStr: string): number {
  const createdMs = new Date(dateStr).getTime();
  if (Number.isNaN(createdMs)) return 0;
  return Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000));
}

function getInitials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Person({
  label,
  name,
  userId,
  avatarUrl,
}: {
  label: string;
  name?: string;
  userId?: string;
  avatarUrl?: string;
}) {
  const official = useOfficialPhoto(userId);
  const src = officialPhotoSrc(official) ?? avatarUrl;
  const displayName = name?.trim() || 'Não atribuído';

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="h-9 w-9 shrink-0 rounded-md">
        {src && <AvatarImage src={src} alt={displayName} className="object-cover" />}
        <AvatarFallback className="rounded-md bg-slate-200 text-xs font-semibold text-slate-600">
          {name ? getInitials(name) : <UserRound className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
      </div>
    </div>
  );
}

function StatusBadge({ ticket, daysConfigured }: { ticket: Ticket; daysConfigured: number }) {
  const daysOpen = daysSince(ticket.createdAt);

  if (ticket.staleWhatsappNotifiedAt) {
    const hoursSinceNotice = Math.floor(
      (Date.now() - new Date(ticket.staleWhatsappNotifiedAt).getTime()) / (60 * 60 * 1000),
    );
    if (hoursSinceNotice >= 24) {
      return (
        <Badge variant="outline" className="rounded border-amber-300 bg-amber-50 text-amber-800 whitespace-nowrap">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reenvio no próximo ciclo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="rounded border-emerald-200 bg-emerald-50 text-emerald-700 whitespace-nowrap">
        Avisado nas últimas 24h
      </Badge>
    );
  }
  if (daysOpen >= daysConfigured) {
    return (
      <Badge className="rounded bg-[#BD2D29] text-white hover:bg-[#BD2D29] whitespace-nowrap">
        Elegível para alerta
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded border-slate-300 text-slate-600 whitespace-nowrap">
      Em acompanhamento
    </Badge>
  );
}

export default function WhatsAppUnansweredTicketsCard({
  tickets, loading, staleTicketDays, onRefresh, sendingAlertTicketId, onSendAlertNow,
}: Props) {
  const daysConfigured = Number.parseInt(staleTicketDays, 10) || 3;
  const sorted = [...tickets].sort((a, b) => daysSince(b.createdAt) - daysSince(a.createdAt));

  return (
    <Card className="overflow-hidden border-slate-200 shadow-none">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-0.5 h-5 w-5 text-[#DE5532]" />
            <div>
              <CardTitle className="text-lg">Monitor de tickets abertos</CardTitle>
              <CardDescription className="mt-1">
                Acompanhe o tempo aberto, as pessoas envolvidas e o próximo aviso.
              </CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            Nenhum ticket sem interação no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {sorted.map((ticket) => {
              const daysOpen = daysSince(ticket.createdAt);
              const sendingThis = sendingAlertTicketId === ticket.id;

              return (
                <article
                  key={ticket.id}
                  className="grid gap-4 px-5 py-5 transition-colors hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="text-wrap-pretty text-sm font-semibold leading-5 text-[#2C2D2F]">
                      {ticket.title}
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-5">
                      <Person
                        label="Solicitante"
                        name={ticket.createdByName}
                        userId={ticket.createdBy}
                        avatarUrl={ticket.createdByAvatarUrl}
                      />
                      <Person
                        label="Responsável"
                        name={ticket.assignedToName}
                        userId={ticket.assignedTo}
                        avatarUrl={ticket.assignedToAvatarUrl}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 lg:flex-nowrap lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div className="flex min-w-[96px] items-baseline gap-1.5">
                      <span className="text-3xl font-semibold tabular-nums text-[#BD2D29]">{daysOpen}</span>
                      <span className="text-xs font-medium leading-4 text-slate-500">
                        {daysOpen === 1 ? 'dia' : 'dias'}<br />aberto
                      </span>
                    </div>
                    <StatusBadge ticket={ticket} daysConfigured={daysConfigured} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:border-[#DE5532]/40 hover:bg-[#DE5532]/5 hover:text-[#BD2D29]"
                      disabled={sendingThis}
                      onClick={() => onSendAlertNow(ticket.id)}
                    >
                      {sendingThis ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar aviso
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
