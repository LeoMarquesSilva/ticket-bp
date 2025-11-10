import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';
import { Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface OnlineStatusToggleProps {
  compact?: boolean;
}

const OnlineStatusToggle: React.FC<OnlineStatusToggleProps> = ({ compact = false }) => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true); // Inicializa como online por padrão
  const [isLoading, setIsLoading] = useState(false);
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  // Carregar status inicial e garantir que o usuário comece online
  useEffect(() => {
    if (user && (user.role === 'support' || user.role === 'lawyer')) {
      // Inicializa o estado com o valor do usuário ou true (online) por padrão
      const initialOnlineState = user.isOnline !== undefined ? user.isOnline : true;
      setIsOnline(initialOnlineState);
      
      // Se o usuário não estiver explicitamente marcado como online no banco de dados,
      // atualiza o status para online automaticamente
      if (!initialSetupDone && (!user.isOnline || user.isOnline === undefined)) {
        updateUserOnlineStatus(true);
        setInitialSetupDone(true);
      }
    }
  }, [user]);

  // Função para atualizar o status no banco de dados
  const updateUserOnlineStatus = async (status: boolean) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      await UserService.updateOnlineStatus(user.id, status);
      setIsOnline(status);
      toast.success(status ? 'Você está online' : 'Você está offline');
    } catch (error) {
      console.error('Error updating online status:', error);
      toast.error('Erro ao atualizar status');
      setIsOnline(!status); // Reverter mudança em caso de erro
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar status online/offline
  const handleToggleStatus = async (checked: boolean) => {
    updateUserOnlineStatus(checked);
  };

  // Não mostrar para usuários comuns ou admin
  if (!user || user.role === 'user' || user.role === 'admin') {
    return null;
  }

  // Versão compacta para dropdown
  if (compact) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <Switch
          checked={isOnline}
          onCheckedChange={handleToggleStatus}
          disabled={isLoading}
          className={isOnline ? "bg-green-500" : ""}
        />
      </div>
    );
  }

  // Versão padrão para o header
  return (
    <div className="flex items-center space-x-2">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-slate-400" />
      )}
      <Switch
        checked={isOnline}
        onCheckedChange={handleToggleStatus}
        disabled={isLoading}
        className={isOnline ? "bg-green-500" : ""}
      />
      <Label className="text-sm">
        {isOnline ? 'Online' : 'Offline'}
      </Label>
    </div>
  );
};

export default OnlineStatusToggle;