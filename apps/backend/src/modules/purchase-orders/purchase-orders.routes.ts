import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PurchaseOrderError } from './purchase-orders.types';
import {
  createEmergencyPO,
  duplicatePO,
  listPurchaseOrders,
  getPurchaseOrderById,
  updatePO,
  transitionPO,
  deletePO,
  generatePurchaseOrderPdf,
} from './purchase-orders.service';

export const purchaseOrdersRouter = Router();

const base = '/org/purchase-orders';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PurchaseOrderError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof PurchaseOrderError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/purchase-orders ──────────────────────────────────────────

purchaseOrdersRouter.get(
  base,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        isEmergency:
          req.query.isEmergency !== undefined ? req.query.isEmergency === 'true' : undefined,
        overdue: req.query.overdue === 'true',
      };
      const result = await listPurchaseOrders(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/purchase-orders (create emergency PO) ──────────────────

purchaseOrdersRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const po = await createEmergencyPO(ctx, req.body);
      res.status(201).json(po);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/purchase-orders/duplicate (BEFORE /:id) ────────────────

purchaseOrdersRouter.post(
  `${base}/duplicate`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const po = await duplicatePO(ctx, req.body);
      res.status(201).json(po);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-orders/:id/pdf (BEFORE /:id) ───────────────────

purchaseOrdersRouter.get(
  `${base}/:id/pdf`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await generatePurchaseOrderPdf(ctx, req.params.id as string, res);
    } catch (err) {
      if (err instanceof PurchaseOrderError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
  },
);

// ─── GET /org/purchase-orders/:id ─────────────────────────────────────

purchaseOrdersRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const po = await getPurchaseOrderById(ctx, req.params.id as string);
      res.json(po);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/purchase-orders/:id/transition ────────────────────────

purchaseOrdersRouter.patch(
  `${base}/:id/transition`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const po = await transitionPO(ctx, req.params.id as string, req.body);
      res.json(po);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/purchase-orders/:id ───────────────────────────────────

purchaseOrdersRouter.patch(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const po = await updatePO(ctx, req.params.id as string, req.body);
      res.json(po);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/purchase-orders/:id ──────────────────────────────────

purchaseOrdersRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePO(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
