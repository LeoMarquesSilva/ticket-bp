import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle, Lock } from 'lucide-react';
import { Ticket } from '@/types';

interface TicketKanbanBoardProps {
  ticketsByStatus: {
    open: Ticket[];
    in_progress: Ticket[];
    resolved: Ticket[];
    closed: Ticket[];
  };
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
}

const TicketKanbanBoard: React.FC<TicketKanbanBoardProps> = ({
  ticketsByStatus,
  renderTicketCard
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full max-h-[calc(100vh-250px)]">
      {/* Coluna: Abertos */}
      <div className="flex flex-col h-full min-h-[300px] max-h-full">
        <div className="bg-blue-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <h3 className="font-medium text-blue-700">Abertos</h3>
          </div>
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            {ticketsByStatus.open.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 bg-blue-50/30 rounded-b-md p-2 overflow-y-auto">
          <div className="space-y-2 pb-1">
            {ticketsByStatus.open.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Nenhum ticket aberto
              </div>
            ) : (
              ticketsByStatus.open.map(ticket => renderTicketCard(ticket))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Coluna: Em Andamento */}
      <div className="flex flex-col h-full min-h-[300px] max-h-full">
        <div className="bg-yellow-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <h3 className="font-medium text-yellow-700">Em Andamento</h3>
          </div>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            {ticketsByStatus.in_progress.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 bg-yellow-50/30 rounded-b-md p-2 overflow-y-auto">
          <div className="space-y-2 pb-1">
            {ticketsByStatus.in_progress.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Nenhum ticket em andamento
              </div>
            ) : (
              ticketsByStatus.in_progress.map(ticket => renderTicketCard(ticket))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Coluna: Resolvidos */}
      <div className="flex flex-col h-full min-h-[300px] max-h-full">
        <div className="bg-green-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h3 className="font-medium text-green-700">Resolvidos</h3>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            {ticketsByStatus.resolved.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 bg-green-50/30 rounded-b-md p-2 overflow-y-auto">
          <div className="space-y-2 pb-1">
            {ticketsByStatus.resolved.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Nenhum ticket resolvido
              </div>
            ) : (
              ticketsByStatus.resolved.map(ticket => renderTicketCard(ticket))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Coluna: Fechados */}
      <div className="flex flex-col h-full min-h-[300px] max-h-full">
        <div className="bg-slate-100 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-600" />
            <h3 className="font-medium text-slate-700">Fechados</h3>
          </div>
          <Badge className="bg-slate-200 text-slate-800 border-slate-300">
            {ticketsByStatus.closed.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 bg-slate-50 rounded-b-md p-2 overflow-y-auto">
          <div className="space-y-2 pb-1">
            {ticketsByStatus.closed.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Nenhum ticket fechado
              </div>
            ) : (
              ticketsByStatus.closed.map(ticket => renderTicketCard(ticket))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TicketKanbanBoard;