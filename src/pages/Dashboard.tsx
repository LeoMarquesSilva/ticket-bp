import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardStats } from '@/services/dashboardService';
import { TicketService } from '@/services/ticketService';
import {
  BarChart3, LineChart as LineChartIcon, PieChart, Users, Clock, CheckCircle, 
  TrendingUp, Star, MessageSquare, ThumbsUp, ThumbsDown, User, Activity,
  RefreshCw, Calendar, AlertTriangle, ArrowUp, ArrowDown, BarChart, Layers,
  ChevronRight, HelpCircle, HeadphonesIcon, Briefcase, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, BarChart as RechartsBarChart, Bar, LineChart,
  Line, TooltipProps
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { format, subDays, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RecentFeedbackList from '@/components/RecentFeedbackList';

// Cores da Marca
const BRAND = {
  orange: '#F69F19',
  red: '#DE5532',
  dark: '#2C2D2F',
  gold: '#D5B170',
  slate: '#64748b',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

const STATUS_COLORS_MAP = {
  open: '#94a3b8', 
  assigned: BRAND.gold,
  in_progress: BRAND.orange,
  resolved: BRAND.success
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({
    totalTickets: 0,
    openTickets: 0,
    assignedTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
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
  
  // Estados para o Chat Modal
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTicket, setChatTicket] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let days = parseInt(timeRange);
        let startDateStr, endDateStr;
        
        if (dateRange?.from) {
          const start = startOfDay(dateRange.from);
          const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
          const diffTime = Math.abs(end.getTime() - start.getTime());
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          startDateStr = start.toISOString();
          endDateStr = end.toISOString();
        } else {
          const end = endOfDay(new Date());
          const start = startOfDay(subDays(new Date(), days));
          startDateStr = start.toISOString();
          endDateStr = end.toISOString();
        }
        
        const data = await getDashboardStats(
          days, 
          user?.role === 'user' ? user.id : undefined,
          startDateStr,
          endDateStr
        );
        
        setStats(data);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError('Não foi possível carregar os dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [refreshKey, user, dateRange]);

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setTimeRange(diffDays.toString());
    }
  }, [dateRange]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // === LÓGICA DO CHAT ===
  const handleOpenChat = async (ticket: any) => {
    setChatTicket(ticket);
    setIsChatOpen(true);
    setIsChatLoading(true);
    setChatMessages([]); 

    try {
      const messages = await TicketService.getTicketMessages(ticket.id);
      setChatMessages(messages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
  };

  // === LÓGICA DE ESTILO DAS MENSAGENS ===
  const getMessageStyles = (role: string | undefined) => {
    const normalizedRole = (role || '').toLowerCase();
    
    // Lista de roles que devem aparecer na DIREITA (Lado da Empresa)
    const companyRoles = ['admin', 'support', 'lawyer', 'administrator'];
    const isCompanySide = companyRoles.includes(normalizedRole);

    if (isCompanySide) {
      // --- LADO DIREITO (EMPRESA) ---
      let bubbleClass = '';
      let avatarBg = '';
      let icon = null;
      let label = '';
      let nameColor = '';

      if (normalizedRole === 'lawyer') {
        bubbleClass = 'bg-[#DE5532] text-white rounded-tr-none'; // Advogado (Vermelho)
        avatarBg = 'bg-[#DE5532]';
        icon = <Briefcase className="h-4 w-4 text-white" />;
        label = 'Advogado';
        nameColor = 'text-[#DE5532]';
      } else {
        bubbleClass = 'bg-[#F69F19] text-[#2C2D2F] rounded-tr-none'; // Suporte/Admin (Amarelo)
        avatarBg = 'bg-[#F69F19]';
        icon = <HeadphonesIcon className="h-4 w-4 text-[#2C2D2F]" />;
        label = 'Suporte';
        nameColor = 'text-[#F69F19]';
      }

      return {
        containerClass: 'justify-end',
        flexDirection: 'flex-row-reverse',
        bubbleClass,
        avatarBg,
        icon,
        label,
        nameColor,
        textAlign: 'text-right'
      };
    } else {
      // --- LADO ESQUERDO (CLIENTE/USUÁRIO) ---
      return {
        containerClass: 'justify-start',
        flexDirection: 'flex-row',
        bubbleClass: 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200',
        avatarBg: 'bg-[#2C2D2F]',
        icon: <User className="h-4 w-4 text-white" />,
        label: 'Cliente',
        nameColor: 'text-[#2C2D2F]',
        textAlign: 'text-left'
      };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return "bg-green-100 text-green-700 border-green-200";
    if (score >= 7) return "bg-blue-50 text-blue-700 border-blue-200";
    if (score >= 5) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<any, any>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#2C2D2F] text-white p-3 rounded-lg shadow-xl border border-white/10 text-xs">
          <p className="font-bold mb-1 border-b border-white/10 pb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="font-mono font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const PercentageChange = ({ current, previous }: { current: number, previous: number }) => {
    if (!previous) return null;
    const percentChange = ((current - previous) / previous) * 100;
    const isPositive = percentChange > 0;
    
    return (
      <span className={`text-xs font-medium flex items-center ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}
        {Math.abs(percentChange).toFixed(1)}%
      </span>
    );
  };

  const StatCard = ({ title, value, previousValue, icon, type = 'default' }: any) => {
    const getIconStyle = () => {
      switch(type) {
        case 'warning': return 'bg-[#F69F19]/10 text-[#F69F19]';
        case 'success': return 'bg-green-100 text-green-600';
        case 'info': return 'bg-blue-50 text-blue-600';
        default: return 'bg-[#2C2D2F]/5 text-[#2C2D2F]';
      }
    };

    return (
      <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
              <h3 className="text-3xl font-bold text-[#2C2D2F]">{value}</h3>
              {previousValue && (
                <div className="mt-1">
                  <PercentageChange current={typeof value === 'number' ? value : 0} previous={previousValue} />
                </div>
              )}
            </div>
            <div className={`p-3 rounded-xl ${getIconStyle()}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-in fade-in">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-[#F69F19] animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-500 font-medium">Carregando métricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertTriangle className="h-8 w-8 text-[#DE5532]" />
        </div>
        <h3 className="text-lg font-bold text-[#2C2D2F] mb-2">Erro ao carregar dados</h3>
        <p className="text-slate-500 mb-6 max-w-md">{error}</p>
        <Button onClick={handleRefresh} className="bg-[#F69F19] hover:bg-[#e08e12] text-white">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Premium */}
      <div className="relative rounded-2xl overflow-hidden bg-[#2C2D2F] shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#F69F19]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#DE5532]/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Dashboard
            </h1>
            <p className="text-slate-400 max-w-xl">
              {user?.role === 'user'
                ? 'Acompanhe o status e histórico dos seus chamados.'
                : 'Visão geral de performance, satisfação e métricas de atendimento.'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-white/5 p-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
              className="w-full sm:w-auto bg-transparent border-0 text-white focus:ring-0 hover:bg-white/5"
              locale={ptBR}
            />
            <Button 
              size="icon"
              variant="ghost" 
              onClick={handleRefresh}
              className="text-slate-400 hover:text-white hover:bg-white/10"
              title="Atualizar dados"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Tickets" value={stats.totalTickets} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Em Atendimento" value={stats.openTickets + stats.assignedTickets + stats.inProgressTickets} icon={<Clock className="h-5 w-5" />} type="warning" />
        <StatCard title="Resolvidos" value={stats.resolvedTickets} icon={<CheckCircle className="h-5 w-5" />} type="success" />
        <StatCard title="Taxa de Resolução" value={`${stats.totalTickets > 0 ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) : 0}%`} icon={<TrendingUp className="h-5 w-5" />} type="info" />
      </div>

      {/* Conteúdo Principal com Tabs */}
      {(user?.role === 'support' || user?.role === 'admin') && (
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center md:justify-start">
            <TabsList className="bg-slate-100 p-1 rounded-full border border-slate-200">
              <TabsTrigger value="overview" className="rounded-full px-6 data-[state=active]:bg-[#2C2D2F] data-[state=active]:text-white transition-all">Visão Geral</TabsTrigger>
              <TabsTrigger value="performance" className="rounded-full px-6 data-[state=active]:bg-[#2C2D2F] data-[state=active]:text-white transition-all">Performance</TabsTrigger>
              <TabsTrigger value="satisfaction" className="rounded-full px-6 data-[state=active]:bg-[#2C2D2F] data-[state=active]:text-white transition-all">Satisfação</TabsTrigger>
              <TabsTrigger value="feedback" className="rounded-full px-6 data-[state=active]:bg-[#2C2D2F] data-[state=active]:text-white transition-all">Feedback</TabsTrigger>
            </TabsList>
          </div>

          {/* === TAB: VISÃO GERAL === */}
          <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#2C2D2F] flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-[#F69F19]" />
                  Volume de Tickets
                </CardTitle>
                <CardDescription>Evolução diária por status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.ticketsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={STATUS_COLORS_MAP.open} stopOpacity={0.3}/><stop offset="95%" stopColor={STATUS_COLORS_MAP.open} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={STATUS_COLORS_MAP.in_progress} stopOpacity={0.3}/><stop offset="95%" stopColor={STATUS_COLORS_MAP.in_progress} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={STATUS_COLORS_MAP.resolved} stopOpacity={0.3}/><stop offset="95%" stopColor={STATUS_COLORS_MAP.resolved} stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'dd/MM')} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Area type="monotone" dataKey="open" name="Abertos" stroke={STATUS_COLORS_MAP.open} fillOpacity={1} fill="url(#colorOpen)" strokeWidth={2} />
                      <Area type="monotone" dataKey="inProgress" name="Em Andamento" stroke={STATUS_COLORS_MAP.in_progress} fillOpacity={1} fill="url(#colorProgress)" strokeWidth={2} />
                      <Area type="monotone" dataKey="resolved" name="Resolvidos" stroke={STATUS_COLORS_MAP.resolved} fillOpacity={1} fill="url(#colorResolved)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2C2D2F]">Status Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Abertos', value: stats.openTickets, color: STATUS_COLORS_MAP.open },
                            { name: 'Atribuídos', value: stats.assignedTickets, color: STATUS_COLORS_MAP.assigned },
                            { name: 'Em Progresso', value: stats.inProgressTickets, color: STATUS_COLORS_MAP.in_progress },
                            { name: 'Resolvidos', value: stats.resolvedTickets, color: STATUS_COLORS_MAP.resolved }
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                        >
                          {[
                            { color: STATUS_COLORS_MAP.open },
                            { color: STATUS_COLORS_MAP.assigned },
                            { color: STATUS_COLORS_MAP.in_progress },
                            { color: STATUS_COLORS_MAP.resolved }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2C2D2F]">Top Solicitantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={stats.topUsers} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                        <Bar dataKey="tickets" name="Tickets" fill={BRAND.orange} radius={[0, 4, 4, 0]} barSize={20}>
                          {stats.topUsers.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? BRAND.orange : BRAND.gold} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === TAB: PERFORMANCE === */}
          <TabsContent value="performance" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#2C2D2F] flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#DE5532]" />
                  Tempo de Resposta (Horas)
                </CardTitle>
                <CardDescription>Média de tempo para primeira resposta por dia da semana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.responseTimeByDay} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="time" name="Horas" stroke={BRAND.red} strokeWidth={3} dot={{ r: 4, fill: BRAND.red, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: BRAND.red }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Tempo Médio de Resolução', value: stats.avgResolutionTime.toFixed(1), unit: 'dias', target: 2, inverse: true },
                { label: 'Taxa de Atendimento', value: stats.requestFulfillment.percentage, unit: '%', target: 90, inverse: false },
                { label: 'Tickets Resolvidos', value: stats.totalTickets > 0 ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) : 0, unit: '% do total', target: 70, inverse: false }
              ].map((kpi, idx) => {
                const isGood = kpi.inverse ? Number(kpi.value) <= kpi.target : Number(kpi.value) >= kpi.target;
                return (
                  <Card key={idx} className="border-slate-200">
                    <CardContent className="p-6 text-center">
                      <h3 className="text-sm font-medium text-slate-500 mb-2">{kpi.label}</h3>
                      <div className="flex items-baseline justify-center gap-1 mb-4">
                        <span className={`text-4xl font-bold ${isGood ? 'text-green-600' : 'text-[#F69F19]'}`}>{kpi.value}</span>
                        <span className="text-sm text-slate-400">{kpi.unit}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isGood ? 'bg-green-500' : 'bg-[#F69F19]'}`} style={{ width: `${Math.min(100, (Number(kpi.value) / (kpi.inverse ? kpi.target * 2 : 100)) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400">Meta: {kpi.target} {kpi.unit}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* === TAB: SATISFAÇÃO === */}
          <TabsContent value="satisfaction" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="overflow-hidden border-slate-200">
                <div className="h-2 w-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#F69F19]" />
                    Net Promoter Score (NPS)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="text-6xl font-bold text-[#2C2D2F] mb-2">{stats.npsScores.score}</div>
                    <Badge variant="outline" className="mb-6">
                      {stats.npsScores.score >= 50 ? 'Zona de Excelência' : stats.npsScores.score >= 0 ? 'Zona de Aperfeiçoamento' : 'Zona Crítica'}
                    </Badge>
                    <div className="w-full space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium"><span className="text-green-600">Promotores (9-10)</span><span>{stats.npsScores.promoters}</span></div>
                        <Progress value={(stats.npsScores.promoters / stats.npsScores.total) * 100 || 0} className="h-2 bg-slate-100" indicatorClassName="bg-green-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium"><span className="text-yellow-600">Neutros (7-8)</span><span>{stats.npsScores.passives}</span></div>
                        <Progress value={(stats.npsScores.passives / stats.npsScores.total) * 100 || 0} className="h-2 bg-slate-100" indicatorClassName="bg-yellow-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium"><span className="text-red-600">Detratores (0-6)</span><span>{stats.npsScores.detractors}</span></div>
                        <Progress value={(stats.npsScores.detractors / stats.npsScores.total) * 100 || 0} className="h-2 bg-slate-100" indicatorClassName="bg-red-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-[#F69F19]" />
                    Qualidade do Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center mb-6">
                    <div className="relative">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle className="text-slate-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                        <circle className="text-[#F69F19]" strokeWidth="8" strokeDasharray={365} strokeDashoffset={365 - (365 * (stats.serviceScores.averageScore / 10))} strokeLinecap="round" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                      </svg>
                      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-[#2C2D2F]">{stats.serviceScores.averageScore.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">de 10</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100"><div className="text-2xl font-bold text-green-700">{stats.serviceScores.excellent}</div><div className="text-xs text-green-600">Excelente</div></div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100"><div className="text-2xl font-bold text-blue-700">{stats.serviceScores.good}</div><div className="text-xs text-blue-600">Bom</div></div>
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100"><div className="text-2xl font-bold text-yellow-700">{stats.serviceScores.average}</div><div className="text-xs text-yellow-600">Regular</div></div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100"><div className="text-2xl font-bold text-red-700">{stats.serviceScores.poor}</div><div className="text-xs text-red-600">Ruim</div></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* === TABELA DE DETALHAMENTO DAS AVALIAÇÕES === */}
            <Card className="border-slate-200 shadow-sm mt-6">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#2C2D2F]">Detalhamento das Avaliações</CardTitle>
                    <CardDescription>Lista de tickets avaliados no período e suas respectivas notas</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-white">
                    {stats.recentFeedback?.length || 0} avaliações
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[300px]">Ticket</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-center">NPS</TableHead>
                        <TableHead className="text-center">Serviço</TableHead>
                        <TableHead>Comentário</TableHead>
                        <TableHead className="text-right">Ver Conversa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!stats.recentFeedback || stats.recentFeedback.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                            Nenhuma avaliação encontrada neste período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        stats.recentFeedback.map((feedback: any) => (
                          <TableRow key={feedback.id} className="hover:bg-slate-50/50">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-[#2C2D2F] truncate max-w-[280px]" title={feedback.title}>
                                  {feedback.title}
                                </span>
                                <span className="text-xs text-slate-400">ID: #{feedback.id.slice(0, 8)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {formatDate(feedback.resolvedAt)}
                            </TableCell>
                            <TableCell className="text-center">
                              {feedback.npsScore !== undefined && feedback.npsScore !== null ? (
                                <Badge variant="outline" className={`${getScoreColor(feedback.npsScore)} font-bold`}>
                                  {feedback.npsScore}
                                </Badge>
                              ) : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {feedback.serviceScore !== undefined && feedback.serviceScore !== null ? (
                                <Badge variant="outline" className={`${getScoreColor(feedback.serviceScore)} font-bold`}>
                                  {feedback.serviceScore}
                                </Badge>
                              ) : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {feedback.comment ? (
                                <span className="text-sm text-slate-600 line-clamp-2 italic" title={feedback.comment}>
                                  "{feedback.comment}"
                                </span>
                              ) : <span className="text-xs text-slate-300 italic">Sem comentário</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleOpenChat(feedback)}
                                className="h-8 w-8 p-0 text-[#2C2D2F] hover:text-[#F69F19] hover:bg-slate-100"
                                title="Ver Histórico da Conversa"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TAB: FEEDBACK === */}
          <TabsContent value="feedback" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <RecentFeedbackList feedbackItems={stats.recentFeedback} />
          </TabsContent>
        </Tabs>
      )}

      {/* Ações Rápidas para Usuário Comum */}
      {user?.role === 'user' && (
        <Card className="bg-gradient-to-r from-[#2C2D2F] to-[#1a1b1c] border-0 text-white shadow-lg">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold mb-1">Precisa de ajuda agora?</h3>
              <p className="text-slate-400 text-sm">Abra um novo ticket ou verifique o status dos seus chamados.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => window.location.href = '/tickets'} variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                Meus Tickets
              </Button>
              <Button onClick={() => window.location.href = '/tickets/new'} className="bg-[#F69F19] hover:bg-[#e08e12] text-white border-0">
                Novo Chamado
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === MODAL DE HISTÓRICO DE CHAT === */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        {/* CORREÇÃO: Altura fixa (80vh) e padding zerado no container principal */}
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0" aria-describedby="chat-history-description">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl">Histórico da Conversa</DialogTitle>
            <DialogDescription id="chat-history-description">
              Histórico completo de mensagens do ticket {chatTicket?.title}.
            </DialogDescription>
            
            <div className="mt-3 space-y-2">
              {/* Informações do atendente */}
              {chatTicket?.assignedToName && (
                <div className="flex items-center gap-2">
                  <div className="w-24 text-xs font-medium text-slate-500">Atendente:</div>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-5 w-5 bg-slate-200">
                      <AvatarFallback className={
                        chatTicket.assignedToRole === 'lawyer' ? 'bg-[#DE5532] text-white' :
                        chatTicket.assignedToRole === 'support' ? 'bg-[#F69F19] text-[#2C2D2F]' :
                        'bg-[#2C2D2F] text-[#F6F6F6]'
                      }>
                        {chatTicket.assignedToRole === 'lawyer' ? <Briefcase className="h-3 w-3" /> :
                        chatTicket.assignedToRole === 'support' ? <HeadphonesIcon className="h-3 w-3" /> :
                        getInitials(chatTicket.assignedToName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{chatTicket.assignedToName}</span>
                    {chatTicket.assignedToRole && (
                      <Badge variant="outline" className="text-xs font-normal ml-1 bg-slate-50 border-slate-200">
                        {chatTicket.assignedToRole === 'lawyer' ? 'Advogado' : 
                        chatTicket.assignedToRole === 'support' ? 'Suporte' : 'Atendente'}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Separator className="my-3" />
          </DialogHeader>
          
          {/* Legenda Atualizada - Com padding lateral */}
          <div className="px-6 pb-2">
            <div className="flex flex-wrap gap-4 px-2 bg-[#F6F6F6] p-2 rounded-md justify-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300"></div>
                <span className="text-xs text-[#2C2D2F]">Cliente (Esq)</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#F69F19]"></div>
                  <span className="text-xs text-[#2C2D2F]">Suporte (Dir)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#DE5532]"></div>
                  <span className="text-xs text-[#2C2D2F]">Advogado (Dir)</span>
                </div>
              </div>
            </div>
          </div>
          
          {isChatLoading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="text-center py-8 text-slate-500 flex-1 flex flex-col items-center justify-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma mensagem encontrada para este ticket.</p>
            </div>
          ) : (
            // CORREÇÃO: flex-1 para ocupar o espaço restante e permitir scroll
            <ScrollArea className="flex-1 w-full p-6 pt-0">
              <div className="space-y-6 w-full">
                {chatMessages.map((message) => {
                  const styles = getMessageStyles(message.userRole);
                  
                  return (
                    <div key={message.id} className={`flex w-full ${styles.containerClass}`}>
                      <div className={`flex gap-3 max-w-[85%] ${styles.flexDirection}`}>
                        
                        {/* Avatar - shrink-0 impede que o avatar seja esmagado */}
                        <div className="flex flex-col items-center mt-1 shrink-0">
                          <Avatar className={`h-8 w-8 ${styles.avatarBg}`}>
                            <AvatarFallback className={`${styles.avatarBg} flex items-center justify-center`}>
                              {styles.icon}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        {/* Balão da Mensagem - min-w-0 ajuda no flexbox aninhado */}
                        <div className="flex flex-col min-w-0">
                          <div className={`rounded-lg p-3 shadow-sm ${styles.bubbleClass} overflow-hidden`}>
                            <p className="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-wide">
                              {message.userName || styles.label}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.message}
                            </p>
                          </div>
                          
                          {/* Data */}
                          <div className={`text-[10px] mt-1 ${styles.textAlign} text-slate-400`}>
                            {formatDate(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          {/* Footer com padding */}
          <div className="p-6 pt-2 border-t border-slate-100 flex justify-end">
            <Button onClick={() => setIsChatOpen(false)} variant="outline">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
