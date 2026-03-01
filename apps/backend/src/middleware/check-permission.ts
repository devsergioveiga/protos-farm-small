import { Request, Response, NextFunction } from 'express';
import { Permission, ROLE_HIERARCHY } from '../shared/rbac/permissions';
import { getUserPermissions } from '../shared/rbac/rbac.service';

export function checkPermission(...required: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (ROLE_HIERARCHY[req.user.role] >= 100) {
      next();
      return;
    }

    const userPermissions = await getUserPermissions(req.user.userId);
    const hasAll = required.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      res.status(403).json({ error: 'Permissão insuficiente' });
      return;
    }

    next();
  };
}
