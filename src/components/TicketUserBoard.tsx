import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, UserCircle, Shield, Briefcase, HelpCircle } from 'lucide-react';
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

  // Helper para obter cores e ícones baseados na role
  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          bgHeader: 'bg-amber-50',
          borderTop: 'border-t-amber-500',
          textHeader: 'text-amber-800',
          icon: <Shield className="h-4 w-4 text-amber-600" />,
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          bgBody: 'bg-amber-50/30',
          bgDragOver: 'bg-amber-100/50',
          label: 'Admin'
        };
      case 'lawyer':
        return {
          bgHeader: 'bg-purple-50',
          borderTop: 'border-t-purple-500',
          textHeader: 'text-purple-800',
          icon: <Briefcase className="h-4 w-4 text-purple-600" />,
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          bgBody: 'bg-purple-50/30',
          bgDragOver: 'bg-purple-100/50',
          label: 'Advogado'
        };
      default: // support/intern
        return {
          bgHeader: 'bg-[#F69F19]/5',
          borderTop: 'border-t-[#F69F19]',
          textHeader: 'text-[#DE5532]',
          icon: <UserCircle className="h-4 w-4 text-[#F69F19]" />,
          badge: 'bg-[#F69F19]/10 text-[#DE5532] border-[#F69F19]/20',
          bgBody: 'bg-[#F69F19]/5',
          bgDragOver: 'bg-[#F69F19]/10',
          label: 'Suporte'
        };
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50/50">
      {/* Container principal com rolagem horizontal */}
      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Largura mínima para garantir conforto visual */}
          <div className="flex p-4 gap-4 h-full min-w-max">
            
            {/* Coluna: Não atribuídos (Neutro/Slate) */}
            <div className="flex-shrink-0 flex flex-col h-full w-[280px] bg-slate-100/50 rounded-lg border border-slate-200">
              <div className="bg-white p-3 rounded-t-lg border-b border-slate-200 border-t-4 border-t-slate-400 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-md">
                    <HelpCircle className="h-4 w-4 text-slate-600" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Não Atribuídos</h3>
                </div>
                <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-slate-300 font-bold">
                  {ticketsByUser['unassigned']?.length || 0}
                </Badge>
              </div>
              
              <Droppable droppableId="unassigned">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 overflow-y-auto custom-scrollbar transition-colors duration-200 ${
                      snapshot.isDraggingOver ? 'bg-slate-200/50' : ''
                    }`}
                  >
                    <div className="space-y-3 pb-2">
                      {!ticketsByUser['unassigned'] || ticketsByUser['unassigned'].length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg m-2">
                          <HelpCircle className="h-8 w-8 mb-2 opacity-50" />
                          <span className="text-sm font-medium">Nenhum ticket pendente</span>
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
                                className={`transition-opacity duration-200 ${snapshot.isDragging ? 'opacity-50' : ''}`}
                                style={{ ...provided.draggableProps.style }}
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
            {supportUsers.map(supportUser => {
              const styles = getRoleStyles(supportUser.role);
              
              return (
                <div key={supportUser.id} className={`flex-shrink-0 flex flex-col h-full w-[280px] rounded-lg border border-slate-200 ${styles.bgBody}`}>
                  <div className={`bg-white p-3 rounded-t-lg border-b border-slate-200 border-t-4 ${styles.borderTop} flex items-center justify-between sticky top-0 z-10 shadow-sm`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`p-1.5 rounded-md ${styles.bgHeader}`}>
                        {styles.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`font-bold text-sm truncate ${styles.textHeader}`}>
                            {supportUser.name}
                          </h3>
                          {supportUser.isOnline && (
                            <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 ring-2 ring-white" title="Online"></span>
                          )}
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block truncate">
                          {styles.label}
                        </span>
                      </div>
                    </div>
                    <Badge className={`${styles.badge} font-bold shadow-none ml-2`}>
                      {ticketsByUser[supportUser.id]?.length || 0}
                    </Badge>
                  </div>
                  
                  <Droppable droppableId={supportUser.id}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-2 overflow-y-auto custom-scrollbar transition-colors duration-200 ${
                          snapshot.isDraggingOver ? styles.bgDragOver : ''
                        }`}
                      >
                        <div className="space-y-3 pb-2">
                          {!ticketsByUser[supportUser.id] || ticketsByUser[supportUser.id].length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-slate-400/50 border-2 border-dashed border-slate-200 rounded-lg m-2">
                              <User className="h-8 w-8 mb-2 opacity-30" />
                              <span className="text-sm font-medium">Sem tickets</span>
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
                                    className={`transition-opacity duration-200 ${snapshot.isDragging ? 'opacity-50' : ''}`}
                                    style={{ ...provided.draggableProps.style }}
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
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default TicketUserBoard;
