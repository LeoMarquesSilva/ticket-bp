import React, { useState, useEffect } from 'react';
import { checkSupabaseConnection } from '../utils/supabaseHelpers';
import { Wifi, WifiOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<{
    connected: boolean;
    latency: number | null;
    checking: boolean;
  }>({
    connected: true, // Assumir conectado inicialmente
    latency: null,
    checking: false,
  });

  const checkConnection = async () => {
    setStatus(prev => ({ ...prev, checking: true }));
    const result = await checkSupabaseConnection();
    setStatus({
      connected: result.connected,
      latency: result.latency,
      checking: false,
    });
  };

  useEffect(() => {
    // Verificar a conexão inicialmente
    checkConnection();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

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
      {status.connected ? (
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