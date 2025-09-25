import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="flex-1 h-full max-h-[calc(100vh-250px)] overflow-hidden">
      <ScrollArea className="h-full pr-2">
        <div className="space-y-2 pb-1">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <MessageSquare className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-slate-500 text-center text-sm">
                  {tickets.length === 0 ? 'Nenhum ticket encontrado' : 'Nenhum ticket corresponde aos filtros'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredTickets.map((ticket) => renderTicketCard(ticket))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TicketList;