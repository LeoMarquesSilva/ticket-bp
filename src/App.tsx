import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Tickets from '@/pages/Tickets';
import UserManagement from '@/pages/UserManagement';
import CategoryManagement from '@/pages/CategoryManagement';
// Banco de Dados desabilitado
// import DatabaseManagement from '@/pages/DatabaseManagement';
import Profile from '@/pages/Profile';
import ResetPassword from '@/pages/ResetPassword';
import PasswordChangeHandler from '@/components/PasswordChangeHandler';
import { initializeConnectionHandlers } from './utils/supabaseHelpers';
import { ConnectionStatus } from '@/components/ConnectionStatus';
// import { InactivityDetector } from '@/components/InactivityDetector'; // ← REMOVIDO para permitir login persistente
import { useTabVisibility } from '@/hooks/useTabVisibility';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/services/roleService';

/** Retorna a primeira rota que o usuário tem permissão para acessar. */
function useFirstAllowedPath(): string {
  const { has } = usePermissions();
  if (has('dashboard')) return '/dashboard';
  if (has('tickets') || has('create_ticket')) return '/tickets';
  if (has('manage_users') || has('manage_roles')) return '/users';
  if (has('manage_categories')) return '/categories';
  return '/profile';
}

function DefaultRedirect() {
  const path = useFirstAllowedPath();
  return <Navigate to={path} replace />;
}

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requiredPermission,
  requiredPermissionAny
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: PermissionKey;
  requiredPermissionAny?: PermissionKey[];
}) => {
  const { user, loading } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const firstAllowedPath = useFirstAllowedPath();
  const isTabVisible = useTabVisibility();
  
  const getCurrentPage = (): 'dashboard' | 'tickets' | 'users' | 'profile' => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/users')) return 'users';
    if (path.includes('/profile')) return 'profile';
    return 'tickets';
  };
  
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'tickets' | 'users' | 'profile'>(getCurrentPage());
  
  const handlePageChange = (page: 'dashboard' | 'tickets' | 'users' | 'profile') => {
    setCurrentPage(page);
  };

  const hasRequiredAccess = (): boolean => {
    if (requiredPermissionAny?.length) {
      return requiredPermissionAny.some((p) => has(p));
    }
    if (requiredPermission) return has(requiredPermission);
    return true;
  };
  
  // Loading mais inteligente - só mostrar se realmente necessário
  const needsPermissionCheck = requiredPermission != null || (requiredPermissionAny?.length ?? 0) > 0;
  if (loading || (needsPermissionCheck && permissionsLoading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!hasRequiredAccess()) {
    const isAdmin = String(user?.role ?? '').toLowerCase() === 'admin';
    if (isAdmin) {
      return (
        <Layout currentPage={currentPage} onPageChange={handlePageChange}>
          {children}
        </Layout>
      );
    }
    return <Navigate to={firstAllowedPath} replace />;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={firstAllowedPath} replace />;
  }
  
  return (
    <Layout
      currentPage={currentPage}
      onPageChange={handlePageChange}
    >
      {children}
    </Layout>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isResetPasswordPage = location.pathname === '/reset-password';

  if (isResetPasswordPage) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }
  
  if (!loading && !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/tickets" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredPermission="dashboard">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute requiredPermissionAny={['tickets', 'create_ticket']}>
            <Tickets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/:ticketId"
        element={
          <ProtectedRoute requiredPermissionAny={['tickets', 'create_ticket']}>
            <Tickets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredPermissionAny={['manage_users', 'manage_roles']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute requiredPermission="manage_categories">
            <CategoryManagement />
          </ProtectedRoute>
        }
      />
      {/* Banco de Dados desabilitado - rota removida */}
      {/* <Route
        path="/database"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DatabaseManagement />
          </ProtectedRoute>
        }
      /> */}
      {/* ✅ NOVA ROTA: Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    // Inicializar handlers simples
    const cleanup = initializeConnectionHandlers();
    return cleanup;
  }, []);

  return (
    <AuthProvider>
      <ChatProvider>
        <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          {/* Adicione o FontLoader aqui */}
          <ConnectionStatus />
          {/*
            InactivityDetector DESABILITADO para sistema de helpdesk
            Motivo: Usuários da equipe precisam manter login ativo para receber
            notificações sonoras mesmo quando não estão interagindo com o sistema
          */}
          {/* <InactivityDetector /> */}
          {/* PasswordChangeHandler - Controla automaticamente quando mostrar modal de alteração de senha */}
          <PasswordChangeHandler>
            <AppRoutes />
          </PasswordChangeHandler>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'white',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
              },
            }}
          />
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
};

export default App;