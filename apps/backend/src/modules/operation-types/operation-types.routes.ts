import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { OperationTypeError } from './operation-types.types';
import {
  createOperationType,
  listOperationTypes,
  getOperationTypeTree,
  getOperationType,
  updateOperationType,
  toggleOperationTypeActive,
  deleteOperationType,
  seedOperationTypes,
  getCropSequence,
  listCropSequences,
  setCropSequence,
  deleteCropSequence,
  seedCropSequences,
} from './operation-types.service';

export const operationTypesRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new OperationTypeError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof OperationTypeError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

operationTypesRouter.post(
  '/org/operation-types',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createOperationType(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name, level: result.level, parentId: result.parentId },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST (flat) ────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listOperationTypes(ctx, {
        parentId: req.query.parentId === 'null' ? null : (req.query.parentId as string),
        level: req.query.level ? Number(req.query.level) : undefined,
        search: (req.query.search as string) || undefined,
        includeInactive: req.query.includeInactive === 'true',
        crop: (req.query.crop as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── TREE ───────────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types/tree',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOperationTypeTree(ctx, {
        includeInactive: req.query.includeInactive === 'true',
        crop: (req.query.crop as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOperationType(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

operationTypesRouter.patch(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateOperationType(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── TOGGLE ACTIVE (CA10) ───────────────────────────────────────────

operationTypesRouter.patch(
  '/org/operation-types/:id/toggle-active',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await toggleOperationTypeActive(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'TOGGLE_OPERATION_TYPE_ACTIVE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name, isActive: result.isActive },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SEED DEFAULTS (CA4) ────────────────────────────────────────────

operationTypesRouter.post(
  '/org/operation-types/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedOperationTypes(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_OPERATION_TYPES',
        targetType: 'operation_type',
        targetId: 'bulk',
        metadata: { created: result.created },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA6: CROP OPERATION SEQUENCES ──────────────────────────────────

operationTypesRouter.get(
  '/org/operation-sequences',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const crop = req.query.crop as string | undefined;

      if (crop) {
        const result = await getCropSequence(ctx, crop);
        res.json(result);
      } else {
        const result = await listCropSequences(ctx);
        res.json(result);
      }
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.put(
  '/org/operation-sequences',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setCropSequence(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_CROP_OPERATION_SEQUENCE',
        targetType: 'crop_operation_sequence',
        targetId: req.body.crop,
        metadata: { crop: req.body.crop, itemCount: result.length },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.delete(
  '/org/operation-sequences/:crop',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCropSequence(ctx, req.params.crop as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CROP_OPERATION_SEQUENCE',
        targetType: 'crop_operation_sequence',
        targetId: req.params.crop as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.post(
  '/org/operation-sequences/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedCropSequences(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_CROP_OPERATION_SEQUENCES',
        targetType: 'crop_operation_sequence',
        targetId: 'bulk',
        metadata: result,
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

operationTypesRouter.delete(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteOperationType(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
