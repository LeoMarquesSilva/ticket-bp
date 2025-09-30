import { supabase } from '@/lib/supabase';

type ConnectionListener = () => void;
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

class ConnectionManager {
  private status: ConnectionStatus = 'connected';
  private listeners: ConnectionListener[] = [];
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;

  constructor() {
    this.setupEventListeners();
    this.startPingInterval();
  }

  private setupEventListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Adicionar listener para eventos de visibilidade do documento
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
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
    }
  }

  private startPingInterval() {
    // Limpar intervalo existente se houver
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Verificar conexão a cada 30 segundos
    this.pingInterval = window.setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  private async checkConnection() {
    try {
      // Criar um AbortController para implementar o timeout manualmente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const start = Date.now();
      
      // Usar o signal do AbortController
      const { data, error } = await supabase.from('_health')
        .select('*')
        .limit(1)
        .abortSignal(controller.signal);
      
      // Limpar o timeout
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - start;
      
      console.log(`Connection check completed in ${elapsed}ms`);
      
      if (error) {
        console.error('Connection check failed:', error);
        this.setStatus('disconnected');
        this.reconnect();
      } else {
        this.setStatus('connected');
      }
    } catch (e) {
      console.error('Connection check error:', e);
      this.setStatus('disconnected');
      this.reconnect();
    }
  }

  public reconnect() {
    if (this.status === 'connecting') return;
    
    this.setStatus('connecting');
    console.log('Attempting to reconnect...');
    
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
        } else {
          console.log('Reconnection failed, will retry...');
          this.setStatus('disconnected');
          
          // Agendar nova tentativa com backoff exponencial
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnect();
          }, 5000);
        }
      })
      .catch(err => {
        console.error('Reconnection error:', err);
        this.setStatus('disconnected');
        
        // Agendar nova tentativa com backoff exponencial
        this.reconnectTimeout = window.setTimeout(() => {
          this.reconnect();
        }, 5000);
      });
  }

  private async reconnectSupabase(): Promise<boolean> {
    try {
      // Tentar atualizar a sessão
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }
      
      // Verificar se a sessão foi atualizada com sucesso
      if (data && data.session) {
        console.log('Session refreshed successfully');
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
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public addListener(listener: ConnectionListener) {
    this.listeners.push(listener);
  }

  public removeListener(listener: ConnectionListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.listeners = [];
  }
}

// Criar uma única instância global
export const connectionManager = new ConnectionManager();