import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { getKanbanBoard } from './purchasing-kanban.service';

export const purchasingKanbanRouter = Router();

// GET /api/org/:orgId/purchasing/kanban
purchasingKanbanRouter.get(
  '/org/:orgId/purchasing/kanban',
  authenticate,
  checkPermission('purchases:read'),
  async (req, res, next) => {
    try {
      const ctx = { organizationId: req.params.orgId as string };
      const filters = {
        farmId: req.query.farmId as string | undefined,
        urgency: req.query.urgency as string | undefined,
        search: req.query.search as string | undefined,
      };
      const board = await getKanbanBoard(ctx, filters);
      res.json(board);
    } catch (err) {
      next(err);
    }
  },
);
