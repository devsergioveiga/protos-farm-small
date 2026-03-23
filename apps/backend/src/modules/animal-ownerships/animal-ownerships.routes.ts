import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalOwnershipError } from './animal-ownerships.types';
import {
  createOwnership,
  listOwnershipsByAnimal,
  updateOwnership,
  deleteOwnership,
  endOwnership,
  bulkAssignOwner,
  listFarmAnimalOwners,
} from './animal-ownerships.service';

export const animalOwnershipsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalOwnershipError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response) {
  if (err instanceof AnimalOwnershipError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('AnimalOwnership error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── List owners for filter dropdown ────────────────────────────────

animalOwnershipsRouter.get(
  '/org/farms/:farmId/animal-owners',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const owners = await listFarmAnimalOwners(ctx, farmId);
      res.json(owners);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── List ownerships by animal ──────────────────────────────────────

animalOwnershipsRouter.get(
  '/org/farms/:farmId/animals/:animalId/ownerships',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const animalId = req.params.animalId as string;

      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
      const ownershipType = req.query.ownershipType as string | undefined;
      const producerId = req.query.producerId as string | undefined;
      const activeOnly = req.query.activeOnly === 'true';

      const result = await listOwnershipsByAnimal(ctx, farmId, animalId, {
        page,
        limit,
        ownershipType,
        producerId,
        activeOnly,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Create ownership ───────────────────────────────────────────────

animalOwnershipsRouter.post(
  '/org/farms/:farmId/animal-ownerships',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const userId = req.user!.userId;

      const ownership = await createOwnership(ctx, farmId, userId, req.body);

      await logAudit({
        action: 'animal_ownership.create',
        actorId: userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        targetId: ownership.id,
        metadata: {
          animalId: ownership.animalId,
          producerId: ownership.producerId,
          ownershipType: ownership.ownershipType,
          ip: getClientIp(req),
        },
      });

      res.status(201).json(ownership);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Bulk assign owner ──────────────────────────────────────────────

animalOwnershipsRouter.post(
  '/org/farms/:farmId/animal-ownerships/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const userId = req.user!.userId;

      const result = await bulkAssignOwner(ctx, farmId, userId, req.body);

      await logAudit({
        action: 'animal_ownership.bulk_assign',
        actorId: userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        targetId: farmId,
        metadata: {
          producerId: req.body.producerId,
          created: result.created,
          skipped: result.skipped,
          total: result.total,
          ip: getClientIp(req),
        },
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Update ownership ───────────────────────────────────────────────

animalOwnershipsRouter.patch(
  '/org/farms/:farmId/animal-ownerships/:ownershipId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const ownershipId = req.params.ownershipId as string;

      const updated = await updateOwnership(ctx, farmId, ownershipId, req.body);

      await logAudit({
        action: 'animal_ownership.update',
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        targetId: ownershipId,
        metadata: { farmId, ip: getClientIp(req) },
      });

      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── End ownership ──────────────────────────────────────────────────

animalOwnershipsRouter.patch(
  '/org/farms/:farmId/animal-ownerships/:ownershipId/end',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const ownershipId = req.params.ownershipId as string;
      const { endDate } = req.body;

      if (!endDate) {
        res.status(400).json({ error: 'endDate é obrigatório' });
        return;
      }

      const updated = await endOwnership(ctx, farmId, ownershipId, endDate as string);

      await logAudit({
        action: 'animal_ownership.end',
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        targetId: ownershipId,
        metadata: { farmId, endDate: endDate as string, ip: getClientIp(req) },
      });

      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Delete ownership ───────────────────────────────────────────────

animalOwnershipsRouter.delete(
  '/org/farms/:farmId/animal-ownerships/:ownershipId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const ownershipId = req.params.ownershipId as string;

      await deleteOwnership(ctx, farmId, ownershipId);

      await logAudit({
        action: 'animal_ownership.delete',
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        targetId: ownershipId,
        metadata: { farmId, ip: getClientIp(req) },
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Ownership types ────────────────────────────────────────────────

animalOwnershipsRouter.get(
  '/org/animal-ownership-types',
  authenticate,
  async (_req, res) => {
    res.json([
      { value: 'PROPRIETARIO', label: 'Proprietário' },
      { value: 'PARCEIRO', label: 'Parceiro' },
      { value: 'COMODATARIO', label: 'Comodatário' },
      { value: 'DEPOSITARIO', label: 'Depositário' },
    ]);
  },
);
