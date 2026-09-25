import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import UserAvatar from '@/components/UserAvatar';
import { Clock, Calendar, AlertCircle, CheckCircle, UserCheck, MessageSquare } from 'lucide-react';
import { Ticket, TicketStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SimpleTicketCardProps {
  ticket: Ticket;
  selectedTicketId?: string;
  unreadCount?: number;
  onClick?: () => void;
  getStatusColor?: (status: string) => string;
  isTicketFinalized?: (ticket: Ticket) => boolean;
  compact?: boolean;
}

const SimpleTicketCard: React.FC<SimpleTicketCardProps> = ({ 
  ticket, 
  selectedTicketId,
  unreadCount = 0,
  onClick,
  getStatusColor,
  isTicketFinalized,
  compact = false
}) => {

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
        return <AlertCircle className="h-3 w-3 text-slate-500" />;
      case 'assigned':
        return <UserCheck className="h-3 w-3 text-blue-500" />;
      case 'in_progress':
        return <Clock className="h-3 w-3 text-[#F69F19]" />;
      case 'resolved':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'assigned': return 'Atribuído';
      case 'in_progress': return 'Em andamento';
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

  const statusColor = getStatusColor ? getStatusColor(ticket.status) : defaultGetStatusColor(ticket.status);

  return (
    <Card 
      className={`
        group relative transition-all duration-200 cursor-pointer border overflow-hidden
        ${isSelected 
          ? 'border-[#F69F19] bg-white shadow-md ring-2 ring-[#F69F19]/25'
          : 'border-slate-200 bg-white hover:border-[#F69F19]/40 hover:shadow-sm'
        }
        ${isFinalized ? 'opacity-80' : ''}
      `}
      onClick={onClick}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F69F19]" />
      )}

      <div className={compact ? 'p-3 pl-3.5' : 'p-3.5 pl-4'}>
        <div className="flex items-start gap-2.5">
          <UserAvatar
            name={ticket.createdByName}
            userId={ticket.createdBy}
            avatarUrl={ticket.createdByAvatarUrl}
            size="sm"
            className="mt-0.5 h-8 w-8 shrink-0 border border-white shadow-sm"
            fallbackClassName="bg-[#DE5532]/15 text-[#DE5532]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className={`truncate font-semibold text-sm leading-snug ${isSelected ? 'text-[#DE5532]' : 'text-[#2C2D2F]'}`}>
                  {ticket.title}
                </h4>
                <p className="density-meta mt-0.5 truncate text-slate-500">{ticket.createdByName}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {unreadCount > 0 && (
                  <Badge className="density-badge h-5 border-0 bg-[#DE5532] px-1.5 py-0 text-white shadow-sm">
                    <MessageSquare className="mr-1 h-3 w-3 fill-current opacity-80" />
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
                <Badge variant="secondary" className={`${statusColor} density-badge inline-flex items-center gap-1 border px-1.5 py-0 font-medium`}>
                  <span className="hidden sm:inline-flex">{getStatusIcon(ticket.status)}</span>
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>
            </div>

            {!compact && ticket.description && (
              <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-slate-600">
                {ticket.description}
              </p>
            )}

            <div className="mt-1.5 flex items-center justify-between gap-2">
              {ticket.assignedToName ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar
                    name={ticket.assignedToName}
                    userId={ticket.assignedTo}
                    avatarUrl={ticket.assignedToAvatarUrl}
                    size="sm"
                    className="h-5 w-5 shrink-0 border border-white"
                    fallbackClassName="bg-[#F69F19]/20 text-[#F69F19] text-[8px]"
                  />
                  <span className="density-meta truncate text-slate-500">{ticket.assignedToName}</span>
                </div>
              ) : (
                <span className="density-meta truncate italic text-slate-400">Não atribuído</span>
              )}
              <div className="density-meta flex shrink-0 items-center gap-1 text-slate-400">
                <Calendar className="h-3 w-3" />
                {!compact && <span>{formatDate(ticket.createdAt)}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SimpleTicketCard;
