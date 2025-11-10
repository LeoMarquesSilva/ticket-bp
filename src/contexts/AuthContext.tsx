import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, TABLES } from '@/lib/supabase';

export type UserRole = 'user' | 'support' | 'admin' | 'lawyer';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  isOnline?: boolean;
  lastActiveAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  register: (email: string, password: string, name: string) => Promise<{ user: User | null; error: string | null }>;
  logout: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; error: string | null }>;
  loading: boolean;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
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
        // Cache válido por 2 horas
        if (timeSinceLastCheck < 2 * 60 * 60 * 1000) {
          return JSON.parse(userData);
        }
      }
      return null;
    } catch (error) {
      console.warn('Erro ao recuperar do sessionStorage:', error);
      return null;
    }
  };

  // Inicialização única e definitiva
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação (única vez)...');
        
        // 1. Tentar carregar do cache primeiro
        const cachedUser = getUserFromStorage();
        if (cachedUser) {
          console.log('✅ Usuário carregado do cache:', cachedUser.name);
          setUser(cachedUser);
          setLoading(false);
          return;
        }

        // 2. Se não há cache, verificar sessão do Supabase
        console.log('🔍 Verificando sessão do Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao verificar sessão:', error);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('🔍 Sessão encontrada, carregando perfil...');
          currentAuthUserId.current = session.user.id;
          await loadUserProfile(session.user.id);
        } else {
          console.log('ℹ️ Nenhuma sessão encontrada');
          setLoading(false);
        }
        
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setLoading(false);
      }
    };

    initAuth();

    // Configurar listener de auth APENAS UMA VEZ
    if (!authSubscription.current) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth event:', event);
        
        // CRÍTICO: Só processar eventos realmente novos
        const newAuthUserId = session?.user?.id || null;
        
        if (event === 'SIGNED_IN' && newAuthUserId && newAuthUserId !== currentAuthUserId.current && !user) {
          console.log('✅ Processando login genuíno');
          currentAuthUserId.current = newAuthUserId;
          await loadUserProfile(newAuthUserId);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 Processando logout');
          handleLogout();
        } else {
          console.log('🚫 Ignorando evento auth (usuário já carregado ou evento duplicado)');
        }
      });
      
      authSubscription.current = subscription;
    }

    return () => {
      if (authSubscription.current) {
        authSubscription.current.unsubscribe();
        authSubscription.current = null;
      }
    };
  }, []);

  const loadUserProfile = async (authUserId: string) => {
    try {
      console.log('👤 Carregando perfil para:', authUserId);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const { data: userProfile, error } = await supabase
          .from(TABLES.USERS)
          .select('*')
          .eq('auth_user_id', authUserId)
          .abortSignal(controller.signal)
          .single();

        clearTimeout(timeoutId);

        if (userProfile && !error) {
          const userData: User = {
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role as UserRole,
            department: userProfile.department || 'Geral',
            isOnline: userProfile.is_online || false,
            lastActiveAt: userProfile.last_active_at
          };

          console.log('✅ Perfil carregado:', userData.name);
          setUser(userData);
          saveUserToStorage(userData);
          setLoading(false);
          return;
        }

        // Fallback por email
        console.log('🔄 Tentando fallback por email...');
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser?.email) {
          const { data: emailProfile, error: emailError } = await supabase
            .from(TABLES.USERS)
            .select('*')
            .eq('email', authUser.email)
            .single();
          
          if (emailProfile && !emailError) {
            await supabase
              .from(TABLES.USERS)
              .update({ auth_user_id: authUserId })
              .eq('id', emailProfile.id);
            
            const userData: User = {
              id: emailProfile.id,
              name: emailProfile.name,
              email: emailProfile.email,
              role: emailProfile.role as UserRole,
              department: emailProfile.department || 'Geral',
              isOnline: emailProfile.is_online || false,
              lastActiveAt: emailProfile.last_active_at
            };

            console.log('✅ Perfil carregado via fallback:', userData.name);
            setUser(userData);
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
        setLoading(false);
      }
      
    } catch (error) {
      console.error('❌ Erro geral ao carregar perfil:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('👋 Executando logout...');
    setUser(null);
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
          };

          setUser(user);
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

  const resetPassword = async (email: string): Promise<{ success: boolean; error: string | null }> => {
    try {
      console.log('🔄 Solicitando reset de senha para:', email);
      
      const { data: userExists, error: userCheckError } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('email', email)
        .single();
      
      if (userCheckError || !userExists) {
        console.error('❌ Usuário não encontrado:', email);
        return { 
          success: false, 
          error: 'E-mail não encontrado no sistema. Verifique se digitou corretamente ou entre em contato com o suporte.' 
        };
      }
      
      const baseUrl = window.location.origin;
      const resetUrl = `${baseUrl}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      if (error) {
        console.error('❌ Erro no reset de senha:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro no reset de senha:', error);
      return { success: false, error: error.message || 'Erro ao solicitar redefinição de senha' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
};