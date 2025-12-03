import { supabase, TABLES } from '@/lib/supabase';

export interface PasswordResetRequest {
  email: string;
  requestedAt: string;
  token?: string;
}

export interface FirstLoginData {
  userId: string;
  isFirstLogin: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: string;
}

class PasswordService {
  // Solicitar redefinição de senha
  async requestPasswordReset(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔄 Solicitando reset de senha para:', email);
      
      // Verificar se o usuário existe
      const { data: userExists, error: userCheckError } = await supabase
        .from(TABLES.USERS)
        .select('id, name')
        .eq('email', email)
        .single();
      
      if (userCheckError || !userExists) {
        console.error('❌ Usuário não encontrado:', email);
        return { 
          success: false, 
          error: 'E-mail não encontrado no sistema. Verifique se digitou corretamente ou entre em contato com o suporte.' 
        };
      }
      
      // Configurar URL de redirecionamento
      const baseUrl = window.location.origin;
      const resetUrl = `${baseUrl}/reset-password`;
      
      // Enviar e-mail de redefinição
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      if (error) {
        console.error('❌ Erro no reset de senha:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ E-mail de reset enviado com sucesso');
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro no reset de senha:', error);
      return { success: false, error: error.message || 'Erro ao solicitar redefinição de senha' };
    }
  }

  // Redefinir senha
  async resetPassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔄 Redefinindo senha...');
      
      if (newPassword.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres' };
      }
      
      // Atualizar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      if (authError) {
        console.error('❌ Erro ao atualizar senha:', authError);
        return { success: false, error: authError.message };
      }
      
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Atualizar registro na tabela de usuários
        const { error: updateError } = await supabase
          .from(TABLES.USERS)
          .update({ 
            password_changed_at: new Date().toISOString(),
            must_change_password: false,
            first_login: false
          })
          .eq('auth_user_id', user.id);
        
        if (updateError) {
          console.warn('⚠️ Erro ao atualizar registro do usuário:', updateError);
        }
      }
      
      console.log('✅ Senha redefinida com sucesso');
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro ao redefinir senha:', error);
      return { success: false, error: error.message || 'Erro ao redefinir senha' };
    }
  }

  // Verificar se é primeiro login
  async checkFirstLogin(userId: string): Promise<FirstLoginData> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('first_login, must_change_password, password_changed_at')
        .eq('id', userId)
        .single();
      
      if (error || !data) {
        console.error('❌ Erro ao verificar primeiro login:', error);
        return {
          userId,
          isFirstLogin: false,
          mustChangePassword: false
        };
      }
      
      return {
        userId,
        isFirstLogin: data.first_login || false,
        mustChangePassword: data.must_change_password || false,
        passwordChangedAt: data.password_changed_at
      };
    } catch (error) {
      console.error('❌ Erro ao verificar primeiro login:', error);
      return {
        userId,
        isFirstLogin: false,
        mustChangePassword: false
      };
    }
  }

  // Marcar que o usuário precisa alterar a senha
  async markPasswordChangeRequired(userId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from(TABLES.USERS)
        .update({ must_change_password: true })
        .eq('id', userId);
      
      if (error) {
        console.error('❌ Erro ao marcar alteração de senha obrigatória:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro ao marcar alteração de senha obrigatória:', error);
      return { success: false, error: error.message };
    }
  }

  // ✅ Verificar senha atual usando API REST diretamente
  private async verifyCurrentPassword(email: string, password: string): Promise<boolean> {
    try {
      console.log('🔍 Verificando senha atual via API REST...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.access_token) {
        console.log('✅ Senha atual verificada com sucesso');
        return true;
      } else {
        console.log('❌ Senha atual incorreta:', result.error_description || result.msg);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar senha atual:', error);
      return false;
    }
  }

  // ✅ VERSÃO CORRIGIDA: Alterar senha (para usuários logados)
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      console.log('🔄 Alterando senha...');
      
      if (newPassword.length < 6) {
        return { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' };
      }
      
      if (currentPassword === newPassword) {
        return { success: false, error: 'A nova senha deve ser diferente da senha atual' };
      }
      
      // Verificar sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.error('❌ Sessão não encontrada ou inválida:', sessionError);
        return { success: false, error: 'Sessão expirada. Faça login novamente.' };
      }
      
      const currentUser = session.user;
      console.log('👤 Usuário atual da sessão:', currentUser.email, 'ID:', currentUser.id);
      
      // Buscar dados do usuário na tabela
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, name, first_login, must_change_password')
        .eq('auth_user_id', currentUser.id)
        .single();
      
      if (userError || !userData) {
        console.error('❌ Erro ao buscar usuário na tabela:', userError);
        
        // Fallback por email
        if (currentUser.email) {
          console.log('🔄 Tentando buscar por email como fallback...');
          const { data: fallbackUser, error: fallbackError } = await supabase
            .from(TABLES.USERS)
            .select('id, email, name, first_login, must_change_password')
            .eq('email', currentUser.email)
            .single();
          
          if (fallbackError || !fallbackUser) {
            console.error('❌ Fallback também falhou:', fallbackError);
            return { success: false, error: 'Dados do usuário não encontrados no sistema' };
          }
          
          // Atualizar o auth_user_id
          await supabase
            .from(TABLES.USERS)
            .update({ auth_user_id: currentUser.id })
            .eq('id', fallbackUser.id);
          
          Object.assign(userData, fallbackUser);
        } else {
          return { success: false, error: 'Dados do usuário não encontrados' };
        }
      }
      
      console.log('📊 Dados do usuário encontrados:', userData);
      
      // Para primeiro login ou alteração obrigatória, não verificamos a senha atual
      if (userData.first_login || userData.must_change_password) {
        console.log('🔑 Primeiro login ou alteração obrigatória - pulando verificação de senha atual');
      } else {
        // Verificar senha atual usando API REST
        const isPasswordValid = await this.verifyCurrentPassword(currentUser.email!, currentPassword);
        
        if (!isPasswordValid) {
          return { success: false, error: 'Senha atual incorreta' };
        }
      }
      
      // Atualizar para a nova senha
      console.log('🔄 Atualizando senha no Auth...');
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      if (updateError) {
        console.error('❌ Erro ao atualizar senha no Auth:', updateError);
        return { success: false, error: updateError.message };
      }
      
      console.log('✅ Senha atualizada no Auth');
      
      // Atualizar registro na tabela de usuários
      console.log('🔄 Atualizando registro na tabela...');
      const { error: dbUpdateError } = await supabase
        .from(TABLES.USERS)
        .update({ 
          password_changed_at: new Date().toISOString(),
          must_change_password: false,
          first_login: false,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', currentUser.id);
      
      if (dbUpdateError) {
        console.error('❌ Erro ao atualizar registro do usuário:', dbUpdateError);
        console.warn('⚠️ Senha alterada no Auth, mas erro ao atualizar tabela');
      } else {
        console.log('✅ Registro do usuário atualizado na tabela');
      }
      
      console.log('✅ Senha alterada com sucesso');
      return { success: true, error: null };
    } catch (error: any) {
      console.error('❌ Erro geral ao alterar senha:', error);
      return { success: false, error: error.message || 'Erro ao alterar senha' };
    }
  }

  // Gerar senha temporária para novos usuários
  generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const passwordService = new PasswordService();
export default passwordService;