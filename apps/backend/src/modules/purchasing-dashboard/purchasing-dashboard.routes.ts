import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { getDashboardData } from './purchasing-dashboard.service';

export const purchasingDashboardRouter = Router();

// GET /api/org/:orgId/purchasing/dashboard?farmId=&periodStart=&periodEnd=
purchasingDashboardRouter.get(
  '/org/:orgId/purchasing/dashboard',
  authenticate,
  checkPermission('purchases:read'),
  async (req, res, next) => {
    try {
      const ctx = { organizationId: req.params.orgId as string };
      const farmId = req.query.farmId as string | undefined;

      // Default to current month if not specified
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const periodStart = req.query.periodStart
        ? new Date(req.query.periodStart as string)
        : defaultStart;
      const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd as string) : defaultEnd;

      if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
        res.status(400).json({ error: 'Invalid periodStart or periodEnd date format' });
        return;
      }

      const data = await getDashboardData(ctx, { farmId, periodStart, periodEnd });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);
