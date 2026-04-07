import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { passwordService, FirstLoginData } from '@/services/passwordService';
import { UserService } from '@/services/userService';
import { User, UserRole } from '@/types';

// Re-exportar UserRole para compatibilidade
export type { UserRole };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  register: (email: string, password: string, name: string) => Promise<{ user: User | null; error: string | null }>;
  logout: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; error: string | null }>;
  loading: boolean;
  requiresPasswordChange: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Chaves para o sessionStorage
const USER_STORAGE_KEY = 'helpdesk_user_data';
const LAST_AUTH_CHECK_KEY = 'helpdesk_last_auth_check';

// Função para verificar se precisa alterar senha
const checkPasswordChangeRequired = (user: User): boolean => {
  if (!user) return false;
  
  // Se é primeiro login ou está marcado para alterar senha
  if (user.firstLogin || user.mustChangePassword) {
    return true;
  }
  
  // Se nunca alterou a senha
  if (!user.passwordChangedAt) {
    return true;
  }
  
  // Verificar se a senha é muito antiga (opcional - 90 dias)
  const passwordDate = new Date(user.passwordChangedAt);
  const now = new Date();
  const daysSinceChange = (now.getTime() - passwordDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Se passou mais de 90 dias, pode forçar alteração (opcional)
  // return daysSinceChange > 90;
  
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  
  // Refs para controlar execuções
  const isInitialized = useRef(false);
  const authSubscription = useRef<any>(null);
  const currentAuthUserId = useRef<string | null>(null);

  // Função para salvar usuário no sessionStorage
  const saveUserToStorage = (userData: User | null) => {
    try {
      if (userData) {
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        sessionStorage.setItem(LAST_AUTH_CHECK_KEY, Date.now().toString());
      } else {
        sessionStorage.removeItem(USER_STORAGE_KEY);
        sessionStorage.removeItem(LAST_AUTH_CHECK_KEY);
        currentAuthUserId.current = null;
      }
    } catch (error) {
      console.warn('Erro ao salvar no sessionStorage:', error);
    }
  };

  // Função para recuperar usuário do sessionStorage
  const getUserFromStorage = (): User | null => {
    try {
      const userData = sessionStorage.getItem(USER_STORAGE_KEY);
      const lastCheck = sessionStorage.getItem(LAST_AUTH_CHECK_KEY);
      
      if (userData && lastCheck) {
        const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
        // Cache válido por 24 horas
        if (timeSinceLastCheck < 24 * 60 * 60 * 1000) {
          return JSON.parse(userData);
        }
      }
      return null;
    } catch (error) {
      console.warn('Erro ao recuperar do sessionStorage:', error);
      return null;
    }
  };

  // Função para recarregar perfil do usuário
  const refreshUserProfile = async () => {
    if (!user) return;

    try {
      // Obter authUserId: tentar getSession, depois getUser
      let authUserId: string | undefined;
      const { data: { session } } = await supabase.auth.getSession();
      authUserId = session?.user?.id;

      if (!authUserId) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        authUserId = authUser?.id;
      }

      if (authUserId) {
        await loadUserProfile(authUserId);
        return;
      }

      // Fallback: buscar usuário diretamente por id (app user) quando sessão indisponível
      const updatedUser = await UserService.getUserById(user.id);
      if (updatedUser) {
        setUser(updatedUser);
        setRequiresPasswordChange(checkPasswordChangeRequired(updatedUser));
        saveUserToStorage(updatedUser);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
    }
  };

  // Inicialização única e definitiva
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    let cancelled = false;

    const initAuth = async () => {
      try {
        const cachedUser = getUserFromStorage();
        if (cachedUser) {
          setUser(cachedUser);
          setRequiresPasswordChange(checkPasswordChangeRequired(cachedUser));
          setLoading(false);
          try {
            const { data: { session: s } } = await supabase.auth.getSession();
            if (s?.user?.id) currentAuthUserId.current = s.user.id;
          } catch {
            /* ignore */
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao verificar sessão:', error);
          setLoading(false);
          return;
        }

        if (session?.user) {
          currentAuthUserId.current = session.user.id;
          await loadUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
        
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setLoading(false);
      }
    };

    const start = async () => {
      await initAuth();
      if (cancelled) return;
      // Depois do init: ref já alinhado (cache ou sessão), evitando SIGNED_IN redundante em corrida.
      if (!authSubscription.current) {
        // Não use `user` aqui: o effect tem deps [] então o closure teria sempre user === null e todo
        // SIGNED_IN (ex.: ao voltar à aba / refresh de token) dispararia load de novo e loading infinito.
        // Também não await loadUserProfile dentro do callback: getUser/getSession dentro dele pode travar (Supabase).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          const newAuthUserId = session?.user?.id ?? null;
          if (event === 'SIGNED_IN' && newAuthUserId) {
            if (newAuthUserId !== currentAuthUserId.current) {
              currentAuthUserId.current = newAuthUserId;
              setLoading(true);
              queueMicrotask(() => {
                void loadUserProfile(newAuthUserId);
              });
            }
          } else if (event === 'SIGNED_OUT') {
            handleLogout();
          }
        });

        authSubscription.current = subscription;
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (authSubscription.current) {
        authSubscription.current.unsubscribe();
        authSubscription.current = null;
      }
    };
  }, []);

  const loadUserProfile = async (authUserId: string | null | undefined) => {
    // Validar authUserId antes de usar
    if (!authUserId || authUserId === 'null' || authUserId === 'undefined') {
      console.error('❌ authUserId inválido:', authUserId);
      setLoading(false);
      return;
    }
    
    try {
      console.log('👤 Carregando perfil para:', authUserId);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // Selecionar campos específicos incluindo ticket_view_preference e is_active
        const { data: userProfile, error } = await supabase
          .from(TABLES.USERS)
          .select('id, name, email, role, department, avatar_url, is_online, last_active_at, first_login, must_change_password, password_changed_at, ticket_view_preference, is_active, created_at, auth_user_id')
          .eq('auth_user_id', authUserId)
          .abortSignal(controller.signal)
          .single();

        clearTimeout(timeoutId);

        if (error) {
          console.error('❌ Erro ao buscar perfil:', error);
          // Continuar para o fallback mesmo se houver erro
        }

        if (userProfile && !error) {
          // Carregar preferência de visualização do banco
          const ticketViewPref = (userProfile.ticket_view_preference as 'list' | 'board' | 'users' | null) || 'list';
          
          // Verificar se o usuário está ativo
          const isActive = userProfile.is_active !== undefined ? userProfile.is_active : true;
          
          if (!isActive) {
            console.error('❌ Usuário inativo. Login bloqueado.');
            await supabase.auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }

          const userData: User = {
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role as UserRole,
            department: userProfile.department || 'Geral',
            avatarUrl: userProfile.avatar_url || undefined,
            isOnline: userProfile.is_online || false,
            lastActiveAt: userProfile.last_active_at,
            firstLogin: userProfile.first_login || false,
            mustChangePassword: userProfile.must_change_password || false,
            passwordChangedAt: userProfile.password_changed_at,
            ticketViewPreference: ticketViewPref,
            isActive: isActive,
            createdAt: userProfile.created_at 
          };

          console.log('✅ Perfil carregado:', userData.name);
          setUser(userData);
          setRequiresPasswordChange(checkPasswordChangeRequired(userData));
          saveUserToStorage(userData);
          setLoading(false);
          return;
        }

        // Fallback por email
        console.log('🔄 Tentando fallback por email...');
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser?.email) {
          // Selecionar campos específicos incluindo ticket_view_preference e is_active
          const { data: emailProfile, error: emailError } = await supabase
            .from(TABLES.USERS)
            .select('id, name, email, role, department, avatar_url, is_online, last_active_at, first_login, must_change_password, password_changed_at, ticket_view_preference, is_active, created_at, auth_user_id')
            .eq('email', authUser.email)
            .single();
          
          if (emailProfile && !emailError) {
            await supabase
              .from(TABLES.USERS)
              .update({ auth_user_id: authUserId })
              .eq('id', emailProfile.id);
            
            // Verificar se o usuário está ativo
            const isActive = emailProfile.is_active !== undefined ? emailProfile.is_active : true;
            
            if (!isActive) {
              console.error('❌ Usuário inativo. Login bloqueado.');
              await supabase.auth.signOut();
              setUser(null);
              setLoading(false);
              return;
            }

            // Carregar preferência de visualização do banco
            const ticketViewPref = (emailProfile.ticket_view_preference as 'list' | 'board' | 'users' | null) || 'list';
            
            const userData: User = {
              id: emailProfile.id,
              name: emailProfile.name,
              email: emailProfile.email,
              role: emailProfile.role as UserRole,
              department: emailProfile.department || 'Geral',
              avatarUrl: emailProfile.avatar_url || undefined,
              isOnline: emailProfile.is_online || false,
              lastActiveAt: emailProfile.last_active_at,
              firstLogin: emailProfile.first_login || false,
              mustChangePassword: emailProfile.must_change_password || false,
              passwordChangedAt: emailProfile.password_changed_at,
              ticketViewPreference: ticketViewPref,
              isActive: isActive,
              createdAt: emailProfile.created_at
            };

            console.log('✅ Perfil carregado via fallback:', userData.name);
            setUser(userData);
            setRequiresPasswordChange(checkPasswordChangeRequired(userData));
            saveUserToStorage(userData);
            setLoading(false);
            return;
          }
        }

        console.error('❌ Não foi possível carregar o perfil');
        setLoading(false);
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('❌ Erro ao carregar perfil:', error);
        console.error('❌ Detalhes do erro:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        setLoading(false);
      }
      
    } catch (error: any) {
      console.error('❌ Erro geral ao carregar perfil:', error);
      console.error('❌ Detalhes do erro geral:', {
        message: error?.message,
        stack: error?.stack
      });
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('👋 Executando logout...');
    setUser(null);
    setRequiresPasswordChange(false);
    saveUserToStorage(null);
    setLoading(false);
  };

  const register = async (email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      setLoading(true);
      console.log('📝 Iniciando registro para:', email);

      const { data: directProfile, error: directError } = await supabase
        .from(TABLES.USERS)
        .insert({
          name: name,
          email: email,
          role: 'user',
          department: 'Geral',
          is_online: false,
          is_active: true, // Usuários criados são ativos por padrão
          first_login: true,
          must_change_password: true,
        })
        .select()
        .single();

      if (directError) {
        console.error('❌ Falha ao criar perfil:', directError);
        setLoading(false);
        return { user: null, error: `Erro ao criar perfil: ${directError.message}` };
      }

      if (directProfile) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { name: name }
          }
        });

        if (authError) {
          console.error('❌ Erro de autenticação:', authError);
          await supabase.from(TABLES.USERS).delete().eq('id', directProfile.id);
          setLoading(false);
          return { user: null, error: authError.message };
        }

        if (authData.user) {
          currentAuthUserId.current = authData.user.id;
          
          await supabase
            .from(TABLES.USERS)
            .update({ auth_user_id: authData.user.id })
            .eq('id', directProfile.id);

          const user: User = {
            id: directProfile.id,
            name: directProfile.name,
            email: directProfile.email,
            role: directProfile.role as UserRole,
            department: directProfile.department || 'Geral',
            isOnline: directProfile.is_online || false,
            firstLogin: true,
            mustChangePassword: true,
          };

          setUser(user);
          setRequiresPasswordChange(true);
          saveUserToStorage(user);
          setLoading(false);
          return { user, error: null };
        }
      }

      setLoading(false);
      return { user: null, error: 'Falha ao criar usuário' };
    } catch (error: any) {
      console.error('❌ Erro no registro:', error);
      setLoading(false);
      return { user: null, error: error.message || 'Erro ao registrar usuário' };
    }
  };

  const login = async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      setLoading(true);
      console.log('🔐 Iniciando login para:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro de autenticação:', error);
        setLoading(false);
        return { user: null, error: error.message };
      }

      if (data.user) {
        console.log('✅ Login bem-sucedido');
        currentAuthUserId.current = data.user.id;
        // Carregar perfil imediatamente após login
        setLoading(true);
        try {
          await loadUserProfile(data.user.id);
        } catch (error) {
          console.error('❌ Erro ao carregar perfil após login:', error);
          setLoading(false);
          return { user: null, error: 'Erro ao carregar perfil do usuário' };
        }
        // Não precisa setar loading para false aqui, loadUserProfile já faz isso
        return { user: null, error: null };
      }

      setLoading(false);
      return { user: null, error: 'Login falhou' };
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      setLoading(false);
      return { user: null, error: error.message || 'Erro ao fazer login' };
    }
  };

  const logout = async () => {
    console.log('👋 Iniciando logout...');
    
    if (user) {
      try {
        await supabase
          .from(TABLES.USERS)
          .update({ is_online: false })
          .eq('id', user.id);
      } catch (error) {
        console.error('⚠️ Erro ao atualizar status online:', error);
      }
    }
    
    try {
      await supabase.auth.signOut();
      saveUserToStorage(null);
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
    } catch (error) {
      console.error('⚠️ Erro durante logout:', error);
    }
    
    handleLogout();
  };

  // ✅ VERSÃO MELHORADA com mais debug
  const resetPassword = async (email: string): Promise<{ success: boolean; error: string | null }> => {
    try {
      console.log('🔄 === INICIANDO PROCESSO DE RESET DE SENHA ===');
      console.log('📧 Email:', email);
      
      // Verificar se o usuário existe
      const { data: userExists, error: userCheckError } = await supabase
        .from(TABLES.USERS)
        .select('id, name, email')
        .eq('email', email)
        .single();
      
      console.log('👤 Verificação de usuário:', {
        encontrado: !!userExists,
        erro: userCheckError?.message || 'nenhum',
        dadosUsuario: userExists ? { id: userExists.id, name: userExists.name } : null
      });
      
      if (userCheckError || !userExists) {
        console.error('❌ Usuário não encontrado:', email);
        return { 
          success: false, 
          error: 'E-mail não encontrado no sistema. Verifique se digitou corretamente ou entre em contato com o suporte.' 
        };
      }
      
      // Configurar URLs de redirecionamento - usar URL absoluta completa
      // Tentar usar variável de ambiente primeiro, senão usar window.location.origin
      const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const resetUrl = `${baseUrl}/reset-password`;
      
      console.log('🔗 URLs configuradas:', {
        baseUrl,
        resetUrl,
        currentUrl: window.location.href,
        envUrl: import.meta.env.VITE_SITE_URL || 'não configurado'
      });
      
      // ✅ CONFIGURAÇÕES MAIS ESPECÍFICAS para o reset
      console.log('📤 Enviando e-mail de reset...');
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
        captchaToken: undefined, // Desabilitar captcha
      });
      
      console.log('📨 Resultado do envio:', {
        data: data,
        error: error?.message || 'nenhum',
        errorCode: (error as any)?.code || 'nenhum',
        errorStatus: (error as any)?.status || 'nenhum'
      });
      
      if (error) {
        console.error('❌ Erro detalhado no reset de senha:', {
          message: error.message,
          code: (error as any).code,
          status: (error as any).status,
          details: (error as any).details
        });
        
        // Tratar erros específicos
        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          return { 
            success: false, 
            error: 'Muitas tentativas de redefinição. Aguarde alguns minutos antes de tentar novamente.' 
          };
        }
        
        if (error.message.includes('email not confirmed')) {
          return { 
            success: false, 
            error: 'E-mail não confirmado. Entre em contato com o suporte.' 
          };
        }
        
        if (error.message.includes('not authorized')) {
          return { 
            success: false, 
            error: 'Não autorizado a redefinir senha para este e-mail.' 
          };
        }
        
        return { success: false, error: `Erro ao enviar e-mail: ${error.message}` };
      }
      
      console.log('✅ E-mail de reset enviado com sucesso!');
      console.log('📋 Dados retornados:', data);
      
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro inesperado no reset de senha:', error);
      console.error('❌ Stack trace:', error.stack);
      return { success: false, error: error.message || 'Erro inesperado ao solicitar redefinição de senha' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      resetPassword, 
      loading, 
      requiresPasswordChange,
      refreshUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};