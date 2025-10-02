import { supabase } from '@/lib/supabase';

// Interface para os dados de estatísticas
export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgResolutionTime: number;
  ticketsOverTime: Array<{
    date: string;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }>;
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  topUsers: Array<{
    name: string;
    tickets: number;
  }>;
  responseTimeByDay: Array<{
    day: string;
    time: number;
  }>;
  npsScores: {
    score: number;
    promoters: number;
    passives: number;
    detractors: number;
    total: number;
  };
  serviceScores: {
    averageScore: number;
    excellent: number;
    good: number;
    average: number;
    poor: number;
    total: number;
  };
  requestFulfillment: {
    fulfilled: number;
    notFulfilled: number;
    percentage: number;
  };
  recentFeedback: Array<{
    id: string;
    title: string;
    npsScore?: number;
    serviceScore?: number;
    requestFulfilled?: boolean;
    comment?: string;
    resolvedAt?: string;
  }>;
}

// Função para obter dados do dashboard
export async function getDashboardStats(
  days: number = 30, 
  userId?: string, 
  startDateStr?: string, 
  endDateStr?: string
): Promise<DashboardStats> {
  try {
    // Usar as datas fornecidas ou calcular com base nos dias
    let queryStartDate: string;
    
    if (startDateStr) {
      queryStartDate = startDateStr;
    } else {
      // Calcular a data de início com base no número de dias
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      queryStartDate = startDate.toISOString();
    }

    // Consulta base para tickets
    let query = supabase
      .from('app_c009c0e4f1_tickets')
      .select('*')
      .gte('created_at', queryStartDate);

    // Se endDateStr for fornecido, adicionar filtro de data final
    if (endDateStr) {
      query = query.lte('created_at', endDateStr);
    }

    // Se userId for fornecido, filtrar por usuário (para dashboard do usuário)
    if (userId) {
      query = query.eq('created_by', userId);
    }

    // Buscar tickets
    const { data: tickets, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar tickets: ${error.message}`);
    }

    // Processar os dados para as estatísticas
    const stats = processTicketsData(tickets || [], days);
    
    // Buscar dados de feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('app_c009c0e4f1_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (feedbackError) {
      console.error('Erro ao buscar feedback:', feedbackError);
    }

    // Processar feedback
    stats.recentFeedback = processFeedbackData(feedback || [], tickets || []);

    return stats;
  } catch (error) {
    console.error('Erro no serviço de dashboard:', error);
    throw error;
  }
}

// Função para processar os dados dos tickets
function processTicketsData(tickets: any[], days: number): DashboardStats {
  // Contadores de status
  const openTickets = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
  const closedTickets = tickets.filter(t => t.status === 'closed').length;
  const totalTickets = tickets.length;

  // Calcular tempo médio de resolução
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  tickets.forEach(ticket => {
    if (ticket.resolved_at && ticket.created_at) {
      const createdDate = new Date(ticket.created_at);
      const resolvedDate = new Date(ticket.resolved_at);
      const timeDiff = resolvedDate.getTime() - createdDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      
      totalResolutionTime += daysDiff;
      resolvedCount++;
    }
  });

  const avgResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

  // Gerar dados de tickets ao longo do tempo
  const ticketsOverTime = generateTicketsOverTimeData(tickets, days);

  // Gerar distribuição por categoria
  const categoryDistribution = generateCategoryDistributionData(tickets);

  // Gerar dados de tempo de resposta por dia
  const responseTimeByDay = generateResponseTimeByDayData(tickets);

  // Gerar dados de usuários com mais tickets
  const topUsers = generateTopUsersData(tickets);

  // Buscar dados reais de NPS do feedback
  const npsData = calculateNpsScores(tickets);

  // Buscar dados reais de satisfação do serviço
  const serviceData = calculateServiceScores(tickets);

  // Dados de atendimento de solicitações (baseado em dados reais se disponíveis)
  const requestFulfillmentData = calculateRequestFulfillment(tickets);

  return {
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    avgResolutionTime,
    ticketsOverTime,
    categoryDistribution,
    responseTimeByDay,
    topUsers,
    npsScores: npsData,
    serviceScores: serviceData,
    requestFulfillment: requestFulfillmentData,
    recentFeedback: [] // Será preenchido posteriormente
  };
}

// Função para calcular pontuações NPS a partir de dados reais
function calculateNpsScores(tickets: any[]) {
  // Filtrar tickets com feedback
  const ticketsWithFeedback = tickets.filter(t => t.nps_score !== undefined && t.nps_score !== null);
  
  // Contar promotores (9-10), passivos (7-8) e detratores (0-6)
  const promoters = ticketsWithFeedback.filter(t => t.nps_score >= 9).length;
  const passives = ticketsWithFeedback.filter(t => t.nps_score >= 7 && t.nps_score <= 8).length;
  const detractors = ticketsWithFeedback.filter(t => t.nps_score <= 6).length;
  const total = ticketsWithFeedback.length;
  
  // Calcular pontuação NPS
  const score = total > 0 
    ? Math.round(((promoters / total) - (detractors / total)) * 100) 
    : 0;
  
  return {
    score,
    promoters,
    passives,
    detractors,
    total
  };
}

// Função para calcular pontuações de serviço a partir de dados reais
function calculateServiceScores(tickets: any[]) {
  // Filtrar tickets com avaliação de serviço
  const ticketsWithServiceScore = tickets.filter(t => t.service_score !== undefined && t.service_score !== null);
  
  // Contar por categoria
  const excellent = ticketsWithServiceScore.filter(t => t.service_score >= 9).length;
  const good = ticketsWithServiceScore.filter(t => t.service_score >= 7 && t.service_score <= 8).length;
  const average = ticketsWithServiceScore.filter(t => t.service_score >= 5 && t.service_score <= 6).length;
  const poor = ticketsWithServiceScore.filter(t => t.service_score <= 4).length;
  const total = ticketsWithServiceScore.length;
  
  // Calcular pontuação média
  const totalScore = ticketsWithServiceScore.reduce((sum, t) => sum + t.service_score, 0);
  const averageScore = total > 0 ? totalScore / total : 0;
  
  return {
    averageScore,
    excellent,
    good,
    average,
    poor,
    total
  };
}

// Função para calcular cumprimento de solicitações a partir de dados reais
function calculateRequestFulfillment(tickets: any[]) {
  // Filtrar tickets com feedback sobre cumprimento de solicitação
  const ticketsWithFulfillmentFeedback = tickets.filter(t => 
    t.request_fulfilled !== undefined && t.request_fulfilled !== null
  );
  
  // Contar solicitações atendidas e não atendidas
  const fulfilled = ticketsWithFulfillmentFeedback.filter(t => t.request_fulfilled === true).length;
  const notFulfilled = ticketsWithFulfillmentFeedback.filter(t => t.request_fulfilled === false).length;
  const total = ticketsWithFulfillmentFeedback.length;
  
  // Calcular porcentagem
  const percentage = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
  
  return {
    fulfilled,
    notFulfilled,
    percentage
  };
}

// Função para gerar dados de tickets ao longo do tempo
function generateTicketsOverTimeData(tickets: any[], days: number) {
  const result = [];
  const now = new Date();
  
  // Criar um array de datas para os últimos 'days' dias
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Filtrar tickets para esta data
    const dayTickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.created_at);
      return ticketDate.toISOString().split('T')[0] === dateStr;
    });
    
    result.push({
      date: dateStr,
      open: dayTickets.filter(t => t.status === 'open').length,
      inProgress: dayTickets.filter(t => t.status === 'in_progress').length,
      resolved: dayTickets.filter(t => t.status === 'resolved').length,
      closed: dayTickets.filter(t => t.status === 'closed').length
    });
  }
  
  return result;
}

// Função para gerar dados de distribuição por categoria
function generateCategoryDistributionData(tickets: any[]) {
  const categories: Record<string, number> = {};
  
  tickets.forEach(ticket => {
    const category = ticket.category || 'Sem categoria';
    if (categories[category]) {
      categories[category]++;
    } else {
      categories[category] = 1;
    }
  });
  
  return Object.entries(categories).map(([name, value]) => ({ name, value }));
}

// Função para gerar dados de tempo de resposta por dia da semana
function generateResponseTimeByDayData(tickets: any[]) {
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dayData: Record<string, { count: number; totalTime: number }> = {};
  
  // Inicializar dados para cada dia da semana
  dayNames.forEach(day => {
    dayData[day] = { count: 0, totalTime: 0 };
  });
  
  // Calcular tempo médio de resposta para cada dia
  tickets.forEach(ticket => {
    if (ticket.created_at && ticket.first_response_at) {
      const createdDate = new Date(ticket.created_at);
      const dayName = dayNames[createdDate.getDay()];
      const responseTime = new Date(ticket.first_response_at).getTime() - createdDate.getTime();
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
}

// Função para gerar dados dos usuários com mais tickets
function generateTopUsersData(tickets: any[]) {
  const userCounts: Record<string, { name: string; tickets: number }> = {};
  
  tickets.forEach(ticket => {
    const userName = ticket.created_by_name || 'Usuário desconhecido';
    const userId = ticket.created_by || 'unknown';
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
}

// Função para processar dados de feedback
function processFeedbackData(feedback: any[], tickets: any[]) {
  return feedback.map(item => {
    // Encontrar o ticket correspondente
    const ticket = tickets.find(t => t.id === item.ticket_id);
    
    return {
      id: item.ticket_id,
      title: ticket ? ticket.title : `Ticket #${item.ticket_id}`,
      npsScore: item.nps_score,
      serviceScore: item.service_score,
      requestFulfilled: item.request_fulfilled,
      comment: item.comment,
      resolvedAt: ticket ? ticket.resolved_at : item.created_at
    };
  });
}

// Constantes para cores de status (para referência no frontend)
export const STATUS_COLORS = {
  open: '#3b82f6', // blue-500
  in_progress: '#eab308', // yellow-500
  resolved: '#22c55e', // green-500
  closed: '#6b7280', // gray-500
};

// Constantes para cores de gráficos
export const COLORS = ['#3b82f6', '#eab308', '#22c55e', '#6b7280', '#d946ef'];