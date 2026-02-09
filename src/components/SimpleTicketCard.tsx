import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import UserAvatar from '@/components/UserAvatar';
import { Clock, Calendar, AlertCircle, CheckCircle, UserCheck, MessageSquare, ArrowUpCircle, MinusCircle } from 'lucide-react';
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
  compact?: boolean;
}

const SimpleTicketCard: React.FC<SimpleTicketCardProps> = ({ 
  ticket, 
  selectedTicketId,
  unreadCount = 0,
  onClick,
  getPriorityColor,
  getStatusColor,
  isTicketFinalized,
  compact = false
}) => {
  
  // Cores de Prioridade ajustadas para a nova paleta
  const defaultGetPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-[#BD2D29]/10 text-[#BD2D29] border-[#BD2D29]/20'; // Vermelho Marca
      case 'high':
        return 'bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20'; // Laranja Escuro Marca
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200'; // Amarelo/Amber
      case 'low':
        return 'bg-slate-100 text-slate-600 border-slate-200'; // Cinza Neutro
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Cores de Status ajustadas
  const defaultGetStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-slate-100 text-slate-700 border-slate-200'; // Neutro
      case 'assigned':
        return 'bg-blue-50 text-blue-700 border-blue-200'; // Azul Sistema (Discreto)
      case 'in_progress':
        return 'bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20'; // Laranja Marca (Destaque)
      case 'resolved':
        return 'bg-green-50 text-green-700 border-green-200'; // Verde Sucesso
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4 text-slate-500" />;
      case 'assigned':
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-[#F69F19]" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getPriorityIcon = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <ArrowUpCircle className="h-3 w-3 mr-1" />;
      case 'low':
        return <ArrowUpCircle className="h-3 w-3 mr-1 rotate-180" />;
      default:
        return <MinusCircle className="h-3 w-3 mr-1" />;
    }
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'assigned': return 'Atribuído';
      case 'in_progress': return 'Em Progresso';
      case 'resolved': return 'Resolvido';
      default: return status;
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

  const priorityColor = getPriorityColor ? getPriorityColor(ticket.priority) : defaultGetPriorityColor(ticket.priority);
  const statusColor = getStatusColor ? getStatusColor(ticket.status) : defaultGetStatusColor(ticket.status);

  return (
    <Card 
      className={`
        group relative transition-all duration-200 cursor-pointer border overflow-hidden
        ${isSelected 
          ? 'border-[#F69F19] bg-white shadow-lg ring-2 ring-[#F69F19]/25' 
          : 'border-slate-200 bg-white hover:border-[#F69F19]/40 hover:shadow-md'
        }
        ${isFinalized ? 'opacity-80' : ''}
      `}
      onClick={onClick}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F69F19]" />
      )}

      <CardHeader className={compact ? 'pb-1 pl-3 pr-3 pt-3' : 'pb-3 pl-4 pr-4 pt-4'}>
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <UserAvatar
              name={ticket.createdByName}
              avatarUrl={ticket.createdByAvatarUrl}
              size={compact ? 'sm' : 'md'}
              className="shrink-0 border-2 border-white shadow-sm"
              fallbackClassName="bg-[#DE5532]/15 text-[#DE5532]"
            />
            <div className="min-w-0 flex-1">
              <h4 className={`font-semibold truncate ${compact ? 'text-xs' : 'text-sm'} ${isSelected ? 'text-[#DE5532]' : 'text-[#2C2D2F]'}`}>
                {ticket.title}
              </h4>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{ticket.createdByName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {unreadCount > 0 && (
              <Badge className="bg-[#DE5532] text-white text-[10px] px-1.5 py-0 h-5 flex items-center shadow-sm border-0">
                <MessageSquare className="h-3 w-3 mr-1 fill-current opacity-80" />
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
            <div className="text-slate-400">{getStatusIcon(ticket.status)}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className={compact ? 'pt-0 pl-3 pr-3 pb-3' : 'pt-0 pl-4 pr-4 pb-4'}>
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          <p className={`text-slate-600 text-xs leading-relaxed ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
            {ticket.description}
          </p>
          
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className={`${statusColor} border text-[10px] font-medium px-2 py-0`}>
              {getStatusLabel(ticket.status)}
            </Badge>
            <Badge variant="secondary" className={`${priorityColor} border text-[10px] font-medium px-2 py-0 flex items-center`}>
              {getPriorityIcon(ticket.priority)}
              {getPriorityLabel(ticket.priority)}
            </Badge>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {ticket.assignedToName ? (
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  name={ticket.assignedToName}
                  avatarUrl={ticket.assignedToAvatarUrl}
                  size="sm"
                  className="h-6 w-6 shrink-0 border border-white"
                  fallbackClassName="bg-[#F69F19]/20 text-[#F69F19] text-[9px]"
                />
                <span className="text-[11px] text-slate-500 truncate">Atribuído: {ticket.assignedToName}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Não atribuído</span>
            )}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
              <Calendar className="h-3 w-3" />
              {formatDate(ticket.createdAt)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleTicketCard;
