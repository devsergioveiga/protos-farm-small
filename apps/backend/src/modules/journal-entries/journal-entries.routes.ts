// ─── Journal Entries Routes ────────────────────────────────────────────────────
// REST endpoints for double-entry journal: CRUD, post, reversal, templates, CSV import.
//
// Route order: /templates and /import-csv registered BEFORE /:id to avoid
// Express 5 param shadowing.
// Permission: financial:read (GET) / financial:manage (POST/DELETE)
// Express 5 rule: always `req.params.orgId as string`, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './journal-entries.service';
import { JournalEntryError } from './journal-entries.types';
import { UnbalancedEntryError, PeriodNotOpenError } from '@protos-farm/shared';

export const journalEntriesRouter = Router();

const base = '/org/:orgId/journal-entries';

// ─── CSV upload middleware ────────────────────────────────────────────

const csvUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são aceitos'));
    }
  },
});

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof JournalEntryError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof UnbalancedEntryError) {
    res.status(422).json({ error: err.message, code: 'UNBALANCED_ENTRY' });
    return;
  }
  if (err instanceof PeriodNotOpenError) {
    res.status(422).json({ error: err.message, code: 'PERIOD_NOT_OPEN' });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/journal-entries/templates ────────────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

journalEntriesRouter.get(
  `${base}/templates`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const templates = await service.listTemplates(orgId);
      res.json(templates);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/journal-entries/templates ───────────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

journalEntriesRouter.post(
  `${base}/templates`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const template = await service.saveTemplate(orgId, req.body, req.user!.userId);
      res.status(201).json(template);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/journal-entries/templates/:id ─────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

journalEntriesRouter.delete(
  `${base}/templates/:id`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      await service.deleteTemplate(orgId, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/journal-entries/import-csv ──────────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

journalEntriesRouter.post(
  `${base}/import-csv`,
  authenticate,
  checkPermission('financial:manage'),
  (req: Request, res: Response, next: import('express').NextFunction): void => {
    csvUpload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo CSV é obrigatório', code: 'FILE_REQUIRED' });
        return;
      }
      const preview = await service.importCsvJournalEntries(orgId, req.file.buffer);
      res.json(preview);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/journal-entries ─────────────────────────────────

journalEntriesRouter.get(
  base,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.listEntries(orgId, {
        periodId: req.query.periodId as string | undefined,
        status: req.query.status as string | undefined,
        entryType: req.query.entryType as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/journal-entries ─────────────────────────────────

journalEntriesRouter.post(
  base,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const entry = await service.createJournalEntryDraft(orgId, req.body, req.user!.userId);
      res.status(201).json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/journal-entries/:id ──────────────────────────────

journalEntriesRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const entry = await service.getEntry(orgId, id);
      if (!entry) {
        res.status(404).json({ error: 'Lançamento não encontrado', code: 'NOT_FOUND' });
        return;
      }
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/journal-entries/:id/post ─────────────────────────

journalEntriesRouter.post(
  `${base}/:id/post`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const entry = await service.postJournalEntry(orgId, id, req.user!.userId);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/journal-entries/:id/reverse ─────────────────────

journalEntriesRouter.post(
  `${base}/:id/reverse`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const entry = await service.reverseJournalEntry(orgId, id, req.body.reason, req.user!.userId);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/journal-entries/:id ────────────────────────────

journalEntriesRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      await service.deleteDraft(orgId, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
