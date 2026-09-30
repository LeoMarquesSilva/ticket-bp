import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star } from 'lucide-react';
import { Ticket } from '@/types';
import { isNpsExemptTicket } from '@/utils/npsExemptTickets';

interface PendingFeedbackHandlerProps {
  tickets: Ticket[];
  onFeedbackSubmitted: () => void;
  onOpenTicket?: (ticket: Ticket) => void;
  currentUserId?: string;
}

const MAX_VISIBLE_TICKETS = 3;

const PendingFeedbackHandler: React.FC<PendingFeedbackHandlerProps> = ({
  tickets,
  onOpenTicket,
  currentUserId,
}) => {
  const pendingFeedbackTickets = (tickets || [])
    .filter(
      (ticket) =>
        ticket &&
        ticket.status === 'resolved' &&
        !ticket.feedbackSubmittedAt &&
        (!currentUserId || ticket.createdBy === currentUserId) &&
        !isNpsExemptTicket(ticket.category, ticket.subcategory),
    )
    // Mais antigos primeiro: é o que está esperando há mais tempo.
    .sort((a, b) => (a.resolvedAt ?? a.updatedAt).localeCompare(b.resolvedAt ?? b.updatedAt));

  const count = pendingFeedbackTickets.length;
  if (count === 0) return null;

  const [first] = pendingFeedbackTickets;
  const visible = pendingFeedbackTickets.slice(0, MAX_VISIBLE_TICKETS);
  const hidden = count - visible.length;

  return (
    <section
      role="status"
      aria-live="polite"
      className="relative mx-3 mt-3 mb-1 overflow-hidden rounded-xl border border-[#F69F19]/25 bg-gradient-to-r from-[#FFF6E8] via-white to-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-responsum-gradient" aria-hidden="true" />

      <div className="flex flex-col gap-3 py-3 pl-5 pr-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F69F19]/15">
            <Star className="h-[18px] w-[18px] fill-[#F69F19] text-[#F69F19]" aria-hidden="true" />
            {count > 1 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#BD2D29] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                {count}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2C2D2F]">
              {count === 1
                ? 'Um atendimento aguarda sua avaliação'
                : `${count} atendimentos aguardam sua avaliação`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {count === 1 ? (
                <>
                  <span className="font-medium text-slate-600">“{first.title}”</span>
                  {' · '}leva menos de um minuto.
                </>
              ) : (
                'Leva menos de um minuto e ajuda a equipe a melhorar.'
              )}
            </p>

            {count > 1 && onOpenTicket && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {visible.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => onOpenTicket(ticket)}
                    title={`Avaliar: ${ticket.title}`}
                    className="inline-flex max-w-[240px] items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-[#F69F19]/60 hover:bg-[#F69F19]/5 hover:text-[#2C2D2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]/40"
                  >
                    <span className="truncate">{ticket.title}</span>
                  </button>
                ))}
                {hidden > 0 && (
                  <span className="text-xs text-slate-400">+{hidden} {hidden === 1 ? 'outro' : 'outros'}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {onOpenTicket && (
          <Button
            size="sm"
            onClick={() => onOpenTicket(first)}
            className="h-8 shrink-0 gap-1.5 self-start border-0 bg-responsum-gradient px-3.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 sm:self-center"
          >
            Avaliar agora
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </section>
  );
};

export default PendingFeedbackHandler;
