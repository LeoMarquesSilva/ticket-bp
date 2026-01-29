import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getDashboardStats } from '@/services/dashboardService';
import { TicketService } from '@/services/ticketService';
import {
  BarChart3, LineChart as LineChartIcon, PieChart, Users, Clock, CheckCircle, 
  TrendingUp, Star, MessageSquare, ThumbsUp, ThumbsDown, User, Activity,
  RefreshCw, Calendar, AlertTriangle, ArrowUp, ArrowDown, BarChart, Layers,
  ChevronRight, HelpCircle, HeadphonesIcon, Briefcase, Loader2, ArrowUpDown, ChevronDown, ChevronUp, Tag
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, BarChart as RechartsBarChart, Bar, LineChart,
  Line, TooltipProps
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { format, subDays, endOfDay, startOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, startOfWeek, endOfWeek, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RecentFeedbackList from '@/components/RecentFeedbackList';
import { CategoryService } from '@/services/categoryService';

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
  const { has } = usePermissions();
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
    responseTimeByAgent: [],
    resolutionTimeByCategory: [],
    topUsers: [],
    npsScores: { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 },
    serviceScores: { averageScore: 0, excellent: 0, good: 0, average: 0, poor: 0, total: 0 },
    requestFulfillment: { fulfilled: 0, notFulfilled: 0, percentage: 0 },
    recentFeedback: []
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [timeRange, setTimeRange] = useState('30');
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>>({});
  const [frentes, setFrentes] = useState<{ id: string; label: string; color: string }[]>([]);
  const [frenteFilter, setFrenteFilter] = useState<string>('all');
  
  // Estados para o Chat Modal
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTicket, setChatTicket] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const [activePeriod, setActivePeriod] = useState<string>('30days');

  // Estados para ordenação da tabela de avaliações
  const [sortColumn, setSortColumn] = useState<'nps' | 'requestFulfilled' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Estado para controlar quais comentários estão expandidos
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  // Função para alternar expansão de comentário
  const toggleCommentExpansion = (feedbackId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedbackId)) {
        newSet.delete(feedbackId);
      } else {
        newSet.add(feedbackId);
      }
      return newSet;
    });
  };
  
  // Função para lidar com ordenação
  const handleSort = (column: 'nps' | 'requestFulfilled') => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é uma nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Função para ordenar os feedbacks
  const getSortedFeedback = () => {
    if (!stats.recentFeedback || !sortColumn) {
      return stats.recentFeedback || [];
    }
    
    const sorted = [...stats.recentFeedback].sort((a, b) => {
      if (sortColumn === 'nps') {
        const aVal = a.npsScore ?? -1; // -1 para colocar valores nulos no final
        const bVal = b.npsScore ?? -1;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (sortColumn === 'requestFulfilled') {
        // Para boolean: true (Sim) vem depois de false (Não) em ascendente
        const aVal = a.requestFulfilled === true ? 1 : a.requestFulfilled === false ? 0 : -1;
        const bVal = b.requestFulfilled === true ? 1 : b.requestFulfilled === false ? 0 : -1;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    
    return sorted;
  };

  // Carregar categorias e frentes de atuação do banco de dados
  useEffect(() => {
    const loadData = async () => {
      try {
        const [config, tags] = await Promise.all([
          CategoryService.getCategoriesConfig(),
          CategoryService.getAllTags(false)
        ]);
        setCategoriesConfig(config);
        setFrentes(tags.map((t) => ({ id: t.id, label: t.label, color: t.color })));
      } catch (error) {
        console.error('Erro ao carregar categorias do banco:', error);
      }
    };

    loadData();
  }, []);

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
          endDateStr,
          frenteFilter && frenteFilter !== 'all' ? frenteFilter : undefined
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
  }, [refreshKey, user, dateRange, frenteFilter]);

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
  
  // Função para aplicar filtro rápido de período
  const applyPeriodFilter = (period: string) => {
    const today = new Date();
    let from: Date;
    let to: Date = endOfDay(today);
    
    switch (period) {
      case 'today':
        from = startOfDay(today);
        to = endOfDay(today);
        break;
      case '7days':
        from = startOfDay(subDays(today, 6));
        to = endOfDay(today);
        break;
      case '30days':
        from = startOfDay(subDays(today, 29));
        to = endOfDay(today);
        break;
      case '90days':
        from = startOfDay(subDays(today, 89));
        to = endOfDay(today);
        break;
      case 'thisMonth':
        from = startOfDay(startOfMonth(today));
        to = endOfDay(endOfMonth(today));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        from = startOfDay(startOfMonth(lastMonth));
        to = endOfDay(endOfMonth(lastMonth));
        break;
      case 'thisYear':
        from = startOfDay(startOfYear(today));
        to = endOfDay(endOfYear(today));
        break;
      case 'lastYear':
        const lastYear = new Date(today.getFullYear() - 1, 0, 1);
        from = startOfDay(startOfYear(lastYear));
        to = endOfDay(endOfYear(lastYear));
        break;
      default:
        from = startOfDay(subDays(today, 29));
        to = endOfDay(today);
    }
    
    setDateRange({ from, to });
    setActivePeriod(period);
  };

  // === LÓGICA DO CHAT ===
  const handleOpenChat = async (ticket: any) => {
    setIsChatOpen(true);
    setIsChatLoading(true);
    setChatMessages([]); 

    try {
      // Se for um feedback (tem apenas id, title, etc), buscar o ticket completo
      let fullTicket = ticket;
      if (ticket.id && (!ticket.createdBy || !ticket.category || !ticket.createdAt)) {
        const ticketData = await TicketService.getTicket(ticket.id);
        if (ticketData) {
          fullTicket = {
            ...ticket,
            ...ticketData,
            createdBy: ticketData.createdBy || ticket.createdBy,
            createdByName: ticketData.createdByName || ticket.createdByName,
            category: ticketData.category || ticket.category,
            subcategory: ticketData.subcategory || ticket.subcategory,
            createdAt: ticketData.createdAt || ticket.createdAt,
            resolvedAt: ticketData.resolvedAt || ticket.resolvedAt
          };
        }
      }
      
      setChatTicket(fullTicket);
      // Resetar o estado de detalhes ao abrir um novo ticket
      setShowTicketDetails(false);
      const messages = await TicketService.getTicketMessages(fullTicket.id);
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
  const getMessageStyles = (message: any, ticket: any) => {
    // Identificar se a mensagem é do cliente (criador do ticket) ou do suporte/advogado/admin
    // Se o userId da mensagem for igual ao createdBy do ticket, é do cliente (esquerda)
    // Caso contrário, é do suporte/advogado/admin (direita)
    const isFromClient = ticket?.createdBy && message.userId === ticket.createdBy;
    
    if (!isFromClient) {
      // --- LADO DIREITO (SUPORTE/ADVOGADO/ADMIN) ---
      // Verificar se é advogado baseado no assignedToRole do ticket
      const isLawyer = ticket?.assignedToRole === 'lawyer';
      
      let bubbleClass = '';
      let avatarBg = '';
      let icon = null;
      let label = '';
      let nameColor = '';

      if (isLawyer) {
        bubbleClass = 'bg-[#DE5532] text-white rounded-tr-none'; // Advogado (Vermelho)
        avatarBg = 'bg-[#DE5532]';
        icon = <Briefcase className="h-4 w-4 text-white" />;
        label = 'Advogado';
        nameColor = 'text-[#DE5532]';
      } else {
        bubbleClass = 'bg-[#F69F19] text-white rounded-tr-none'; // Suporte/Admin (Laranja)
        avatarBg = 'bg-[#F69F19]';
        icon = <HeadphonesIcon className="h-4 w-4 text-white" />;
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

  // Função para obter o label formatado da categoria
  const getCategoryLabel = (category: string): string => {
    if (Object.keys(categoriesConfig).length === 0) return category || 'Geral';
    const categoryConfig = categoriesConfig[category];
    return categoryConfig?.label || category || 'Geral';
  };

  // Função para obter o label formatado da subcategoria
  const getSubcategoryLabel = (category: string, subcategory: string): string => {
    if (Object.keys(categoriesConfig).length === 0 || !category || !subcategory) return subcategory || '';
    const categoryConfig = categoriesConfig[category];
    if (!categoryConfig) return subcategory || '';
    
    const subcategoryConfig = categoryConfig.subcategories.find(
      sub => sub.value === subcategory
    );
    return subcategoryConfig?.label || subcategory;
  };

  // Função para calcular e formatar o tempo de resolução
  const getResolutionTime = (createdAt?: string, resolvedAt?: string): string => {
    if (!createdAt || !resolvedAt) return 'Não resolvido';
    
    try {
      const created = new Date(createdAt);
      const resolved = new Date(resolvedAt);
      const hours = differenceInHours(resolved, created);
      const days = differenceInDays(resolved, created);
      
      if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else {
        const minutes = Math.round((resolved.getTime() - created.getTime()) / (1000 * 60));
        return `${minutes}min`;
      }
    } catch (error) {
      return 'Erro ao calcular';
    }
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

          <div className="flex flex-col gap-3 w-full md:w-auto">
            {/* Botões de Filtro Rápido */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => applyPeriodFilter('today')}
                variant={activePeriod === 'today' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === 'today' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                Hoje
              </Button>
              <Button
                onClick={() => applyPeriodFilter('7days')}
                variant={activePeriod === '7days' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === '7days' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                7 dias
              </Button>
              <Button
                onClick={() => applyPeriodFilter('30days')}
                variant={activePeriod === '30days' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === '30days' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                30 dias
              </Button>
              <Button
                onClick={() => applyPeriodFilter('90days')}
                variant={activePeriod === '90days' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === '90days' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                90 dias
              </Button>
              <Button
                onClick={() => applyPeriodFilter('thisMonth')}
                variant={activePeriod === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === 'thisMonth' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                Este mês
              </Button>
              <Button
                onClick={() => applyPeriodFilter('lastMonth')}
                variant={activePeriod === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === 'lastMonth' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                Mês passado
              </Button>
              <Button
                onClick={() => applyPeriodFilter('thisYear')}
                variant={activePeriod === 'thisYear' ? 'default' : 'outline'}
                size="sm"
                className={activePeriod === 'thisYear' ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white border-0' : 'bg-white/5 text-white border-white/20 hover:bg-white/10'}
              >
                Este ano
              </Button>
            </div>
            
            {/* Filtro por Frente de Atuação */}
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10 min-w-[200px]">
              <Tag className="h-4 w-4 text-slate-400 shrink-0" />
              <Select value={frenteFilter} onValueChange={setFrenteFilter}>
                <SelectTrigger className="bg-transparent border-0 text-white focus:ring-0 focus:ring-offset-0 w-full [&>span]:text-left">
                  <SelectValue placeholder="Frente de atuação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as frentes</SelectItem>
                  <SelectItem value="sem-frente">Sem frente de atuação</SelectItem>
                  {frentes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                        {f.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleção Personalizada e Botão de Atualizar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
                <DatePickerWithRange
                  date={dateRange}
                  setDate={(range) => {
                    setDateRange(range);
                    setActivePeriod('custom');
                  }}
                  className="w-full sm:w-auto bg-transparent border-0 text-white"
                  locale={ptBR}
                />
              </div>
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
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Tickets" value={stats.totalTickets} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Em Atendimento" value={stats.openTickets + stats.assignedTickets + stats.inProgressTickets} icon={<Clock className="h-5 w-5" />} type="warning" />
        <StatCard title="Resolvidos" value={stats.resolvedTickets} icon={<CheckCircle className="h-5 w-5" />} type="success" />
        <StatCard title="Taxa de Resolução" value={`${stats.totalTickets > 0 ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100) : 0}%`} icon={<TrendingUp className="h-5 w-5" />} type="info" />
      </div>

      {/* Conteúdo Principal com Tabs - quem tem permissão dashboard vê gráficos e abas */}
      {has('dashboard') && (
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico: Tempo de Resposta por Atendente */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2C2D2F] flex items-center gap-2">
                    <User className="h-5 w-5 text-[#F69F19]" />
                    Tempo de Resposta por Atendente
                  </CardTitle>
                  <CardDescription>Média de horas para primeira resposta (menor é melhor)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={stats.responseTimeByAgent || []} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} label={{ value: 'Horas', position: 'insideBottom', offset: -5, fill: '#64748b' }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={70} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                  <p className="font-semibold text-[#2C2D2F]">{data.name}</p>
                                  <p className="text-sm text-slate-600">Tempo médio: <span className="font-bold">{data.time}h</span></p>
                                  <p className="text-sm text-slate-600">Tickets: <span className="font-bold">{data.tickets}</span></p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="time" name="Horas" fill={BRAND.orange} radius={[0, 4, 4, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico: Tempo de Resolução por Categoria */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#2C2D2F] flex items-center gap-2">
                    <Layers className="h-5 w-5 text-[#DE5532]" />
                    Tempo de Resolução por Categoria
                  </CardTitle>
                  <CardDescription>Média de dias para resolver tickets (menor é melhor)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={stats.resolutionTimeByCategory || []} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} angle={-45} textAnchor="end" height={80} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} label={{ value: 'Dias', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                  <p className="font-semibold text-[#2C2D2F]">{data.category}</p>
                                  <p className="text-sm text-slate-600">Tempo médio: <span className="font-bold">{data.time} dias</span></p>
                                  <p className="text-sm text-slate-600">Tickets: <span className="font-bold">{data.tickets}</span></p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="time" name="Dias" fill={BRAND.red} radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                  <CardDescription>Baseado na avaliação do atendimento (1-10)</CardDescription>
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

            {/* Gráfico de "Sua solicitação foi atendida" */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#10B981]" />
                  Sua Solicitação Foi Atendida?
                </CardTitle>
                <CardDescription>Distribuição de solicitações atendidas vs não atendidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Atendidas', value: stats.requestFulfillment.fulfilled, fill: '#10B981' },
                          { name: 'Não Atendidas', value: stats.requestFulfillment.notFulfilled, fill: '#EF4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#EF4444" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                    <div className="text-3xl font-bold text-green-700">{stats.requestFulfillment.fulfilled}</div>
                    <div className="text-sm text-green-600 mt-1">Solicitações Atendidas</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                    <div className="text-3xl font-bold text-red-700">{stats.requestFulfillment.notFulfilled}</div>
                    <div className="text-sm text-red-600 mt-1">Solicitações Não Atendidas</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold text-[#2C2D2F]">{stats.requestFulfillment.percentage}%</div>
                  <div className="text-sm text-slate-500">Taxa de Atendimento</div>
                </div>
              </CardContent>
            </Card>

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
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-center">
                          <button
                            onClick={() => handleSort('nps')}
                            className="flex items-center justify-center gap-1 hover:text-[#F69F19] transition-colors cursor-pointer w-full"
                          >
                            NPS
                            {sortColumn === 'nps' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="text-center">
                          <button
                            onClick={() => handleSort('requestFulfilled')}
                            className="flex items-center justify-center gap-1 hover:text-[#F69F19] transition-colors cursor-pointer w-full"
                          >
                            Solicitação Atendida
                            {sortColumn === 'requestFulfilled' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>Comentário</TableHead>
                        <TableHead className="text-right">Ver Conversa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!stats.recentFeedback || stats.recentFeedback.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                            Nenhuma avaliação encontrada neste período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        getSortedFeedback().map((feedback: any) => (
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
                            <TableCell>
                              <span className="text-sm text-slate-700">{feedback.createdByName || 'Não informado'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-700">{feedback.assignedToName || 'Não atribuído'}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {feedback.npsScore !== undefined && feedback.npsScore !== null ? (
                                <Badge variant="outline" className={`${getScoreColor(feedback.npsScore)} font-bold`}>
                                  {feedback.npsScore}
                                </Badge>
                              ) : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {feedback.requestFulfilled !== undefined && feedback.requestFulfilled !== null ? (
                                <Badge 
                                  variant="outline" 
                                  className={`font-bold ${
                                    feedback.requestFulfilled 
                                      ? 'bg-green-50 text-green-700 border-green-200' 
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {feedback.requestFulfilled ? 'Sim' : 'Não'}
                                </Badge>
                              ) : <span className="text-slate-300">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {(() => {
                                const isExpanded = expandedComments.has(feedback.id);
                                
                                // Se a solicitação não foi atendida, mostrar o motivo primeiro
                                if (feedback.requestFulfilled === false && feedback.notFulfilledReason) {
                                  const hasLongContent = feedback.notFulfilledReason.length > 100 || (feedback.comment && feedback.comment.length > 100);
                                  
                                  return (
                                    <div className="space-y-1">
                                      <div className={`text-sm text-red-600 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                        <span className="font-semibold">❌ Motivo:</span> {feedback.notFulfilledReason}
                                      </div>
                                      {feedback.comment && (
                                        <div className={`text-sm text-slate-600 ${!isExpanded ? 'line-clamp-2' : ''} italic`}>
                                          💬 "{feedback.comment}"
                                        </div>
                                      )}
                                      {hasLongContent && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleCommentExpansion(feedback.id);
                                          }}
                                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 mt-1"
                                        >
                                          {isExpanded ? (
                                            <>
                                              <ChevronUp className="h-3 w-3 mr-1" />
                                              Ver menos
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="h-3 w-3 mr-1" />
                                              Ver mais
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                }
                                // Caso contrário, mostrar apenas o comentário normal
                                if (feedback.comment) {
                                  const hasLongContent = feedback.comment.length > 100;
                                  
                                  return (
                                    <div className="space-y-1">
                                      <div className={`text-sm text-slate-600 ${!isExpanded ? 'line-clamp-2' : ''} italic`}>
                                        "{feedback.comment}"
                                      </div>
                                      {hasLongContent && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleCommentExpansion(feedback.id);
                                          }}
                                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 mt-1"
                                        >
                                          {isExpanded ? (
                                            <>
                                              <ChevronUp className="h-3 w-3 mr-1" />
                                              Ver menos
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="h-3 w-3 mr-1" />
                                              Ver mais
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                }
                                return <span className="text-xs text-slate-300 italic">Sem comentário</span>;
                              })()}
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
          <DialogHeader className="p-4 sm:p-6 pb-2">
            <DialogTitle className="text-lg sm:text-xl">Histórico da Conversa</DialogTitle>
            <DialogDescription id="chat-history-description" className="text-xs sm:text-sm">
              Histórico completo de mensagens do ticket {chatTicket?.title}.
            </DialogDescription>
            
            {/* Botão Mostrar Detalhes */}
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTicketDetails(!showTicketDetails)}
                className="w-full sm:w-auto text-xs"
              >
                {showTicketDetails ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Mostrar detalhes
                  </>
                )}
              </Button>
            </div>

            {/* Detalhes do Ticket (expandível) */}
            {showTicketDetails && chatTicket && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-in slide-in-from-top-2">
                {/* Data e Hora de Criação - Sempre mostrar se ticket existe */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-[#2C2D2F]">Criado em:</span>
                  <span className="text-slate-700">
                    {chatTicket.createdAt ? (
                      format(new Date(chatTicket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    ) : (
                      <span className="text-slate-400 italic">Não informado</span>
                    )}
                  </span>
                </div>
                
                {/* Tempo de Resolução */}
                {chatTicket.createdAt && chatTicket.resolvedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-[#2C2D2F]">Tempo de resolução:</span>
                    <span className="text-slate-700">{getResolutionTime(chatTicket.createdAt, chatTicket.resolvedAt)}</span>
                  </div>
                )}
                
                {/* Categoria e Subcategoria */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-[#2C2D2F]">Categoria:</span>
                  <span className="text-slate-700">
                    {(chatTicket.category || chatTicket.subcategory) ? (
                      <>
                        {getCategoryLabel(chatTicket.category || 'outros')}
                        {chatTicket.subcategory && (
                          <span> / {getSubcategoryLabel(chatTicket.category || 'outros', chatTicket.subcategory)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Não informado</span>
                    )}
                  </span>
                </div>
              </div>
            )}
            
            <div className="mt-3 space-y-2">
              {/* Informações do cliente/usuario */}
              {chatTicket?.createdByName && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-xs font-medium text-slate-500 shrink-0">Cliente:</div>
                    <span className="text-xs sm:text-sm text-slate-700 truncate">{chatTicket.createdByName}</span>
                  </div>
                  {/* NPS */}
                  {chatTicket?.serviceScore !== undefined && chatTicket?.serviceScore !== null && (
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-slate-500 shrink-0">NPS:</div>
                      <Badge variant="outline" className={`${getScoreColor(chatTicket.serviceScore)} font-bold text-xs shrink-0`}>
                        {chatTicket.serviceScore}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              {/* Informações do atendente */}
              {chatTicket?.assignedToName && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-xs font-medium text-slate-500 shrink-0">Atendente:</div>
                    <div className="flex items-center gap-1 min-w-0">
                      <Avatar className="h-4 w-4 sm:h-5 sm:w-5 bg-slate-200 shrink-0">
                        <AvatarFallback className={
                          chatTicket.assignedToRole === 'lawyer' ? 'bg-[#DE5532] text-white' :
                          chatTicket.assignedToRole === 'support' ? 'bg-[#F69F19] text-white' :
                          'bg-[#2C2D2F] text-[#F6F6F6]'
                        }>
                          {chatTicket.assignedToRole === 'lawyer' ? <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> :
                          chatTicket.assignedToRole === 'support' ? <HeadphonesIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> :
                          getInitials(chatTicket.assignedToName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs sm:text-sm text-slate-700 truncate">{chatTicket.assignedToName}</span>
                      {chatTicket.assignedToRole && (
                        <Badge variant="outline" className="text-xs font-normal bg-slate-50 border-slate-200 shrink-0 hidden sm:inline-flex">
                          {chatTicket.assignedToRole === 'lawyer' ? 'Advogado' : 
                          chatTicket.assignedToRole === 'support' ? 'Suporte' : 'Atendente'}
                        </Badge>
                      )}
                    </div>
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
                  const styles = getMessageStyles(message, chatTicket);
                  
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
