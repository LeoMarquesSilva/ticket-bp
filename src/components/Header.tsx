import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  LogOut,
  Users,
  Database,
  Menu,
  X,
  User,
  Tag,
  Shield
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OnlineStatusToggle from '@/components/OnlineStatusToggle';
import ticketEventService from '@/services/ticketEventService';

interface HeaderProps {
  pendingTickets?: number;
  unreadMessages?: number;
  onPendingTicketsUpdated?: () => void;
}

export function Header({ pendingTickets = 0, unreadMessages = 0, onPendingTicketsUpdated }: HeaderProps) {
  const { user, logout } = useAuth();
  const { has } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localPendingTickets, setLocalPendingTickets] = useState(pendingTickets);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Escutar mudanças de status de tickets usando o serviço
  useEffect(() => {
    // Registrar o callback para mudanças de status de tickets
    const cleanup = ticketEventService.onTicketStatusChanged(() => {
      // Se temos uma função de callback, usá-la
      if (onPendingTicketsUpdated) {
        onPendingTicketsUpdated();
      } else {
        // Caso contrário, atualizar o estado local
        if (localPendingTickets > 0) {
          setLocalPendingTickets(prev => Math.max(0, prev - 1));
        }
      }
    });
    
    // Armazenar a função de limpeza para uso posterior
    cleanupRef.current = cleanup;

    // Limpar o ouvinte de evento ao desmontar o componente
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [onPendingTicketsUpdated, localPendingTickets]);

  // Atualizar o estado local quando a prop pendingTickets mudar
  useEffect(() => {
    setLocalPendingTickets(pendingTickets);
  }, [pendingTickets]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, permission: 'dashboard' as const, badge: null },
    { name: "Tickets", href: "/tickets", icon: <Ticket className="h-5 w-5" />, permission: 'tickets' as const, badge: localPendingTickets > 0 ? localPendingTickets : null },
    { name: "Gerenciar Usuários", href: "/users", icon: <Users className="h-5 w-5" />, permission: 'manage_users' as const, badge: null },
    { name: "Gerenciar Categorias", href: "/categories", icon: <Tag className="h-5 w-5" />, permission: 'manage_categories' as const, badge: null },
    { name: "Roles e Permissões", href: "/users", icon: <Shield className="h-5 w-5" />, permission: 'manage_roles' as const, badge: null, onlyWhenNoManageUsers: true },
  ];

  const filteredNavItems = navItems.filter((item) => {
    const canSeeTickets = item.href === '/tickets' && (has('tickets') || has('create_ticket'));
    if (!canSeeTickets && !has(item.permission)) return false;
    if ('onlyWhenNoManageUsers' in item && item.onlyWhenNoManageUsers && has('manage_users')) return false;
    return true;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'gradient';
      case 'support': return 'secondary';
      case 'lawyer': return 'warning';
      case 'user': return 'success';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Gestor Op. Legais';
      case 'support': return 'Op. Legais';
      case 'lawyer': return 'Advogado';
      case 'user': return 'Jurídico';
      default: return role;
    }
  };

  const getDepartmentColor = (department?: string) => {
    switch (department?.toLowerCase()) {
      case 'contencioso': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'consultivo': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'trabalhista': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'tributário': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'contratos': return 'bg-sky-100 text-sky-800 border-sky-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const isStaff = user?.role === 'support' || user?.role === 'lawyer';

  const handleLogoClick = () => {
    navigate('/tickets');
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-responsum-dark shadow-lg">
      {/* Barra de gradiente superior */}
      <div className="h-1 w-full bg-responsum-gradient"></div>
      
      <div className="container flex h-16 items-center">
        {/* Logo Responsum - Mantido tamanho h-12 original */}
        <div 
          className="mr-6 flex items-center cursor-pointer" 
          onClick={handleLogoClick}
        >
          <div className="relative">
            {/* Efeito de brilho atrás do logo */}
            <div className="absolute inset-0 bg-responsum-primary/20 rounded-full blur-lg"></div>
            {/* Logo com tamanho aumentado (original) */}
            <img 
              src="/assets/logo-horizontal.png" 
              alt="RESPONSUM" 
              className="h-12 w-auto relative" 
            />
          </div>
        </div>

        {/* Menu de navegação para desktop */}
        <nav className="hidden md:flex flex-1 items-center justify-center space-x-2">
          {filteredNavItems.map((item) => (
            <NavLink 
              key={item.href} 
              to={item.href} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-responsum-gradient text-white shadow-md shadow-responsum-primary/20"
                  : "text-responsum-light hover:bg-responsum-dark-lighter hover:text-white"
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.name}</span>
                {item.badge && (
                  <Badge variant="gradient" size="sm" className="ml-1 animate-pulse">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Status online/offline */}
        {isStaff && (
          <div className="hidden md:flex items-center mr-4">
            <div className="bg-responsum-dark-lighter rounded-md py-1.5 px-4 shadow-inner shadow-black/20">
              <OnlineStatusToggle />
            </div>
          </div>
        )}

        {/* === LOGO DO CLIENTE (BP) === */}
        {/* Adicionado aqui, antes do dropdown do usuário */}
        <div className="hidden md:flex items-center mr-4 pl-4 border-l border-white/10 h-10">
          <img 
            src="/assets/logo-bp.png" 
            alt="BP" 
            className="h-8 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity" 
            title="Ambiente BP"
          />
        </div>

        {/* Dropdown de perfil do usuário */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-10 w-10 rounded-full overflow-hidden hover:bg-responsum-dark-lighter hover:scale-105 transition-all duration-200"
              >
                <div className="absolute inset-0 bg-responsum-gradient opacity-20 animate-pulse-slow"></div>
                <Avatar className="h-9 w-9 border-2 border-responsum-primary/30">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
                  <AvatarFallback className="bg-responsum-gradient text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-80 overflow-visible shadow-xl shadow-responsum-primary/10" 
              align="end" 
              side="bottom"
              sideOffset={8}
              alignOffset={0}
              avoidCollisions={true}
              collisionPadding={20}
              forceMount
              style={{ 
                backgroundColor: "#1a1a2e", 
                maxHeight: "none",
                minWidth: "320px",
                overflowWrap: "break-word",
                wordBreak: "break-word"
              }}
            >
              <div className="h-1 w-full bg-responsum-gradient"></div>
              <div className="bg-gradient-to-b from-responsum-dark-lighter to-transparent p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border-2 border-responsum-primary/30 flex-shrink-0">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
                    <AvatarFallback className="bg-responsum-gradient text-white">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-grow min-w-0">
                    <p className="text-sm font-medium leading-none text-white truncate">{user?.name}</p>
                    <p className="text-xs leading-none text-responsum-light/80 mt-1 break-all">
                      {user?.email}
                    </p>
                    <Badge variant={getRoleBadgeVariant(user?.role || '')} size="sm" className="mt-2 w-fit">
                      {getRoleLabel(user?.role || '')}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {user?.department && (
                <>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <div className="px-4 py-2">
                    <p className="text-xs text-responsum-light/70 mb-1">Departamento</p>
                    <Badge variant="outline" className={cn("text-xs font-medium", getDepartmentColor(user.department))}>
                      {user.department}
                    </Badge>
                  </div>
                </>
              )}
              
              {isStaff && (
                <>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <div className="px-4 py-2">
                    <p className="text-xs text-responsum-light/70 mb-1">Status</p>
                    <OnlineStatusToggle compact={true} />
                  </div>
                </>
              )}
              
              <DropdownMenuSeparator className="bg-gray-700" />
              
              <DropdownMenuItem 
                onClick={handleProfileClick} 
                className="cursor-pointer text-responsum-light hover:text-white focus:bg-responsum-dark-lighter focus:text-white px-4 py-2.5"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem 
                onClick={logout} 
                className="text-red-400 hover:text-red-300 focus:bg-red-950 focus:text-red-300 px-4 py-2.5"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Botão de menu mobile */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden text-white hover:bg-responsum-dark-lighter hover:text-responsum-primary transition-colors" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-responsum-dark-lighter bg-responsum-dark/95 backdrop-blur-md shadow-lg">
          <div className="container py-3 space-y-2">
            
            {/* Logo BP no Mobile também */}
            <div className="flex justify-center py-2 mb-2 border-b border-white/5">
               <img src="/assets/logo-bp.png" alt="BP" className="h-8 w-auto opacity-80" />
            </div>

            {filteredNavItems.map((item) => (
              <NavLink 
                key={item.href} 
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-responsum-gradient text-white shadow-md shadow-responsum-primary/20"
                    : "text-responsum-light hover:bg-responsum-dark-lighter hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.name}</span>
                  {item.badge && (
                    <Badge variant="gradient" size="sm" className="ml-1 animate-pulse">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </NavLink>
            ))}
            
            <button
              onClick={() => {
                handleProfileClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium text-responsum-light hover:bg-responsum-dark-lighter hover:text-white transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <User className="h-5 w-5" />
                <span>Meu Perfil</span>
              </div>
            </button>
            
            {isStaff && (
              <div className="px-4 py-3 flex items-center justify-between text-responsum-light bg-responsum-dark-lighter rounded-md mt-2">
                <span className="text-sm font-medium">Status</span>
                <OnlineStatusToggle />
              </div>
            )}
            
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-950 hover:text-red-300 transition-all duration-200 mt-2"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
