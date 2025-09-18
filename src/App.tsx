import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// OU se preferir manter o BrowserRouter:
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Tickets from '@/pages/Tickets';
import { useAuth } from '@/contexts/AuthContext';

// Uma solução mais simples é modificar o componente Layout para aceitar props opcionais
// Vamos criar um wrapper para o Layout que fornece valores padrão

const LayoutWrapper: React.FC<{ children: React.ReactNode; pageName?: 'tickets' | 'dashboard' }> = ({ 
  children, 
  pageName = 'dashboard' 
}) => {
  const [currentPage, setCurrentPage] = useState<'tickets' | 'dashboard'>(pageName);
  
  const handlePageChange = (page: 'tickets' | 'dashboard') => {
    setCurrentPage(page);
    // Navegação usando window.location para simplicidade
    window.location.href = page === 'dashboard' ? '/' : '/tickets';
  };
  
  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {children}
    </Layout>
  );
};

const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles?: string[];
  pageName?: 'tickets' | 'dashboard';
}> = ({ 
  children, 
  allowedRoles = [],
  pageName
}) => {
  const { user, loading } = useAuth();

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

  // Check if user role is allowed for this route
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/tickets" replace />;
  }

  return <LayoutWrapper pageName={pageName}>{children}</LayoutWrapper>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  // Show login page if no user and not loading
  if (!loading && !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Show loading if still loading
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

  // Show main app if user is logged in
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/tickets" replace />} />
      
      {/* Dashboard only for admins */}
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['admin']} pageName="dashboard">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Tickets page for all authenticated users */}
      <Route
        path="/tickets"
        element={
          <ProtectedRoute pageName="tickets">
            <Tickets />
          </ProtectedRoute>
        }
      />
      
      {/* Redirect all other routes based on user role */}
      <Route 
        path="*" 
        element={
          user?.role === 'admin' ? 
            <Navigate to="/" replace /> : 
            <Navigate to="/tickets" replace />
        } 
      />
    </Routes>
  );
};

const App: React.FC = () => {
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