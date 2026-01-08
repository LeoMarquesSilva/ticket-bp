import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { toast } from 'sonner';

interface PasswordChangeHandlerProps {
  children: React.ReactNode;
}

const PasswordChangeHandler: React.FC<PasswordChangeHandlerProps> = ({ children }) => {
  const { user, requiresPasswordChange, refreshUserProfile, loading } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  // Efeito para detectar quando precisa alterar senha
  useEffect(() => {
    if (!loading && user && requiresPasswordChange) {
      console.log('🔐 Usuário precisa alterar senha:', {
        firstLogin: user.firstLogin,
        mustChangePassword: user.mustChangePassword,
        passwordChangedAt: user.passwordChangedAt
      });

      setIsFirstLogin(user.firstLogin || false);
      setShowPasswordModal(true);
    } else if (!loading && user && !requiresPasswordChange) {
      setShowPasswordModal(false);
    }
  }, [user, requiresPasswordChange, loading]);

  const handlePasswordChangeSuccess = async () => {
    try {
      console.log('✅ Senha alterada com sucesso, atualizando perfil...');
      
      // Recarregar o perfil do usuário para atualizar os campos
      await refreshUserProfile();
      
      // Fechar o modal
      setShowPasswordModal(false);
      setIsFirstLogin(false);
      
      // Mostrar mensagem de sucesso
      toast.success(
        isFirstLogin 
          ? 'Bem-vindo! Sua senha foi alterada com sucesso.' 
          : 'Senha alterada com sucesso!'
      );
      
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil após alteração de senha:', error);
      toast.error('Erro ao atualizar perfil. Faça login novamente.');
    }
  };

  const handlePasswordChangeCancel = () => {
    // Se é primeiro login, não permite cancelar
    if (isFirstLogin || (user?.mustChangePassword)) {
      toast.warning('Você deve alterar sua senha para continuar usando o sistema.');
      return;
    }
    
    setShowPasswordModal(false);
  };

  // Se está carregando, não renderiza nada
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário logado, renderiza os children normalmente (página de login)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Renderizar o conteúdo principal */}
      {children}
      
      {/* Modal de alteração de senha */}
      <ChangePasswordModal
        open={showPasswordModal}
        isFirstLogin={isFirstLogin || (user?.mustChangePassword || false)}
        onSuccess={handlePasswordChangeSuccess}
        onCancel={!isFirstLogin && !user?.mustChangePassword ? handlePasswordChangeCancel : undefined}
      />
    </>
  );
};

export default PasswordChangeHandler;