import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  LogOut,
  Users,
  Menu,
  Building2,
  Database,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarMenuBadge,
  SidebarMenuAction,
  SidebarSeparator,
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import OnlineStatusToggle from '@/components/OnlineStatusToggle';

interface AppSidebarProps {
  className?: string;
  pendingTickets?: number;
  unreadMessages?: number;
}

export function AppSidebar({ className, pendingTickets = 0, unreadMessages = 0 }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

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
      badge: pendingTickets > 0 ? pendingTickets : null
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
    // Cores diferentes para diferentes departamentos
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

  // Função segura para verificar se o usuário tem departamento
  const getUserDepartment = (user: User | null): string | undefined => {
    return user?.department;
  };

  const userDepartment = getUserDepartment(user);
  const isStaff = user?.role === 'support' || user?.role === 'lawyer';

  return (
    <Sidebar 
      className={cn("border-r border-[#D5B170]/20", className)} 
      style={{ '--sidebar-width': '16rem' } as React.CSSProperties}
      collapsible="icon" // Alterado para "icon" para permitir minimização
    >
      <SidebarHeader className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-[#D5B170] rounded-xl blur-lg opacity-30"></div>
            <div className="relative bg-gradient-to-r from-[#101F2E] to-[#2a3f52] p-2 rounded-xl border border-[#D5B170]/30 shadow-sm">
              <img 
                src="/assets/logo.png" 
                alt="Bismarchi Pires" 
                className="h-8 w-auto"
              />
            </div>
          </div>
          {!isCollapsed && (
            <div className="transition-opacity duration-200">
              <h1 className="text-lg font-bold bg-gradient-to-r from-[#D5B170] to-[#f0d9a3] bg-clip-text text-transparent">Sistema de Tickets</h1>
              <p className="text-xs text-muted-foreground">Bismarchi | Pires</p>
            </div>
          )}
        </div>
        
        {/* Botão de toggle para a sidebar */}
        <SidebarTrigger className="hidden md:flex">
          <Menu className="h-4 w-4" />
        </SidebarTrigger>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Perfil do usuário com destaque para o departamento */}
        <div className={cn(
          "mb-4 px-4 py-3 bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-sm rounded-xl border border-[#D5B170]/20",
          isCollapsed && "px-2 py-2"
        )}>
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-12 w-12 border-2 border-[#D5B170]/30 shadow-md">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
              <AvatarFallback className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] text-white">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="transition-opacity duration-200">
                <p className="text-sm font-semibold">{user?.name}</p>
                <Badge variant={getRoleBadgeVariant(user?.role || '')} size="sm" className="mt-1">
                  {getRoleLabel(user?.role || '')}
                </Badge>
              </div>
            )}
          </div>
          
          {/* Departamento do usuário - visível apenas quando não está colapsado */}
          {userDepartment && !isCollapsed && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-white/50 border border-[#D5B170]/10 transition-opacity duration-200">
              <Building2 className="h-4 w-4 text-slate-500" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Departamento</p>
                <Badge variant="outline" className={cn("mt-1 text-xs font-medium", getDepartmentColor(userDepartment))}>
                  {userDepartment}
                </Badge>
              </div>
            </div>
          )}
          
          {/* Toggle de status online/offline - APENAS para support e lawyer */}
          {isStaff && (
            <div className={cn(
              "mt-3 p-2 rounded-lg bg-white/50 border border-[#D5B170]/10",
              isCollapsed ? "flex justify-center" : ""
            )}>
              {isCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <OnlineStatusToggle compact={true} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Status de disponibilidade</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <OnlineStatusToggle compact={true} />
              )}
            </div>
          )}
        </div>

        <SidebarMenu>
          {navItems
            .filter((item) => item.roles.includes(user?.role || ""))
            .map((item) => (
              <SidebarMenuItem key={item.href}>
                <NavLink to={item.href} className={({ isActive }) => cn(isActive ? "font-medium" : "")}>
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive} tooltip={item.name}>
                      {item.icon}
                      <span>{item.name}</span>
                      {item.badge && (
                        <SidebarMenuBadge>
                          <Badge 
                            variant={isActive ? "gold" : "secondary"} 
                            size="sm" 
                            className={cn(
                              "ml-auto", 
                              isActive ? "bg-[#D5B170] text-[#101F2E]" : ""
                            )}
                          >
                            {item.badge}
                          </Badge>
                        </SidebarMenuBadge>
                      )}
                      {!isCollapsed && (
                        <SidebarMenuAction showOnHover>
                          <ChevronRight className="h-4 w-4" />
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          onClick={logout}
          variant="outline"
          className={cn(
            "w-full flex items-center gap-2 text-red-500 hover:bg-red-50 hover:text-red-600 border-[#D5B170]/20",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;