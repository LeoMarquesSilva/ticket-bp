import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar, AlertCircle, CheckCircle, UserCheck, MessageSquare } from 'lucide-react';
import { Ticket, TicketStatus, TicketPriority } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SimpleTicketCardProps {
  ticket: Ticket;
  selectedTicketId?: string;
  unreadCount?: number;
  onClick?: () => void;
  getPriorityColor?: (priority: string) => string;
  getStatusColor?: (status: string) => string;
  isTicketFinalized?: (ticket: Ticket) => boolean;
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
  const defaultGetPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const defaultGetStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assigned':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />;
      case 'assigned':
        return <UserCheck className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return 'Urgente';
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return priority;
    }
  };

  const getStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'Aberto';
      case 'assigned':
        return 'Atribuído';
      case 'in_progress':
        return 'Em Progresso';
      case 'resolved':
        return 'Resolvido';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const isSelected = selectedTicketId === ticket.id;
  const isFinalized = isTicketFinalized ? isTicketFinalized(ticket) : false;

  // Usar as funções passadas como props ou as padrão
  const priorityColor = getPriorityColor ? getPriorityColor(ticket.priority) : defaultGetPriorityColor(ticket.priority);
  const statusColor = getStatusColor ? getStatusColor(ticket.status) : defaultGetStatusColor(ticket.status);

  return (
    <Card 
      className={`hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200 ${
        onClick ? 'hover:border-slate-300' : ''
      } ${
        isSelected ? 'ring-2 ring-[#D5B170] border-[#D5B170] shadow-md' : ''
      } ${
        isFinalized ? 'opacity-75' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            {getStatusIcon(ticket.status)}
            <h4 className="font-medium text-[#101F2E] line-clamp-1 text-sm">
              {ticket.title}
            </h4>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-[#D5B170]" />
              <Badge className="bg-[#D5B170] text-white text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          <p className="text-slate-600 text-xs line-clamp-2">
            {ticket.description}
          </p>
          
          <div className="flex flex-wrap gap-1">
            <Badge className={`${statusColor} border text-xs`}>
              {getStatusLabel(ticket.status)}
            </Badge>
            <Badge className={`${priorityColor} border text-xs`}>
              {getPriorityLabel(ticket.priority)}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{ticket.createdByName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {ticket.assignedToName && (
            <div className="flex items-center gap-1 text-xs text-slate-500 pt-1">
              <UserCheck className="h-3 w-3" />
              <span>Atribuído para: {ticket.assignedToName}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleTicketCard;