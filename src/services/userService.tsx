import { supabase, supabaseAdmin, TABLES } from '@/lib/supabase';
import { User, UserRole, Department } from '@/types';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string; // Mantido como string para compatibilidade
}

export class UserService {
  // Obter todos os usuários de suporte
  static async getSupportUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .in('role', ['support', 'lawyer'])
        .order('role', { ascending: false }) // Advogados primeiro, depois suporte
        .order('is_online', { ascending: false }); // Online primeiro

      if (error) {
        console.error('Error fetching support users:', error);
        throw error;
      }

      return data ? data.map(this.mapFromDatabase) : [];
    } catch (error) {
      console.error('Error in getSupportUsers:', error);
      throw error;
    }
  }

  // Obter todos os usuários advogados
  static async getLawyerUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('role', 'lawyer')
        .order('is_online', { ascending: false }); // Online primeiro

      if (error) {
        console.error('Error fetching lawyer users:', error);
        throw error;
      }

      return data ? data.map(this.mapFromDatabase) : [];
    } catch (error) {
      console.error('Error in getLawyerUsers:', error);
      throw error;
    }
  }

  // Obter todos os usuários
  static async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .order('role')
        .order('name');

      if (error) {
        console.error('Error fetching all users:', error);
        throw error;
      }

      return data ? data.map(this.mapFromDatabase) : [];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }
  
  // Buscar usuário por email
  static async getUserByEmail(email: string): Promise<User[] | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('email', email);
        
      if (error) {
        console.error('Error fetching user by email:', error);
        throw error;
      }
      
      return data ? data.map(this.mapFromDatabase) : null;
    } catch (error) {
      console.error('Error in getUserByEmail:', error);
      throw error;
    }
  }

  // Criar um novo usuário (método original - mantido para compatibilidade)
  static async createUser(userData: CreateUserData): Promise<User> {
    try {
      console.log('Creating new user:', userData);
      
      // Garantir que o departamento tenha um valor
      const department = userData.department || Department.GERAL;
      
      // 1. Criar o usuário na autenticação
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
            department: department
          }
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Falha ao criar usuário na autenticação');
      }

      // 2. Criar o usuário na tabela de usuários
      const newUser = {
        auth_user_id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        department: department, // Garantir que o departamento seja incluído
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: dbUser, error: dbError } = await supabase
        .from(TABLES.USERS)
        .insert([newUser])
        .select()
        .single();

      if (dbError) {
        console.error('Error creating user in database:', dbError);
        throw dbError;
      }

      return this.mapFromDatabase(dbUser);
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }
  
  // Criar um novo usuário pelo admin (usando chave service_role)
  static async createUserAdmin(userData: CreateUserData): Promise<User> {
    try {
      console.log('Admin creating new user with service role:', userData);
      
      // Garantir que o departamento tenha um valor
      const department = userData.department || Department.GERAL;
      
      // 1. Criar o usuário na autenticação usando o cliente admin
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Email já confirmado
        user_metadata: {
          name: userData.name,
          role: userData.role,
          department: department
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Falha ao criar usuário na autenticação');
      }

      // 2. Criar o usuário na tabela de usuários
      const newUser = {
        auth_user_id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        department: department,
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: dbUser, error: dbError } = await supabase
        .from(TABLES.USERS)
        .insert([newUser])
        .select()
        .single();

      if (dbError) {
        console.error('Error creating user in database:', dbError);
        // Tentar reverter a criação do usuário de autenticação em caso de erro
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Error deleting auth user after database error:', deleteError);
        }
        throw dbError;
      }

      return this.mapFromDatabase(dbUser);
    } catch (error) {
      console.error('Error in createUserAdmin:', error);
      throw error;
    }
  }

  // Atualizar um usuário existente
  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const dbUpdates = {
        name: updates.name,
        role: updates.role,
        department: updates.department || Department.GERAL, // Usando o enum Department
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update(dbUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        throw error;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

// Excluir um usuário
static async deleteUser(userId: string): Promise<boolean> {
  try {
    // Primeiro, obter o auth_user_id e outras informações do usuário
    const { data: userData, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user for deletion:', userError);
      throw userError;
    }

    // Verificar se o usuário já foi anonimizado anteriormente
    const isAlreadyAnonymized = userData.name.startsWith('Usuário Excluído') && 
                               userData.email.startsWith('deleted_');
    
    // Verificar se existem tickets criados por este usuário
    const { data: createdTickets, error: createdTicketsError } = await supabase
      .from(TABLES.TICKETS)
      .select('id')
      .eq('created_by', userId);

    if (createdTicketsError) {
      console.error('Error checking tickets created by user:', createdTicketsError);
      throw createdTicketsError;
    }

    // Se o usuário criou tickets, não podemos excluí-lo completamente
    // Mesmo que já tenha sido anonimizado anteriormente
    if (createdTickets && createdTickets.length > 0) {
      console.warn(`User has ${createdTickets.length} tickets. Will anonymize instead of delete.`);
      
      // Se já está anonimizado, apenas retorna sucesso
      if (isAlreadyAnonymized) {
        console.log('User was already anonymized. Cannot delete due to ticket references.');
        return true;
      }
      
      // Anonimizar o usuário em vez de excluí-lo
      const { error: anonymizeError } = await supabase
        .from(TABLES.USERS)
        .update({
          name: `Usuário Excluído (${userData.id.substring(0, 8)})`,
          email: `deleted_${userData.id.substring(0, 8)}@example.com`,
          is_online: false,
          role: 'user', // Rebaixar para usuário comum
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (anonymizeError) {
        console.error('Error anonymizing user:', anonymizeError);
        throw anonymizeError;
      }
      
      // Mesmo anonimizando, vamos tentar excluir da autenticação
      if (userData?.auth_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id);
        } catch (authDeleteError) {
          console.warn('Auth deletion failed, but user was anonymized:', authDeleteError);
        }
      }
      
      // Atualizar tickets que estão atribuídos a este usuário
      try {
        await supabase
          .from(TABLES.TICKETS)
          .update({
            assigned_to: null,
            status: 'open' // Retorna o ticket para o status "aberto"
          })
          .eq('assigned_to', userId);
      } catch (ticketError) {
        console.warn('Error updating assigned tickets:', ticketError);
        // Continuar mesmo com erro
      }
      
      return true;
    }

    // Se chegou aqui, o usuário não tem tickets criados e pode ser excluído completamente

    // Passo 1: Atualizar todos os tickets que estão atribuídos a este usuário
    try {
      await supabase
        .from(TABLES.TICKETS)
        .update({
          assigned_to: null,
          status: 'open' // Retorna o ticket para o status "aberto"
        })
        .eq('assigned_to', userId);
    } catch (ticketError) {
      console.warn('Error updating tickets before user deletion:', ticketError);
      // Continuar mesmo com erro
    }

    // Passo 2: Verificar e atualizar mensagens de chat
    try {
      await supabase
        .from(TABLES.CHAT_MESSAGES)
        .update({
          user_name: `Usuário Excluído (${userData.id.substring(0, 8)})`
        })
        .eq('user_id', userId);
    } catch (chatError) {
      console.warn('Error handling chat messages:', chatError);
      // Continuar mesmo com erro
    }

    // Passo 3: Excluir da tabela de usuários
    const { error: dbError } = await supabase
      .from(TABLES.USERS)
      .delete()
      .eq('id', userId);

    if (dbError) {
      console.error('Error deleting user from database:', dbError);
      throw dbError;
    }

    // Passo 4: Excluir da autenticação se o auth_user_id existir
    if (userData?.auth_user_id) {
      try {
        // Usando a API de administração do Supabase
        await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id);
      } catch (authDeleteError) {
        console.warn('Auth deletion failed, but database user was deleted:', authDeleteError);
      }
    }

    return true;
  } catch (error) {
    console.error('Error in deleteUser:', error);
    throw error;
  }
}

  // Atualizar status online/offline
  static async updateOnlineStatus(userId: string, isOnline: boolean): Promise<User> {
    try {
      const updates = {
        is_online: isOnline,
        last_active_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user online status:', error);
        throw error;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Error in updateOnlineStatus:', error);
      throw error;
    }
  }

  // Obter o próximo advogado disponível para atribuição de ticket
  static async getNextAvailableLawyer(): Promise<User | null> {
    try {
      // Primeiro tenta encontrar um advogado online
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('role', 'lawyer')
        .eq('is_online', true)
        .order('last_active_at', { ascending: true }) // Distribui de forma justa
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 é o código para "no rows returned"
        console.error('Error finding available lawyer:', error);
        throw error;
      }

      if (data) {
        return this.mapFromDatabase(data);
      }

      // Se não encontrar nenhum advogado online, tenta encontrar qualquer advogado
      const { data: offlineData, error: offlineError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('role', 'lawyer')
        .order('last_active_at', { ascending: true }) // Distribui de forma justa
        .limit(1)
        .single();

      if (offlineError && offlineError.code !== 'PGRST116') {
        console.error('Error finding any lawyer:', offlineError);
        throw offlineError;
      }

      return offlineData ? this.mapFromDatabase(offlineData) : null;
    } catch (error) {
      console.error('Error in getNextAvailableLawyer:', error);
      throw error;
    }
  }

  // Obter usuários por departamento
  static async getUsersByDepartment(department: Department | string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('department', department)
        .order('role')
        .order('name');

      if (error) {
        console.error('Error fetching users by department:', error);
        throw error;
      }

      return data ? data.map(this.mapFromDatabase) : [];
    } catch (error) {
      console.error('Error in getUsersByDepartment:', error);
      throw error;
    }
  }

  // Mapear do banco de dados para o formato do frontend
  private static mapFromDatabase(data: any): User {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department || Department.GERAL, // Usando o enum Department
      isOnline: data.is_online,
      lastActiveAt: data.last_active_at
    };
  }
}