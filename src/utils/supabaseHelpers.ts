import { supabase } from '../lib/supabase';
import { saveForLater, processPendingOperations } from './offlineStorage';

// Cache para armazenar o status da conexão
let connectionStatus = {
  connected: true,
  lastChecked: Date.now(),
  checking: false
};

// Função para executar operações com retry automático
export const executeWithRetry = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delayMs = 1000
) => {
  let retries = 0;
  let lastError;

  // Se já sabemos que estamos offline, não tente a operação
  if (!connectionStatus.connected && Date.now() - connectionStatus.lastChecked < 10000) {
    throw new Error('Aplicativo está offline. Operação armazenada para execução posterior.');
  }

  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      retries++;
      console.log(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delayMs}ms...`);
      
      // Verificar se o erro é de conexão
      if (error.message && (
          error.message.includes('network') || 
          error.message.includes('connection') ||
          error.message.includes('offline') ||
          error.message.includes('Failed to fetch')
        )) {
        // Atualizar status de conexão
        connectionStatus.connected = false;
        connectionStatus.lastChecked = Date.now();
      }
      
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
  // Se já estamos verificando, retorne o status atual
  if (connectionStatus.checking) {
    return { 
      connected: connectionStatus.connected, 
      latency: null, 
      error: null 
    };
  }

  connectionStatus.checking = true;
  
  try {
    const start = Date.now();
    
    // Primeiro tente um ping simples para verificar a conexão com a internet
    try {
      await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
    } catch (e) {
      // Se não conseguir acessar o Google, provavelmente está offline
      connectionStatus = {
        connected: false,
        lastChecked: Date.now(),
        checking: false
      };
      return { connected: false, latency: null, error: e };
    }
    
    // Agora verifica a conexão com o Supabase
    const { data, error } = await supabase
      .from('health_check')
      .select('count')
      .maybeSingle()
      
    const elapsed = Date.now() - start;
    
    if (error && error.code !== 'PGRST116') { // PGRST116 é o erro quando a tabela não existe
      console.error('Erro ao verificar conexão com Supabase:', error);
      connectionStatus = {
        connected: false,
        lastChecked: Date.now(),
        checking: false
      };
      return { connected: false, latency: null, error };
    }
    
    connectionStatus = {
      connected: true,
      lastChecked: Date.now(),
      checking: false
    };
    
    // Se estamos online, processar operações pendentes
    processPendingOperations({
      'sendChatMessage': async (data) => {
        const { ticketId, userId, userName, message, attachments } = data;
        return await supabase
          .from('app_c009c0e4f1_chat_messages')
          .insert([{
            ticket_id: ticketId,
            user_id: userId,
            user_name: userName,
            message: message,
            attachments: attachments || null,
            created_at: new Date().toISOString(),
            read: false
          }])
          .select()
          .single();
      }
    });
    
    return { connected: true, latency: elapsed, error: null };
  } catch (error) {
    console.error('Exceção ao verificar conexão com Supabase:', error);
    connectionStatus = {
      connected: false,
      lastChecked: Date.now(),
      checking: false
    };
    return { connected: false, latency: null, error };
  } finally {
    connectionStatus.checking = false;
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

// Função para verificar se estamos online antes de executar uma operação
export const isOnline = async () => {
  // Se verificamos recentemente, use o valor em cache
  if (Date.now() - connectionStatus.lastChecked < 10000) {
    return connectionStatus.connected;
  }
  
  // Caso contrário, verifique novamente
  const status = await checkSupabaseConnection();
  return status.connected;
};