import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
export type UserRole = 'user' | 'support' | 'admin' | 'lawyer';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string; // Agora é obrigatório
  isOnline?: boolean;
  lastActiveAt?: string;
}

interface SupabaseQueryResult {
  data: any;
  error: any;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  register: (email: string, password: string, name: string) => Promise<{ user: User | null; error: string | null }>;
  logout: () => void;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Check for existing Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Session check:', { session: !!session, error });
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user && mounted) {
          console.log('Found session, loading profile...');
          await loadUserProfile(session.user.id);
        } else if (mounted) {
          console.log('No session found');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in initAuth:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, loading profile...');
        await loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUserId: string) => {
    try {
      console.log('Loading user profile for:', authUserId);
      
      // Primeiro, tente carregar pelo auth_user_id
      let userProfile = null;
      let error = null;
      
      try {
        // Evite usar Promise.race e faça a consulta diretamente
        const response = await supabase
          .from(TABLES.USERS)
          .select('*')
          .eq('auth_user_id', authUserId)
          .single();
        
        userProfile = response.data;
        error = response.error;
      } catch (e) {
        console.error('Error querying by auth_user_id:', e);
        error = e;
      }

      // Se não encontrou o perfil ou houve erro, tente pelo email
      if (!userProfile || error) {
        console.log('Profile not found by auth_user_id, trying email fallback...');
        
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          
          if (authUser?.email) {
            console.log('Trying fallback by email:', authUser.email);
            
            const emailResponse = await supabase
              .from(TABLES.USERS)
              .select('*')
              .eq('email', authUser.email)
              .single();
            
            if (emailResponse.data && !emailResponse.error) {
              // Update the profile with auth_user_id
              await supabase
                .from(TABLES.USERS)
                .update({ auth_user_id: authUserId })
                .eq('id', emailResponse.data.id);
              
              userProfile = emailResponse.data;
              error = null;
            }
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }

      // Se ainda não encontrou o perfil, crie um perfil padrão
      if (!userProfile) {
        console.log('Profile not found, creating default profile...');
        
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          
          if (authUser?.email) {
            const { data: newProfile, error: createError } = await supabase
              .from(TABLES.USERS)
              .insert({
                name: authUser.user_metadata?.name || authUser.email.split('@')[0],
                email: authUser.email,
                role: 'user',
                department: 'Geral', // Adicionando departamento padrão
                auth_user_id: authUserId
              })
              .select()
              .single();
            
            if (newProfile && !createError) {
              userProfile = newProfile;
              error = null;
            } else {
              console.error('Error creating default profile:', createError);
            }
          }
        } catch (createError) {
          console.error('Error creating default profile:', createError);
        }
      }

      // Se encontrou o perfil, atualize o estado
      if (userProfile) {
        const userData: User = {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
          role: userProfile.role as UserRole, // Garantir que o tipo seja correto
          department: userProfile.department || 'Geral', // Garantir que sempre tenha um valor
          isOnline: userProfile.is_online || false,
          lastActiveAt: userProfile.last_active_at
        };

        console.log('User profile loaded successfully:', userData);
        setUser(userData);
      } else {
        console.error('Failed to load or create user profile');
        setUser(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      setLoading(true);
      console.log('Starting registration for:', email);

      // First create the user profile in our database
      const { data: directProfile, error: directError } = await supabase
        .from(TABLES.USERS)
        .insert({
          name: name,
          email: email,
          role: 'user', // Default role for new registrations
          department: 'Geral', // Adicionando departamento padrão
          is_online: false, // Definir status online inicial
        })
        .select()
        .single();

      if (directError) {
        console.error('Direct profile creation failed:', directError);
        setLoading(false);
        return { user: null, error: `Erro ao criar perfil: ${directError.message}` };
      }

      if (directProfile) {
        // Then create the auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              name: name,
            }
          }
        });

        if (authError) {
          console.error('Supabase auth error:', authError);
          // Clean up the profile we created
          await supabase.from(TABLES.USERS).delete().eq('id', directProfile.id);
          setLoading(false);
          return { user: null, error: authError.message };
        }

        if (authData.user) {
          // Update the profile with auth_user_id
          await supabase
            .from(TABLES.USERS)
            .update({ auth_user_id: authData.user.id })
            .eq('id', directProfile.id);

          const user: User = {
            id: directProfile.id,
            name: directProfile.name,
            email: directProfile.email,
            role: directProfile.role as UserRole,
            department: directProfile.department || 'Geral', // Garantir que sempre tenha um valor
            isOnline: directProfile.is_online || false,
          };

          setUser(user);
          setLoading(false);
          return { user, error: null };
        }
      }

      setLoading(false);
      return { user: null, error: 'Falha ao criar usuário' };
    } catch (error: any) {
      console.error('Registration error:', error);
      setLoading(false);
      return { user: null, error: error.message || 'Erro ao registrar usuário' };
    }
  };

  const login = async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      setLoading(true);
      console.log('Starting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login result:', { data, error });

      if (error) {
        console.error('Supabase auth error:', error);
        setLoading(false);
        return { user: null, error: error.message };
      }

      if (data.user) {
        console.log('Login successful, user authenticated:', data.user.id);
        // The auth state change will trigger loadUserProfile
        return { user: null, error: null }; // Return null user as it will be set by loadUserProfile
      }

      setLoading(false);
      return { user: null, error: 'Login falhou' };
    } catch (error: any) {
      console.error('Login error:', error);
      setLoading(false);
      return { user: null, error: error.message || 'Erro ao fazer login' };
    }
  };

  const logout = async () => {
    console.log('Logging out');
    
    // Atualizar status para offline antes de sair
    if (user) {
      try {
        await supabase
          .from(TABLES.USERS)
          .update({ is_online: false })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating online status on logout:', error);
      }
    }
    
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};