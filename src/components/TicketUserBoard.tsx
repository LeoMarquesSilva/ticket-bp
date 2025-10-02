import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, UserCircle } from 'lucide-react';
import { Ticket } from '@/types';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface SupportUser {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
}

interface TicketUserBoardProps {
  ticketsByUser: Record<string, Ticket[]>;
  supportUsers: SupportUser[];
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
  handleAssignTicket?: (ticketId: string, userId: string) => void;
}

const TicketUserBoard: React.FC<TicketUserBoardProps> = ({
  ticketsByUser,
  supportUsers,
  renderTicketCard,
  handleAssignTicket
}) => {
  // Função para lidar com o evento de arrastar e soltar
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    
    // Cancelar se não houver destino ou se o destino for o mesmo que a origem
    if (!destination || 
        (source.droppableId === destination.droppableId && 
         source.index === destination.index)) {
      return;
    }
    
    // Extrair o ID do ticket e o ID do usuário de destino
    const ticketId = draggableId;
    const destinationUserId = destination.droppableId;
    
    // Chamar a função de callback para atribuir o ticket ao usuário
    if (handleAssignTicket) {
      handleAssignTicket(ticketId, destinationUserId === 'unassigned' ? '' : destinationUserId);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Container principal com rolagem horizontal */}
      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Este div define a largura mínima do conteúdo para garantir que as colunas não fiquem muito apertadas */}
          <div className="flex p-4 gap-4 h-full">
            {/* Coluna: Não atribuídos */}
            <div className="flex-shrink-0 flex flex-col h-full w-[250px]">
              <div className="bg-slate-100 p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-600" />
                  <h3 className="font-medium text-slate-700">Não Atribuídos</h3>
                </div>
                <Badge className="bg-slate-200 text-slate-800 border-slate-300">
                  {ticketsByUser['unassigned']?.length || 0}
                </Badge>
              </div>
              
              <Droppable droppableId="unassigned">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 overflow-y-auto rounded-b-md ${
                      snapshot.isDraggingOver ? 'bg-slate-100' : 'bg-slate-50/30'
                    }`}
                  >
                    <div className="space-y-2 pb-1">
                      {!ticketsByUser['unassigned'] || ticketsByUser['unassigned'].length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-500">
                          Nenhum ticket não atribuído
                        </div>
                      ) : (
                        ticketsByUser['unassigned'].map((ticket, index) => (
                          <Draggable 
                            key={ticket.id} 
                            draggableId={ticket.id} 
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`${snapshot.isDragging ? 'opacity-70' : ''}`}
                              >
                                {renderTicketCard(ticket)}
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </div>

            {/* Colunas para cada usuário de suporte */}
            {supportUsers.map(supportUser => (
              <div key={supportUser.id} className="flex-shrink-0 flex flex-col h-full w-[250px]">
                <div className={`p-2 rounded-t-md flex items-center justify-between sticky top-0 z-10 
                  ${supportUser.role === 'lawyer' ? 'bg-purple-50' : 
                   supportUser.role === 'admin' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  <div className="flex items-center gap-2">
                    <UserCircle className={`h-4 w-4 
                      ${supportUser.role === 'lawyer' ? 'text-purple-600' : 
                       supportUser.role === 'admin' ? 'text-amber-600' : 'text-blue-600'}`} />
                    <div>
                      <div className="flex items-center gap-1">
                        <h3 className={`font-medium text-sm truncate max-w-[120px]
                          ${supportUser.role === 'lawyer' ? 'text-purple-700' : 
                           supportUser.role === 'admin' ? 'text-amber-700' : 'text-blue-700'}`}>
                          {supportUser.name}
                        </h3>
                        {supportUser.isOnline && (
                          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {supportUser.role === 'lawyer' ? 'Advogado' : 
                         supportUser.role === 'admin' ? 'Admin' : 'Estagiário'}
                      </span>
                    </div>
                  </div>
                  <Badge className={`
                    ${supportUser.role === 'lawyer' ? 'bg-purple-100 text-purple-800 border-purple-200' : 
                     supportUser.role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                     'bg-blue-100 text-blue-800 border-blue-200'}`}>
                    {ticketsByUser[supportUser.id]?.length || 0}
                  </Badge>
                </div>
                
                <Droppable droppableId={supportUser.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 overflow-y-auto rounded-b-md ${
                        snapshot.isDraggingOver 
                          ? supportUser.role === 'lawyer' ? 'bg-purple-100/50' : 
                            supportUser.role === 'admin' ? 'bg-amber-100/50' : 'bg-blue-100/50'
                          : supportUser.role === 'lawyer' ? 'bg-purple-50/30' : 
                            supportUser.role === 'admin' ? 'bg-amber-50/30' : 'bg-blue-50/30'
                      }`}
                    >
                      <div className="space-y-2 pb-1">
                        {!ticketsByUser[supportUser.id] || ticketsByUser[supportUser.id].length === 0 ? (
                          <div className="text-center py-8 text-sm text-slate-500">
                            Nenhum ticket atribuído
                          </div>
                        ) : (
                          ticketsByUser[supportUser.id].map((ticket, index) => (
                            <Draggable 
                              key={ticket.id} 
                              draggableId={ticket.id} 
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`${snapshot.isDragging ? 'opacity-70' : ''}`}
                                >
                                  {renderTicketCard(ticket)}
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default TicketUserBoard;