import { useEffect, useState } from 'react';
import { DepartmentService, type Department } from '@/services/departmentService';
import { UserService } from '@/services/userService';
import type { User } from '@/types';

export function useDesenvolvimentoContinuoOptions(enabled: boolean) {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [usersData, departmentsData] = await Promise.all([
          UserService.getAllUsers(false),
          DepartmentService.getActiveDepartments(),
        ]);
        if (!cancelled) {
          setUsers(usersData);
          setDepartments(departmentsData);
        }
      } catch (error) {
        console.error('Erro ao carregar opções do formulário:', error);
        if (!cancelled) {
          setUsers([]);
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { users, departments, loading };
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'lawyer':
      return 'Advogado';
    case 'support':
      return 'Suporte';
    default:
      return 'Usuário';
  }
}
