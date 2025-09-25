import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Tickets from '@/pages/Tickets';
import UserManagement from '@/pages/UserManagement';
import DatabaseManagement from '@/pages/DatabaseManagement';

// Componente para rotas protegidas
const ProtectedRoute = ({ 
  children, 
  allowedRoles = [] 
}: { 
  children: React.ReactNode; 
  allowedRoles?: string[];
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // Determinar a página atual com base na URL
  const getCurrentPage = (): 'dashboard' | 'tickets' | 'users' | 'database' => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/users')) return 'users';
    if (path.includes('/database')) return 'database';
    return 'tickets'; // default
  };
  
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'tickets' | 'users' | 'database'>(getCurrentPage());
  
  // Handler para mudança de página
  const handlePageChange = (page: 'dashboard' | 'tickets' | 'users' | 'database') => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
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

  // Verificar se o usuário tem permissão para acessar esta rota
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/tickets" replace />;
  }

  // Passando as props necessárias para o Layout
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

  // Mostrar página de login se não houver usuário e não estiver carregando
  if (!loading && !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Mostrar carregamento se ainda estiver carregando
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Mostrar o aplicativo principal se o usuário estiver logado
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/tickets" replace />} />
      
      {/* Dashboard apenas para administradores */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Página de tickets para todos os usuários autenticados */}
      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <Tickets />
          </ProtectedRoute>
        }
      />
      
      {/* Página de gerenciamento de usuários apenas para administradores */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      
      {/* Página de gerenciamento de banco de dados apenas para administradores */}
      <Route
        path="/database"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DatabaseManagement />
          </ProtectedRoute>
        }
      />
      
      {/* Redirecionar todas as outras rotas com base na função do usuário */}
      <Route 
        path="/" 
        element={
          <Navigate to={user?.role === 'admin' ? "/dashboard" : "/tickets"} replace />
        } 
      />
      
      <Route 
        path="*" 
        element={
          <Navigate to={user?.role === 'admin' ? "/dashboard" : "/tickets"} replace />
        } 
      />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <AppRoutes />
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
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;