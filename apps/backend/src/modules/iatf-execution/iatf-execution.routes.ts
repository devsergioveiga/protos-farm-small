import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { IatfExecutionError, type ListLotsQuery } from './iatf-execution.types';
import {
  createReproductiveLot,
  listLots,
  getLot,
  executeStep,
  recordInsemination,
  removeAnimalFromLot,
  completeLot,
  cancelLot,
  getUpcomingSteps,
  listInseminations,
  getActiveLotsForAnimals,
  listLotStatuses,
  listStepStatuses,
  listInseminationTypes,
  listCervicalMucusTypes,
} from './iatf-execution.service';

export const iatfExecutionRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new IatfExecutionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof IatfExecutionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('IatfExecutionError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── METADATA ──────────────────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/iatf-execution/lot-statuses',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listLotStatuses());
  },
);

iatfExecutionRouter.get(
  '/org/iatf-execution/step-statuses',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listStepStatuses());
  },
);

iatfExecutionRouter.get(
  '/org/iatf-execution/insemination-types',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listInseminationTypes());
  },
);

iatfExecutionRouter.get(
  '/org/iatf-execution/cervical-mucus-types',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listCervicalMucusTypes());
  },
);

// ─── CREATE LOT ─────────────────────────────────────────────────────

iatfExecutionRouter.post(
  '/org/farms/:farmId/reproductive-lots',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await createReproductiveLot(ctx, farmId, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_REPRODUCTIVE_LOT',
        targetType: 'reproductive_lot',
        targetId: result.id,
        metadata: {
          name: result.name,
          protocolId: result.protocolId,
          animalsCount: result.animalsCount,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST LOTS ──────────────────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/farms/:farmId/reproductive-lots',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await listLots(ctx, farmId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as ListLotsQuery['status'],
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPCOMING STEPS ─────────────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/farms/:farmId/reproductive-lots/upcoming-steps',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : undefined;
      const result = await getUpcomingSteps(ctx, farmId, daysAhead);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET LOT ────────────────────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/farms/:farmId/reproductive-lots/:lotId',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const lotId = req.params.lotId as string;
      const result = await getLot(ctx, farmId, lotId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXECUTE STEP ───────────────────────────────────────────────────

iatfExecutionRouter.post(
  '/org/farms/:farmId/reproductive-lots/:lotId/steps/:stepId/execute',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const lotId = req.params.lotId as string;
      const stepId = req.params.stepId as string;
      const result = await executeStep(ctx, farmId, lotId, stepId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'EXECUTE_LOT_STEP',
        targetType: 'reproductive_lot_step',
        targetId: stepId,
        metadata: { lotId, dayLabel: result.dayLabel },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── REMOVE ANIMAL ──────────────────────────────────────────────────

iatfExecutionRouter.delete(
  '/org/farms/:farmId/reproductive-lots/:lotId/animals/:animalId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const lotId = req.params.lotId as string;
      const animalId = req.params.animalId as string;
      await removeAnimalFromLot(ctx, farmId, lotId, animalId, req.body?.reason);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'REMOVE_LOT_ANIMAL',
        targetType: 'reproductive_lot_animal',
        targetId: animalId,
        metadata: { lotId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── COMPLETE LOT ───────────────────────────────────────────────────

iatfExecutionRouter.post(
  '/org/farms/:farmId/reproductive-lots/:lotId/complete',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const lotId = req.params.lotId as string;
      const result = await completeLot(ctx, farmId, lotId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'COMPLETE_REPRODUCTIVE_LOT',
        targetType: 'reproductive_lot',
        targetId: lotId,
        metadata: { totalCostCents: result.totalCostCents },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CANCEL LOT ─────────────────────────────────────────────────────

iatfExecutionRouter.post(
  '/org/farms/:farmId/reproductive-lots/:lotId/cancel',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const lotId = req.params.lotId as string;
      const result = await cancelLot(ctx, farmId, lotId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CANCEL_REPRODUCTIVE_LOT',
        targetType: 'reproductive_lot',
        targetId: lotId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECORD INSEMINATION ────────────────────────────────────────────

iatfExecutionRouter.post(
  '/org/farms/:farmId/inseminations',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await recordInsemination(ctx, farmId, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_INSEMINATION',
        targetType: 'insemination',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          inseminationType: result.inseminationType,
          bullId: result.bullId,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ACTIVE LOTS FOR ANIMALS ────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/farms/:farmId/animals/active-reproductive-lots',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const raw = req.query.animalIds as string | undefined;
      const animalIds = raw ? raw.split(',').filter(Boolean) : [];
      const result = await getActiveLotsForAnimals(ctx, farmId, animalIds);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST INSEMINATIONS ─────────────────────────────────────────────

iatfExecutionRouter.get(
  '/org/farms/:farmId/inseminations',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await listInseminations(ctx, farmId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        animalId: req.query.animalId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        inseminationType: req.query.inseminationType as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
