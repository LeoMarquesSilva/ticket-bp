import { supabase, TABLES } from '@/lib/supabase';

export interface Department {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentData {
  name: string;
  order?: number;
}

function mapFromDb(row: Record<string, unknown>): Department {
  return {
    id: row.id as string,
    name: row.name as string,
    order: (row.order as number) ?? 0,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  };
}

export class DepartmentService {
  static async getDepartments(): Promise<Department[]> {
    const { data, error } = await supabase
      .from(TABLES.DEPARTMENTS)
      .select('*')
      .order('order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapFromDb);
  }

  static async getActiveDepartments(): Promise<Department[]> {
    const { data, error } = await supabase
      .from(TABLES.DEPARTMENTS)
      .select('*')
      .eq('is_active', true)
      .order('order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapFromDb);
  }

  static async createDepartment(payload: CreateDepartmentData): Promise<Department> {
    const last = await supabase
      .from(TABLES.DEPARTMENTS)
      .select('order')
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const order = (last.data?.order ?? 0) + 1;
    const { data, error } = await supabase
      .from(TABLES.DEPARTMENTS)
      .insert({
        name: payload.name.trim(),
        order: payload.order ?? order,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return mapFromDb(data);
  }

  static async updateDepartment(
    id: string,
    payload: Partial<Pick<CreateDepartmentData, 'name' | 'order'> & { isActive?: boolean }>
  ): Promise<Department> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.order !== undefined) updates.order = payload.order;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;

    const { data, error } = await supabase
      .from(TABLES.DEPARTMENTS)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapFromDb(data);
  }

  static async deleteDepartment(id: string): Promise<void> {
    const { error } = await supabase.from(TABLES.DEPARTMENTS).delete().eq('id', id);
    if (error) throw error;
  }

  static async countUsersByDepartment(name: string): Promise<number> {
    const { count, error } = await supabase
      .from(TABLES.USERS)
      .select('*', { count: 'exact', head: true })
      .eq('department', name);
    if (error) throw error;
    return count ?? 0;
  }
}
