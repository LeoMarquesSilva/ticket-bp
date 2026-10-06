import React from 'react';
import { Ticket } from '@/types';

interface TicketKanbanBoardProps {
  ticketsByStatus: {
    open: Ticket[];
    in_progress: Ticket[];
    resolved: Ticket[];
  };
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
  /** Oculta a coluna de resolvidos (segue o toggle "Mostrar resolvidos"). */
  hideResolved?: boolean;
}

type ColumnKey = keyof TicketKanbanBoardProps['ticketsByStatus'];

const COLUMNS: Array<{ key: ColumnKey; label: string; dotClass: string; empty: string }> = [
  { key: 'open', label: 'Abertos', dotClass: 'bg-slate-400', empty: 'Nenhum ticket aberto' },
  { key: 'in_progress', label: 'Em andamento', dotClass: 'bg-[#F69F19]', empty: 'Nenhum ticket em andamento' },
  { key: 'resolved', label: 'Resolvidos', dotClass: 'bg-emerald-500', empty: 'Nenhum ticket resolvido' },
];

const TicketKanbanBoard: React.FC<TicketKanbanBoardProps> = ({
  ticketsByStatus,
  renderTicketCard,
  hideResolved = false,
}) => {
  const columns = hideResolved ? COLUMNS.filter((column) => column.key !== 'resolved') : COLUMNS;

  return (
    <div className="h-full w-full overflow-x-auto bg-slate-50/50 custom-scrollbar">
      <div
        className="grid h-full gap-3 p-3 sm:gap-4 sm:p-4"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(300px, 1fr))` }}
      >
        {columns.map((column) => {
          const tickets = ticketsByStatus[column.key];
          return (
            <section
              key={column.key}
              className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-100/60"
              aria-label={`${column.label}: ${tickets.length}`}
            >
              <header className="flex items-center gap-2 rounded-t-xl border-b border-slate-200 bg-white px-3 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${column.dotClass}`} aria-hidden="true" />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2C2D2F]">{column.label}</h3>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">
                  {tickets.length}
                </span>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar">
                {tickets.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-400">{column.empty}</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => renderTicketCard(ticket))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default TicketKanbanBoard;
