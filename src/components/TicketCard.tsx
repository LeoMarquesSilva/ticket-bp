import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  User, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Calendar,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { Ticket, TicketStatus, TicketPriority } from '@/types';
import { supabase, TABLES } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FinishTicketButton from './FinishTicketButton';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'support' | 'admin';
}

interface TicketCardProps {
  ticket: Ticket;
  currentUser: User;
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  onAssignTicket: (ticketId: string, supportUserId: string) => void;
  onOpenChat: (ticket: Ticket) => void;
  onTicketFinished?: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  currentUser,
  onUpdateTicket,
  onAssignTicket,
  onOpenChat,
  onTicketFinished = () => {},
}) => {
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [assignedUserName, setAssignedUserName] = useState<string>('');

  useEffect(() => {
    if (currentUser.role === 'support' || currentUser.role === 'admin') {
      loadSupportUsers();
    }
    if (ticket.assignedTo) {
      loadAssignedUserName();
    }
  }, [currentUser.role, ticket.assignedTo]);

const loadSupportUsers = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('id, name, email, role')
      .in('role', ['support', 'admin']);

    if (error) {
      console.error('Error loading support users:', error);
      return;
    }

    // Type assertion to ensure the data matches the User interface
    const typedUsers = data?.map(user => ({
      id: String(user.id),
      name: String(user.name),
      email: String(user.email),
      role: user.role as 'user' | 'support' | 'admin'
    })) || [];

    setSupportUsers(typedUsers);
  } catch (error) {
    console.error('Error loading support users:', error);
  }
};

  const loadAssignedUserName = async () => {
  if (!ticket.assignedTo) return;

  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('name')
      .eq('id', ticket.assignedTo)
      .single();

    if (error) {
      console.error('Error loading assigned user name:', error);
      setAssignedUserName('Usuário não encontrado');
      return;
    }

    // Type assertion to ensure name is treated as a string
    const userName = data?.name ? String(data.name) : 'Usuário não encontrado';
    setAssignedUserName(userName);
  } catch (error) {
    console.error('Error loading assigned user name:', error);
    setAssignedUserName('Usuário não encontrado');
  }
};

  const getPriorityColor = (priority: TicketPriority) => {
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

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
      case 'in_progress':
        return 'Em Andamento';
      case 'resolved':
        return 'Resolvido';
      case 'closed':
        return 'Fechado';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleStatusChange = (newStatus: TicketStatus) => {
    const updates: Partial<Ticket> = { status: newStatus };
    
    if (newStatus === 'in_progress' && !ticket.startedAt) {
      updates.startedAt = new Date().toISOString();
    } else if (newStatus === 'resolved' && !ticket.resolvedAt) {
      updates.resolvedAt = new Date().toISOString();
    } else if (newStatus === 'closed' && !ticket.closedAt) {
      updates.closedAt = new Date().toISOString();
    }
    
    onUpdateTicket(ticket.id, updates);
  };

  const handleAssign = (supportUserId: string) => {
    if (supportUserId) {
      onAssignTicket(ticket.id, supportUserId);
    }
  };

  const canModifyTicket = () => {
    return currentUser.role === 'support' || currentUser.role === 'admin';
  };

  const isTicketActive = () => {
    return ticket.status !== 'resolved' && ticket.status !== 'closed';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(ticket.status)}
              <h3 className="text-lg font-semibold text-[#101F2E] line-clamp-1">
                {ticket.title}
              </h3>
            </div>
            <p className="text-slate-600 text-sm line-clamp-2 mb-3">
              {ticket.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className={`${getStatusColor(ticket.status)} border`}>
                {getStatusLabel(ticket.status)}
              </Badge>
              <Badge className={`${getPriorityColor(ticket.priority)} border`}>
                {getPriorityLabel(ticket.priority)}
              </Badge>
              {ticket.category && (
                <Badge variant="outline" className="text-slate-600">
                  {ticket.category}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Ticket Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4" />
              <span>Criado por: {ticket.createdBy}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>Criado: {formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {/* Assignment Info */}
          {ticket.assignedTo && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <UserCheck className="h-4 w-4" />
              <span>Atribuído para: {assignedUserName}</span>
              {ticket.assignedAt && (
                <span className="text-slate-500">
                  • {formatDate(ticket.assignedAt)}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {/* Chat Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChat(ticket)}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>

            {/* Finish Ticket Button - mostrado apenas se o ticket estiver ativo */}
            {isTicketActive() && (
              <FinishTicketButton
                ticketId={ticket.id}
                ticketTitle={ticket.title}
                isSupport={canModifyTicket()}
                onTicketFinished={onTicketFinished}
              />
            )}

            {/* Status Change for Support/Admin */}
            {canModifyTicket() && (
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Assignment for Support/Admin */}
            {canModifyTicket() && isTicketActive() && (
              <Select
                value={ticket.assignedTo || 'unassigned'}
                onValueChange={handleAssign}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Atribuir para..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {supportUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role === 'admin' ? 'Gestor' : 'Suporte'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TicketCard;