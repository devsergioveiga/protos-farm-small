import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { StockInventoryError, type InventoryStatusValue } from './stock-inventories.types';
import {
  createInventory,
  recordCount,
  reconcileInventory,
  listInventories,
  getInventory,
  cancelInventory,
  getInventoryReport,
  getInventoryReportCSV,
  checkActiveInventoryWarning,
} from './stock-inventories.service';

export const stockInventoriesRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new StockInventoryError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof StockInventoryError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('StockInventoryError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CA1: Criar inventário ──────────────────────────────────────────

stockInventoriesRouter.post(
  '/org/stock-inventories',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createInventory(ctx, req.body, req.user!.email);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_STOCK_INVENTORY',
        targetType: 'stock_inventory',
        targetId: result.id,
        metadata: { itemCount: result.itemCount },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ──────────────────────────────────────────────────────────

stockInventoriesRouter.get(
  '/org/stock-inventories',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listInventories(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as InventoryStatusValue | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA7: Verificar inventário ativo (para alertar movimentações) ──
// NOTE: Must come BEFORE :id route to avoid matching "check-active" as id

stockInventoriesRouter.get(
  '/org/stock-inventories/check-active',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const productId = req.query.productId as string;
      if (!productId) {
        res.status(400).json({ error: 'productId é obrigatório' });
        return;
      }
      const result = await checkActiveInventoryWarning(ctx, productId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET BY ID ─────────────────────────────────────────────────────

stockInventoriesRouter.get(
  '/org/stock-inventories/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getInventory(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA2: Registrar contagens ──────────────────────────────────────

stockInventoriesRouter.post(
  '/org/stock-inventories/:id/count',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordCount(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_INVENTORY_COUNT',
        targetType: 'stock_inventory',
        targetId: result.id,
        metadata: { countedItems: req.body.items?.length ?? 0 },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA3 + CA4 + CA5: Conciliar inventário ─────────────────────────

stockInventoriesRouter.post(
  '/org/stock-inventories/:id/reconcile',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await reconcileInventory(
        ctx,
        req.params.id as string,
        req.body,
        req.user!.email,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECONCILE_STOCK_INVENTORY',
        targetType: 'stock_inventory',
        targetId: result.inventory.id,
        metadata: {
          adjustmentCount: result.adjustments.length,
          surplusCount: result.summary.surplusCount,
          shortageCount: result.summary.shortageCount,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CANCEL ─────────────────────────────────────────────────────────

stockInventoriesRouter.patch(
  '/org/stock-inventories/:id/cancel',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await cancelInventory(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CANCEL_STOCK_INVENTORY',
        targetType: 'stock_inventory',
        targetId: result.id,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA6: Relatório de inventário ──────────────────────────────────

stockInventoriesRouter.get(
  '/org/stock-inventories/:id/report',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getInventoryReport(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA6: Export CSV ───────────────────────────────────────────────

stockInventoriesRouter.get(
  '/org/stock-inventories/:id/report/export',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await getInventoryReportCSV(ctx, req.params.id as string);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="inventario-${req.params.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      res.send('\ufeff' + csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
