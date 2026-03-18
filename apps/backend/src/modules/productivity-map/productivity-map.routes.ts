import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import type { RlsContext } from '../../database/rls';
import { ProductivityMapError, type CultureType } from './productivity-map.types';
import { getProductivityMap, getSeasonComparison } from './productivity-map.service';

export const productivityMapRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ProductivityMapError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ProductivityMapError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET productivity map ────────────────────────────────────────────

productivityMapRouter.get(
  '/org/farms/:farmId/productivity-map',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const cultureType = req.query.cultureType as CultureType | undefined;
      if (cultureType && !['GRAOS', 'CAFE'].includes(cultureType)) {
        res.status(400).json({ error: 'Tipo de cultura inválido. Use: GRAOS, CAFE' });
        return;
      }

      const result = await getProductivityMap(ctx, req.params.farmId as string, {
        cultureType: cultureType || undefined,
        crop: (req.query.crop as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA5: Season Comparison ──────────────────────────────────────────

productivityMapRouter.get(
  '/org/farms/:farmId/productivity-map/seasons',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSeasonComparison(
        ctx,
        req.params.farmId as string,
        (req.query.fieldPlotId as string) || undefined,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
