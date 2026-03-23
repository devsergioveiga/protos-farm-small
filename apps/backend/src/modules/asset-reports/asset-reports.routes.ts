import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './asset-reports.service';

export const assetReportsRouter = Router();

const base = '/orgs/:orgId/asset-reports';

// ─── GET /inventory ────────────────────────────────────────────────────

assetReportsRouter.get(
  `${base}/inventory`,
  authenticate,
  checkPermission('assets:read'),
  async (req: Request, res: Response) => {
    try {
      const result = await service.getInventoryReport({
        organizationId: req.params.orgId,
        farmId: req.query.farmId as string | undefined,
        assetType: req.query.assetType as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── GET /inventory/export ────────────────────────────────────────────

assetReportsRouter.get(
  `${base}/inventory/export`,
  authenticate,
  checkPermission('assets:read'),
  async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string) || 'pdf';
      if (!['pdf', 'xlsx', 'csv'].includes(format)) {
        res.status(400).json({ error: 'Formato invalido. Use: pdf, xlsx ou csv' });
        return;
      }
      const buffer = await service.exportInventoryReport(
        {
          organizationId: req.params.orgId,
          farmId: req.query.farmId as string | undefined,
          assetType: req.query.assetType as string | undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
        },
        format as 'pdf' | 'xlsx' | 'csv',
      );
      const contentTypes: Record<string, string> = {
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
      };
      const extensions: Record<string, string> = {
        pdf: 'pdf',
        xlsx: 'xlsx',
        csv: 'csv',
      };
      res.setHeader('Content-Type', contentTypes[format]);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="relatorio-patrimonial.${extensions[format]}"`,
      );
      res.send(buffer);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── GET /depreciation-projection ────────────────────────────────────

assetReportsRouter.get(
  `${base}/depreciation-projection`,
  authenticate,
  checkPermission('assets:read'),
  async (req: Request, res: Response) => {
    try {
      const horizonMonths = parseInt(req.query.horizonMonths as string, 10) || 12;
      if (![12, 36, 60].includes(horizonMonths)) {
        res.status(400).json({ error: 'horizonMonths deve ser 12, 36 ou 60' });
        return;
      }
      const result = await service.getDepreciationProjection({
        organizationId: req.params.orgId,
        horizonMonths: horizonMonths as 12 | 36 | 60,
        farmId: req.query.farmId as string | undefined,
        assetType: req.query.assetType as string | undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── GET /tco-fleet ───────────────────────────────────────────────────

assetReportsRouter.get(
  `${base}/tco-fleet`,
  authenticate,
  checkPermission('assets:read'),
  async (req: Request, res: Response) => {
    try {
      const result = await service.getTCOFleet({
        organizationId: req.params.orgId,
        farmId: req.query.farmId as string | undefined,
        assetType: req.query.assetType as string | undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);
