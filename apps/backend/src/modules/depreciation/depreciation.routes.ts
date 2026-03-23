import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { DepreciationError } from './depreciation.types';
import {
  createConfig,
  getConfig,
  updateConfig,
  deleteConfig,
  getReport,
  exportReport,
  getLastRun,
} from './depreciation.service';
import { runDepreciationBatch, reverseEntry } from './depreciation-batch.service';

export const depreciationRouter = Router();

const base = '/org/:orgId/depreciation';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new DepreciationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.userId ?? '' };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof DepreciationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  // Handle Prisma P2002 as 409
  if (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  ) {
    res.status(409).json({ error: 'Registro duplicado' });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /config ──────────────────────────────────────────────────────

depreciationRouter.post(
  `${base}/config`,
  authenticate,
  checkPermission('depreciation:create'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const result = await createConfig(rls, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /config/:assetId ──────────────────────────────────────────────

depreciationRouter.get(
  `${base}/config/:assetId`,
  authenticate,
  checkPermission('depreciation:read'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const result = await getConfig(rls, req.params.assetId as string);
      if (!result) {
        res.status(404).json({ error: 'Configuração de depreciação não encontrada' });
        return;
      }
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /config/:assetId ────────────────────────────────────────────

depreciationRouter.patch(
  `${base}/config/:assetId`,
  authenticate,
  checkPermission('depreciation:update'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const result = await updateConfig(rls, req.params.assetId as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /config/:assetId ───────────────────────────────────────────

depreciationRouter.delete(
  `${base}/config/:assetId`,
  authenticate,
  checkPermission('depreciation:update'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      await deleteConfig(rls, req.params.assetId as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /run ─────────────────────────────────────────────────────────

depreciationRouter.post(
  `${base}/run`,
  authenticate,
  checkPermission('depreciation:update'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const { periodYear, periodMonth, track, force } = req.body as {
        periodYear?: number;
        periodMonth?: number;
        track?: string;
        force?: boolean;
      };

      const result = await runDepreciationBatch({
        organizationId: rls.organizationId,
        periodYear: Number(periodYear),
        periodMonth: Number(periodMonth),
        track: track as 'FISCAL' | 'MANAGERIAL' | undefined,
        triggeredBy: req.user?.userId ?? 'unknown',
        force: force ?? false,
      });

      res.status(202).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /entries/:entryId/reverse ────────────────────────────────────

depreciationRouter.post(
  `${base}/entries/:entryId/reverse`,
  authenticate,
  checkPermission('depreciation:update'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const result = await reverseEntry(rls, req.params.entryId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /report/export (before /report to avoid route shadowing) ──────

depreciationRouter.get(
  `${base}/report/export`,
  authenticate,
  checkPermission('depreciation:read'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const {
        periodYear,
        periodMonth,
        track,
        format = 'csv',
      } = req.query as {
        periodYear?: string;
        periodMonth?: string;
        track?: string;
        format?: string;
      };

      const exportFormat = format === 'xlsx' ? 'xlsx' : 'csv';

      const buffer = await exportReport(
        {
          organizationId: rls.organizationId,
          periodYear: Number(periodYear),
          periodMonth: Number(periodMonth),
          track: track as 'FISCAL' | 'MANAGERIAL' | undefined,
        },
        exportFormat,
      );

      const periodStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
      const contentType =
        exportFormat === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=depreciation-report-${periodStr}.${exportFormat}`,
      );
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /report ───────────────────────────────────────────────────────

depreciationRouter.get(
  `${base}/report`,
  authenticate,
  checkPermission('depreciation:read'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const { periodYear, periodMonth, track, assetId, page, limit } = req.query as {
        periodYear?: string;
        periodMonth?: string;
        track?: string;
        assetId?: string;
        page?: string;
        limit?: string;
      };

      const result = await getReport({
        organizationId: rls.organizationId,
        periodYear: Number(periodYear),
        periodMonth: Number(periodMonth),
        track: track as 'FISCAL' | 'MANAGERIAL' | undefined,
        assetId: assetId ?? undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /last-run ─────────────────────────────────────────────────────

depreciationRouter.get(
  `${base}/last-run`,
  authenticate,
  checkPermission('depreciation:read'),
  async (req: Request, res: Response) => {
    try {
      const rls = buildRlsContext(req);
      const { periodYear, periodMonth, track } = req.query as {
        periodYear?: string;
        periodMonth?: string;
        track?: string;
      };

      const result = await getLastRun(
        rls.organizationId,
        Number(periodYear),
        Number(periodMonth),
        track,
      );

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
