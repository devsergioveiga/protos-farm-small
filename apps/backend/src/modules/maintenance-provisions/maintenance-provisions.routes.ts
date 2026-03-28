import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { MaintenanceProvisionError } from './maintenance-provisions.types';
import {
  createProvision,
  listProvisions,
  updateProvision,
  deleteProvision,
  getReconciliation,
} from './maintenance-provisions.service';

export const maintenanceProvisionsRouter = Router();

const base = '/org/:orgId/maintenance-provisions';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new MaintenanceProvisionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof MaintenanceProvisionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/maintenance-provisions/reconciliation ─────────────
// IMPORTANT: before /:id to avoid Express matching 'reconciliation' as an id

maintenanceProvisionsRouter.get(
  `${base}/reconciliation`,
  authenticate,
  checkPermission('maintenance-provisions:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'Parâmetros year e month inválidos' });
        return;
      }

      const result = await getReconciliation(ctx, { year, month });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/maintenance-provisions ───────────────────────────

maintenanceProvisionsRouter.get(
  base,
  authenticate,
  checkPermission('maintenance-provisions:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        assetId: req.query.assetId as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listProvisions(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/maintenance-provisions/:id ───────────────────────

maintenanceProvisionsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-provisions:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listProvisions(ctx, { page: 1, limit: 1 });
      // Fetch single provision
      const { prisma } = await import('../../database/prisma');
      const provision = await prisma.maintenanceProvision.findFirst({
        where: { id: req.params.id as string, organizationId: ctx.organizationId },
        include: { asset: { select: { id: true, name: true, assetTag: true } } },
      });
      if (!provision) {
        res.status(404).json({ error: 'Provisão não encontrada' });
        return;
      }
      void result;
      res.json({
        id: provision.id,
        organizationId: provision.organizationId,
        assetId: provision.assetId ?? null,
        monthlyAmount: Number(provision.monthlyAmount),
        costCenterId: provision.costCenterId ?? null,
        isActive: provision.isActive,
        description: provision.description ?? null,
        createdAt: provision.createdAt.toISOString(),
        updatedAt: provision.updatedAt.toISOString(),
        asset: provision.asset
          ? {
              id: provision.asset.id,
              name: provision.asset.name,
              assetTag: provision.asset.assetTag,
            }
          : null,
      });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/maintenance-provisions ──────────────────────────

maintenanceProvisionsRouter.post(
  base,
  authenticate,
  checkPermission('maintenance-provisions:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { monthlyAmount } = req.body as { monthlyAmount?: number };

      if (!monthlyAmount) {
        res.status(400).json({ error: 'Valor mensal é obrigatório' });
        return;
      }

      const result = await createProvision(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/:orgId/maintenance-provisions/:id ───────────────────────

maintenanceProvisionsRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-provisions:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateProvision(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/maintenance-provisions/:id ────────────────────

maintenanceProvisionsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-provisions:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteProvision(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
