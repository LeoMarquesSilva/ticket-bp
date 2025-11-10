import { supabase } from '@/lib/supabase';

// Função para verificar se estamos online
export const isOnline = async (): Promise<boolean> => {
  // Primeiro verifica o estado do navegador
  if (!navigator.onLine) return false;
  
 // Tenta fazer uma consulta simples para verificar a conexão real
try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  const { error } = await supabase.from('_health')
    .select('*')
    .limit(1)
    .abortSignal(controller.signal);
  
  clearTimeout(timeoutId);
  return !error;
} catch (e) {
  return false;
}
};

// Função para executar uma operação com tentativas automáticas
export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Tentativa ${attempt + 1}/${maxRetries} falhou:`, error);
      lastError = error;
      
      // Esperar antes da próxima tentativa (com backoff exponencial)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error('Operação falhou após múltiplas tentativas');
};

// Função para reconectar o Supabase
export const reconnectSupabase = async (): Promise<boolean> => {
  try {
    // Tentar atualizar a sessão
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Falha ao atualizar sessão:', error);
      return false;
    }
    
    // Verificar se a sessão foi atualizada com sucesso
    return !!(data && data.session);
  } catch (error) {
    console.error('Erro ao reconectar:', error);
    return false;
  }
};

// Configurar listeners para eventos de rede
export const setupNetworkListeners = (onReconnect: () => void) => {
  window.addEventListener('online', async () => {
    console.log('Rede voltou online, tentando reconectar...');
    const success = await reconnectSupabase();
    if (success && onReconnect) {
      onReconnect();
    }
  });
};

// Limpar canais existentes para um ticket específico
export const cleanupExistingChannels = (ticketId: string) => {
  const channels = supabase.getChannels();
  
  channels.forEach(channel => {
    const channelStr = channel.topic || '';
    if (channelStr.includes(`chat-${ticketId}`)) {
      console.log(`Removendo canal existente para ticket ${ticketId}:`, channelStr);
      supabase.removeChannel(channel);
    }
  });
};

// Limpar todos os canais
export const cleanupAllChannels = () => {
  const channels = supabase.getChannels();
  
  channels.forEach(channel => {
    console.log(`Removendo canal:`, channel.topic);
    supabase.removeChannel(channel);
  });
};

// Configurar ping periódico para manter a conexão ativa
export const setupKeepAlive = () => {
  console.log('Configurando keep-alive para Supabase');
  
  // Fazer ping a cada 4 minutos para manter a conexão ativa
  const interval = setInterval(async () => {
    try {
      // Verificar se o navegador está online antes de tentar
      if (!navigator.onLine) {
        console.log('Navegador offline, pulando keep-alive');
        return;
      }
      
      console.log('Executando ping keep-alive');
      const start = Date.now();
      
      // Fazer uma consulta leve para manter a conexão
      const { error } = await supabase.from('_health').select('count').maybeSingle();
      
      const elapsed = Date.now() - start;
      if (error) {
        console.error(`Ping falhou após ${elapsed}ms:`, error);
        
        // Tentar reconectar se o ping falhar
        const reconnected = await reconnectSupabase();
        console.log('Tentativa de reconexão:', reconnected ? 'bem-sucedida' : 'falhou');
      } else {
        console.log(`Ping bem-sucedido (${elapsed}ms)`);
      }
    } catch (error) {
      console.error('Erro durante keep-alive:', error);
    }
  }, 240000); // 4 minutos
  
  return interval;
};

// Verificar o estado da sessão e reconectar se necessário
export const checkAndRefreshSession = async (): Promise<boolean> => {
  try {
    // Verificar se temos uma sessão válida
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro ao verificar sessão:', error);
      return false;
    }
    
    // Se não houver sessão ou ela estiver expirando em breve, atualizar
    if (!data.session || isSessionExpiringSoon(data.session)) {
      console.log('Sessão ausente ou expirando em breve, tentando atualizar...');
      return await reconnectSupabase();
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar e atualizar sessão:', error);
    return false;
  }
};

// Verificar se a sessão está expirando em breve (menos de 5 minutos)
const isSessionExpiringSoon = (session: any): boolean => {
  if (!session || !session.expires_at) return true;
  
  try {
    const expiresAt = new Date(session.expires_at).getTime();
    const now = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    
    return expiresAt - now < fiveMinutesInMs;
  } catch (e) {
    console.error('Erro ao verificar expiração da sessão:', e);
    return true; // Por segurança, considerar que está expirando
  }
};

// Verificar se há operações pendentes para executar
export const checkPendingOperations = async () => {
  try {
    // Implementação depende do seu sistema de armazenamento offline
    // Esta é uma função de exemplo que você pode expandir conforme necessário
    const pendingOpsKey = 'pending_operations';
    const pendingOpsStr = localStorage.getItem(pendingOpsKey);
    
    if (!pendingOpsStr) return;
    
    const pendingOps = JSON.parse(pendingOpsStr);
    if (!Array.isArray(pendingOps) || pendingOps.length === 0) return;
    
    console.log(`Encontradas ${pendingOps.length} operações pendentes para processar`);
    
    // Processar operações pendentes aqui
    // ...
    
    // Limpar operações processadas
    localStorage.removeItem(pendingOpsKey);
  } catch (error) {
    console.error('Erro ao verificar operações pendentes:', error);
  }
};

// Configurar listeners para eventos de visibilidade do documento
export const setupVisibilityListeners = () => {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('Documento tornou-se visível, verificando conexão...');
      
      // Verificar se estamos online
      const online = await isOnline();
      
      if (online) {
        // Verificar e atualizar a sessão se necessário
        await checkAndRefreshSession();
        
        // Verificar operações pendentes
        await checkPendingOperations();
      } else {
        console.log('Documento visível, mas sem conexão');
      }
    }
  });
};

// Inicializar todos os listeners e mecanismos de recuperação
export const initializeConnectionHandlers = () => {
  setupNetworkListeners(() => {
    checkAndRefreshSession();
    checkPendingOperations();
  });
  
  setupVisibilityListeners();
  setupKeepAlive();
  
  console.log('Handlers de conexão inicializados');
};