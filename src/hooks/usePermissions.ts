import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleService, getDefaultPermissionsForRole, type PermissionKey } from '@/services/roleService';

export function usePermissions() {
  const { user } = useAuth();
  const [permissionKeys, setPermissionKeys] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);
  // Role cujas permissões estão em permissionKeys; evita um render com loading=false e
  // permissões da role anterior entre a troca de role e a execução do effect.
  const [loadedRole, setLoadedRole] = useState<string | null>(null);
  const currentRole = user?.role ?? null;

  useEffect(() => {
    if (!currentRole) {
      setPermissionKeys([]);
      setLoadedRole(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    RoleService.getRolePermissions(currentRole)
      .then((keys) => {
        if (!cancelled) setPermissionKeys(keys);
      })
      .catch(() => {
        if (!cancelled) setPermissionKeys(getDefaultPermissionsForRole(currentRole));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedRole(currentRole);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [currentRole]);

  const has = useMemo(() => {
    const set = new Set(permissionKeys);
    return (key: PermissionKey) => set.has(key);
  }, [permissionKeys]);

  return { permissions: permissionKeys, has, loading: loading || loadedRole !== currentRole };
}
