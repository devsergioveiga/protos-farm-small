import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  MilkAnalysisError,
  type AnalysisTypeValue,
  type AlertLevelValue,
} from './milk-analysis.types';
import {
  createAnalysis,
  listAnalyses,
  getAnalysis,
  updateAnalysis,
  deleteAnalysis,
  getQualityConfig,
  setQualityConfig,
  getHighSccCows,
  getQualityTrend,
  calculateBonus,
  importAnalysesCsv,
  exportAnalysesCsv,
} from './milk-analysis.service';

export const milkAnalysisRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MilkAnalysisError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MilkAnalysisError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('MilkAnalysis error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── QUALITY CONFIG (CA6, CA9) ──────────────────────────────────────

milkAnalysisRouter.get(
  '/org/milk-analysis/quality-config',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getQualityConfig(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

milkAnalysisRouter.put(
  '/org/milk-analysis/quality-config',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setQualityConfig(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_MILK_QUALITY_CONFIG',
        targetType: 'milk_quality_config',
        targetId: result.id || 'new',
        metadata: { changes: Object.keys(req.body) },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── HIGH SCC COWS (CA7) ───────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis/high-scc',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getHighSccCows(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── QUALITY TREND (CA8) ───────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis/quality-trend',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const months = req.query.months ? Number(req.query.months) : undefined;
      const result = await getQualityTrend(ctx, req.params.farmId as string, months);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BONUS CALCULATION (CA9) ────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis/bonus',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const month = req.query.month as string | undefined;
      const result = await calculateBonus(ctx, req.params.farmId as string, month);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── IMPORT CSV (CA10) ─────────────────────────────────────────────

milkAnalysisRouter.post(
  '/org/farms/:farmId/milk-analysis/import',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { csvContent } = req.body;

      if (!csvContent || typeof csvContent !== 'string') {
        throw new MilkAnalysisError('Conteúdo CSV é obrigatório', 400);
      }

      const result = await importAnalysesCsv(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        csvContent,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'IMPORT_MILK_ANALYSES',
        targetType: 'milk_analysis',
        targetId: 'import',
        metadata: {
          imported: result.imported,
          errorCount: result.errors.length,
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

// ─── EXPORT CSV ─────────────────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        analysisType: req.query.analysisType as AnalysisTypeValue | undefined,
        animalId: req.query.animalId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };

      const csv = await exportAnalysesCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analise-leite-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        analysisType: req.query.analysisType as AnalysisTypeValue | undefined,
        animalId: req.query.animalId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        sccAlert: req.query.sccAlert as AlertLevelValue | undefined,
        tbcAlert: req.query.tbcAlert as AlertLevelValue | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listAnalyses(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1-CA5) ──────────────────────────────────────────────

milkAnalysisRouter.post(
  '/org/farms/:farmId/milk-analysis',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createAnalysis(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MILK_ANALYSIS',
        targetType: 'milk_analysis',
        targetId: result.id,
        metadata: {
          analysisType: result.analysisType,
          animalId: result.animalId,
          analysisDate: result.analysisDate,
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

// ─── GET ────────────────────────────────────────────────────────────

milkAnalysisRouter.get(
  '/org/farms/:farmId/milk-analysis/:analysisId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnalysis(
        ctx,
        req.params.farmId as string,
        req.params.analysisId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

milkAnalysisRouter.patch(
  '/org/farms/:farmId/milk-analysis/:analysisId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateAnalysis(
        ctx,
        req.params.farmId as string,
        req.params.analysisId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MILK_ANALYSIS',
        targetType: 'milk_analysis',
        targetId: result.id,
        metadata: {
          changes: Object.keys(req.body),
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

milkAnalysisRouter.delete(
  '/org/farms/:farmId/milk-analysis/:analysisId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteAnalysis(ctx, req.params.farmId as string, req.params.analysisId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MILK_ANALYSIS',
        targetType: 'milk_analysis',
        targetId: req.params.analysisId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Análise de leite excluída com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
