import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';
import { Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const OnlineStatusToggle = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar status inicial
  useEffect(() => {
    if (user && (user.role === 'support' || user.role === 'lawyer')) {
      setIsOnline(user.isOnline || false);
    }
  }, [user]);

  // Atualizar status online/offline
  const handleToggleStatus = async (checked: boolean) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      await UserService.updateOnlineStatus(user.id, checked);
      setIsOnline(checked);
      toast.success(checked ? 'Você está online' : 'Você está offline');
    } catch (error) {
      console.error('Error updating online status:', error);
      toast.error('Erro ao atualizar status');
      setIsOnline(!checked); // Reverter mudança em caso de erro
    } finally {
      setIsLoading(false);
    }
  };

  // Não mostrar para usuários comuns ou admin
  if (!user || user.role === 'user' || user.role === 'admin') {
    return null;
  }

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