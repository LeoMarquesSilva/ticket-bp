import React, { useState, useEffect, useCallback } from 'react';
import { checkSupabaseConnection } from '../utils/supabaseHelpers';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<{
    connected: boolean;
    latency: number | null;
    checking: boolean;
    lastChecked: number | null;
  }>({
    connected: true, // Assumir conectado inicialmente
    latency: null,
    checking: false,
    lastChecked: null,
  });

  const checkConnection = useCallback(async () => {
    if (status.checking) return; // Evitar múltiplas verificações simultâneas
    
    setStatus(prev => ({ ...prev, checking: true }));
    const result = await checkSupabaseConnection();
    setStatus({
      connected: result.connected,
      latency: result.latency,
      checking: false,
      lastChecked: Date.now(),
    });
  }, [status.checking]);

  useEffect(() => {
    // Verificar a conexão inicialmente
    checkConnection();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    
    // Adicionar event listener para verificar quando a conexão voltar
    window.addEventListener('online', checkConnection);
    window.addEventListener('focus', checkConnection);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('focus', checkConnection);
    };
  }, [checkConnection]);

  return (
    <div 
      className={`fixed bottom-4 right-4 px-3 py-1 rounded-full flex items-center gap-2 text-xs transition-all ${
        status.connected 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800 animate-pulse'
      }`}
      onClick={checkConnection}
      title="Clique para verificar a conexão"
      style={{ cursor: 'pointer' }}
    >
      {status.checking ? (
        <RefreshCw size={14} className="animate-spin text-blue-600" />
      ) : status.connected ? (
        <Wifi size={14} className="text-green-600" />
      ) : (
        <WifiOff size={14} className="text-red-600" />
      )}
      
      <span>
        {status.checking 
          ? 'Verificando...' 
          : status.connected 
            ? `Conectado${status.latency ? ` (${status.latency}ms)` : ''}` 
            : 'Desconectado'
        }
      </span>
    </div>
  );
};