import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { WeaningError } from './weaning.types';
import {
  getWeaningConfig,
  setWeaningConfig,
  getUnweanedAnimals,
  createWeaning,
  createBulkWeaning,
  listWeanings,
  getWeaning,
  deleteWeaning,
} from './weaning.service';

export const weaningRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new WeaningError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof WeaningError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Weaning error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CONFIG ─────────────────────────────────────────────────────────

weaningRouter.get(
  '/org/weaning-config',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWeaningConfig(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

weaningRouter.put(
  '/org/weaning-config',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setWeaningConfig(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UNWEANED ANIMALS ───────────────────────────────────────────────

weaningRouter.get(
  '/org/farms/:farmId/weanings/unweaned',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getUnweanedAnimals(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BULK WEANING ───────────────────────────────────────────────────

weaningRouter.post(
  '/org/farms/:farmId/weanings/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createBulkWeaning(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_WEANING',
        targetType: 'weaning_record',
        targetId: 'bulk',
        metadata: {
          count: result.length,
          created: result.filter((r) => r.status === 'created').length,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SINGLE WEANING ─────────────────────────────────────────────────

weaningRouter.post(
  '/org/farms/:farmId/weanings',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createWeaning(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_WEANING',
        targetType: 'weaning_record',
        targetId: result.id,
        metadata: {
          calfId: result.calfId,
          weightKg: result.weightKg,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// LIST WEANINGS
weaningRouter.get(
  '/org/farms/:farmId/weanings',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        calfId: req.query.calfId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listWeanings(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET WEANING
weaningRouter.get(
  '/org/farms/:farmId/weanings/:weaningId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWeaning(
        ctx,
        req.params.farmId as string,
        req.params.weaningId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE WEANING
weaningRouter.delete(
  '/org/farms/:farmId/weanings/:weaningId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteWeaning(ctx, req.params.farmId as string, req.params.weaningId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_WEANING',
        targetType: 'weaning_record',
        targetId: req.params.weaningId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de desmame excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
