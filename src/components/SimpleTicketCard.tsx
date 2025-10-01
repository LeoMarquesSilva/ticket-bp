import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, User, UserCheck, Clock, Building2 } from 'lucide-react';
import { Ticket } from '@/types';

interface SimpleTicketCardProps {
  ticket: Ticket;
  selectedTicketId?: string;
  unreadCount?: number;
  onClick: () => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  isTicketFinalized: (ticket: Ticket) => boolean;
}

const SimpleTicketCard: React.FC<SimpleTicketCardProps> = ({
  ticket,
  selectedTicketId,
  unreadCount = 0,
  onClick,
  getPriorityColor,
  getStatusColor,
  isTicketFinalized
}) => {
  // Função para formatar a data e hora
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card 
      key={ticket.id} 
      className={`cursor-pointer transition-all hover:shadow-md ${
        selectedTicketId === ticket.id 
          ? 'border-[#D5B170] bg-[#D5B170]/5' 
          : unreadCount > 0 
            ? 'border-blue-300 bg-blue-50' 
            : isTicketFinalized(ticket)
              ? 'border-slate-200 bg-slate-50'
              : 'border-slate-200'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-sm text-[#101F2E] line-clamp-1">
            {ticket.title}
            {isTicketFinalized(ticket) && (
              <span className="ml-2 inline-flex">
                <Lock className="h-3 w-3 text-slate-400" />
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs ml-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-slate-600 line-clamp-2 mb-2">
          {ticket.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge className={`${getStatusColor(ticket.status)} border text-xs`}>
            {ticket.status === 'open' ? 'Aberto' : 
             ticket.status === 'in_progress' ? 'Em Andamento' : 
             ticket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
          </Badge>
          <Badge className={`${getPriorityColor(ticket.priority)} border text-xs`}>
            {ticket.priority === 'urgent' ? 'Urgente' : 
             ticket.priority === 'high' ? 'Alta' : 
             ticket.priority === 'medium' ? 'Média' : 'Baixa'}
          </Badge>
        </div>
        
        {/* Informações de solicitante e atribuição */}
        <div className="flex flex-col gap-1 mb-2 text-xs">
          <div className="flex items-center text-slate-600">
            <User className="h-3 w-3 mr-1" />
            <span>Solicitante: <span className="font-medium">{ticket.createdByName}</span></span>
          </div>
          
          {/* Adicionando o departamento do solicitante */}
          {ticket.createdByDepartment && (
            <div className="flex items-center text-slate-600">
              <Building2 className="h-3 w-3 mr-1" />
              <span>Departamento: <span className="font-medium">{ticket.createdByDepartment}</span></span>
            </div>
          )}
          
          <div className="flex items-center text-slate-600">
            <UserCheck className="h-3 w-3 mr-1" />
            <span>Atribuído: {ticket.assignedToName ? 
              <span className="font-medium">{ticket.assignedToName}</span> : 
              <span className="italic text-slate-400">Não atribuído</span>}
            </span>
          </div>
        </div>
        
        {/* Data e hora de criação */}
        <div className="flex items-center justify-end text-xs text-slate-500">
          <Clock className="h-3 w-3 mr-1" />
          <span>{formatDateTime(ticket.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleTicketCard;