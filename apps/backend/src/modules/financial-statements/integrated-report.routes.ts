// ─── Integrated Report Routes ─────────────────────────────────────────────────
// REST endpoints for integrated financial report PDF and notes autosave.
//
// Endpoints:
//  GET  /org/:orgId/integrated-report/download?fiscalYearId=...&costCenterId=...
//  PATCH /org/:orgId/integrated-report/notes     body: { notesText: string }
//  GET  /org/:orgId/integrated-report/notes
//
// Permission: financial:read
// Express 5 rule: always req.params.orgId as string, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { generateIntegratedReport, saveNotes, getNotes } from './integrated-report.service';

export const integratedReportRouter = Router();

const base = '/org/:orgId/integrated-report';

// ─── GET /org/:orgId/integrated-report/download ───────────────────────────────

integratedReportRouter.get(
  `${base}/download`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const costCenterId = req.query.costCenterId as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }

      const { buffer, filename } = await generateIntegratedReport(orgId, fiscalYearId, costCenterId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── PATCH /org/:orgId/integrated-report/notes ────────────────────────────────

integratedReportRouter.patch(
  `${base}/notes`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const { notesText } = req.body as { notesText?: string };

      if (typeof notesText !== 'string') {
        res.status(400).json({ error: 'notesText deve ser uma string', code: 'INVALID_NOTES_TEXT' });
        return;
      }

      await saveNotes(orgId, notesText);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET /org/:orgId/integrated-report/notes ──────────────────────────────────

integratedReportRouter.get(
  `${base}/notes`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const notesText = await getNotes(orgId);
      res.json({ notesText });
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
