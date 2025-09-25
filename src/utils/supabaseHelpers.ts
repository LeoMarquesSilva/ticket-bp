import { supabase } from '../lib/supabase';

// Função para executar operações com retry automático
export const executeWithRetry = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delayMs = 1000
) => {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      retries++;
      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delayMs}ms...`);
      
      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Aumentar o tempo de espera para cada nova tentativa
      delayMs *= 2;
    }
  }

  console.error('Todas as tentativas falharam:', lastError);
  throw lastError;
};

// Função para verificar a conexão com o Supabase
export const checkSupabaseConnection = async () => {
  try {
    const start = Date.now();
    const { data, error } = await supabase.from('health_check').select('count').maybeSingle();
    const elapsed = Date.now() - start;
    
    if (error && error.code !== 'PGRST116') { // PGRST116 é o erro quando a tabela não existe
      console.error('Erro ao verificar conexão com Supabase:', error);
      return { connected: false, latency: null, error };
    }
    
    return { connected: true, latency: elapsed, error: null };
  } catch (error) {
    console.error('Exceção ao verificar conexão com Supabase:', error);
    return { connected: false, latency: null, error };
  }
};

// Função para manter a conexão ativa
export const setupKeepAlive = () => {
  const ping = async () => {
    const status = await checkSupabaseConnection();
    console.log(`Supabase connection: ${status.connected ? 'OK' : 'FAILED'}, Latency: ${status.latency}ms`);
  };

  // Executar imediatamente e depois a cada 4 minutos
  ping();
  return setInterval(ping, 4 * 60 * 1000);
};