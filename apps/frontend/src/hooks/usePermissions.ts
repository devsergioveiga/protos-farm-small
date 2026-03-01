import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

interface PermissionsResponse {
  permissions: string[];
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await api.get<PermissionsResponse>('/org/permissions/me');
      setPermissions(data.permissions);
    } catch {
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  return { permissions, isLoading, hasPermission, hasAnyPermission, refetch: fetchPermissions };
}
