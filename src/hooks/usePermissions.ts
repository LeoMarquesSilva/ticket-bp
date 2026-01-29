import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleService, getDefaultPermissionsForRole, type PermissionKey } from '@/services/roleService';

export function usePermissions() {
  const { user } = useAuth();
  const [permissionKeys, setPermissionKeys] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.role) {
      setPermissionKeys([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    RoleService.getRolePermissions(user.role)
      .then((keys) => {
        if (!cancelled) setPermissionKeys(keys);
      })
      .catch(() => {
        if (!cancelled) setPermissionKeys(getDefaultPermissionsForRole(user.role));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.role]);

  const has = useMemo(() => {
    const set = new Set(permissionKeys);
    return (key: PermissionKey) => set.has(key);
  }, [permissionKeys]);

  return { permissions: permissionKeys, has, loading };
}
