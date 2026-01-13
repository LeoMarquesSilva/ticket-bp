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
  responseTimeByAgent: Array<{
    name: string;
    time: number;
    tickets: number;
  }>;
  resolutionTimeByCategory: Array<{
    category: string;
    time: number;
    tickets: number;
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
    const stats = await processTicketsData(tickets || [], days);
    
    // Processar feedback diretamente dos tickets (já que não existe uma tabela separada)
    stats.recentFeedback = await processFeedbackFromTickets(tickets || []);

    return stats;
  } catch (error) {
    console.error('Erro no serviço de dashboard:', error);
    throw error;
  }
}

// Função para processar os dados dos tickets
async function processTicketsData(tickets: any[], days: number): Promise<DashboardStats> {
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
  const responseTimeByDay = await generateResponseTimeByDayData(tickets);
  
  // Gerar dados de tempo de resposta por atendente
  const responseTimeByAgent = await generateResponseTimeByAgentData(tickets);
  
  // Gerar dados de tempo de resolução por categoria
  const resolutionTimeByCategory = generateResolutionTimeByCategoryData(tickets);

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
    responseTimeByAgent,
    resolutionTimeByCategory,
    topUsers,
    npsScores: npsData,
    serviceScores: serviceData,
    requestFulfillment: requestFulfillmentData,
    recentFeedback: [] // Será preenchido posteriormente
  };
}

// Função para calcular pontuações NPS a partir de dados reais
// Usa service_score (nota de 1-10) para calcular o NPS
function calculateNpsScores(tickets: any[]) {
  // Filtrar tickets com feedback de serviço (service_score)
  const ticketsWithFeedback = tickets.filter(t => t.service_score !== undefined && t.service_score !== null);
  
  // Contar promotores (9-10), passivos (7-8) e detratores (0-6)
  const promoters = ticketsWithFeedback.filter(t => t.service_score >= 9).length;
  const passives = ticketsWithFeedback.filter(t => t.service_score >= 7 && t.service_score <= 8).length;
  const detractors = ticketsWithFeedback.filter(t => t.service_score <= 6).length;
  const total = ticketsWithFeedback.length;
  
  // Calcular pontuação NPS: % Promotores - % Detratores (escala de -100 a 100)
  const score = total > 0 
    ? Math.round(((promoters / total) - (detractors / total)) * 100) 
    : 0;
  
  return {
    score,
    promoters,
    passives,
    detractors,
    total,
    target: PERFORMANCE_TARGETS.NPS // Meta de NPS: 70
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
async function generateResponseTimeByDayData(tickets: any[]): Promise<Array<{ day: string; time: number }>> {
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dayData: Record<string, { count: number; totalTime: number }> = {};
  
  // Inicializar dados para cada dia da semana
  dayNames.forEach(day => {
    dayData[day] = { count: 0, totalTime: 0 };
  });
  
  // Buscar primeira mensagem de atendente para cada ticket (quando first_response_at não estiver disponível)
  const firstResponseByTicket: Record<string, string> = {};
  
  if (tickets.length > 0) {
    const ticketIds = tickets.map(t => t.id);
    
    // Buscar todas as mensagens dos tickets em uma única query
    const { data: allMessages, error: messagesError } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .select('ticket_id, user_id, created_at')
      .in('ticket_id', ticketIds);
    
    if (messagesError) {
      console.error('Erro ao buscar mensagens para cálculo de tempo de resposta:', messagesError);
    }
    
    // Criar um mapa de ticket_id para primeira mensagem do atendente
    if (allMessages && allMessages.length > 0) {
      tickets.forEach(ticket => {
        const ticketMessages = allMessages
          .filter(msg => msg.ticket_id === ticket.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Encontrar a primeira mensagem que não foi enviada pelo criador do ticket
        const firstResponseMessage = ticketMessages.find(msg => msg.user_id !== ticket.created_by);
        
        if (firstResponseMessage) {
          firstResponseByTicket[ticket.id] = firstResponseMessage.created_at;
        }
      });
    }
  }
  
  // Calcular tempo médio de resposta para cada dia
  tickets.forEach(ticket => {
    let firstResponseTime: string | null = null;
    
    // Primeiro, tentar usar first_response_at se estiver disponível
    if (ticket.first_response_at) {
      firstResponseTime = ticket.first_response_at;
    } 
    // Caso contrário, usar a primeira mensagem do atendente
    else if (firstResponseByTicket[ticket.id]) {
      firstResponseTime = firstResponseByTicket[ticket.id];
    }
    
    if (ticket.created_at && firstResponseTime) {
      const createdDate = new Date(ticket.created_at);
      const dayName = dayNames[createdDate.getDay()];
      const responseTime = new Date(firstResponseTime).getTime() - createdDate.getTime();
      const responseTimeHours = responseTime / (1000 * 60 * 60);
      
      // Ignorar valores negativos (erros de data) e valores muito grandes (possíveis erros)
      if (responseTimeHours >= 0 && responseTimeHours < 10000) {
        dayData[dayName].count++;
        dayData[dayName].totalTime += responseTimeHours;
      }
    }
  });
  
  // Calcular a média para cada dia e formatar os dados
  return dayNames.map(day => ({
    day,
    time: dayData[day].count > 0 ? Math.round((dayData[day].totalTime / dayData[day].count) * 10) / 10 : 0
  }));
}

// Função para gerar dados de tempo de resposta por atendente
async function generateResponseTimeByAgentData(tickets: any[]): Promise<Array<{ name: string; time: number; tickets: number }>> {
  const agentData: Record<string, { name: string; totalTime: number; count: number }> = {};
  
  // Buscar todas as mensagens para calcular tempo de primeira resposta
  const ticketIds = tickets.map(t => t.id);
  const firstResponseByTicket: Record<string, string> = {};
  
  if (ticketIds.length > 0) {
    const { data: allMessages } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .select('ticket_id, user_id, created_at')
      .in('ticket_id', ticketIds);
    
    if (allMessages && allMessages.length > 0) {
      tickets.forEach(ticket => {
        const ticketMessages = allMessages
          .filter(msg => msg.ticket_id === ticket.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const firstResponseMessage = ticketMessages.find(msg => msg.user_id !== ticket.created_by);
        if (firstResponseMessage) {
          firstResponseByTicket[ticket.id] = firstResponseMessage.created_at;
        }
      });
    }
  }
  
  // Calcular tempo de resposta por atendente
  tickets.forEach(ticket => {
    if (!ticket.assigned_to_name || ticket.assigned_to_name === 'Não atribuído') return;
    
    let firstResponseTime: string | null = null;
    
    if (ticket.first_response_at) {
      firstResponseTime = ticket.first_response_at;
    } else if (firstResponseByTicket[ticket.id]) {
      firstResponseTime = firstResponseByTicket[ticket.id];
    }
    
    if (ticket.created_at && firstResponseTime) {
      const responseTime = new Date(firstResponseTime).getTime() - new Date(ticket.created_at).getTime();
      const responseTimeHours = responseTime / (1000 * 60 * 60);
      
      if (responseTimeHours >= 0 && responseTimeHours < 10000) {
        const agentName = ticket.assigned_to_name;
        
        if (!agentData[agentName]) {
          agentData[agentName] = { name: agentName, totalTime: 0, count: 0 };
        }
        
        agentData[agentName].totalTime += responseTimeHours;
        agentData[agentName].count++;
      }
    }
  });
  
  // Calcular médias e formatar
  return Object.values(agentData)
    .map(agent => ({
      name: agent.name,
      time: agent.count > 0 ? Math.round((agent.totalTime / agent.count) * 10) / 10 : 0,
      tickets: agent.count
    }))
    .sort((a, b) => a.time - b.time); // Ordenar por tempo (menor primeiro = melhor)
}

// Função para gerar dados de tempo de resolução por categoria
function generateResolutionTimeByCategoryData(tickets: any[]): Array<{ category: string; time: number; tickets: number }> {
  const categoryData: Record<string, { totalTime: number; count: number }> = {};
  
  tickets.forEach(ticket => {
    if (ticket.resolved_at && ticket.created_at && ticket.category) {
      const createdDate = new Date(ticket.created_at);
      const resolvedDate = new Date(ticket.resolved_at);
      const timeDiff = resolvedDate.getTime() - createdDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      
      if (daysDiff >= 0 && daysDiff < 1000) {
        const category = ticket.category;
        
        if (!categoryData[category]) {
          categoryData[category] = { totalTime: 0, count: 0 };
        }
        
        categoryData[category].totalTime += daysDiff;
        categoryData[category].count++;
      }
    }
  });
  
  // Calcular médias e formatar
  return Object.entries(categoryData)
    .map(([category, data]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
      time: data.count > 0 ? Math.round((data.totalTime / data.count) * 10) / 10 : 0,
      tickets: data.count
    }))
    .sort((a, b) => b.tickets - a.tickets); // Ordenar por quantidade de tickets
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
    (ticket.service_score !== null && ticket.service_score !== undefined) || 
    (ticket.request_fulfilled !== null && ticket.request_fulfilled !== undefined) ||
    (ticket.comment !== null && ticket.comment !== '')
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
      npsScore: ticket.service_score, // Usar service_score como NPS
      serviceScore: ticket.service_score,
      requestFulfilled: ticket.request_fulfilled,
      comment: ticket.comment || null, 
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