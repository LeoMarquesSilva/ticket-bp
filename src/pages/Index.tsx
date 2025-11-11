import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/services/ticketService';
import Dashboard from './Dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TicketIcon,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const Index: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    // Removido closed: 0,
    inProgress: 0,
    byPriority: {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    averageResolutionTime: 0,
    averageResponseTime: 0,
    averageNPS: 0,
    totalNPSResponses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      console.log('Loading dashboard stats for user:', user.id, 'role:', user.role);
      
      const ticketStats = await TicketService.getTicketStats(user.id, user.role);
      console.log('Dashboard stats loaded:', ticketStats);
      
      // Map the stats to match Dashboard component expectations
      const mappedStats = {
        total: ticketStats?.total || 0,
        open: ticketStats?.open || 0,
        assigned: ticketStats?.assigned || 0,
        in_progress: ticketStats?.in_progress || 0,
        inProgress: ticketStats?.in_progress || 0, // Alias for compatibility
        resolved: ticketStats?.resolved || 0,
        // Removido closed: ticketStats?.closed || 0,
        byPriority: {
          urgent: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        averageResolutionTime: 24, // Default 24 hours
        averageResponseTime: 2, // Default 2 hours
        averageNPS: 8.5, // Default good score
        totalNPSResponses: 0,
      };
      
      setStats(mappedStats);
      toast.success('Dashboard atualizado');
    } catch (error: any) {
      console.error('Error loading dashboard stats:', error);
      setError(error.message || 'Erro ao carregar estatísticas');
      toast.error('Erro ao carregar dashboard: ' + (error.message || 'Erro desconhecido'));
      
      // Set default stats on error
      setStats({
        total: 0,
        open: 0,
        assigned: 0,
        in_progress: 0,
        inProgress: 0,
        resolved: 0,
        // Removido closed: 0,
        byPriority: {
          urgent: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        averageResolutionTime: 24,
        averageResponseTime: 2,
        averageNPS: 8.5,
        totalNPSResponses: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-50';
      case 'assigned': return 'text-purple-600 bg-purple-50';
      case 'in_progress': return 'text-yellow-600 bg-yellow-50';
      case 'resolved': return 'text-green-600 bg-green-50';
      // Removido case 'closed': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <TicketIcon className="h-5 w-5" />;
      case 'assigned': return <Users className="h-5 w-5" />;
      case 'in_progress': return <Clock className="h-5 w-5" />;
      case 'resolved': return <CheckCircle2 className="h-5 w-5" />;
      // Removido case 'closed': return <AlertCircle className="h-5 w-5" />;
      default: return <TicketIcon className="h-5 w-5" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Abertos';
      case 'assigned': return 'Atribuídos';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvidos';
      // Removido case 'closed': return 'Fechados';
      default: return status;
    }
  };

  const handleNavigateToTickets = () => {
    try {
      window.location.href = '/tickets';
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('Erro ao navegar para tickets');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-[#D5B170]" />
        <span className="ml-2 text-lg">Carregando usuário...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-[#D5B170]" />
        <span className="ml-2 text-lg">Carregando dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-700 mb-2">Erro ao carregar dashboard</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadStats} className="bg-red-600 hover:bg-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // For admin/support users, show full dashboard
  if (user.role === 'admin' || user.role === 'support') {
    return <Dashboard />;
  }

  // For regular users, show simplified dashboard
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#101F2E] flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-[#D5B170]" />
            Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Visão geral dos seus tickets de suporte
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={loadStats}
          disabled={loading}
          className="border-[#D5B170] text-[#D5B170] hover:bg-[#D5B170]/10"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Bem-vindo, {user.name}!
              </h2>
              <p className="text-blue-100 mb-4">
                Gerencie seus tickets de suporte
              </p>
              <Badge className="bg-[#D5B170] text-[#101F2E] border-0">
                Usuário
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-[#D5B170]">
                {stats.total}
              </div>
              <div className="text-blue-100">
                Seus Tickets
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(stats).filter(([key]) => 
          ['open', 'assigned', 'in_progress', 'resolved'].includes(key) // Removido 'closed'
        ).map(([status, count]) => (
          <Card key={status} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {getStatusLabel(status)}
              </CardTitle>
              <div className={`p-2 rounded-full ${getStatusColor(status)}`}>
                {getStatusIcon(status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {typeof count === 'number' ? count : 0}
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 mt-2">
                <TrendingUp className="h-3 w-3" />
                <span>
                  {stats.total > 0 
                    ? `${Math.round(((typeof count === 'number' ? count : 0) / stats.total) * 100)}% do total`
                    : '0% do total'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5 text-[#D5B170]" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
              onClick={handleNavigateToTickets}
            >
              <TicketIcon className="h-4 w-4 mr-2" />
              Criar Novo Ticket
            </Button>
            <Button 
              variant="outline"
              className="w-full border-[#D5B170] text-[#D5B170] hover:bg-[#D5B170]/10"
              onClick={handleNavigateToTickets}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Todos os Tickets
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#D5B170]" />
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Tickets Ativos</span>
                <span className="font-semibold">
                  {stats.open + stats.assigned + stats.in_progress}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Taxa de Resolução</span>
                <span className="font-semibold text-green-600">
                  {stats.total > 0 
                    ? `${Math.round((stats.resolved / stats.total) * 100)}%` // Removido stats.closed
                    : '0%'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Pendentes</span>
                <span className="font-semibold text-yellow-600">
                  {stats.open + stats.assigned}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;