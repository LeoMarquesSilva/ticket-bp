import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Ticket, BarChart3, Users, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'tickets' | 'dashboard';
  onPageChange: (page: 'tickets' | 'dashboard') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const { user, logout } = useAuth();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-[#D5B170] to-[#e6c485] text-[#101F2E] border-0 font-semibold';
      case 'support':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 font-semibold';
      case 'user':
        return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 font-semibold';
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
      case 'user':
        return 'Jurídico';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] shadow-2xl border-b border-[#D5B170]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#D5B170] rounded-xl blur-lg opacity-30"></div>
                  <div className="relative bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-[#D5B170]/30">
                    <img 
                      src="/assets/logo.png" 
                      alt="Bismarchi Pires" 
                      className="h-10 w-auto"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-[#D5B170]" />
                    Sistema de Tickets
                  </h1>
                  <p className="text-sm text-[#D5B170]">Bismarchi | Pires Sociedade de Advogados</p>
                </div>
              </div>
              <Badge className={getRoleBadgeColor(user?.role || '')}>
                {getRoleLabel(user?.role || '')}
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-[#D5B170]">{user?.email}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="bg-white/10 hover:bg-white/20 border-[#D5B170]/30 text-white hover:text-white backdrop-blur-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white/60 backdrop-blur-xl border-b border-[#D5B170]/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => onPageChange('tickets')}
              className={`py-4 px-6 border-b-3 font-medium text-sm transition-all duration-300 flex items-center space-x-2 ${
                currentPage === 'tickets'
                  ? 'border-[#D5B170] text-[#101F2E] bg-[#D5B170]/10'
                  : 'border-transparent text-slate-600 hover:text-[#101F2E] hover:border-[#D5B170]/50 hover:bg-[#D5B170]/5'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Tickets</span>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => onPageChange('dashboard')}
                className={`py-4 px-6 border-b-3 font-medium text-sm transition-all duration-300 flex items-center space-x-2 ${
                  currentPage === 'dashboard'
                    ? 'border-[#D5B170] text-[#101F2E] bg-[#D5B170]/10'
                    : 'border-transparent text-slate-600 hover:text-[#101F2E] hover:border-[#D5B170]/50 hover:bg-[#D5B170]/5'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-[#D5B170]/20 p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;