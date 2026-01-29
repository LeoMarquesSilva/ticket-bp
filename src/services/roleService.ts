import { supabase, TABLES } from '@/lib/supabase';

export const PERMISSION_KEYS = [
  { key: 'dashboard', label: 'Ver Dashboard' },
  { key: 'tickets', label: 'Ver Tickets' },
  { key: 'view_all_tickets', label: 'Ver todos os tickets (não só os próprios)' },
  { key: 'create_ticket', label: 'Criar ticket (próprio)' },
  { key: 'create_ticket_for_user', label: 'Criar ticket em nome de usuário' },
  { key: 'assign_ticket', label: 'Atribuir / transferir ticket' },
  { key: 'finish_ticket', label: 'Finalizar ticket (marcar resolvido)' },
  { key: 'delete_ticket', label: 'Excluir ticket' },
  { key: 'manage_users', label: 'Gerenciar Usuários' },
  { key: 'manage_categories', label: 'Gerenciar Categorias' },
  { key: 'manage_roles', label: 'Gerenciar Roles e Permissões' },
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number]['key'];

const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: ['dashboard', 'tickets', 'view_all_tickets', 'create_ticket', 'create_ticket_for_user', 'assign_ticket', 'finish_ticket', 'delete_ticket', 'manage_users', 'manage_categories', 'manage_roles'],
  lawyer: ['dashboard', 'tickets', 'view_all_tickets', 'create_ticket', 'create_ticket_for_user', 'assign_ticket', 'finish_ticket'],
  support: ['dashboard', 'tickets', 'view_all_tickets', 'create_ticket', 'create_ticket_for_user', 'assign_ticket', 'finish_ticket'],
  user: ['tickets', 'create_ticket', 'finish_ticket'],
};

/** Fallback quando o banco não retorna permissões (ex.: tabelas ainda não criadas ou erro). */
export function getDefaultPermissionsForRole(role: string): PermissionKey[] {
  const key = (role || '').toLowerCase();
  return DEFAULT_PERMISSIONS[key] || [];
}

export interface Role {
  id: string;
  key: string;
  label: string;
  description?: string;
  isSystem: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleData {
  key: string;
  label: string;
  description?: string;
  permissionKeys?: PermissionKey[];
}

export class RoleService {
  static async getRoles(includeSystem = true): Promise<Role[]> {
    try {
      let query = supabase
        .from(TABLES.ROLES)
        .select('*')
        .order('order', { ascending: true });

      if (!includeSystem) {
        query = query.eq('is_system', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRoleFromDb);
    } catch (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
  }

  static async getRoleByKey(key: string): Promise<Role | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.ROLES)
        .select('*')
        .eq('key', key)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ? mapRoleFromDb(data) : null;
    } catch (error) {
      console.error('Error fetching role by key:', error);
      return null;
    }
  }

  static async getRolePermissions(roleKey: string): Promise<PermissionKey[]> {
    const fallback = () => getDefaultPermissionsForRole(roleKey);
    try {
      const key = (roleKey || '').toLowerCase();
      const role = await this.getRoleByKey(key);
      if (!role) return fallback();

      const { data, error } = await supabase
        .from(TABLES.ROLE_PERMISSIONS)
        .select('permission_key')
        .eq('role_id', role.id);

      if (error) throw error;
      const keys = (data || []).map((r: { permission_key: string }) => r.permission_key as PermissionKey);
      return keys.length > 0 ? keys : fallback();
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return fallback();
    }
  }

  static async getRolePermissionsByRoleId(roleId: string): Promise<PermissionKey[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.ROLE_PERMISSIONS)
        .select('permission_key')
        .eq('role_id', roleId);
      if (error) throw error;
      return (data || []).map((r: { permission_key: string }) => r.permission_key as PermissionKey);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  }

  static async createRole(data: CreateRoleData): Promise<Role> {
    const { data: lastRole } = await supabase
      .from(TABLES.ROLES)
      .select('order')
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const order = (lastRole?.order ?? 0) + 1;
    const { data: role, error } = await supabase
      .from(TABLES.ROLES)
      .insert({
        key: data.key,
        label: data.label,
        description: data.description || null,
        is_system: false,
        order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    if (data.permissionKeys?.length) {
      await this.setRolePermissions(role.id, data.permissionKeys);
    }
    return mapRoleFromDb(role);
  }

  static async updateRole(roleId: string, data: Partial<Pick<CreateRoleData, 'label' | 'description'>>): Promise<Role> {
    const { data: role, error } = await supabase
      .from(TABLES.ROLES)
      .update({
        ...(data.label != null && { label: data.label }),
        ...(data.description !== undefined && { description: data.description || null }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleId)
      .select()
      .single();
    if (error) throw error;
    return mapRoleFromDb(role);
  }

  static async setRolePermissions(roleId: string, permissionKeys: PermissionKey[]): Promise<void> {
    await supabase.from(TABLES.ROLE_PERMISSIONS).delete().eq('role_id', roleId);
    if (permissionKeys.length === 0) return;
    await supabase.from(TABLES.ROLE_PERMISSIONS).insert(
      permissionKeys.map((permission_key) => ({ role_id: roleId, permission_key }))
    );
  }

  static async deleteRole(roleId: string): Promise<void> {
    const { data: role } = await supabase.from(TABLES.ROLES).select('is_system').eq('id', roleId).single();
    if (role?.is_system) throw new Error('Não é possível excluir uma role do sistema.');
    const { error } = await supabase.from(TABLES.ROLES).delete().eq('id', roleId);
    if (error) throw error;
  }

  static async countUsersByRole(roleKey: string): Promise<number> {
    const { count, error } = await supabase
      .from(TABLES.USERS)
      .select('*', { count: 'exact', head: true })
      .eq('role', roleKey);
    if (error) throw error;
    return count ?? 0;
  }
}

function mapRoleFromDb(row: any): Role {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    isSystem: row.is_system === true,
    order: row.order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
