import React from 'react';
import { Button } from '@/components/ui/button';
import { List, LayoutGrid, Users, Plus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import OnlineStatusToggle from '@/components/OnlineStatusToggle';

interface User {
  id: string;
  name: string;
  role: string;
}

interface TicketHeaderProps {
  view: 'list' | 'board' | 'users';
  setView: (view: 'list' | 'board' | 'users') => void;
  supportUsers: User[];
  user: { role: string } | null;
  setShowCreateForm: (show: boolean) => void;
  onlineUsersCount?: number;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({
  view,
  setView,
  supportUsers,
  user,
  setShowCreateForm,
  onlineUsersCount = 0
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm">
      {/* Header principal com gradiente */}
      <div className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white py-6 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Tickets de Suporte</h1>
            <p className="text-slate-200 text-sm mt-1">
              {user?.role === 'user' 
                ? 'Suas solicitações de suporte jurídico'
                : 'Gerenciamento centralizado de tickets'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Toggle de status online/offline - APENAS para support e lawyer */}
            {(user?.role === 'support' || user?.role === 'lawyer') && (
              <div className="bg-white/10 rounded-md py-1 px-3">
                <OnlineStatusToggle />
              </div>
            )}
            
            {/* Botão para criar novo ticket - APENAS para usuários comuns */}
            {user?.role === 'user' && (
              <Button
                onClick={() => setShowCreateForm(true)}
                size="sm"
                className="bg-[#D5B170] hover:bg-[#c9a25e] text-[#101F2E] font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Ticket
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Barra de ferramentas com botões de visualização */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-2">
        {/* Botões de visualização */}
        <div className="flex rounded-md overflow-hidden border border-slate-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === 'list' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView('list')}
                  className={view === 'list' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visualização em lista</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === 'board' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView('board')}
                  className={view === 'board' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visualização em quadro</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Botão de visualização por usuários (apenas para admin, support e lawyer) */}
          {(user?.role === 'admin' || user?.role === 'support' || user?.role === 'lawyer') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === 'users' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView('users')}
                    className={view === 'users' ? 'bg-[#101F2E] hover:bg-[#1c3651]' : ''}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Visualização por usuários</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Removido o botão "Novo Ticket" da barra de ferramentas para outros usuários */}
        {/* Agora o botão só aparecerá no cabeçalho principal para usuários com role "user" */}
      </div>
    </div>
  );
};

export default TicketHeader;