import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { DietError } from './diets.types';
import {
  createDiet,
  listDiets,
  getDiet,
  updateDiet,
  deleteDiet,
  duplicateDiet,
  assignToLot,
  removeFromLot,
  simulateDiet,
  recalculateNutrients,
  listVersions,
  exportRecipeCsv,
} from './diets.service';

export const dietsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new DietError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof DietError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Diet error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// DIETS CRUD
// ═══════════════════════════════════════════════════════════════════

// ─── CREATE ─────────────────────────────────────────────────────────

dietsRouter.post(
  '/org/diets',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createDiet(ctx, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_DIET',
        targetType: 'diet',
        targetId: result.id,
        metadata: { name: result.name, targetCategory: result.targetCategory },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

dietsRouter.get('/org/diets', authenticate, checkPermission('animals:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listDiets(ctx, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      targetCategory: req.query.targetCategory as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search as string | undefined,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── SIMULATE (CA7) ────────────────────────────────────────────────

dietsRouter.post(
  '/org/diets/simulate',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await simulateDiet(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

dietsRouter.get(
  '/org/diets/:id',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDiet(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

dietsRouter.put(
  '/org/diets/:id',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateDiet(ctx, req.params.id as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_DIET',
        targetType: 'diet',
        targetId: result.id,
        metadata: { name: result.name, version: result.version, changes: Object.keys(req.body) },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

dietsRouter.delete(
  '/org/diets/:id',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteDiet(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_DIET',
        targetType: 'diet',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DUPLICATE (CA8) ───────────────────────────────────────────────

dietsRouter.post(
  '/org/diets/:id/duplicate',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await duplicateDiet(ctx, req.params.id as string, req.user!.userId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DUPLICATE_DIET',
        targetType: 'diet',
        targetId: result.id,
        metadata: { sourceId: req.params.id, name: result.name },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECALCULATE (CA3) ─────────────────────────────────────────────

dietsRouter.post(
  '/org/diets/:id/recalculate',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recalculateNutrients(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── VERSIONS ──────────────────────────────────────────────────────

dietsRouter.get(
  '/org/diets/:id/versions',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listVersions(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT RECIPE CSV (CA9) ──────────────────────────────────────

dietsRouter.get(
  '/org/diets/:id/recipe',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportRecipeCsv(
        ctx,
        req.params.id as string,
        req.query.lotId as string | undefined,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="receita-dieta.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// LOT ASSIGNMENTS (CA4)
// ═══════════════════════════════════════════════════════════════════

dietsRouter.post(
  '/org/diets/:id/lots',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await assignToLot(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ASSIGN_DIET_TO_LOT',
        targetType: 'diet_lot_assignment',
        targetId: result.id,
        metadata: { dietId: req.params.id, lotId: result.lotId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

dietsRouter.delete(
  '/org/diets/:id/lots/:assignmentId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await removeFromLot(ctx, req.params.id as string, req.params.assignmentId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'REMOVE_DIET_FROM_LOT',
        targetType: 'diet_lot_assignment',
        targetId: req.params.assignmentId as string,
        metadata: { dietId: req.params.id },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
