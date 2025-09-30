import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, UserCircle } from 'lucide-react';
import { Ticket } from '@/types';

interface SupportUser {
  id: string;
  name: string;
  role: string;
}

interface TicketUserBoardProps {
  ticketsByUser: Record<string, Ticket[]>;
  supportUsers: SupportUser[];
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
}

const TicketUserBoard: React.FC<TicketUserBoardProps> = ({
  ticketsByUser,
  supportUsers,
  renderTicketCard
}) => {
  return (
    <div className="h-full w-full overflow-auto">
      <div className="min-w-[900px] p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Coluna: Não atribuídos */}
          <div className="flex flex-col h-full min-h-[300px]">
            <div className="bg-slate-100 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-600" />
                <h3 className="font-medium text-slate-700">Não Atribuídos</h3>
              </div>
              <Badge className="bg-slate-200 text-slate-800 border-slate-300">
                {ticketsByUser['unassigned']?.length || 0}
              </Badge>
            </div>
            <div className="flex-1 bg-slate-50/30 rounded-b-md p-2 overflow-y-auto">
              <div className="space-y-2 pb-1">
                {!ticketsByUser['unassigned'] || ticketsByUser['unassigned'].length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Nenhum ticket não atribuído
                  </div>
                ) : (
                  ticketsByUser['unassigned'].map(ticket => renderTicketCard(ticket))
                )}
              </div>
            </div>
          </div>

          {/* Colunas para cada usuário de suporte */}
          {supportUsers.map(supportUser => (
            <div key={supportUser.id} className="flex flex-col h-full min-h-[300px]">
              <div className={`p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10 
                ${supportUser.role === 'lawyer' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                <div className="flex items-center gap-2">
                  <UserCircle className={`h-4 w-4 
                    ${supportUser.role === 'lawyer' ? 'text-purple-600' : 'text-blue-600'}`} />
                  <div>
                    <h3 className={`font-medium 
                      ${supportUser.role === 'lawyer' ? 'text-purple-700' : 'text-blue-700'}`}>
                      {supportUser.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {supportUser.role === 'lawyer' ? 'Advogado' : 'Estagiário'}
                    </span>
                  </div>
                </div>
                <Badge className={`
                  ${supportUser.role === 'lawyer' ? 'bg-purple-100 text-purple-800 border-purple-200' : 
                    'bg-blue-100 text-blue-800 border-blue-200'}`}>
                  {ticketsByUser[supportUser.id]?.length || 0}
                </Badge>
              </div>
              <div className={`flex-1 rounded-b-md p-2 overflow-y-auto
                ${supportUser.role === 'lawyer' ? 'bg-purple-50/30' : 'bg-blue-50/30'}`}>
                <div className="space-y-2 pb-1">
                  {!ticketsByUser[supportUser.id] || ticketsByUser[supportUser.id].length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-500">
                      Nenhum ticket atribuído
                    </div>
                  ) : (
                    ticketsByUser[supportUser.id].map(ticket => renderTicketCard(ticket))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TicketUserBoard;