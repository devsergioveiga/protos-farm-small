// ─── Ledger Routes ─────────────────────────────────────────────────────────────
// REST endpoints for ledger (razao), trial balance (balancete), and daily book (diario).
//
// Route order: export routes registered BEFORE base routes to prevent Express 5 param conflicts.
// Permission: financial:read
// Express 5 rule: always `req.params.orgId as string`, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './ledger.service';
import { LedgerError } from './ledger.types';
import type { LedgerFilters, TrialBalanceFilters, DailyBookFilters } from './ledger.types';

export const ledgerRouter = Router();

const base = '/org/:orgId/ledger';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof LedgerError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/ledger/razao/export/csv ─────────────────────────
// Export ledger as CSV (registered before /razao to avoid param shadowing)

ledgerRouter.get(
  `${base}/razao/export/csv`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: LedgerFilters = {
        accountId: req.query.accountId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        costCenterId: req.query.costCenterId as string | undefined,
      };

      const csv = await service.exportLedgerCsv(orgId, filters);
      const accountCode = (req.query.accountCode as string) || filters.accountId;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=razao_${accountCode}_${date}.csv`);
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/razao/export/pdf ─────────────────────────

ledgerRouter.get(
  `${base}/razao/export/pdf`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: LedgerFilters = {
        accountId: req.query.accountId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        costCenterId: req.query.costCenterId as string | undefined,
      };

      const accountCode = (req.query.accountCode as string) || filters.accountId;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=razao_${accountCode}_${date}.pdf`);
      await service.exportLedgerPdf(orgId, filters, res);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/balancete/export/pdf ──────────────────────

ledgerRouter.get(
  `${base}/balancete/export/pdf`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: TrialBalanceFilters = {
        fiscalYearId: req.query.fiscalYearId as string,
        month: Number(req.query.month),
        comparePreviousPeriod: req.query.comparePreviousPeriod === 'true',
      };

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=balancete_${date}.pdf`);
      await service.exportTrialBalancePdf(orgId, filters, res);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/balancete/export/xlsx ─────────────────────

ledgerRouter.get(
  `${base}/balancete/export/xlsx`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: TrialBalanceFilters = {
        fiscalYearId: req.query.fiscalYearId as string,
        month: Number(req.query.month),
        comparePreviousPeriod: req.query.comparePreviousPeriod === 'true',
      };

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename=balancete_${date}.xlsx`);
      await service.exportTrialBalanceXlsx(orgId, filters, res);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/diario/export/pdf ─────────────────────────

ledgerRouter.get(
  `${base}/diario/export/pdf`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: DailyBookFilters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        entryType: req.query.entryType as string | undefined,
        minAmount: req.query.minAmount as string | undefined,
        maxAmount: req.query.maxAmount as string | undefined,
      };

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=livro_diario_${date}.pdf`);
      await service.exportDailyBookPdf(orgId, filters, res);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/razao ────────────────────────────────────

ledgerRouter.get(
  `${base}/razao`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: LedgerFilters = {
        accountId: req.query.accountId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        costCenterId: req.query.costCenterId as string | undefined,
      };

      const result = await service.getLedger(orgId, filters);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/balancete ────────────────────────────────

ledgerRouter.get(
  `${base}/balancete`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: TrialBalanceFilters = {
        fiscalYearId: req.query.fiscalYearId as string,
        month: Number(req.query.month),
        comparePreviousPeriod: req.query.comparePreviousPeriod === 'true',
      };

      const result = await service.getTrialBalance(orgId, filters);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/ledger/diario ───────────────────────────────────

ledgerRouter.get(
  `${base}/diario`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const filters: DailyBookFilters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        entryType: req.query.entryType as string | undefined,
        minAmount: req.query.minAmount as string | undefined,
        maxAmount: req.query.maxAmount as string | undefined,
      };

      const result = await service.getDailyBook(orgId, filters);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
