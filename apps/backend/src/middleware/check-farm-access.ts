import { Request, Response, NextFunction } from 'express';
import { withRlsBypass } from '../database/rls';
import { ROLE_HIERARCHY } from '../shared/rbac/permissions';

export function checkFarmAccess(farmIdParam = 'farmId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    // SUPER_ADMIN and ADMIN bypass farm access check
    if (ROLE_HIERARCHY[req.user.role] >= 90) {
      next();
      return;
    }

    // Extract farmId from params, body, or query
    const farmId =
      req.params[farmIdParam] || (req.body as Record<string, unknown>)?.farmId || req.query.farmId;

    // If no farmId context, skip check (route may not be farm-scoped)
    if (!farmId || typeof farmId !== 'string') {
      next();
      return;
    }

    const access = await withRlsBypass(async (tx) => {
      return tx.userFarmAccess.findUnique({
        where: {
          userId_farmId: {
            userId: req.user!.userId,
            farmId,
          },
        },
      });
    });

    if (!access) {
      res.status(403).json({ error: 'Sem acesso a esta fazenda' });
      return;
    }

    next();
  };
}
