import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart, BarChart3, Calendar, CheckCircle, ChevronRight, Clock,
  Layers, LineChart as LineChartIcon, MessageSquare, PieChart, RefreshCw, Star, ThumbsDown, ThumbsUp, TrendingUp,
  User, Users
} from 'lucide-react';
import { getDashboardStats, STATUS_COLORS, COLORS } from '@/services/dashboardService';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, BarChart as RechartsBarChart, Bar, LineChart,
  Line
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RecentFeedbackList from '@/components/RecentFeedbackList';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    avgResolutionTime: 0,
    ticketsOverTime: [],
    categoryDistribution: [],
    responseTimeByDay: [],
    topUsers: [],
    npsScores: { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 },
    serviceScores: { averageScore: 0, excellent: 0, good: 0, average: 0, poor: 0, total: 0 },
    requestFulfillment: { fulfilled: 0, notFulfilled: 0, percentage: 0 },
    recentFeedback: []
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [timeRange, setTimeRange] = useState('30');
  
  // Estado para o seletor de datas
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), parseInt(timeRange)),
    to: new Date()
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let days = parseInt(timeRange);
        let startDate, endDate;
        
        if (dateRange?.from && dateRange?.to) {
          // Calcular dias entre as datas selecionadas
          const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          startDate = dateRange.from;
          endDate = dateRange.to;
        } else {
          startDate = subDays(new Date(), days);
          endDate = new Date();
        }
        
        // Usar a função correta getDashboardStats
        const stats = await getDashboardStats(
          days, 
          user?.role === 'user' ? user.id : undefined,
          startDate.toISOString(),
          endDate.toISOString()
        );
        
        setStats(stats);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError('Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange, refreshKey, user, dateRange]);

  // Atualiza o timeRange quando o dateRange muda
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setTimeRange(diffDays.toString());
    }
  }, [dateRange]);

  // Função para gerar dados de tempo de resposta por dia da semana
  const generateResponseTimeByDayData = (tickets: any[]) => {
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayData: Record<string, { count: number; totalTime: number }> = {};
    
    // Inicializar dados para cada dia da semana
    dayNames.forEach(day => {
      dayData[day] = { count: 0, totalTime: 0 };
    });
    
    // Calcular tempo médio de resposta para cada dia
    tickets.forEach(ticket => {
      if (ticket.createdAt && ticket.firstResponseAt) {
        const createdDate = new Date(ticket.createdAt);
        const dayName = dayNames[createdDate.getDay()];
        const responseTime = new Date(ticket.firstResponseAt).getTime() - createdDate.getTime();
        const responseTimeHours = responseTime / (1000 * 60 * 60);
        
        dayData[dayName].count++;
        dayData[dayName].totalTime += responseTimeHours;
      }
    });
    
    // Calcular a média para cada dia e formatar os dados
    return dayNames.map(day => ({
      day,
      time: dayData[day].count > 0 ? Math.round((dayData[day].totalTime / dayData[day].count) * 10) / 10 : 0
    }));
  };

  // Função para gerar dados dos usuários com mais tickets
  const generateTopUsersData = (tickets: any[]) => {
    const userCounts: Record<string, { name: string; tickets: number }> = {};
    
    tickets.forEach(ticket => {
      const userName = ticket.createdByName || 'Usuário desconhecido';
      const userId = ticket.createdBy || 'unknown';
      const userKey = `${userId}-${userName}`;
      
      if (userCounts[userKey]) {
        userCounts[userKey].tickets++;
      } else {
        userCounts[userKey] = { name: userName, tickets: 1 };
      }
    });
    
    // Ordenar e pegar os top 5
    return Object.values(userCounts)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 5);
  };

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

  const getNpsScoreColor = (score?: number) => {
    if (score === undefined) return 'text-slate-400';
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Componente para exibir a variação percentual
  const PercentageChange = ({ current, previous }: { current: number, previous: number }) => {
    if (previous === 0) return null;
    
    const percentChange = ((current - previous) / previous) * 100;
    const isPositive = percentChange > 0;
    
    return (
      <span className={`text-xs flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {Math.abs(percentChange).toFixed(1)}%
      </span>
    );
  };

  // Componente para cartão de estatística
  const StatCard = ({ 
    title, 
    value, 
    previousValue, 
    icon, 
    color = 'blue',
    description 
  }: { 
    title: string; 
    value: number | string; 
    previousValue?: number; 
    icon: React.ReactNode; 
    color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red'; 
    description?: string;
  }) => {
    const colorClasses = {
      blue: 'border-l-blue-500 from-blue-50 to-transparent',
      green: 'border-l-green-500 from-green-50 to-transparent',
      yellow: 'border-l-yellow-500 from-yellow-50 to-transparent',
      purple: 'border-l-purple-500 from-purple-50 to-transparent',
      red: 'border-l-red-500 from-red-50 to-transparent'
    };
    
    const iconColorClasses = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      yellow: 'text-yellow-500',
      purple: 'text-purple-500',
      red: 'text-red-500'
    };
    
    return (
      <Card className={`border-l-4 ${colorClasses[color]} bg-gradient-to-r`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          <div className={iconColorClasses[color]}>
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline">
            <div className="text-2xl font-bold text-[#101F2E]">{value}</div>
            {previousValue !== undefined && (
              <div className="ml-2">
                <PercentageChange current={typeof value === 'number' ? value : 0} previous={previousValue} />
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    );
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg text-slate-600">{error}</p>
          <Button 
            onClick={handleRefresh}
            className="mt-4"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header com título e controles */}
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1 rounded-md border">
            <Calendar className="h-4 w-4" />
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          
          {(user?.role === 'admin' || user?.role === 'support') && (
            <div className="flex items-center gap-2">
              {/* Substituímos o Select por um DatePickerWithRange */}
              <DatePickerWithRange 
                date={dateRange} 
                setDate={setDateRange} 
                className="w-auto"
                locale={ptBR}
                placeholder="Selecione o período"
              />
              
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Atualizar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Exibir período selecionado */}
      {dateRange?.from && dateRange?.to && (
        <div className="text-sm text-slate-500">
          Período selecionado: {format(dateRange.from, 'dd/MM/yyyy')} até {format(dateRange.to, 'dd/MM/yyyy')} ({timeRange} dias)
        </div>
      )}

      {/* Cards de estatísticas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Tickets" 
          value={stats.totalTickets} 
          icon={<Users className="h-4 w-4" />} 
          color="blue"
          description="Todos os tickets no sistema"
        />
        
        <StatCard 
          title="Em Andamento" 
          value={stats.openTickets + stats.inProgressTickets} 
          icon={<Clock className="h-4 w-4" />} 
          color="yellow"
          description="Abertos + Em progresso"
        />
        
        <StatCard 
          title="Resolvidos" 
          value={stats.resolvedTickets} 
          icon={<CheckCircle className="h-4 w-4" />} 
          color="green"
          description="Tickets resolvidos"
        />
        
        <StatCard 
          title="Taxa de Resolução" 
          value={`${stats.totalTickets > 0 
            ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100)
            : 0}%`} 
          icon={<TrendingUp className="h-4 w-4" />} 
          color="purple"
          description="Tickets resolvidos vs total"
        />
      </div>

      {/* Tabs para diferentes visões do dashboard */}
      {(user?.role === 'support' || user?.role === 'admin') && (
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-white">
              <LineChartIcon className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="satisfaction" className="data-[state=active]:bg-white">
              <Star className="h-4 w-4 mr-2" />
              Satisfação
            </TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-white">
              <MessageSquare className="h-4 w-4 mr-2" />
              Feedback
            </TabsTrigger>
          </TabsList>
          
          {/* Tab de Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            {/* Gráfico de tickets ao longo do tempo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart className="h-5 w-5 text-[#D5B170]" />
                  Tickets ao Longo do Tempo
                </CardTitle>
                <CardDescription>
                  Distribuição de tickets por status no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.ticketsOverTime}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => {
                          const d = new Date(date);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [value, 'Tickets']}
                        labelFormatter={(label) => `Data: ${formatDate(label)}`}
                        wrapperStyle={{ zIndex: 1000 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: 15 }} />
                      <Area 
                        type="monotone" 
                        dataKey="open" 
                        name="Abertos" 
                        stackId="1"
                        stroke={STATUS_COLORS.open} 
                        fill={STATUS_COLORS.open} 
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="inProgress" 
                        name="Em Progresso" 
                        stackId="1"
                        stroke={STATUS_COLORS.in_progress} 
                        fill={STATUS_COLORS.in_progress} 
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="resolved" 
                        name="Resolvidos" 
                        stackId="1"
                        stroke={STATUS_COLORS.resolved} 
                        fill={STATUS_COLORS.resolved} 
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="closed" 
                        name="Fechados" 
                        stackId="1"
                        stroke={STATUS_COLORS.closed} 
                        fill={STATUS_COLORS.closed} 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas de Status e Categorias */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribuição por Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PieChart className="h-5 w-5 text-[#D5B170]" />
                    Distribuição por Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Abertos', value: stats.openTickets },
                            { name: 'Em Progresso', value: stats.inProgressTickets },
                            { name: 'Resolvidos', value: stats.resolvedTickets },
                            { name: 'Fechados', value: stats.closedTickets }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell key="open" fill={STATUS_COLORS.open} />
                          <Cell key="in_progress" fill={STATUS_COLORS.in_progress} />
                          <Cell key="resolved" fill={STATUS_COLORS.resolved} />
                          <Cell key="closed" fill={STATUS_COLORS.closed} />
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`${value} tickets`, '']}
                          wrapperStyle={{ zIndex: 1000 }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                      <span className="text-sm">Abertos</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                      <span className="text-sm">Em Progresso</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                      <span className="text-sm">Resolvidos</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                      <span className="text-sm">Fechados</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Distribuição por Categoria */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="h-5 w-5 text-[#D5B170]" />
                    Distribuição por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={stats.categoryDistribution}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          wrapperStyle={{ zIndex: 1000 }}
                        />
                        <Bar 
                          dataKey="value" 
                          name="Tickets" 
                          fill="#D5B170"
                          radius={[0, 4, 4, 0]}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usuários com mais tickets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-[#D5B170]" />
                  Usuários com Mais Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={stats.topUsers}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip 
                        wrapperStyle={{ zIndex: 1000 }}
                      />
                      <Bar 
                        dataKey="tickets" 
                        name="Tickets" 
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      >
                        {stats.topUsers.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab de Performance */}
          <TabsContent value="performance" className="space-y-6">
            {/* Tempo Médio de Resposta por Dia */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-[#D5B170]" />
                  Tempo Médio de Resposta por Dia
                </CardTitle>
                <CardDescription>
                  Tempo médio (em horas) para primeira resposta por dia da semana
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={stats.responseTimeByDay}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value} horas`, 'Tempo de Resposta']}
                        wrapperStyle={{ zIndex: 1000 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="time" 
                        name="Tempo de Resposta" 
                        stroke="#D5B170" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tempo Médio de Resolução</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2 text-[#D5B170]">
                      {stats.avgResolutionTime > 0 
                        ? `${stats.avgResolutionTime.toFixed(1)}`
                        : 'N/A'
                      }
                    </div>
                    <div className="text-sm text-slate-600">
                      Dias em média para resolver um ticket
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Meta: 2 dias</span>
                      <span>{stats.avgResolutionTime <= 2 ? 'Atingida' : 'Não atingida'}</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (stats.avgResolutionTime / 2) * 100)} 
                      className="h-2" 
                      indicatorClassName={stats.avgResolutionTime <= 2 ? "bg-green-500" : "bg-yellow-500"}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Taxa de Atendimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2 text-[#D5B170]">
                      {stats.requestFulfillment.percentage}%
                    </div>
                    <div className="text-sm text-slate-600">
                      Solicitações atendidas
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Meta: 90%</span>
                      <span>{stats.requestFulfillment.percentage >= 90 ? 'Atingida' : 'Não atingida'}</span>
                    </div>
                    <Progress 
                      value={stats.requestFulfillment.percentage} 
                      className="h-2" 
                      indicatorClassName={stats.requestFulfillment.percentage >= 90 ? "bg-green-500" : "bg-yellow-500"}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tickets Resolvidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2 text-[#D5B170]">
                      {stats.resolvedTickets}
                    </div>
                    <div className="text-sm text-slate-600">
                      Total de tickets resolvidos
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Meta: 70% do total</span>
                      <span>
                        {stats.totalTickets > 0 && (stats.resolvedTickets / stats.totalTickets) * 100 >= 70 
                          ? 'Atingida' 
                          : 'Não atingida'}
                      </span>
                    </div>
                    <Progress 
                      value={stats.totalTickets > 0 ? (stats.resolvedTickets / stats.totalTickets) * 100 : 0} 
                      className="h-2" 
                      indicatorClassName={(stats.totalTickets > 0 && (stats.resolvedTickets / stats.totalTickets) * 100 >= 70) 
                        ? "bg-green-500" 
                        : "bg-yellow-500"}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estatísticas de Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-[#D5B170]" />
                  Estatísticas de Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-blue-700">Abertos</h3>
                      <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center">
                        {Math.round((stats.openTickets / stats.totalTickets) * 100)}%
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{stats.openTickets}</p>
                    <p className="text-sm text-blue-600 mt-1">Aguardando atendimento</p>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-yellow-700">Em Progresso</h3>
                      <div className="bg-yellow-100 text-yellow-700 rounded-full w-8 h-8 flex items-center justify-center">
                        {Math.round((stats.inProgressTickets / stats.totalTickets) * 100)}%
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{stats.inProgressTickets}</p>
                    <p className="text-sm text-yellow-600 mt-1">Em atendimento</p>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-green-700">Resolvidos</h3>
                      <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center">
                        {Math.round((stats.resolvedTickets / stats.totalTickets) * 100)}%
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{stats.resolvedTickets}</p>
                    <p className="text-sm text-green-600 mt-1">Solucionados</p>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-700">Fechados</h3>
                      <div className="bg-slate-100 text-slate-700 rounded-full w-8 h-8 flex items-center justify-center">
                        {Math.round((stats.closedTickets / stats.totalTickets) * 100)}%
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{stats.closedTickets}</p>
                    <p className="text-sm text-slate-600 mt-1">Finalizados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab de Satisfação */}
          <TabsContent value="satisfaction" className="space-y-6">
            {/* NPS Score */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-[#D5B170]" />
                    Net Promoter Score (NPS)
                  </CardTitle>
                  <CardDescription>
                    Medida de satisfação e lealdade dos usuários
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className={`text-5xl font-bold mb-2 ${
                      stats.npsScores.score >= 50 ? "text-green-600" : 
                      stats.npsScores.score >= 0 ? "text-yellow-600" : 
                      "text-red-600"
                    }`}>
                      {stats.npsScores.total > 0 ? stats.npsScores.score : 'N/A'}
                    </div>
                    <div className="text-sm text-slate-600">
                      {stats.npsScores.total > 0 
                        ? `Baseado em ${stats.npsScores.total} avaliações`
                        : 'Nenhuma avaliação disponível'
                      }
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">Promotores (9-10)</span>
                      <span>{stats.npsScores.promoters} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.promoters / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.npsScores.total > 0 ? (stats.npsScores.promoters / stats.npsScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-green-500"
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600 font-medium">Neutros (7-8)</span>
                      <span>{stats.npsScores.passives} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.passives / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.npsScores.total > 0 ? (stats.npsScores.passives / stats.npsScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-yellow-500"
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600 font-medium">Detratores (0-6)</span>
                      <span>{stats.npsScores.detractors} ({stats.npsScores.total > 0 ? Math.round((stats.npsScores.detractors / stats.npsScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.npsScores.total > 0 ? (stats.npsScores.detractors / stats.npsScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-red-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ThumbsUp className="h-5 w-5 text-[#D5B170]" />
                    Satisfação do Serviço
                  </CardTitle>
                  <CardDescription>
                    Avaliação da qualidade do atendimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className={`text-5xl font-bold mb-2 ${
                      stats.serviceScores.averageScore >= 8 ? "text-green-600" : 
                      stats.serviceScores.averageScore >= 6 ? "text-yellow-600" : 
                      "text-red-600"
                    }`}>
                      {stats.serviceScores.total > 0 ? stats.serviceScores.averageScore.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-slate-600">
                      {stats.serviceScores.total > 0 
                        ? `Média de ${stats.serviceScores.total} avaliações`
                        : 'Nenhuma avaliação disponível'
                      }
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">Excelente (9-10)</span>
                      <span>{stats.serviceScores.excellent} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.excellent / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.serviceScores.total > 0 ? (stats.serviceScores.excellent / stats.serviceScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-green-500"
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600 font-medium">Bom (7-8)</span>
                      <span>{stats.serviceScores.good} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.good / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.serviceScores.total > 0 ? (stats.serviceScores.good / stats.serviceScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-blue-500"
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600 font-medium">Regular (5-6)</span>
                      <span>{stats.serviceScores.average} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.average / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.serviceScores.total > 0 ? (stats.serviceScores.average / stats.serviceScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-yellow-500"
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600 font-medium">Ruim (1-4)</span>
                      <span>{stats.serviceScores.poor} ({stats.serviceScores.total > 0 ? Math.round((stats.serviceScores.poor / stats.serviceScores.total) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.serviceScores.total > 0 ? (stats.serviceScores.poor / stats.serviceScores.total) * 100 : 0} 
                      className="h-2 bg-slate-100" 
                      indicatorClassName="bg-red-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Atendimento de Solicitações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChart className="h-5 w-5 text-[#D5B170]" />
                  Atendimento de Solicitações
                </CardTitle>
                <CardDescription>
                  Taxa de solicitações atendidas conforme expectativa do usuário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-green-50 to-transparent rounded-lg p-6 border border-green-100">
                    <div className="flex flex-col items-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {stats.requestFulfillment.fulfilled}
                      </div>
                      <div className="text-sm text-green-700 text-center">Solicitações Atendidas</div>
                      <ThumbsUp className="h-6 w-6 text-green-500 mt-2" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-transparent rounded-lg p-6 border border-red-100">
                    <div className="flex flex-col items-center">
                      <div className="text-3xl font-bold text-red-600 mb-2">
                        {stats.requestFulfillment.notFulfilled}
                      </div>
                      <div className="text-sm text-red-700 text-center">Solicitações Não Atendidas</div>
                      <ThumbsDown className="h-6 w-6 text-red-500 mt-2" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-lg p-6 border border-blue-100">
                    <div className="flex flex-col items-center">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {stats.requestFulfillment.percentage}%
                      </div>
                      <div className="text-sm text-blue-700 text-center">Taxa de Atendimento</div>
                      <div className="w-full mt-2">
                        <Progress 
                          value={stats.requestFulfillment.percentage} 
                          className="h-2 bg-slate-200" 
                          indicatorClassName={
                            stats.requestFulfillment.percentage >= 90 ? "bg-green-500" : 
                            stats.requestFulfillment.percentage >= 70 ? "bg-yellow-500" : 
                            "bg-red-500"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Metas de Atendimento</h3>
                  <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <span className="text-sm">Meta Mensal (90%)</span>
                      <Badge variant={stats.requestFulfillment.percentage >= 90 ? "success" : "danger"}>
                        {stats.requestFulfillment.percentage >= 90 ? "Atingida" : "Não atingida"}
                      </Badge>
                    </div>
                    <Progress 
                      value={stats.requestFulfillment.percentage} 
                      className="h-1.5 bg-slate-100" 
                      indicatorClassName={stats.requestFulfillment.percentage >= 90 ? "bg-green-500" : "bg-red-500"}
                    />

                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm">Meta Mínima (70%)</span>
                        <Badge variant={stats.requestFulfillment.percentage >= 70 ? "success" : "danger"}>
                          {stats.requestFulfillment.percentage >= 70 ? "Atingida" : "Não atingida"}
                        </Badge>
                    </div>
                    <Progress 
                      value={stats.requestFulfillment.percentage} 
                      className="h-1.5 bg-slate-100" 
                      indicatorClassName={stats.requestFulfillment.percentage >= 70 ? "bg-green-500" : "bg-red-500"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
{/* Tab de Feedback */}
<TabsContent value="feedback" className="space-y-6">
  {/* Feedback Recente usando o componente RecentFeedbackList */}
  <RecentFeedbackList feedbackItems={stats.recentFeedback} />

  {/* Comentários dos Usuários */}
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Activity className="h-5 w-5 text-[#D5B170]" />
        Comentários dos Usuários
      </CardTitle>
      <CardDescription>
        Feedback textual fornecido pelos usuários
      </CardDescription>
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
                <Card key={feedback.id} className="bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => window.location.href = `/tickets?id=${feedback.id}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between mb-2">
                      <div className="font-medium">{feedback.title}</div>
                      <div className="text-sm text-slate-500">{formatDate(feedback.resolvedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getNpsScoreColor(feedback.npsScore)} variant="outline">
                        NPS: {feedback.npsScore !== undefined ? feedback.npsScore : 'N/A'}
                      </Badge>
                      <Badge className={getNpsScoreColor(feedback.serviceScore)} variant="outline">
                        Serviço: {feedback.serviceScore !== undefined ? feedback.serviceScore : 'N/A'}
                      </Badge>
                      {feedback.requestFulfilled !== undefined && (
                        feedback.requestFulfilled ? 
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <ThumbsUp className="h-3 w-3 mr-1" /> Atendido
                          </Badge> :
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <ThumbsDown className="h-3 w-3 mr-1" /> Não atendido
                          </Badge>
                      )}
                    </div>
                    <p className="text-slate-700 text-sm">{feedback.comment}</p>
                    <div className="mt-2 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-800">
                        Ver detalhes <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
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
                onClick={() => window.location.href = '/tickets/new'}
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