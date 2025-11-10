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
  X
} from 'lucide-react';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localPendingTickets, setLocalPendingTickets] = useState(pendingTickets);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Inicializar o serviço de eventos de tickets
  useEffect(() => {
    ticketEventService.initialize();
  }, []);

  // Escutar o evento de feedback enviado usando o serviço
  useEffect(() => {
    // Registrar o callback para o evento de feedback submetido
    const cleanup = ticketEventService.onFeedbackSubmitted(() => {
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
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      roles: ["admin"],
      badge: null
    },
    {
      name: "Tickets",
      href: "/tickets",
      icon: <Ticket className="h-5 w-5" />,
      roles: ["user", "support", "admin", "lawyer"],
      badge: localPendingTickets > 0 ? localPendingTickets : null
    },
    {
      name: "Gerenciar Usuários",
      href: "/users",
      icon: <Users className="h-5 w-5" />,
      roles: ["admin"],
      badge: null
    },
    {
      name: "Banco de Dados",
      href: "/database",
      icon: <Database className="h-5 w-5" />,
      roles: ["admin"],
      badge: null
    }
  ];

  const filteredNavItems = navItems.filter(
    (item) => item.roles.includes(user?.role || "")
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'gold';
      case 'support':
        return 'secondary';
      case 'lawyer':
        return 'warning';
      case 'user':
        return 'success';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Gestor Op. Legais';
      case 'support':
        return 'Op. Legais';
      case 'lawyer':
        return 'Advogado';
      case 'user':
        return 'Jurídico';
      default:
        return role;
    }
  };

  const getDepartmentColor = (department?: string) => {
    switch (department?.toLowerCase()) {
      case 'contencioso':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'consultivo':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'trabalhista':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'tributário':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'contratos':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const isStaff = user?.role === 'support' || user?.role === 'lawyer';

  // Função para navegar para a página de tickets ao clicar no logo
  const handleLogoClick = () => {
    navigate('/tickets');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {/* Logo - Adicionado onClick para navegar para /tickets */}
        <div 
          className="mr-4 flex items-center gap-2 cursor-pointer" 
          onClick={handleLogoClick}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-[#D5B170] rounded-xl blur-lg opacity-30"></div>
            <div className="relative bg-gradient-to-r from-[#101F2E] to-[#2a3f52] p-2 rounded-xl border border-[#D5B170]/30 shadow-sm">
              <img 
                src="/assets/logo-branco.png" 
                alt="Bismarchi Pires" 
                className="h-7 w-auto"
              />
            </div>
          </div>
          <div className="hidden md:block">
            <h1 className="text-lg font-bold bg-gradient-to-r from-[#D5B170] to-[#f0d9a3] bg-clip-text text-transparent">Sistema de Tickets</h1>
            <p className="text-xs text-muted-foreground">Bismarchi | Pires</p>
          </div>
        </div>

        {/* Menu de navegação para desktop */}
        <nav className="hidden md:flex flex-1 items-center justify-center space-x-1">
          {filteredNavItems.map((item) => (
            <NavLink 
              key={item.href} 
              to={item.href} 
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-[#101F2E] text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.name}</span>
                {item.badge && (
                  <Badge variant="gold" size="sm" className="ml-1">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Status online/offline para support e lawyer */}
        {isStaff && (
          <div className="hidden md:flex items-center mr-4">
            <div className="bg-white/10 rounded-md py-1 px-3">
              <OnlineStatusToggle />
            </div>
          </div>
        )}

        {/* Dropdown de perfil do usuário */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9 border-2 border-[#D5B170]/30">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
                  <AvatarFallback className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <Badge variant={getRoleBadgeVariant(user?.role || '')} size="sm" className="mt-1 w-fit">
                    {getRoleLabel(user?.role || '')}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              
              {user?.department && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground mb-1">Departamento</p>
                    <Badge variant="outline" className={cn("text-xs font-medium", getDepartmentColor(user.department))}>
                      {user.department}
                    </Badge>
                  </div>
                </>
              )}
              
              {/* Status online/offline para mobile */}
              {isStaff && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <OnlineStatusToggle compact={true} />
                  </div>
                </>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Botão de menu mobile */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden" 
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
        <div className="md:hidden border-t">
          <div className="container py-2 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink 
                key={item.href} 
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-[#101F2E] text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.name}</span>
                  {item.badge && (
                    <Badge variant="gold" size="sm" className="ml-1">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </NavLink>
            ))}
            
            {/* Status online/offline para mobile */}
            {isStaff && (
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <OnlineStatusToggle />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;