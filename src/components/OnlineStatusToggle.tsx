import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OnlineStatusToggleProps {
  compact?: boolean;
}

const OnlineStatusToggle: React.FC<OnlineStatusToggleProps> = ({ compact = false }) => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true); // Inicializa como online por padrão
  const [isLoading, setIsLoading] = useState(false);
  const [initialSetupDone, setInitialSetupDone] = useState(false);
  const normalizeRole = (role?: string | null) => String(role ?? '').trim().toLowerCase();
  const isStaffRole = (role?: string | null) => {
    const normalizedRole = normalizeRole(role);
    return (
      normalizedRole === 'support' ||
      normalizedRole === 'lawyer' ||
      normalizedRole === 'suporte' ||
      normalizedRole === 'advogado'
    );
  };

  // Carregar status inicial e garantir que o usuário comece online
  useEffect(() => {
    if (user && isStaffRole(user.role)) {
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
  }, [user, initialSetupDone]);

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
  if (!user || !isStaffRole(user.role)) {
    return null;
  }

  const StatusIcon = isLoading ? Loader2 : isOnline ? Wifi : WifiOff;

  // Versão compacta para dropdown/sidebar
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 w-full rounded-xl border border-[#D5B170]/20 bg-white/70 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border',
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            )}
          >
            <StatusIcon className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Disponibilidade</span>
            <span className={cn('text-sm font-semibold', isOnline ? 'text-emerald-700' : 'text-slate-600')}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        <Switch
          checked={isOnline}
          onCheckedChange={handleToggleStatus}
          disabled={isLoading}
          className={cn(
            'data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300',
            isLoading && 'opacity-70'
          )}
        />
      </div>
    );
  }

  // Versão padrão para o header
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#D5B170]/20 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border',
          isOnline
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        )}
      >
        <StatusIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Atendimento</span>
        <span className={cn('text-sm font-semibold', isOnline ? 'text-emerald-700' : 'text-slate-600')}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <Switch
        checked={isOnline}
        onCheckedChange={handleToggleStatus}
        disabled={isLoading}
        className={cn(
          'ml-1 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300',
          isLoading && 'opacity-70'
        )}
      />
    </div>
  );
};

export default OnlineStatusToggle;