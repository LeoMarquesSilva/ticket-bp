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
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-slate-50/50">
        <div className="flex flex-col items-center justify-center text-center max-w-sm animate-in fade-in zoom-in duration-300">
          <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-100">
            {isFilteredEmpty ? (
              <SearchX className="h-10 w-10 text-slate-300" />
            ) : (
              <Inbox className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">
            {isFilteredEmpty ? 'Nenhum resultado encontrado' : 'Nenhum ticket por aqui'}
          </h3>
          <p className="text-sm text-slate-500">
            {isFilteredEmpty 
              ? 'Tente ajustar seus filtros ou termos de busca para encontrar o que procura.'
              : 'Não há tickets criados no momento. Quando houver, eles aparecerão aqui.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50/50 custom-scrollbar">
      <div 
        className={`
          p-4 md:p-6 grid gap-4 auto-rows-max animate-in fade-in slide-in-from-bottom-4 duration-500
          ${isChatOpen 
            ? 'grid-cols-2' // Se o chat estiver aberto, força 1 coluna
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-1' // Se fechado, usa layout responsivo
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
