import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
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
        
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{ticket.createdByName}</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleTicketCard;