import { supabase } from '@/lib/supabase';

type ConnectionListener = (status: ConnectionStatus) => void;
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

class ConnectionManager {
  private status: ConnectionStatus = 'connected';
  private listeners: ConnectionListener[] = [];
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private backgroundPingInterval: number | null = null;
  private lastPingTime: number = Date.now();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private healthCheckTable: string = 'app_c009c0e4f1_tickets'; // Tabela que sabemos que existe

  constructor() {
    this.setupEventListeners();
    this.startPingInterval();
    this.setupRealtimeChannel();
  }

  private setupEventListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Adicionar listener para eventos de visibilidade do documento
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Adicionar listener para eventos de beforeunload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  private handleOnline = () => {
    console.log('Network online, attempting to reconnect...');
    this.reconnect();
  }

  private handleOffline = () => {
    console.log('Network offline');
    this.setStatus('disconnected');
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('Document became visible, checking connection...');
      this.checkConnection();
      this.startPingInterval(); // Reiniciar o intervalo normal
      
      // Limpar o intervalo de background se existir
      if (this.backgroundPingInterval) {
        clearInterval(this.backgroundPingInterval);
        this.backgroundPingInterval = null;
      }
    } else {
      console.log('Document hidden, switching to background mode');
      
      // Limpar o intervalo normal
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      // Iniciar um intervalo de ping menos frequente para background
      if (!this.backgroundPingInterval) {
        this.backgroundPingInterval = window.setInterval(() => {
          console.log('Background ping check');
          this.keepAliveConnection();
        }, 45000); // A cada 45 segundos em background
      }
    }
  }

  private handleBeforeUnload = () => {
    // Tentar manter a conexão viva antes de descarregar a página
    this.keepAliveConnection();
  }

  private startPingInterval() {
    // Limpar intervalo existente se houver
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Verificar conexão a cada 30 segundos quando a página está visível
    this.pingInterval = window.setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  // Configurar um canal Realtime para manter a conexão ativa
  private setupRealtimeChannel() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel('connection-keep-alive', {
      config: {
        // Configuração para reduzir a frequência de health checks
        broadcast: { self: true },
        presence: { key: 'connection-manager' }
      }
    });

    // Monitorar status da conexão
    this.channel.on('system', { event: 'connection_status' }, (payload) => {
      console.log('Connection status changed:', payload.status);
      if (payload.status === 'connected') {
        this.setStatus('connected');
        this.reconnectAttempts = 0; // Resetar tentativas de reconexão
      } else if (payload.status === 'disconnected') {
        this.setStatus('disconnected');
        this.reconnect();
      }
    });

    // Tratar erros específicos
    this.channel.on('system', { event: 'error' }, (payload) => {
      // Ignorar erros de health check
      if (payload.error?.code === 'PGRST205' && 
          (payload.error?.message?.includes('health') || 
           payload.error?.message?.includes('_health'))) {
        console.log('Ignorando erro de health check PGRST205');
        return;
      }
      
      console.error('Realtime channel error:', payload);
      
      // Para outros erros, tentar reconectar
      this.reconnect();
    });

    // Inscrever-se no canal
    this.channel.subscribe((status) => {
      console.log('Realtime channel subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('Realtime channel connected');
        this.setStatus('connected');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime channel error');
        this.setStatus('disconnected');
        this.reconnect();
      }
    });

    // Adicionar presença para manter a conexão ativa
    this.channel.track({
      online_at: new Date().toISOString(),
      client_id: `client-${Math.random().toString(36).substring(2, 10)}`
    });
  }

  // Função especial para manter a conexão viva mesmo em background
  private keepAliveConnection() {
    try {
      // Verificar se passou muito tempo desde o último ping
      const now = Date.now();
      const timeSinceLastPing = now - this.lastPingTime;
      
      if (timeSinceLastPing > 60000) { // Se passou mais de 1 minuto
        console.log('Long time since last ping, reconnecting channel');
        this.setupRealtimeChannel(); // Recriar o canal
      }
      
      // Enviar um evento de presença para manter a conexão ativa
      if (this.channel) {
        this.channel.track({
          online_at: new Date().toISOString(),
          client_id: `client-${Math.random().toString(36).substring(2, 10)}`
        });
      }
      
      this.lastPingTime = now;
    } catch (e) {
      console.error('Error in keepAliveConnection:', e);
    }
  }

  private async checkConnection() {
    try {
      // Atualizar o timestamp do último ping
      this.lastPingTime = Date.now();
      
      // Manter a conexão ativa através do canal Realtime
      this.keepAliveConnection();
      
      // Criar um AbortController para implementar o timeout manualmente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const start = Date.now();
      
      // Usar uma tabela que sabemos que existe em vez de _health
      // Isso evita erros PGRST205
      const { data, error } = await supabase.from(this.healthCheckTable)
        .select('count')
        .limit(1)
        .abortSignal(controller.signal);
      
      // Limpar o timeout
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - start;
      
      console.log(`Connection check completed in ${elapsed}ms`);
      
      if (error) {
        // Ignorar erros específicos de health check
        if (error.code === 'PGRST205' && 
            (error.message.includes('health') || 
             error.message.includes('_health'))) {
          console.log('Ignorando erro de health check PGRST205');
          return;
        }
        
        console.error('Connection check failed:', error);
        this.setStatus('disconnected');
        this.reconnect();
      } else {
        this.setStatus('connected');
        this.reconnectAttempts = 0; // Resetar tentativas de reconexão
      }
    } catch (e: any) {
      // Ignorar erros específicos de health check
      if (e?.code === 'PGRST205' && 
          (e?.message?.includes('health') || 
           e?.message?.includes('_health'))) {
        console.log('Ignorando erro de health check PGRST205');
        return;
      }
      
      console.error('Connection check error:', e);
      
      // Verificar se é um erro de abort (timeout)
      if (e instanceof DOMException && e.name === 'AbortError') {
        console.log('Connection check timed out');
      }
      
      this.setStatus('disconnected');
      this.reconnect();
    }
  }

  // Método alternativo para verificar a conexão sem usar tabelas
  private async pingSupabase() {
    try {
      // Usar o endpoint de autenticação para verificar a conexão
      // Este endpoint não depende de tabelas específicas
      const start = Date.now();
      const { data, error } = await supabase.auth.getSession();
      const elapsed = Date.now() - start;
      
      console.log(`Auth ping completed in ${elapsed}ms`);
      
      if (error) {
        console.error('Auth ping failed:', error);
        return false;
      }
      
      return true;
    } catch (e) {
      console.error('Auth ping error:', e);
      return false;
    }
  }

  public reconnect() {
    if (this.status === 'connecting') return;
    
    // Verificar se excedeu o número máximo de tentativas
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Reached max reconnect attempts (${this.maxReconnectAttempts}), waiting for user action`);
      return;
    }
    
    this.reconnectAttempts++;
    
    this.setStatus('connecting');
    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    // Limpar timeout existente se houver
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Tentar reconectar
    this.reconnectSupabase()
      .then(success => {
        if (success) {
          console.log('Reconnection successful');
          this.setStatus('connected');
          this.reconnectAttempts = 0; // Resetar contagem após sucesso
          
          // Reconfigurar o canal Realtime
          this.setupRealtimeChannel();
        } else {
          console.log('Reconnection failed, will retry...');
          this.setStatus('disconnected');
          
          // Agendar nova tentativa com backoff exponencial
          const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`Will retry in ${backoffTime/1000} seconds`);
          
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnect();
          }, backoffTime);
        }
      })
      .catch(err => {
        console.error('Reconnection error:', err);
        this.setStatus('disconnected');
        
        // Agendar nova tentativa com backoff exponencial
        const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Will retry in ${backoffTime/1000} seconds`);
        
        this.reconnectTimeout = window.setTimeout(() => {
          this.reconnect();
        }, backoffTime);
      });
  }

  private async reconnectSupabase(): Promise<boolean> {
    try {
      // Primeiro, tentar um ping simples
      const pingSuccess = await this.pingSupabase();
      
      if (pingSuccess) {
        console.log('Ping successful, connection is active');
        
        // Reconfigurar o canal Realtime
        this.setupRealtimeChannel();
        
        return true;
      }
      
      // Se o ping falhar, tentar atualizar a sessão
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }
      
      // Verificar se a sessão foi atualizada com sucesso
      if (data && data.session) {
        console.log('Session refreshed successfully');
        
        // Reconfigurar o canal Realtime
        this.setupRealtimeChannel();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyListeners(newStatus);
    }
  }

  private notifyListeners(status: ConnectionStatus) {
    this.listeners.forEach(listener => listener(status));
  }

  public addListener(listener: ConnectionListener) {
    this.listeners.push(listener);
    // Notificar imediatamente o novo listener com o status atual
    listener(this.status);
  }

  public removeListener(listener: ConnectionListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  // Método para forçar uma verificação de conexão e reconexão
  public forceCheck() {
    console.log('Forcing connection check');
    this.checkConnection();
  }

  public cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.backgroundPingInterval) {
      clearInterval(this.backgroundPingInterval);
      this.backgroundPingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.listeners = [];
  }
}

// Criar uma única instância global
export const connectionManager = new ConnectionManager();