import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  Calendar,
  MessageSquare
} from 'lucide-react';

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgResolutionTime: number;
  userSatisfaction: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    avgResolutionTime: 0,
    userSatisfaction: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Get all tickets for the user
        const tickets = await TicketService.getTickets(user.id, user.role);
        
        // Calculate statistics
        const totalTickets = tickets.length;
        const openTickets = tickets.filter(t => t.status === 'open').length;
        const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
        const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
        const closedTickets = tickets.filter(t => t.status === 'closed').length;
        
        // Calculate average resolution time (simplified)
        const resolvedWithTime = tickets.filter(t => t.resolvedAt && t.createdAt);
        const avgResolutionTime = resolvedWithTime.length > 0 
          ? resolvedWithTime.reduce((acc, ticket) => {
              const created = new Date(ticket.createdAt).getTime();
              const resolved = new Date(ticket.resolvedAt!).getTime();
              return acc + (resolved - created);
            }, 0) / resolvedWithTime.length / (1000 * 60 * 60 * 24) // Convert to days
          : 0;

        // Calculate user satisfaction (simplified - based on NPS scores)
        const ticketsWithNPS = tickets.filter(t => t.npsScore !== undefined);
        const userSatisfaction = ticketsWithNPS.length > 0
          ? ticketsWithNPS.reduce((acc, ticket) => acc + (ticket.npsScore || 0), 0) / ticketsWithNPS.length
          : 0;

        setStats({
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
          avgResolutionTime,
          userSatisfaction,
        });
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#101F2E]">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {user?.role === 'user' 
              ? 'Visão geral dos seus tickets de suporte'
              : 'Visão geral do sistema de suporte'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="h-4 w-4" />
          <span>{new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Tickets
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#101F2E]">{stats.totalTickets}</div>
            <p className="text-xs text-slate-500 mt-1">
              Todos os tickets no sistema
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Em Andamento
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#101F2E]">
              {stats.openTickets + stats.inProgressTickets}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Abertos + Em progresso
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Resolvidos
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#101F2E]">{stats.resolvedTickets}</div>
            <p className="text-xs text-slate-500 mt-1">
              Tickets resolvidos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Taxa de Resolução
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#101F2E]">
              {stats.totalTickets > 0 
                ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100)
                : 0
              }%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tickets resolvidos vs total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#D5B170]" />
              Métricas de Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Tempo Médio de Resolução</span>
              <Badge variant="outline">
                {stats.avgResolutionTime > 0 
                  ? `${stats.avgResolutionTime.toFixed(1)} dias`
                  : 'N/A'
                }
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Satisfação do Usuário</span>
              <Badge variant="outline">
                {stats.userSatisfaction > 0 
                  ? `${stats.userSatisfaction.toFixed(1)}/10`
                  : 'N/A'
                }
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Tickets Fechados</span>
              <Badge variant="outline">{stats.closedTickets}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#D5B170]" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Abertos</span>
              <Badge className={getStatusColor('open')}>
                {stats.openTickets}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Em Progresso</span>
              <Badge className={getStatusColor('in_progress')}>
                {stats.inProgressTickets}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Resolvidos</span>
              <Badge className={getStatusColor('resolved')}>
                {stats.resolvedTickets}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Fechados</span>
              <Badge className={getStatusColor('closed')}>
                {stats.closedTickets}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {user?.role === 'user' && (
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => window.location.href = '/tickets'}
                className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
              >
                Ver Todos os Tickets
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/tickets'}
              >
                Criar Novo Ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Overview for Support/Admin */}
      {(user?.role === 'support' || user?.role === 'admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#D5B170]" />
              Visão do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-[#101F2E] mb-1">
                  {stats.openTickets}
                </div>
                <div className="text-sm text-slate-600">Tickets Aguardando</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-[#101F2E] mb-1">
                  {stats.inProgressTickets}
                </div>
                <div className="text-sm text-slate-600">Em Atendimento</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-[#101F2E] mb-1">
                  {stats.totalTickets > 0 
                    ? Math.round(((stats.resolvedTickets + stats.closedTickets) / stats.totalTickets) * 100)
                    : 0
                  }%
                </div>
                <div className="text-sm text-slate-600">Taxa de Conclusão</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;