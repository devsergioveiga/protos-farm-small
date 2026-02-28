import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { getDashboardStats, listAuditLogs } from './admin.service';

export const adminRouter = Router();

const adminOnly = [authenticate, authorize('SUPER_ADMIN')];

// GET /admin/dashboard
adminRouter.get('/admin/dashboard', ...adminOnly, async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /admin/audit-logs
adminRouter.get('/admin/audit-logs', ...adminOnly, async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page as string) : undefined;
    const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
    const action = req.query.action as string | undefined;
    const actorId = req.query.actorId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const result = await listAuditLogs({ page, limit, action, actorId, dateFrom, dateTo });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
