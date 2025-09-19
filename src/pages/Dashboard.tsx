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
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  PieChart,
  Activity
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgResolutionTime: number;
  userSatisfaction: number;
  npsScores: {
    promoters: number;
    passives: number;
    detractors: number;
    total: number;
    score: number;
  };
  serviceScores: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
    total: number;
    averageScore: number;
  };
  requestFulfillment: {
    fulfilled: number;
    notFulfilled: number;
    total: number;
    percentage: number;
  };
  recentFeedback: Array<{
    id: string;
    title: string;
    npsScore?: number;
    serviceScore?: number;
    comment?: string;
    requestFulfilled?: boolean;
    createdAt: string;
    resolvedAt?: string;
  }>;
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
    npsScores: {
      promoters: 0,
      passives: 0,
      detractors: 0,
      total: 0,
      score: 0
    },
    serviceScores: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      total: 0,
      averageScore: 0
    },
    requestFulfillment: {
      fulfilled: 0,
      notFulfilled: 0,
      total: 0,
      percentage: 0
    },
    recentFeedback: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

        // Calculate NPS scores
        const promoters = ticketsWithNPS.filter(t => (t.npsScore || 0) >= 9).length;
        const passives = ticketsWithNPS.filter(t => (t.npsScore || 0) >= 7 && (t.npsScore || 0) <= 8).length;
        const detractors = ticketsWithNPS.filter(t => (t.npsScore || 0) <= 6).length;
        const npsTotal = ticketsWithNPS.length;
        const npsScore = npsTotal > 0 
          ? Math.round(((promoters - detractors) / npsTotal) * 100) 
          : 0;

        // Calculate service scores
        const ticketsWithServiceScore = tickets.filter(t => t.serviceScore !== undefined);
        const excellent = ticketsWithServiceScore.filter(t => (t.serviceScore || 0) >= 9).length;
        const good = ticketsWithServiceScore.filter(t => (t.serviceScore || 0) >= 7 && (t.serviceScore || 0) <= 8).length;
        const average = ticketsWithServiceScore.filter(t => (t.serviceScore || 0) >= 5 && (t.serviceScore || 0) <= 6).length;
        const poor = ticketsWithServiceScore.filter(t => (t.serviceScore || 0) <= 4).length;
        const serviceTotal = ticketsWithServiceScore.length;
        const averageServiceScore = serviceTotal > 0
          ? ticketsWithServiceScore.reduce((acc, ticket) => acc + (ticket.serviceScore || 0), 0) / serviceTotal
          : 0;

        // Calculate request fulfillment
        const ticketsWithFeedback = tickets.filter(t => t.requestFulfilled !== undefined);
        const fulfilled = ticketsWithFeedback.filter(t => t.requestFulfilled === true).length;
        const notFulfilled = ticketsWithFeedback.filter(t => t.requestFulfilled === false).length;
        const fulfillmentTotal = ticketsWithFeedback.length;
        const fulfillmentPercentage = fulfillmentTotal > 0
          ? Math.round((fulfilled / fulfillmentTotal) * 100)
          : 0;

        // Get recent feedback
        const recentFeedback = tickets
          .filter(t => t.npsScore !== undefined || t.serviceScore !== undefined || t.comment)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            title: t.title,
            npsScore: t.npsScore,
            serviceScore: t.serviceScore,
            comment: t.comment,
            requestFulfilled: t.requestFulfilled,
            createdAt: t.createdAt,
            resolvedAt: t.resolvedAt
          }));

        setStats({
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
          avgResolutionTime,
          userSatisfaction,
          npsScores: {
            promoters,
            passives,
            detractors,
            total: npsTotal,
            score: npsScore
          },
          serviceScores: {
            excellent,
            good,
            average,
            poor,
            total: serviceTotal,
            averageScore: averageServiceScore
          },
          requestFulfillment: {
            fulfilled,
            notFulfilled,
            total: fulfillmentTotal,
            percentage: fulfillmentPercentage
          },
          recentFeedback
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getNpsScoreColor = (score?: number) => {
    if (score === undefined) return 'text-slate-400';
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-yellow-600';
    return 'text-red-600';
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

      {/* Tabs for different dashboard views */}
      {(user?.role === 'support' || user?.role === 'admin') && (
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="nps">Dados NPS</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">NPS Score</span>
                    <Badge variant={stats.npsScores.score >= 50 ? "success" : stats.npsScores.score >= 0 ? "warning" : "destructive"}>
                      {stats.npsScores.total > 0 ? `${stats.npsScores.score}` : 'N/A'}
                    </Badge>
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

            {/* System Overview for Support/Admin */}
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
          </TabsContent>
          
          {/* NPS Tab */}
          <TabsContent value="nps" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#D5B170]" />
                    Pontuação NPS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {stats.npsScores.total > 0 ? stats.npsScores.score : 'N/A'}
                    </div>
                    <div className="text-sm text-slate-600">
                      {stats.npsScores.total > 0 
                        ? `Baseado em ${stats.npsScores.total} avaliações`
                        : 'Nenhuma avaliação disponível'
                      }
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Promotores</span>
                      <span>{stats.npsScores.promoters} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.promoters / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.npsScores.total > 0 ? (stats.npsScores.promoters / stats.npsScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-green-500" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600">Neutros</span>
                      <span>{stats.npsScores.passives} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.passives / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.npsScores.total > 0 ? (stats.npsScores.passives / stats.npsScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-yellow-500" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Detratores</span>
                      <span>{stats.npsScores.detractors} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.detractors / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.npsScores.total > 0 ? (stats.npsScores.detractors / stats.npsScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-[#D5B170]" />
                    Satisfação do Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {stats.serviceScores.total > 0 ? stats.serviceScores.averageScore.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-slate-600">
                      {stats.serviceScores.total > 0 
                        ? `Média de ${stats.serviceScores.total} avaliações`
                        : 'Nenhuma avaliação disponível'
                      }
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Excelente (9-10)</span>
                      <span>{stats.serviceScores.excellent} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.excellent / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.serviceScores.total > 0 ? (stats.serviceScores.excellent / stats.serviceScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-green-500" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600">Bom (7-8)</span>
                      <span>{stats.serviceScores.good} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.good / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.serviceScores.total > 0 ? (stats.serviceScores.good / stats.serviceScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-blue-500" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600">Regular (5-6)</span>
                      <span>{stats.serviceScores.average} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.average / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.serviceScores.total > 0 ? (stats.serviceScores.average / stats.serviceScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-yellow-500" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Ruim (1-4)</span>
                      <span>{stats.serviceScores.poor} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.poor / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress value={stats.serviceScores.total > 0 ? (stats.serviceScores.poor / stats.serviceScores.total) * 100 : 0} className="h-2 bg-slate-100" indicatorClassName="bg-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-[#D5B170]" />
                  Atendimento de Solicitações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {stats.requestFulfillment.fulfilled}
                    </div>
                    <div className="text-sm text-slate-600">Solicitações Atendidas</div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {stats.requestFulfillment.notFulfilled}
                    </div>
                    <div className="text-sm text-slate-600">Solicitações Não Atendidas</div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-[#101F2E] mb-1">
                      {stats.requestFulfillment.percentage}%
                    </div>
                    <div className="text-sm text-slate-600">Taxa de Atendimento</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#D5B170]" />
                  Feedback Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full pr-4">
                  {stats.recentFeedback.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum feedback disponível
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>NPS</TableHead>
                          <TableHead>Serviço</TableHead>
                          <TableHead>Atendido</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recentFeedback.map((feedback) => (
                          <TableRow key={feedback.id} className="cursor-pointer hover:bg-slate-50" onClick={() => window.location.href = `/tickets?id=${feedback.id}`}>
                            <TableCell className="font-medium">{feedback.title}</TableCell>
                            <TableCell className={getNpsScoreColor(feedback.npsScore)}>
                              {feedback.npsScore !== undefined ? feedback.npsScore : 'N/A'}
                            </TableCell>
                            <TableCell className={getNpsScoreColor(feedback.serviceScore)}>
                              {feedback.serviceScore !== undefined ? feedback.serviceScore : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {feedback.requestFulfilled === undefined ? (
                                <span className="text-slate-400">N/A</span>
                              ) : feedback.requestFulfilled ? (
                                <span className="text-green-600 flex items-center">
                                  <ThumbsUp className="h-4 w-4 mr-1" /> Sim
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center">
                                  <ThumbsDown className="h-4 w-4 mr-1" /> Não
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {formatDate(feedback.resolvedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#D5B170]" />
                  Comentários dos Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] w-full pr-4">
                  {stats.recentFeedback.filter(f => f.comment).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum comentário disponível
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stats.recentFeedback
                        .filter(f => f.comment)
                        .map((feedback) => (
                          <Card key={feedback.id} className="bg-slate-50">
                            <CardContent className="p-4">
                              <div className="flex justify-between mb-2">
                                <div className="font-medium">{feedback.title}</div>
                                <div className="text-sm text-slate-500">{formatDate(feedback.resolvedAt)}</div>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getNpsScoreColor(feedback.npsScore)}>
                                  NPS: {feedback.npsScore !== undefined ? feedback.npsScore : 'N/A'}
                                </Badge>
                                <Badge className={getNpsScoreColor(feedback.serviceScore)}>
                                  Serviço: {feedback.serviceScore !== undefined ? feedback.serviceScore : 'N/A'}
                                </Badge>
                              </div>
                              <p className="text-slate-700 text-sm">{feedback.comment}</p>
                            </CardContent>
                          </Card>
                        ))
                      }
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
    </div>
  );
};

export default Dashboard;