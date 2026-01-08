import { supabase, TABLES } from '@/lib/supabase';

// Interface para os dados de estatísticas
export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  ticketsOverTime: Array<{
    date: string;
    open: number;
    assigned: number;
    inProgress: number;
    resolved: number;
  }>;
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  subcategoryDistribution: Array<{
    category: string;
    subcategory: string;
    value: number;
    slaHours: number;
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
    target: number; // Meta de NPS
  };
  serviceScores: {
    averageScore: number;
    excellent: number;
    good: number;
    average: number;
    poor: number;
    total: number;
    target: number; // Meta de cordialidade
  };
  requestFulfillment: {
    fulfilled: number;
    notFulfilled: number;
    percentage: number;
    target: number; // Meta de resolução
  };
  recentFeedback: Array<{
    id: string;
    title: string;
    npsScore?: number;
    serviceScore?: number;
    requestFulfilled?: boolean;
    comment?: string;
    resolvedAt?: string;
    ticketUrl: string; // URL para navegar para o ticket
    assignedToName: string; // Nome do atendente
    assignedToRole?: string; // Função do atendente (support, lawyer, etc.)
  }>;
}

// Definição de categorias, subcategorias e seus SLAs
export const CATEGORIES_CONFIG = {
  'protocolo': {
    label: 'Protocolo',
    subcategories: [
      { value: 'pedido_urgencia', label: 'Pedido de urgência', slaHours: 2 },
      { value: 'inconsistencia', label: 'Inconsistência', slaHours: 2 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 2 }
    ]
  },
  'cadastro': {
    label: 'Cadastro',
    subcategories: [
      { value: 'senhas_outros_tribunais', label: 'Senhas Outros Tribunais', slaHours: 1 },
      { value: 'senha_tribunal_expirada', label: 'Senha Tribunal Expirada', slaHours: 1 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 24 },
      { value: 'atualizacao_cadastro', label: 'Atualização de Cadastro', slaHours: 24 },
      { value: 'correcao_cadastro', label: 'Correção de Cadastro', slaHours: 24 }
    ]
  },
  'agendamento': {
    label: 'Agendamento',
    subcategories: [
      { value: 'duvidas', label: 'Dúvidas', slaHours: 4 }
    ]
  },
  'publicacoes': {
    label: 'Publicações',
    subcategories: [
      { value: 'problemas_central_publi', label: 'Problemas na central de publi', slaHours: 1 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 2 }
    ]
  },
  'assinatura_digital': {
    label: 'Assinatura Digital',
    subcategories: [
      { value: 'pedido_urgencia', label: 'Pedido de urgência', slaHours: 3 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 3 }
    ]
  },
  'outros': {
    label: 'Outros',
    subcategories: [
      { value: 'outros', label: 'Outros', slaHours: 24 }
    ]
  }
};

// Metas de desempenho
export const PERFORMANCE_TARGETS = {
  NPS: 70, // Meta de NPS: 70%
  RESOLUTION: 80, // Meta de resolução: 80%
  CORDIALITY: 80 // Meta de cordialidade: 80%
};

// Função para obter SLA com base na categoria e subcategoria
export function getSlaHours(category: string, subcategory: string): number {
  const categoryConfig = CATEGORIES_CONFIG[category];
  if (!categoryConfig) return 24; // Padrão: 24 horas
  
  const subcategoryConfig = categoryConfig.subcategories.find(
    sub => sub.value === subcategory
  );
  
  return subcategoryConfig ? subcategoryConfig.slaHours : 24;
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
      .from(TABLES.TICKETS)
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
    
    // Processar feedback diretamente dos tickets (já que não existe uma tabela separada)
    stats.recentFeedback = await processFeedbackFromTickets(tickets || []);

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
  const assignedTickets = tickets.filter(t => t.status === 'assigned').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
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
  
  // Gerar distribuição por subcategoria
  const subcategoryDistribution = generateSubcategoryDistributionData(tickets);

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
    assignedTickets,
    inProgressTickets,
    resolvedTickets,
    avgResolutionTime,
    ticketsOverTime,
    categoryDistribution,
    subcategoryDistribution,
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
    total,
    target: PERFORMANCE_TARGETS.NPS // Meta de NPS: 70%
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
    total,
    target: PERFORMANCE_TARGETS.CORDIALITY // Meta de cordialidade: 80%
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
    percentage,
    target: PERFORMANCE_TARGETS.RESOLUTION // Meta de resolução: 80%
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
      assigned: dayTickets.filter(t => t.status === 'assigned').length,
      inProgress: dayTickets.filter(t => t.status === 'in_progress').length,
      resolved: dayTickets.filter(t => t.status === 'resolved').length
    });
  }
  
  return result;
}

// Função para gerar dados de distribuição por categoria
function generateCategoryDistributionData(tickets: any[]) {
  const categories: Record<string, number> = {};
  
  tickets.forEach(ticket => {
    const category = ticket.category || 'outros';
    if (categories[category]) {
      categories[category]++;
    } else {
      categories[category] = 1;
    }
  });
  
  return Object.entries(categories).map(([name, value]) => ({ name, value }));
}

// Função para gerar dados de distribuição por subcategoria com SLA
function generateSubcategoryDistributionData(tickets: any[]) {
  const subcategories: Record<string, { count: number; category: string; subcategory: string }> = {};
  
  tickets.forEach(ticket => {
    const category = ticket.category || 'outros';
    const subcategory = ticket.subcategory || 'outros';
    const key = `${category}-${subcategory}`;
    
    if (subcategories[key]) {
      subcategories[key].count++;
    } else {
      subcategories[key] = { 
        count: 1, 
        category: category,
        subcategory: subcategory
      };
    }
  });
  
  return Object.entries(subcategories).map(([key, data]) => {
    const [category, subcategory] = key.split('-');
    const slaHours = getSlaHours(category, subcategory);
    
    return { 
      category, 
      subcategory, 
      value: data.count,
      slaHours
    };
  });
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

// Função para processar dados de feedback diretamente dos tickets
async function processFeedbackFromTickets(tickets: any[]) {
  // 1. Filtrar APENAS tickets que realmente têm algum feedback
  // Isso garante que a tabela mostre apenas dados reais de avaliação
  const ticketsWithFeedback = tickets.filter(ticket => 
    (ticket.nps_score !== null && ticket.nps_score !== undefined) || 
    (ticket.service_score !== null && ticket.service_score !== undefined) || 
    (ticket.request_fulfilled !== null && ticket.request_fulfilled !== undefined) ||
    (ticket.comment !== null && ticket.comment !== '') ||
    (ticket.nps_feedback !== null && ticket.nps_feedback !== '')
  );
  
  // 2. Ordenar por data de feedback (mais recente primeiro)
  const sortedTickets = ticketsWithFeedback.sort((a, b) => {
    const dateA = a.feedback_submitted_at || a.resolved_at || a.created_at;
    const dateB = b.feedback_submitted_at || b.resolved_at || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
  
  // 3. Buscar nomes dos usuários para exibir quem atendeu (opcional, mas bom para contexto)
  // Nota: Se você já tiver o 'assigned_to_name' no objeto ticket vindo do banco, isso pode ser simplificado.
  const { data: supportUsers } = await supabase
    .from(TABLES.USERS)
    .select('id, name, role')
    .in('role', ['support', 'lawyer']);
  
  const userMap = new Map();
  if (supportUsers) {
    supportUsers.forEach(user => {
      userMap.set(user.id, { name: user.name, role: user.role });
    });
  }
  
  // 4. Mapear TODOS os tickets encontrados (REMOVIDO O .slice(0, 20))
  const feedbackItems = sortedTickets.map(ticket => {
    const assignedUser = userMap.get(ticket.assigned_to);
    
    return {
      id: ticket.id,
      title: ticket.title || `Ticket #${ticket.id.substring(0, 8)}`,
      npsScore: ticket.nps_score,
      serviceScore: ticket.service_score,
      requestFulfilled: ticket.request_fulfilled,
      // Prioriza o comentário explícito, depois o feedback do NPS
      comment: ticket.comment || ticket.nps_feedback, 
      resolvedAt: ticket.resolved_at,
      ticketUrl: `/tickets/${ticket.id}`,
      assignedToName: ticket.assigned_to_name || (assignedUser ? assignedUser.name : 'Não atribuído'),
      assignedToRole: assignedUser ? assignedUser.role : undefined
    };
  });
  
  // REMOVIDO: A lógica que adicionava usuários vazios ao final.
  // Motivo: Para a tabela de "Detalhamento de Avaliações", queremos ver TICKETS e NOTAS,
  // não queremos ver linhas vazias de atendentes que não receberam nota.
  
  return feedbackItems;
}


// Função para verificar se um ticket está dentro do SLA
export function isTicketWithinSLA(ticket: any): boolean {
  if (!ticket.created_at || !ticket.category || !ticket.subcategory) {
    return true; // Se não tiver informações suficientes, consideramos que está no SLA
  }
  
  // Obter o SLA em horas para esta categoria/subcategoria
  const slaHours = getSlaHours(ticket.category, ticket.subcategory);
  
  // Converter SLA para milissegundos
  const slaMillis = slaHours * 60 * 60 * 1000;
  
  // Calcular o tempo decorrido desde a criação do ticket
  const createdAt = new Date(ticket.created_at).getTime();
  const now = Date.now();
  const elapsedTime = now - createdAt;
  
  // Se o ticket já foi resolvido, verificar se foi resolvido dentro do SLA
  if (ticket.resolved_at) {
    const resolvedAt = new Date(ticket.resolved_at).getTime();
    const resolutionTime = resolvedAt - createdAt;
    return resolutionTime <= slaMillis;
  }
  
  // Se o ticket ainda não foi resolvido, verificar se ainda está dentro do SLA
  return elapsedTime <= slaMillis;
}

// Função para obter o tempo restante do SLA em horas
export function getRemainingSlaTIme(ticket: any): number {
  if (!ticket.created_at || !ticket.category || !ticket.subcategory) {
    return 24; // Valor padrão se não houver informações suficientes
  }
  
  // Se o ticket já foi resolvido, retornar 0
  if (ticket.resolved_at || ticket.status === 'resolved') {
    return 0;
  }
  
  // Obter o SLA em horas para esta categoria/subcategoria
  const slaHours = getSlaHours(ticket.category, ticket.subcategory);
  
  // Calcular o tempo decorrido desde a criação do ticket em horas
  const createdAt = new Date(ticket.created_at).getTime();
  const now = Date.now();
  const elapsedHours = (now - createdAt) / (1000 * 60 * 60);
  
  // Calcular o tempo restante (pode ser negativo se estiver atrasado)
  const remainingHours = slaHours - elapsedHours;
  
  return Math.max(0, Math.round(remainingHours * 10) / 10); // Arredondar para uma casa decimal e não permitir valores negativos
}

// Função para navegar para o ticket a partir do feedback
export function navigateToTicketFromFeedback(ticketId: string): string {
  return `/tickets/${ticketId}`;
}

// Constantes para cores de status (para referência no frontend)
export const STATUS_COLORS = {
  open: '#3b82f6', // blue-500
  assigned: '#f59e0b', // amber-500
  in_progress: '#eab308', // yellow-500
  resolved: '#22c55e', // green-500
};

// Constantes para cores de gráficos
export const COLORS = ['#3b82f6', '#eab308', '#22c55e', '#6b7280', '#d946ef'];

// Constantes para cores de categorias
export const CATEGORY_COLORS = {
  'protocolo': '#3b82f6',     // Azul
  'cadastro': '#eab308',      // Amarelo
  'agendamento': '#22c55e',   // Verde
  'publicacoes': '#d946ef',   // Rosa
  'assinatura_digital': '#f97316', // Laranja
  'outros': '#6b7280',        // Cinza
};