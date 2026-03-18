import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { ReconciliationError } from './reconciliation.types';
import {
  previewFile,
  confirmImport,
  listImports,
  getImportDetail,
  getImportLinesWithMatches,
  confirmReconciliation,
  rejectMatch,
  manualLink,
  ignoreStatementLine,
  searchCandidates,
  getReconciliationReport,
} from './reconciliation.service';

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

export const reconciliationRouter = Router();

// ─── Helpers ───────────────────────────────────────────────────────────

function buildCtx(req: import('express').Request) {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ReconciliationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return {
    organizationId,
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
  };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ReconciliationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('ReconciliationError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /preview ─────────────────────────────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/preview',
  authenticate,
  checkPermission('reconciliation:manage'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo não enviado' });
        return;
      }
      const ctx = buildCtx(req);
      const result = await previewFile(req.file.buffer, req.file.originalname, ctx);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /imports ──────────────────────────────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/imports',
  authenticate,
  checkPermission('reconciliation:manage'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo não enviado' });
        return;
      }

      const {
        bankAccountId,
        selectedLineIndices: selectedLineIndicesRaw,
        columnMapping: columnMappingRaw,
      } = req.body;

      if (!bankAccountId) {
        res.status(400).json({ error: 'bankAccountId é obrigatório' });
        return;
      }

      let selectedLineIndices: number[] | undefined;
      if (selectedLineIndicesRaw) {
        try {
          selectedLineIndices = JSON.parse(selectedLineIndicesRaw);
        } catch {
          res.status(400).json({ error: 'selectedLineIndices deve ser um JSON array' });
          return;
        }
      }

      let columnMapping;
      if (columnMappingRaw) {
        try {
          columnMapping = JSON.parse(columnMappingRaw);
        } catch {
          res.status(400).json({ error: 'columnMapping deve ser um JSON object' });
          return;
        }
      }

      const ctx = buildCtx(req);
      const result = await confirmImport(
        ctx,
        { fileBuffer: req.file.buffer, fileName: req.file.originalname },
        { bankAccountId, selectedLineIndices, columnMapping },
      );
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /imports ───────────────────────────────────────────────────────

reconciliationRouter.get(
  '/org/reconciliation/imports',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const { bankAccountId, page, limit } = req.query;

      const result = await listImports(ctx, {
        bankAccountId: bankAccountId as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /imports/:id/lines ─────────────────────────────────────────────

reconciliationRouter.get(
  '/org/reconciliation/imports/:id/lines',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const { status } = req.query;
      const result = await getImportLinesWithMatches(
        ctx,
        req.params['id'] as string,
        status as string | undefined,
      );
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /imports/:id/lines/:lineId/confirm ────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/imports/:id/lines/:lineId/confirm',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const { reconciliationId } = req.body;
      if (!reconciliationId) {
        res.status(400).json({ error: 'reconciliationId é obrigatório' });
        return;
      }
      const ctx = buildCtx(req);
      await confirmReconciliation(ctx, req.params['lineId'] as string, reconciliationId);
      res.status(200).json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /imports/:id/lines/:lineId/reject ─────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/imports/:id/lines/:lineId/reject',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const { reconciliationId } = req.body;
      if (!reconciliationId) {
        res.status(400).json({ error: 'reconciliationId é obrigatório' });
        return;
      }
      const ctx = buildCtx(req);
      await rejectMatch(ctx, req.params['lineId'] as string, reconciliationId);
      res.status(200).json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /imports/:id/lines/:lineId/link ───────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/imports/:id/lines/:lineId/link',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const { links } = req.body;
      if (!links || !Array.isArray(links) || links.length === 0) {
        res.status(400).json({ error: 'links é obrigatório e deve ser um array não vazio' });
        return;
      }
      const ctx = buildCtx(req);
      await manualLink(ctx, req.params['lineId'] as string, links);
      res.status(200).json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /imports/:id/lines/:lineId/ignore ─────────────────────────────

reconciliationRouter.post(
  '/org/reconciliation/imports/:id/lines/:lineId/ignore',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      await ignoreStatementLine(ctx, req.params['lineId'] as string);
      res.status(200).json({ success: true });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /imports/:id/search ────────────────────────────────────────────

reconciliationRouter.get(
  '/org/reconciliation/imports/:id/search',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const { search, bankAccountId } = req.query;
      const result = await searchCandidates(ctx, {
        search: search as string | undefined,
        bankAccountId: bankAccountId as string | undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /imports/:id/report ────────────────────────────────────────────

reconciliationRouter.get(
  '/org/reconciliation/imports/:id/report',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const format = (req.query['format'] as string) === 'pdf' ? 'pdf' : 'csv';
      const { buffer } = await getReconciliationReport(ctx, req.params['id'] as string, format);

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="reconciliation-report.pdf"');
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="reconciliation-report.csv"');
      }
      res.status(200).send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /imports/:id ───────────────────────────────────────────────────

reconciliationRouter.get(
  '/org/reconciliation/imports/:id',
  authenticate,
  checkPermission('reconciliation:manage'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await getImportDetail(ctx, req.params['id'] as string);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
