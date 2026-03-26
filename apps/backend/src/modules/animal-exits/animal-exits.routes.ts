import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalExitError } from './animal-exits.types';
import {
  createAnimalExit,
  listAnimalExits,
  getAnimalExit,
  undoAnimalExit,
  bulkAnimalExit,
  exportAnimalExitsCsv,
} from './animal-exits.service';

export const animalExitsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalExitError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AnimalExitError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('AnimalExit error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/farms/:farmId/animals/:animalId/exit ─────────────────

animalExitsRouter.post(
  '/org/farms/:farmId/animals/:animalId/exit',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createAnimalExit(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_ANIMAL_EXIT',
        targetType: 'animal_exit',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          exitType: result.exitType,
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

// ─── POST /org/farms/:farmId/animal-exits/bulk ──────────────────────

animalExitsRouter.post(
  '/org/farms/:farmId/animal-exits/bulk',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkAnimalExit(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_ANIMAL_EXIT',
        targetType: 'animal_exit',
        targetId: 'bulk',
        metadata: {
          created: result.created,
          failed: result.failed,
          exitType: (req.body as Record<string, unknown>).exitType as string,
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

// ─── GET /org/farms/:farmId/animal-exits/export ─────────────────────

animalExitsRouter.get(
  '/org/farms/:farmId/animal-exits/export',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        exitType: req.query.exitType as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
      };

      const csv = await exportAnimalExitsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="saidas-animais.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/animal-exits ────────────────────────────

animalExitsRouter.get(
  '/org/farms/:farmId/animal-exits',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        exitType: req.query.exitType as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listAnimalExits(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/animal-exits/:exitId ────────────────────

animalExitsRouter.get(
  '/org/farms/:farmId/animal-exits/:exitId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnimalExit(
        ctx,
        req.params.farmId as string,
        req.params.exitId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/farms/:farmId/animal-exits/:exitId ─────────────────

animalExitsRouter.delete(
  '/org/farms/:farmId/animal-exits/:exitId',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await undoAnimalExit(ctx, req.params.farmId as string, req.params.exitId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UNDO_ANIMAL_EXIT',
        targetType: 'animal_exit',
        targetId: req.params.exitId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Saída desfeita com sucesso. Animal restaurado ao rebanho ativo.' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
