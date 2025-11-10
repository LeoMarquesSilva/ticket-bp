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
      console.log(`🧹 Removendo canal ${channel.state} para ticket ${ticketId}`);
      supabase.removeChannel(channel);
    }
  });
};

// Limpeza geral apenas de canais problemáticos
export const cleanupAllChannels = () => {
  const channels = supabase.getChannels();
  
  channels.forEach(channel => {
    if (channel.state === 'closed' || channel.state === 'errored') {
      console.log(`🧹 Removendo canal ${channel.state}:`, channel.topic);
      supabase.removeChannel(channel);
    }
  });
};

// Keep-alive muito mais conservador
export const setupKeepAlive = () => {
  console.log('💓 Configurando keep-alive conservador');
  
  const interval = setInterval(async () => {
    // Só executar se a aba estiver visível E online
    if (document.hidden || !navigator.onLine) {
      return;
    }
    
    try {
      // Ping muito simples
      await supabase.from('app_c009c0e4f1_users').select('id').limit(1);
      console.log('💓 Keep-alive OK');
    } catch (error) {
      console.warn('⚠️ Keep-alive falhou:', error);
    }
  }, 600000); // 10 minutos
  
  return interval;
};

// Inicialização super simples - SEM listeners de visibilidade
export const initializeConnectionHandlers = () => {
  const keepAliveInterval = setupKeepAlive();
  
  console.log('🔧 Handlers de conexão simples inicializados');
  
  return () => {
    clearInterval(keepAliveInterval);
  };
};