import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, UserCheck, CheckCircle } from 'lucide-react';
import { Ticket } from '@/types';

interface TicketKanbanBoardProps {
  ticketsByStatus: {
    open: Ticket[];
    assigned: Ticket[];
    in_progress: Ticket[];
    resolved: Ticket[];
  };
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
}

const TicketKanbanBoard: React.FC<TicketKanbanBoardProps> = ({
  ticketsByStatus,
  renderTicketCard
}) => {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Container principal com rolagem horizontal */}
      <div className="flex-1 overflow-x-auto">
        {/* Este div define a largura mínima do conteúdo para garantir que as colunas não fiquem muito apertadas */}
        <div className="flex p-4 gap-4 h-full min-w-[1400px]">
          {/* Coluna: Abertos */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px]">
            <div className="bg-blue-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-700">Abertos</h3>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {ticketsByStatus.open.length}
              </Badge>
            </div>
            <div className="flex-1 bg-blue-50/30 rounded-b-md p-2 overflow-y-auto">
              <div className="space-y-2 pb-1">
                {ticketsByStatus.open.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhum ticket aberto
                  </div>
                ) : (
                  ticketsByStatus.open.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Coluna: Atribuídos */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px]">
            <div className="bg-amber-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-1">
                <UserCheck className="h-4 w-4 text-amber-600" />
                <h3 className="font-medium text-amber-700">Atribuídos</h3>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                {ticketsByStatus.assigned.length}
              </Badge>
            </div>
            <div className="flex-1 bg-amber-50/30 rounded-b-md p-2 overflow-y-auto">
              <div className="space-y-2 pb-1">
                {ticketsByStatus.assigned.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhum ticket atribuído
                  </div>
                ) : (
                  ticketsByStatus.assigned.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Coluna: Em Progresso */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px]">
            <div className="bg-yellow-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <h3 className="font-medium text-yellow-700">Em Progresso</h3>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                {ticketsByStatus.in_progress.length}
              </Badge>
            </div>
            <div className="flex-1 bg-yellow-50/30 rounded-b-md p-2 overflow-y-auto">
              <div className="space-y-2 pb-1">
                {ticketsByStatus.in_progress.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhum ticket em progresso
                  </div>
                ) : (
                  ticketsByStatus.in_progress.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Coluna: Resolvidos */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px]">
            <div className="bg-green-50 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-medium text-green-700">Resolvidos</h3>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {ticketsByStatus.resolved.length}
              </Badge>
            </div>
            <div className="flex-1 bg-green-50/30 rounded-b-md p-2 overflow-y-auto">
              <div className="space-y-2 pb-1">
                {ticketsByStatus.resolved.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhum ticket resolvido
                  </div>
                ) : (
                  ticketsByStatus.resolved.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketKanbanBoard;