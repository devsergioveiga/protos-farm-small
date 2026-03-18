import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PurchaseKanbanError, KANBAN_COLUMNS } from './purchase-kanban.types';
import type { KanbanColumn } from './purchase-kanban.types';
import { getKanbanCards, transitionCard } from './purchase-kanban.service';

export const purchaseKanbanRouter = Router();

const base = '/org/purchase-kanban';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new Error('Acesso negado: usuário sem organização vinculada');
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof PurchaseKanbanError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/purchase-kanban ──────────────────────────────────────────

purchaseKanbanRouter.get(
  base,
  authenticate,
  checkPermission('purchases:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);

      const filters = {
        farmId: req.query.farmId as string | undefined,
        urgency: req.query.urgency as string | undefined,
        category: req.query.category as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };

      const cards = await getKanbanCards(ctx, filters);
      res.json(cards);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/purchase-kanban/transition ─────────────────────────────

purchaseKanbanRouter.post(
  `${base}/transition`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);

      const { cardId, targetColumn } = req.body as {
        cardId: string;
        targetColumn: string;
      };

      if (!targetColumn || !(KANBAN_COLUMNS as readonly string[]).includes(targetColumn)) {
        res.status(400).json({ error: `targetColumn invalido: ${targetColumn}` });
        return;
      }

      await transitionCard(ctx, cardId, targetColumn as KanbanColumn);
      res.json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);
