import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export const ConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Rede online');
      setStatus('connected');
    };

    const handleOffline = () => {
      console.log('📵 Rede offline');
      setStatus('disconnected');
    };

    // Verificar status inicial
    setStatus(navigator.onLine ? 'connected' : 'disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setStatus('connecting');
    
    // Simular tentativa de reconexão
    setTimeout(() => {
      if (navigator.onLine) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
      setIsReconnecting(false);
    }, 2000);
  };

  if (status === 'connected') {
    return null; // Não mostrar nada quando conectado
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[90] bg-red-500 p-2 text-center text-white">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>
          {status === 'disconnected' && 'Sem conexão com a internet'}
          {status === 'connecting' && 'Reconectando...'}
        </span>
        {status === 'disconnected' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="ml-2"
          >
            {isReconnecting ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              'Tentar novamente'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
