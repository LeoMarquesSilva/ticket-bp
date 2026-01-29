import { supabase } from '@/lib/supabase';

// Função simples para verificar conectividade
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Função para executar operação com retry simples
export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Limpeza seletiva de canais
export const cleanupExistingChannels = (ticketId: string) => {
  const channels = supabase.getChannels();
  
  channels.forEach(channel => {
    const channelStr = channel.topic || '';
    if (channelStr.includes(`chat-${ticketId}`) && 
        (channel.state === 'closed' || channel.state === 'errored')) {
      supabase.removeChannel(channel);
    }
  });
};

// Limpeza geral apenas de canais problemáticos
export const cleanupAllChannels = () => {
  const channels = supabase.getChannels();
  
  channels.forEach(channel => {
    if (channel.state === 'closed' || channel.state === 'errored') {
      supabase.removeChannel(channel);
    }
  });
};

// Keep-alive muito mais conservador
export const setupKeepAlive = () => {
  const interval = setInterval(async () => {
    if (document.hidden || !navigator.onLine) return;
    try {
      await supabase.from('app_c009c0e4f1_users').select('id').limit(1);
    } catch {
      // Silencioso; keep-alive falhou
    }
  }, 600000); // 10 minutos
  return interval;
};

// Inicialização super simples - SEM listeners de visibilidade
export const initializeConnectionHandlers = () => {
  const keepAliveInterval = setupKeepAlive();
  return () => clearInterval(keepAliveInterval);
};