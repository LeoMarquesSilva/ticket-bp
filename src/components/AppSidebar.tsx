import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Rows3,
  Rows4,
  Settings2,
  Shield,
  Tag,
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import UserAvatar from '@/components/UserAvatar';
import OnlineStatusToggle from '@/components/OnlineStatusToggle';
import { supabase, TABLES } from '@/lib/supabase';
import {
  getInitialInterfaceDensity,
  getInitialSidebarCollapsed,
  type InterfaceDensity,
} from '@/utils/layoutPreferences';

const STORAGE_KEY = 'responsum-nav-collapsed';
const DENSITY_STORAGE_KEY = 'responsum-interface-density';
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 248;
const logoEase = [0.22, 1, 0.36, 1] as const;

function SidebarLogo({ expanded }: { expanded: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="relative flex items-center justify-center overflow-hidden"
      initial={false}
      animate={{ width: expanded ? 188 : 40, height: expanded ? 48 : 40 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: logoEase }}
    >
      <AnimatePresence initial={false} mode="wait">
        {expanded ? (
          <motion.img
            key="full"
            src="/assets/logo-horizontal.png"
            alt="RESPONSUM"
            className="h-12 w-auto max-w-[188px] object-contain"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: logoEase }}
          />
        ) : (
          <motion.img
            key="mark"
            src="/assets/logotipo.png"
            alt="RESPONSUM"
            className="h-10 w-10 object-contain"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: logoEase }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface AppNavContextValue {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  mobileTriggerRef: React.RefObject<HTMLButtonElement>;
  density: InterfaceDensity;
  setDensity: (value: InterfaceDensity) => void;
}

const AppNavContext = createContext<AppNavContextValue | null>(null);

function useAppNav() {
  const context = useContext(AppNavContext);
  if (!context) {
    throw new Error('useAppNav must be used within AppNavShell');
  }
  return context;
}

export function AppNavShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return true;
    return getInitialSidebarCollapsed(window.localStorage.getItem(STORAGE_KEY), window.innerWidth);
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [density, setDensityState] = useState<InterfaceDensity>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return getInitialInterfaceDensity(window.localStorage.getItem(DENSITY_STORAGE_KEY));
  });
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  };

  const setDensity = (value: InterfaceDensity) => {
    setDensityState(value);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, value);
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <AppNavContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen, mobileTriggerRef, density, setDensity }}>
      <TooltipProvider delayDuration={200}>
        <div
          className="flex h-dvh w-full overflow-hidden bg-gradient-to-br from-[#F6F6F6] via-[#F69F19]/5 to-[#DE5532]/15"
          data-density={density}
        >
          <AppSidebar />
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            aria-hidden={mobileOpen ? true : undefined}
          >
            <AppMobileTopBar />
            {children}
          </div>
        </div>
      </TooltipProvider>
    </AppNavContext.Provider>
  );
}

function getRoleLabel(role?: string) {
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
      return role || 'Usuário';
  }
}

function getRoleBadgeVariant(role?: string) {
  switch (role) {
    case 'admin':
      return 'gradient' as const;
    case 'support':
      return 'secondary' as const;
    case 'lawyer':
      return 'warning' as const;
    case 'user':
      return 'success' as const;
    default:
      return 'outline' as const;
  }
}

function getDepartmentColor(department?: string) {
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
}

function useNavItems(pendingTickets: number) {
  const { has } = usePermissions();
  const { user } = useAuth();
  const isAdmin = String(user?.role ?? '').toLowerCase() === 'admin';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' as const, badge: null as number | null },
    { name: 'Tickets', href: '/tickets', icon: Ticket, permission: 'tickets' as const, badge: pendingTickets > 0 ? pendingTickets : null },
    { name: 'Usuários', href: '/users', icon: Users, permission: 'manage_users' as const, badge: null },
    { name: 'Categorias', href: '/categories', icon: Tag, permission: 'manage_categories' as const, badge: null },
    { name: 'Configurações', href: '/settings', icon: Settings2, permission: 'manage_categories' as const, badge: null },
    { name: 'Permissões', href: '/users', icon: Shield, permission: 'manage_roles' as const, badge: null, onlyWhenNoManageUsers: true },
  ];

  return navItems.filter((item) => {
    const canSeeTickets = item.href === '/tickets' && (has('tickets') || has('create_ticket'));
    if (!canSeeTickets && !has(item.permission) && !isAdmin) return false;
    if (item.onlyWhenNoManageUsers && (has('manage_users') || isAdmin)) return false;
    return true;
  });
}

function AppMobileTopBar() {
  const { setMobileOpen, mobileTriggerRef } = useAppNav();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#141516] px-3 lg:hidden">
      <button
        ref={mobileTriggerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] motion-reduce:transition-none"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex min-w-0 items-center gap-2"
      >
        <img src="/assets/logo-horizontal.png" alt="RESPONSUM" className="h-8 w-auto" />
      </button>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="ml-auto rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141516]"
        aria-label="Abrir menu do usuário"
      >
        <UserAvatar
          name={user?.name}
          userId={user?.id}
          avatarUrl={user?.avatarUrl}
          size="md"
          className="h-8 w-8"
          fallbackClassName="bg-[#F69F19] text-[#141516]"
        />
      </button>
    </div>
  );
}

function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    mobileTriggerRef,
    density,
    setDensity,
  } = useAppNav();
  const [pendingTickets, setPendingTickets] = useState(0);
  const [keyboardExpanded, setKeyboardExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingRefreshTimerRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const pointerNavigatingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const navItems = useNavItems(pendingTickets);
  const isStaff = user?.role === 'support' || user?.role === 'lawyer';
  const isOnline = user?.isOnline !== false;
  const showLabels = !collapsed || mobileOpen || keyboardExpanded || menuOpen;

  const loadPendingTickets = useCallback(async () => {
    if (!user?.id) {
      setPendingTickets(0);
      return;
    }

    const { count, error } = await supabase
      .from(TABLES.TICKETS)
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'assigned', 'in_progress']);

    if (error) {
      console.warn('[sidebar] falha ao carregar tickets pendentes', error.message);
      return;
    }
    setPendingTickets(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void loadPendingTickets();

    const scheduleRefresh = () => {
      if (pendingRefreshTimerRef.current) window.clearTimeout(pendingRefreshTimerRef.current);
      pendingRefreshTimerRef.current = window.setTimeout(() => {
        pendingRefreshTimerRef.current = null;
        void loadPendingTickets();
      }, 200);
    };

    const channel = supabase
      .channel(`sidebar-pending-tickets-${user?.id ?? 'anonymous'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.TICKETS },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (pendingRefreshTimerRef.current) window.clearTimeout(pendingRefreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadPendingTickets, user?.id]);

  useEffect(() => {
    setKeyboardExpanded(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const panel = sidebarRef.current;
    if (!panel) return;
    const trigger = mobileTriggerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => {
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirstControl);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen, mobileTriggerRef, setMobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleFocusCapture = () => {
    if (pointerNavigatingRef.current) return;
    setKeyboardExpanded(true);
  };
  const handleBlurCapture = (event: React.FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setKeyboardExpanded(false);
    }
  };

  const isItemActive = (href: string) => {
    if (href === '/tickets') return location.pathname.startsWith('/tickets');
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const sidebarWidth = showLabels ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const railWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <>
      <div
        className="hidden shrink-0 lg:block"
        style={{ width: railWidth }}
        aria-hidden
      />

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] lg:hidden"
          aria-label="Fechar menu"
          onClick={closeMobile}
        />
      )}

      <div
        className={cn(
          'pointer-events-none fixed inset-y-0 left-0 w-0 overflow-visible',
          mobileOpen ? 'z-[70]' : 'z-30',
        )}
      >
        <aside
          ref={sidebarRef}
          role={mobileOpen ? 'dialog' : undefined}
          aria-modal={mobileOpen ? true : undefined}
          aria-label={mobileOpen ? 'Navegação principal' : undefined}
          className={cn(
            'pointer-events-auto flex h-dvh flex-col border-r border-white/[0.06] bg-[#141516] text-white transition-[width,transform] duration-200 ease-out motion-reduce:transition-none',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
          style={{ width: sidebarWidth }}
          onPointerDown={() => {
            pointerNavigatingRef.current = true;
          }}
          onPointerUp={() => {
            pointerNavigatingRef.current = false;
          }}
          onPointerCancel={() => {
            pointerNavigatingRef.current = false;
          }}
          onFocusCapture={handleFocusCapture}
          onBlurCapture={handleBlurCapture}
        >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-responsum-gradient" />

        <div className="relative flex h-[72px] shrink-0 items-center justify-center px-2">
          <button
            type="button"
            onClick={() => {
              navigate('/');
              closeMobile();
            }}
            className="flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141516]"
            aria-label="Ir para tickets"
          >
            <SidebarLogo expanded={showLabels} />
          </button>

          {showLabels && (
            <button
              type="button"
              onClick={() => {
                if (mobileOpen) {
                  closeMobile();
                  return;
                }
                setCollapsed(!collapsed);
              }}
              className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] motion-reduce:transition-none"
              aria-label={mobileOpen ? 'Fechar menu' : collapsed ? 'Fixar menu aberto' : 'Recolher menu'}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={(event) => {
                    closeMobile();
                    setKeyboardExpanded(false);
                    event.currentTarget.blur();
                    window.setTimeout(() => {
                      pointerNavigatingRef.current = false;
                    }, 0);
                  }}
                  aria-label={item.name}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex h-11 items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141516] motion-reduce:transition-none',
                    showLabels ? 'gap-3 px-3' : 'justify-center px-0',
                    active
                      ? 'bg-[#F69F19] text-[#141516] shadow-lg shadow-[#F69F19]/20'
                      : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-5 w-5" />
                    {!showLabels && item.badge ? (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#F69F19] ring-2 ring-[#141516]" />
                    ) : null}
                  </span>
                  <AnimatePresence initial={false}>
                    {showLabels && (
                      <motion.span
                        key={`${item.name}-label`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16, ease: logoEase }}
                        className="min-w-0 flex-1 truncate text-sm font-medium"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {showLabels && item.badge ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                        active ? 'bg-[#141516] text-[#F69F19]' : 'bg-[#F69F19] text-[#141516]'
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto border-t border-white/[0.06] p-2">
          {showLabels && (
            <div className="mb-2 flex items-center justify-center px-2 py-1">
              <img src="/assets/logo-bp.png" alt="BP" className="h-6 w-auto opacity-80" />
            </div>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] motion-reduce:transition-none',
                  showLabels ? 'gap-3' : 'justify-center'
                )}
              >
                <div className="relative shrink-0">
                  <UserAvatar
                    name={user?.name}
                    userId={user?.id}
                    avatarUrl={user?.avatarUrl}
                    size="md"
                    className="h-9 w-9 ring-2 ring-white/10"
                    fallbackClassName="bg-[#F69F19] text-[#141516]"
                  />
                  <span
                    className={cn(
                      'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#141516]',
                      isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    )}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {showLabels && (
                    <motion.div
                      key="user-copy"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16, ease: logoEase }}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                      <p className="truncate text-xs text-white/55">{user?.email}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                'w-[min(20rem,calc(100vw-1rem))] overflow-visible shadow-xl shadow-black/30',
                mobileOpen ? 'z-[80]' : 'z-[60]',
              )}
              align={showLabels ? 'end' : 'start'}
              side={mobileOpen ? 'bottom' : 'right'}
              sideOffset={10}
              style={{ backgroundColor: '#1a1a2e' }}
            >
              <div className="h-1 w-full bg-responsum-gradient" />
              <div className="bg-gradient-to-b from-white/5 to-transparent p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={user?.name}
                    userId={user?.id}
                    avatarUrl={user?.avatarUrl}
                    size="lg"
                    className="h-10 w-10 border-2 border-[#F69F19]/30"
                    fallbackClassName="bg-[#F69F19] text-[#141516]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                    <p className="mt-1 break-all text-xs text-white/70">{user?.email}</p>
                    <Badge variant={getRoleBadgeVariant(user?.role)} size="sm" className="mt-2 w-fit">
                      {getRoleLabel(user?.role)}
                    </Badge>
                  </div>
                </div>
              </div>

              {user?.department && (
                <>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <div className="px-4 py-2">
                    <p className="mb-1 text-xs text-white/60">Departamento</p>
                    <Badge variant="outline" className={cn('text-xs font-medium', getDepartmentColor(user.department))}>
                      {user.department}
                    </Badge>
                  </div>
                </>
              )}

              {isStaff && (
                <>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <div className="px-4 py-2">
                    <p className="mb-1 text-xs text-white/60">Status</p>
                    <OnlineStatusToggle compact />
                  </div>
                </>
              )}

              <DropdownMenuSeparator className="bg-gray-700" />
              <div className="px-4 py-2.5" role="group" aria-label="Densidade da interface">
                <p className="mb-2 text-xs font-medium text-white/65">Densidade da interface</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setDensity('comfortable');
                    }}
                    aria-pressed={density === 'comfortable'}
                    className={cn(
                      'flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]',
                      density === 'comfortable'
                        ? 'border-[#F69F19] bg-[#F69F19]/20 text-white'
                        : 'border-white/10 text-white/65 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <Rows3 className="h-4 w-4" />
                    Confortável
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setDensity('compact');
                    }}
                    aria-pressed={density === 'compact'}
                    className={cn(
                      'flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]',
                      density === 'compact'
                        ? 'border-[#F69F19] bg-[#F69F19]/20 text-white'
                        : 'border-white/10 text-white/65 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <Rows4 className="h-4 w-4" />
                    Compacta
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                onClick={() => {
                  navigate('/profile');
                  closeMobile();
                }}
                className="cursor-pointer px-4 py-2.5 text-white/80 focus:bg-white/10 focus:text-white"
              >
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                onClick={logout}
                className="px-4 py-2.5 text-red-400 focus:bg-red-950 focus:text-red-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      </div>
    </>
  );
}

export default AppSidebar;
