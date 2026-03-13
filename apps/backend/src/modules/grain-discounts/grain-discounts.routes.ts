import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { GrainDiscountError } from './grain-discounts.types';
import {
  listDiscountTables,
  upsertDiscountTable,
  deleteDiscountTable,
  listClassifications,
  upsertClassification,
  deleteClassification,
  calculateDiscount,
} from './grain-discounts.service';

export const grainDiscountsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GrainDiscountError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof GrainDiscountError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// CA1: DISCOUNT TABLES
// ═══════════════════════════════════════════════════════════════════

grainDiscountsRouter.get(
  '/org/grain-discount-tables',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const crop = (req.query.crop as string) || undefined;
      const result = await listDiscountTables(ctx, crop);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

grainDiscountsRouter.put(
  '/org/grain-discount-tables',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await upsertDiscountTable(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPSERT_GRAIN_DISCOUNT_TABLE',
        targetType: 'grain_discount_table',
        targetId: result.id,
        metadata: { crop: result.crop, discountType: result.discountType },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

grainDiscountsRouter.delete(
  '/org/grain-discount-tables/:tableId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteDiscountTable(ctx, req.params.tableId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_GRAIN_DISCOUNT_TABLE',
        targetType: 'grain_discount_table',
        targetId: req.params.tableId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA2+CA3: CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════════

grainDiscountsRouter.get(
  '/org/grain-classifications',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const crop = (req.query.crop as string) || undefined;
      const result = await listClassifications(ctx, crop);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

grainDiscountsRouter.put(
  '/org/grain-classifications',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await upsertClassification(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPSERT_GRAIN_CLASSIFICATION',
        targetType: 'grain_classification',
        targetId: result.id,
        metadata: { crop: result.crop, gradeType: result.gradeType },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

grainDiscountsRouter.delete(
  '/org/grain-classifications/:classificationId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteClassification(ctx, req.params.classificationId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_GRAIN_CLASSIFICATION',
        targetType: 'grain_classification',
        targetId: req.params.classificationId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA4: CALCULATE DISCOUNT
// ═══════════════════════════════════════════════════════════════════

grainDiscountsRouter.post(
  '/org/grain-discounts/calculate',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await calculateDiscount(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
