/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { withRlsContext } from '../../database/rls';
import type { RlsContext } from '../../database/rls';
import { PayableError } from './payables.types';
import {
  createPayable,
  listPayables,
  getPayable,
  updatePayable,
  deletePayable,
  settlePayment,
  batchSettlePayments,
  reversePayment,
  generateRecurrence,
} from './payables.service';
import { getCnabAdapter } from '../cnab/cnab.adapter';
import type { CnabHeaderData, CnabPaymentRecord } from '../cnab/cnab.adapter';

const cnabUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

export const payablesRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PayableError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PayableError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('PayableError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ─────────────────────────────────────────────────────────────

payablesRouter.get(
  '/org/payables',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await listPayables(ctx, {
        farmId: req.query.farmId as string | undefined,
        status: req.query.status as import('./payables.types').ListPayablesQuery['status'],
        category: req.query.category as import('./payables.types').ListPayablesQuery['category'],
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        search: req.query.search as string | undefined,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ───────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await createPayable(ctx, req.body);
      res.status(201).json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BATCH SETTLE — BEFORE /:id TO AVOID PARAM CONFLICT ──────────────

payablesRouter.post(
  '/org/payables/batch-settle',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const results = await batchSettlePayments(ctx, req.body);
      res.json(results);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GENERATE RECURRENCE — BEFORE /:id ────────────────────────────────

payablesRouter.post(
  '/org/payables/generate-recurrence',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const generated = await generateRecurrence(ctx);
      res.status(201).json(generated);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CNAB REMESSA — BEFORE /:id ──────────────────────────────────────
// POST /org/payables/cnab/remessa
// Body: { bankAccountId, format: '240'|'400', payableIds: string[] }
// Returns: text/plain CNAB file as attachment

payablesRouter.post(
  '/org/payables/cnab/remessa',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const {
        bankAccountId,
        format,
        payableIds,
      }: { bankAccountId: string; format: '240' | '400'; payableIds: string[] } = req.body;

      if (!bankAccountId || !format || !payableIds?.length) {
        res.status(400).json({ error: 'bankAccountId, format e payableIds são obrigatórios' });
        return;
      }
      if (format !== '240' && format !== '400') {
        res.status(400).json({ error: 'format deve ser "240" ou "400"' });
        return;
      }

      const result = await withRlsContext(ctx, async (tx) => {
        // Load bank account
        const bankAccount = await (tx as any).bankAccount.findFirst({
          where: { id: bankAccountId, organizationId: ctx.organizationId, isActive: true },
        });
        if (!bankAccount) {
          throw new PayableError('Conta bancária não encontrada ou inativa', 404);
        }

        // Load org for company data
        const org = await (tx as any).organization.findUnique({
          where: { id: ctx.organizationId },
        });

        // Load payables
        const payables = await (tx as any).payable.findMany({
          where: {
            id: { in: payableIds },
            organizationId: ctx.organizationId,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        });

        if (payables.length === 0) {
          throw new PayableError('Nenhuma conta a pagar elegível para remessa encontrada', 400);
        }

        const adapter = getCnabAdapter(bankAccount.bankCode as string);

        const headerData: CnabHeaderData = {
          companyName: org?.name ?? 'EMPRESA',
          companyDocument: (org?.cnpj ?? '00000000000000').replace(/\D/g, ''),
          convenioCode: (bankAccount.convenioCode as string) ?? '000000000000000000000',
          agency: bankAccount.agency as string,
          agencyDigit: (bankAccount.agencyDigit as string) ?? undefined,
          accountNumber: bankAccount.accountNumber as string,
          accountDigit: (bankAccount.accountDigit as string) ?? undefined,
          carteira: (bankAccount.carteira as string) ?? undefined,
          variacao: (bankAccount.variacao as string) ?? undefined,
          fileDate: new Date(),
          sequentialNumber: 1,
        };

        const paymentRecords: CnabPaymentRecord[] = payables.map((p: any) => ({
          payableId: p.id as string,
          amount: parseFloat(p.totalAmount),
          dueDate: p.dueDate as Date,
          supplierName: p.supplierName as string,
          documentNumber: (p.documentNumber as string) ?? undefined,
          // Supplier bank info not stored on payable — use empty defaults
          bankCode: bankAccount.bankCode as string,
        }));

        const content =
          format === '240'
            ? adapter.generateRemessa240(headerData, paymentRecords)
            : adapter.generateRemessa400(headerData, paymentRecords);

        return { content, bankCode: bankAccount.bankCode as string };
      });

      const filename = `remessa_${result.bankCode}_cnab${format}_${new Date().toISOString().slice(0, 10)}.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.content);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CNAB RETORNO PREVIEW — BEFORE /:id ──────────────────────────────
// POST /org/payables/cnab/retorno/preview
// Multipart file upload. Returns preview records (no DB writes).

payablesRouter.post(
  '/org/payables/cnab/retorno/preview',
  authenticate,
  checkPermission('financial:read'),
  cnabUpload.single('file'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);

      if (!req.file) {
        res.status(400).json({ error: 'Arquivo de retorno é obrigatório' });
        return;
      }

      const { bankCode } = req.body as { bankCode?: string };
      if (!bankCode) {
        res.status(400).json({ error: 'bankCode é obrigatório' });
        return;
      }

      const adapter = getCnabAdapter(bankCode);
      const fileContent = req.file.buffer.toString('latin1'); // CNAB uses ISO-8859-1
      const returnRecords = adapter.parseRetorno(fileContent);

      if (returnRecords.length === 0) {
        res.json({ records: [], unmatched: [] });
        return;
      }

      // Match ourNumbers to payable IDs
      // Our numbers are derived from payableId (first 20 chars without dashes)
      const preview = await withRlsContext(ctx, async (tx) => {
        const matched: any[] = [];
        const unmatched: any[] = [];

        for (const rec of returnRecords) {
          // Try to find payable by matching ourNumber pattern
          // ourNumber is payableId with dashes removed, truncated
          const payables = await (tx as any).payable.findMany({
            where: { organizationId: ctx.organizationId, status: { in: ['PENDING', 'OVERDUE'] } },
            select: { id: true, supplierName: true, totalAmount: true, dueDate: true },
            take: 200,
          });

          const match = payables.find((p: any) => {
            const normalized = (p.id as string).replace(/-/g, '').slice(0, 20);
            return (
              normalized === rec.ourNumber.trim() ||
              (p.id as string).replace(/-/g, '').slice(0, 8) === rec.ourNumber.trim().slice(0, 8)
            );
          });

          if (match) {
            matched.push({
              payableId: match.id,
              supplierName: match.supplierName,
              totalAmount: parseFloat(match.totalAmount),
              dueDate: (match.dueDate as Date).toISOString(),
              ourNumber: rec.ourNumber,
              status: rec.status,
              statusCode: rec.statusCode,
              liquidationDate: rec.liquidationDate?.toISOString() ?? null,
              amountPaid: rec.amountPaid ?? null,
            });
          } else {
            unmatched.push({
              ourNumber: rec.ourNumber,
              status: rec.status,
              statusCode: rec.statusCode,
              liquidationDate: rec.liquidationDate?.toISOString() ?? null,
              amountPaid: rec.amountPaid ?? null,
            });
          }
        }

        return { records: matched, unmatched };
      });

      res.json(preview);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CNAB RETORNO CONFIRM — BEFORE /:id ──────────────────────────────
// POST /org/payables/cnab/retorno/confirm
// Body: { bankAccountId, records: { payableId, amountPaid, liquidationDate }[] }

payablesRouter.post(
  '/org/payables/cnab/retorno/confirm',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const {
        bankAccountId,
        records,
      }: {
        bankAccountId: string;
        records: { payableId: string; amountPaid: number; liquidationDate: string }[];
      } = req.body;

      if (!bankAccountId || !records?.length) {
        res.status(400).json({ error: 'bankAccountId e records são obrigatórios' });
        return;
      }

      // Settle each matched payable
      const settled = await Promise.all(
        records.map((rec) =>
          settlePayment(ctx, rec.payableId, {
            paidAt: rec.liquidationDate,
            amount: rec.amountPaid,
            bankAccountId,
          }),
        ),
      );

      res.json({ settled: settled.length, payables: settled });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ──────────────────────────────────────────────────────────────

payablesRouter.get(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await getPayable(ctx, req.params.id as string);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ───────────────────────────────────────────────────────────

payablesRouter.put(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await updatePayable(ctx, req.params.id as string, req.body);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ───────────────────────────────────────────────────────────

payablesRouter.delete(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePayable(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SETTLE ───────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables/:id/settle',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await settlePayment(ctx, req.params.id as string, req.body);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── REVERSE ──────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables/:id/reverse',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await reversePayment(ctx, req.params.id as string);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);
