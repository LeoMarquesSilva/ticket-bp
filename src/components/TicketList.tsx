import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { Ticket } from '@/types';

interface TicketListProps {
  filteredTickets: Ticket[];
  tickets: Ticket[];
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
}

const TicketList: React.FC<TicketListProps> = ({
  filteredTickets,
  tickets,
  renderTicketCard
}) => {
  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-4 space-y-3 w-full">
        {filteredTickets.length === 0 ? (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-500 text-center">
                {tickets.length === 0 ? 'Nenhum ticket encontrado' : 'Nenhum ticket corresponde aos filtros'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => renderTicketCard(ticket))
        )}
      </div>
    </div>
  );
};

export default TicketList;