import { useState, useEffect } from 'react';
import { connectionManager } from '@/utils/connectionManager';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionStatus = () => {
  const [status, setStatus] = useState(connectionManager.getStatus());
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleStatusChange = () => {
      setStatus(connectionManager.getStatus());
    };
    
    connectionManager.addListener(handleStatusChange);
    
    return () => {
      connectionManager.removeListener(handleStatusChange);
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    connectionManager.reconnect();
    
    // Resetar o estado após um tempo
    setTimeout(() => {
      setIsReconnecting(false);
    }, 3000);
  };

  if (status === 'connected') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5" 
         style={{ 
           backgroundColor: status === 'connecting' ? '#f59e0b' : '#ef4444',
           color: 'white'
         }}>
      {status === 'disconnected' ? (
        <WifiOff size={18} />
      ) : (
        <RefreshCw size={18} className="animate-spin" />
      )}
      
      <span className="text-sm font-medium">
        {status === 'disconnected' ? 'Conexão perdida' : 'Reconectando...'}
      </span>
      
      {status === 'disconnected' && (
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
          onClick={handleReconnect}
          disabled={isReconnecting}
        >
          {isReconnecting ? (
            <RefreshCw size={14} className="animate-spin mr-1" />
          ) : (
            <RefreshCw size={14} className="mr-1" />
          )}
          Reconectar
        </Button>
      )}
    </div>
  );
};

export default ConnectionStatus;