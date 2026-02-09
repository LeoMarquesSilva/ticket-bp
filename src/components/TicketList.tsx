import React from 'react';
import { SearchX, Inbox } from 'lucide-react';
import { Ticket } from '@/types';

interface TicketListProps {
  filteredTickets: Ticket[];
  tickets: Ticket[];
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
  isChatOpen?: boolean; // Nova prop para controlar o layout
}

const TicketList: React.FC<TicketListProps> = ({
  filteredTickets,
  tickets,
  renderTicketCard,
  isChatOpen = false
}) => {
  // Verifica se a lista está vazia por filtro ou por não existir tickets
  const isFilteredEmpty = tickets.length > 0 && filteredTickets.length === 0;
  const isTotalEmpty = tickets.length === 0;

  if (isTotalEmpty || isFilteredEmpty) {
    return (
      <div className={`h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50/80 to-white ${isChatOpen ? 'p-4' : 'p-8'}`}>
        <div className={`flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 ${isChatOpen ? 'max-w-[200px]' : 'max-w-sm'}`}>
          <div className={`bg-white rounded-full flex items-center justify-center shadow-md border border-slate-200 ring-2 ring-slate-100 ${isChatOpen ? 'h-14 w-14 mb-3' : 'h-20 w-20 mb-4'}`}>
            {isFilteredEmpty ? (
              <SearchX className={isChatOpen ? 'h-7 w-7 text-slate-300' : 'h-10 w-10 text-slate-300'} />
            ) : (
              <Inbox className={isChatOpen ? 'h-7 w-7 text-slate-300' : 'h-10 w-10 text-slate-300'} />
            )}
          </div>
          <h3 className={`font-semibold text-slate-700 mb-1 ${isChatOpen ? 'text-sm' : 'text-lg'}`}>
            {isFilteredEmpty ? 'Nenhum resultado' : 'Nenhum ticket'}
          </h3>
          <p className={isChatOpen ? 'text-xs text-slate-500' : 'text-sm text-slate-500'}>
            {isFilteredEmpty 
              ? 'Ajuste os filtros de busca.'
              : 'Não há tickets no momento.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white custom-scrollbar">
      <div 
        className={`
          grid auto-rows-max animate-in fade-in slide-in-from-bottom-4 duration-500
          ${isChatOpen 
            ? 'p-3 gap-3 grid-cols-1' // Chat aberto: layout compacto
            : 'p-4 md:p-6 gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-1' // Chat fechado: layout responsivo
          }
        `}
      >
        {filteredTickets.map((ticket) => (
          <div key={ticket.id} className="h-full">
            {renderTicketCard(ticket)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketList;
