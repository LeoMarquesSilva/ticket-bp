import React, { useEffect } from 'react';
import { Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface OnlineUser {
  id: string;
  name: string;
  role: string;
  isOnline?: boolean;
}

interface OnlineUsersListProps {
  onlineUsers: OnlineUser[];
  onClose?: () => void; // Agora opcional
}

const OnlineUsersList: React.FC<OnlineUsersListProps> = ({ onlineUsers, onClose }) => {
  // Adicionar logs para depuração
  useEffect(() => {
    console.log('OnlineUsersList - Usuários recebidos:', onlineUsers);
  }, [onlineUsers]);

  // Função para obter o texto do papel do usuário em português
  const getUserRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'lawyer':
        return 'Advogado';
      case 'support':
        return 'Suporte';
      default:
        return role;
    }
  };

  // Filtrar apenas usuários que realmente estão online
  // No nosso caso, todos os usuários em onlineUsers já devem estar online
  // porque foram filtrados pela função getOnlineStaff() em Tickets.tsx
  const actualOnlineUsers = onlineUsers.filter(user => user.isOnline !== false);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-medium text-slate-800">Equipe Online</h3>
        <p className="text-xs text-slate-500 mt-1">
          {actualOnlineUsers.length === 0 
            ? 'Nenhum membro online' 
            : `${actualOnlineUsers.length} membro(s) online`}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {actualOnlineUsers.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            Nenhum membro da equipe online no momento
          </div>
        ) : (
          <div className="space-y-2">
            {actualOnlineUsers.map(user => (
              <Card key={user.id} className="p-3 hover:bg-slate-50">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-600">
                        {user.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <Circle 
                      className="absolute -bottom-1 -right-1 h-3 w-3 fill-green-500 text-green-500" 
                    />
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500">{getUserRoleText(user.role)}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineUsersList;