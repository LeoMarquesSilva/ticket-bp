import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle,
  Calendar,
  UserCheck,
  Star
} from 'lucide-react';
import { Ticket } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: Ticket;
  selectedTicketId?: string;
  unreadCount?: number; // ✅ Nova prop para contador
  onClick: (ticket: Ticket) => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  isTicketFinalized: (ticket: Ticket) => boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  selectedTicketId,
  unreadCount = 0, // ✅ Valor padrão
  onClick,
  getPriorityColor,
  getStatusColor,
  isTicketFinalized
}) => {
  const isSelected = selectedTicketId === ticket.id;
  const isFinalized = isTicketFinalized(ticket);

  // Função para obter o texto da prioridade
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  // Função para obter o texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em andamento';
      case 'resolved': return 'Resolvido';
      default: return status;
    }
  };

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md
        ${isSelected ? 'ring-2 ring-[#D5B170] shadow-lg' : 'hover:shadow-sm'}
        ${isFinalized ? 'opacity-75' : ''}
      `}
      onClick={() => onClick(ticket)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`
              font-semibold text-sm leading-tight mb-1 truncate
              ${isFinalized ? 'text-slate-500' : 'text-slate-900'}
            `}>
              {ticket.title}
            </h3>
            <p className={`
              text-xs leading-relaxed line-clamp-2
              ${isFinalized ? 'text-slate-400' : 'text-slate-600'}
            `}>
              {ticket.description}
            </p>
          </div>
          
          {/* ✅ Contador de mensagens não lidas */}
          {unreadCount > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-[#D5B170]" />
              <Badge 
                variant="secondary" 
                className="bg-[#D5B170] text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Badges de prioridade e status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={`text-xs ${getPriorityColor(ticket.priority)}`}
            >
              {getPriorityText(ticket.priority)}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-xs ${getStatusColor(ticket.status)}`}
            >
              {getStatusText(ticket.status)}
            </Badge>
          </div>

          {/* Informações do usuário e data */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <User className="h-3 w-3" />
              <span className="truncate">
                {ticket.createdByName}
                {ticket.createdByDepartment && (
                  <span className="text-slate-400"> • {ticket.createdByDepartment}</span>
                )}
              </span>
            </div>

            {ticket.assignedTo && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserCheck className="h-3 w-3" />
                <span className="truncate">Atribuído a {ticket.assignedToName}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(ticket.createdAt), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>

          {/* Categoria e subcategoria */}
          {(ticket.category || ticket.subcategory) && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>{ticket.category}</span>
              {ticket.category && ticket.subcategory && <span>•</span>}
              <span>{ticket.subcategory}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketCard;