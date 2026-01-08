import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle, Inbox } from 'lucide-react';
import { Ticket } from '@/types';

interface TicketKanbanBoardProps {
  ticketsByStatus: {
    open: Ticket[];
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
    <div className="h-full w-full flex flex-col bg-slate-50/50">
      {/* Container principal com rolagem horizontal */}
      <div className="flex-1 overflow-x-auto">
        {/* Largura mínima para garantir que as colunas não fiquem espremidas */}
        <div className="flex p-4 gap-4 h-full min-w-[1050px]">
          
          {/* Coluna: Abertos (Neutro/Slate) */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px] bg-slate-100/50 rounded-lg border border-slate-200">
            <div className="bg-white p-3 rounded-t-lg border-b border-slate-200 border-t-4 border-t-slate-400 flex items-center justify-between sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-md">
                  <Inbox className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Abertos</h3>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 font-bold">
                {ticketsByStatus.open.length}
              </Badge>
            </div>
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
              <div className="space-y-3 pb-2">
                {ticketsByStatus.open.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg m-2">
                    <Inbox className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Nenhum ticket aberto</span>
                  </div>
                ) : (
                  ticketsByStatus.open.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Coluna: Em Progresso (Laranja/Marca - Foco de Ação) */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px] bg-[#F69F19]/5 rounded-lg border border-[#F69F19]/20">
            <div className="bg-white p-3 rounded-t-lg border-b border-[#F69F19]/20 border-t-4 border-t-[#F69F19] flex items-center justify-between sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#F69F19]/10 rounded-md">
                  <Clock className="h-4 w-4 text-[#F69F19]" />
                </div>
                <h3 className="font-bold text-[#DE5532] text-sm uppercase tracking-wide">Em Progresso</h3>
              </div>
              <Badge className="bg-[#F69F19]/10 text-[#DE5532] border-[#F69F19]/20 font-bold hover:bg-[#F69F19]/20 shadow-none">
                {ticketsByStatus.in_progress.length}
              </Badge>
            </div>
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
              <div className="space-y-3 pb-2">
                {ticketsByStatus.in_progress.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-[#F69F19]/40 border-2 border-dashed border-[#F69F19]/20 rounded-lg m-2">
                    <Clock className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Nenhum ticket em andamento</span>
                  </div>
                ) : (
                  ticketsByStatus.in_progress.map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Coluna: Resolvidos (Verde/Sucesso) */}
          <div className="flex-shrink-0 flex flex-col h-full w-[350px] bg-green-50/50 rounded-lg border border-green-100">
            <div className="bg-white p-3 rounded-t-lg border-b border-green-100 border-t-4 border-t-green-500 flex items-center justify-between sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-50 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <h3 className="font-bold text-green-700 text-sm uppercase tracking-wide">Resolvidos</h3>
              </div>
              <Badge className="bg-green-50 text-green-700 border-green-200 font-bold hover:bg-green-100 shadow-none">
                {ticketsByStatus.resolved.length}
              </Badge>
            </div>
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
              <div className="space-y-3 pb-2">
                {ticketsByStatus.resolved.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-green-800/30 border-2 border-dashed border-green-200 rounded-lg m-2">
                    <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Nenhum ticket resolvido</span>
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
