/**
 * US-098 — Conversão em comercialização e produção
 *
 * Routes:
 * - GET  /org/farms/:farmId/harvest-conversion/convert          (CA5)
 * - GET  /org/farms/:farmId/harvest-conversion/production-report (CA6)
 * - POST /org/farms/:farmId/harvest-conversion/delivery-manifest (CA7)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { HarvestConversionError } from './harvest-commercial-conversion.types';
import {
  convertHarvestUnit,
  getProductionReport,
  generateDeliveryManifest,
} from './harvest-commercial-conversion.service';
import type { RlsContext } from '../../database/rls';

export const harvestConversionRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new HarvestConversionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof HarvestConversionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CA5: Convert harvest quantity ─────────────────────────────────

harvestConversionRouter.get(
  '/org/farms/:farmId/harvest-conversion/convert',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const result = convertHarvestUnit({
        harvestType: req.query.harvestType as string,
        quantity: Number(req.query.quantity),
        fromUnit: req.query.fromUnit as string,
        toUnit: req.query.toUnit as string,
        yieldLitersPerSac: req.query.yieldLitersPerSac
          ? Number(req.query.yieldLitersPerSac)
          : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA6: Production report ────────────────────────────────────────

harvestConversionRouter.get(
  '/org/farms/:farmId/harvest-conversion/production-report',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getProductionReport(ctx, req.params.farmId as string, {
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        crop: (req.query.crop as string) || undefined,
        unit: (req.query.unit as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA7: Delivery manifest (romaneio) ─────────────────────────────

harvestConversionRouter.post(
  '/org/farms/:farmId/harvest-conversion/delivery-manifest',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await generateDeliveryManifest(ctx, req.params.farmId as string, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
