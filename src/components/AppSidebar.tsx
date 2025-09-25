import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  MessageSquare, 
  Settings,
  UserPlus,
  LogOut,
  Users,
  Menu,
  Building2,
  Database
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
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { state } = useSidebar();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      roles: ["admin"],
    },
    {
      name: "Tickets",
      href: "/tickets",
      icon: <Ticket className="h-5 w-5" />,
      roles: ["user", "support", "admin", "lawyer"],
    },
    {
      name: "Chat",
      href: "/chat",
      icon: <MessageSquare className="h-5 w-5" />,
      roles: ["user", "support", "admin", "lawyer"],
    },
    {
      name: "Gerenciar Usuários",
      href: "/users",
      icon: <Users className="h-5 w-5" />,
      roles: ["admin"], // Apenas administradores podem acessar
    },
    {
      name: "Banco de Dados",
      href: "/database",
      icon: <Database className="h-5 w-5" />,
      roles: ["admin"], // Apenas administradores podem acessar
    },
    {
      name: "Configurações",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      roles: ["user", "support", "admin", "lawyer"],
    },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[#D5B170] text-[#101F2E]';
      case 'support':
        return 'bg-blue-500 text-white';
      case 'lawyer':
        return 'bg-purple-500 text-white';
      case 'user':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
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
    return user ? user.department : undefined;
  };

  const userDepartment = getUserDepartment(user);

  return (
    <Sidebar className={cn("border-r border-[#D5B170]/20", className)} style={{ '--sidebar-width': '16rem' } as React.CSSProperties}>
      <SidebarHeader className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-[#D5B170] rounded-xl blur-lg opacity-30"></div>
            <div className="relative bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-[#D5B170]/30">
              <img 
                src="/assets/logo.png" 
                alt="Bismarchi Pires" 
                className="h-8 w-auto"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold">Sistema de Tickets</h1>
            <p className="text-xs text-muted-foreground">Bismarchi | Pires</p>
          </div>
        </div>
        
        {/* Botão de toggle para a sidebar */}
        <SidebarTrigger className="hidden md:flex">
          <Menu className="h-4 w-4" />
        </SidebarTrigger>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Perfil do usuário com destaque para o departamento */}
        <div className="mb-4 px-4 py-3 bg-white/40 backdrop-blur-sm rounded-xl border border-[#D5B170]/20">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-12 w-12 border-2 border-[#D5B170]/30 shadow-md">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`} />
              <AvatarFallback className={getRoleBadgeColor(user?.role || '')}>
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{user?.name}</p>
              <Badge variant="outline" className={cn("mt-1 text-xs font-medium", getRoleBadgeColor(user?.role || ''))}>
                {getRoleLabel(user?.role || '')}
              </Badge>
            </div>
          </div>
          
          {/* Departamento do usuário */}
          {userDepartment && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-white/50 border border-[#D5B170]/10">
              <Building2 className="h-4 w-4 text-slate-500" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Departamento</p>
                <Badge variant="outline" className={cn("mt-1 text-xs font-medium", getDepartmentColor(userDepartment))}>
                  {userDepartment}
                </Badge>
              </div>
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
          className="w-full flex items-center gap-2 text-red-500 hover:bg-red-50 hover:text-red-600 border-[#D5B170]/20"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;