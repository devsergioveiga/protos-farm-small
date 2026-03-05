import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { getOrgDashboardStats } from './dashboard.service';

export const dashboardRouter = Router();

// GET /org/dashboard — org-level dashboard stats
dashboardRouter.get(
  '/org/dashboard',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        res.status(403).json({ error: 'Usuário sem organização vinculada' });
        return;
      }

      const stats = await getOrgDashboardStats({ organizationId });
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
