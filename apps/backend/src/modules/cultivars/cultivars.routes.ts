import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { CultivarError, type CreateCultivarInput } from './cultivars.types';
import {
  createCultivar,
  listCultivars,
  getCultivar,
  updateCultivar,
  deleteCultivar,
  importCultivarsFromCsv,
} from './cultivars.service';

export const cultivarsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CultivarError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CultivarError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

cultivarsRouter.post(
  '/org/cultivars',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCultivar(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_CULTIVAR',
        targetType: 'cultivar',
        targetId: result.id,
        metadata: { name: result.name, crop: result.crop },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

cultivarsRouter.get(
  '/org/cultivars',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listCultivars(ctx, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        crop: (req.query.crop as string) || undefined,
        search: (req.query.search as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

cultivarsRouter.get(
  '/org/cultivars/:cultivarId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCultivar(ctx, req.params.cultivarId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

cultivarsRouter.patch(
  '/org/cultivars/:cultivarId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCultivar(ctx, req.params.cultivarId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_CULTIVAR',
        targetType: 'cultivar',
        targetId: result.id,
        metadata: { name: result.name, crop: result.crop },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

cultivarsRouter.delete(
  '/org/cultivars/:cultivarId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCultivar(ctx, req.params.cultivarId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CULTIVAR',
        targetType: 'cultivar',
        targetId: req.params.cultivarId as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── IMPORT CSV ─────────────────────────────────────────────────────

cultivarsRouter.post(
  '/org/cultivars/import',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const rows = req.body.cultivars as CreateCultivarInput[];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new CultivarError('Lista de cultivares vazia ou inválida', 400);
      }
      if (rows.length > 500) {
        throw new CultivarError('Máximo de 500 cultivares por importação', 400);
      }

      const result = await importCultivarsFromCsv(ctx, rows);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'IMPORT_CULTIVARS',
        targetType: 'cultivar',
        targetId: undefined,
        metadata: { imported: result.imported, skipped: result.skipped },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
