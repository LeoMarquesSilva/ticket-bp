import { supabase, supabaseAdmin, TABLES } from '@/lib/supabase';
import { User, UserRole, Department } from '@/types';
import { passwordService } from '@/services/passwordService';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string; // Mantido como string para compatibilidade
}

export class UserService {
  // Obter todos os usuários que podem receber/atribuir tickets (support, lawyer, admin + roles com assign_ticket)
  static async getSupportUsers(): Promise<User[]> {
    try {
      // Incluir roles customizadas que têm permissão assign_ticket
      const { data: rolePerms } = await supabase
        .from(TABLES.ROLE_PERMISSIONS)
        .select('role_id')
        .eq('permission_key', 'assign_ticket');
      const roleIds = [...new Set((rolePerms || []).map((r: { role_id: string }) => r.role_id))];
      let customRoleKeys: string[] = [];
      if (roleIds.length > 0) {
        const { data: rolesData } = await supabase
          .from(TABLES.ROLES)
          .select('key')
          .in('id', roleIds);
        customRoleKeys = (rolesData || []).map((r: { key: string }) => r.key);
      }
      const supportRoleKeys = [...new Set(['admin', 'lawyer', 'support', ...customRoleKeys])];
      const supportKeysLower = new Set(supportRoleKeys.map((k) => String(k).toLowerCase()));
      // Aliases: roles armazenadas como label em vez de key (ex: "Advogado" em vez de "lawyer")
      supportKeysLower.add('advogado'); // lawyer
      supportKeysLower.add('administrador'); // admin
      supportKeysLower.add('suporte'); // support

      // Buscar todos os ativos e filtrar por role (case-insensitive) para evitar problemas de casing no banco
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('is_online', { ascending: false });

      if (error) {
        console.error('Error fetching support users:', error);
        throw error;
      }

      const filtered = (data || []).filter((u) =>
        supportKeysLower.has(String(u.role ?? '').toLowerCase())
      );
      return filtered.map(this.mapFromDatabase);
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
        .eq('is_active', true) // Apenas usuários ativos
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

  // Obter todos os usuários (incluindo inativos para administração)
  static async getAllUsers(includeInactive: boolean = true): Promise<User[]> {
    try {
      let query = supabase
        .from(TABLES.USERS)
        .select('*');

      // Se não incluir inativos, filtrar apenas ativos
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query
        .order('is_active', { ascending: false }) // Ativos primeiro
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

  /** Usuário elegível para seleção em pickers (ativo e não anonimizado/excluído). */
  static isSelectableUser(user: Pick<User, 'name' | 'email' | 'isActive'>): boolean {
    if (user.isActive === false) return false;

    const name = String(user.name ?? '').trim();
    const email = String(user.email ?? '').trim().toLowerCase();

    if (name.startsWith('Usuário Excluído')) return false;
    if (email.startsWith('deleted_')) return false;

    return true;
  }

  /** Usuários jurídicos ativos e selecionáveis (fluxo inverso, transferências, etc.). */
  static async getActiveJuridicoUsers(): Promise<User[]> {
    const users = await this.getAllUsers(false);
    return users
      .filter((user) => user.role === 'user' && this.isSelectableUser(user))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  
  // Buscar usuário por ID (app user id)
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // no rows
        console.error('Error fetching user by id:', error);
        throw error;
      }

      return data ? this.mapFromDatabase(data) : null;
    } catch (error) {
      console.error('Error in getUserById:', error);
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
        department: department,
        is_online: false,
        first_login: true, // ✅ Novo campo
        must_change_password: true, // ✅ Novo campo
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
      
      // Gerar senha temporária se não fornecida
      const tempPassword = userData.password || passwordService.generateTemporaryPassword();
      
      // 1. Criar o usuário na autenticação usando o cliente admin
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: tempPassword,
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
        is_active: true, // ✅ Novo campo - usuários criados são ativos por padrão
        first_login: true, // ✅ Novo campo - primeiro login
        must_change_password: true, // ✅ Novo campo - deve alterar senha
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

      console.log(`✅ Usuário criado com senha temporária: ${tempPassword}`);
      return this.mapFromDatabase(dbUser);
    } catch (error) {
      console.error('Error in createUserAdmin:', error);
      throw error;
    }
  }

  // Atualizar um usuário existente
  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.department !== undefined) dbUpdates.department = updates.department || Department.GERAL;
      if (updates.tagId !== undefined) dbUpdates.tag_id = updates.tagId || null;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl === '' ? null : updates.avatarUrl;

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

  // ✅ NOVO: Forçar alteração de senha para um usuário
  static async forcePasswordChange(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Forçando alteração de senha para usuário:', userId);
      
      const { error } = await supabase
        .from(TABLES.USERS)
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error forcing password change:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in forcePasswordChange:', error);
      throw error;
    }
  }

  // ✅ NOVO: Resetar senha de um usuário (gerar nova senha temporária)
  static async resetUserPassword(userId: string): Promise<{ tempPassword: string; success: boolean }> {
    try {
      console.log('🔄 Resetando senha para usuário:', userId);
      
      // Obter dados do usuário
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('auth_user_id, email, name')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Usuário não encontrado');
      }

      // Gerar nova senha temporária
      const tempPassword = passwordService.generateTemporaryPassword();

      // Atualizar senha no Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userData.auth_user_id,
        { password: tempPassword }
      );

      if (authError) {
        console.error('Error updating auth password:', authError);
        throw authError;
      }

      // Atualizar flags na tabela de usuários
      const { error: dbError } = await supabase
        .from(TABLES.USERS)
        .update({
          must_change_password: true,
          first_login: false, // Não é mais primeiro login, mas deve alterar senha
          password_changed_at: null, // Resetar data de alteração
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) {
        console.error('Error updating user password flags:', dbError);
        throw dbError;
      }

      console.log(`✅ Senha resetada com sucesso. Nova senha: ${tempPassword}`);
      return { tempPassword, success: true };
    } catch (error) {
      console.error('Error in resetUserPassword:', error);
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
          is_active: false,
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

  // Próximo membro da equipe da frente (tag) para atribuição automática
  static async getNextAvailableByTag(tagId: string): Promise<User | null> {
    const staffRoles = ['suporte_administrativo', 'support', 'admin', 'lawyer'];

    try {
      for (const onlineOnly of [true, false]) {
        let query = supabase
          .from(TABLES.USERS)
          .select('*')
          .eq('tag_id', tagId)
          .eq('is_active', true)
          .in('role', staffRoles)
          .order('last_active_at', { ascending: true })
          .limit(1);

        if (onlineOnly) {
          query = query.eq('is_online', true);
        }

        const { data, error } = await query.maybeSingle();
        if (error && error.code !== 'PGRST116') {
          console.error('Error finding user by tag:', error);
          throw error;
        }
        if (data) {
          return this.mapFromDatabase(data);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in getNextAvailableByTag:', error);
      throw error;
    }
  }

  // Obter o próximo advogado disponível para atribuição de ticket
  static async getNextAvailableLawyer(): Promise<User | null> {
    try {
      // Primeiro tenta encontrar um advogado online e ativo
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('role', 'lawyer')
        .eq('is_active', true) // Apenas usuários ativos
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

      // Se não encontrar nenhum advogado online, tenta encontrar qualquer advogado ativo
      const { data: offlineData, error: offlineError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('role', 'lawyer')
        .eq('is_active', true) // Apenas usuários ativos
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
        .eq('is_active', true) // Apenas usuários ativos
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

  // ✅ NOVO: Ativar/Desativar usuário
  static async toggleUserActiveStatus(userId: string, isActive: boolean): Promise<User> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error toggling user active status:', error);
        throw error;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Error in toggleUserActiveStatus:', error);
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
      department: data.department || Department.GERAL,
      avatarUrl: data.avatar_url || undefined,
      isOnline: data.is_online,
      lastActiveAt: data.last_active_at,
      firstLogin: data.first_login, // ✅ Novo campo
      mustChangePassword: data.must_change_password, // ✅ Novo campo
      passwordChangedAt: data.password_changed_at, // ✅ Novo campo
      ticketViewPreference: data.ticket_view_preference || 'list', // ✅ Preferência de visualização
      isActive: data.is_active !== undefined ? data.is_active : true, // ✅ Novo campo - padrão é true
      tagId: data.tag_id || undefined,
    };
  }

  // ✅ NOVO: Atualizar preferência de visualização de tickets
  static async updateTicketViewPreference(userId: string, view: 'list' | 'board' | 'users'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(TABLES.USERS)
        .update({
          ticket_view_preference: view,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        // Se o erro for porque a coluna não existe, apenas logar e retornar true
        // (a preferência será salva quando a coluna for adicionada)
        if (error.message?.includes('column') && error.message?.includes('does not exist')) {
          console.warn('⚠️ Campo ticket_view_preference ainda não existe no banco. A preferência será salva quando a coluna for adicionada.');
          return true; // Retornar true para não bloquear o fluxo
        }
        console.error('Erro ao atualizar preferência de visualização:', error);
        return false;
      }

      return true;
    } catch (error: any) {
      // Se o erro for porque a coluna não existe, apenas logar e retornar true
      if (error?.message?.includes('column') && error?.message?.includes('does not exist')) {
        console.warn('⚠️ Campo ticket_view_preference ainda não existe no banco. A preferência será salva quando a coluna for adicionada.');
        return true; // Retornar true para não bloquear o fluxo
      }
      console.error('Erro ao atualizar preferência de visualização:', error);
      return false;
    }
  }
}