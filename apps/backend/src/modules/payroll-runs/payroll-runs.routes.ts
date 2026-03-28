// ─── PayrollRuns Routes ───────────────────────────────────────────────
// 9 endpoints: create, list, preview, get, process, recalculate, close, revert,
// payslips ZIP, individual payslip, employee payslips history.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './payroll-runs.service';
import { PayrollRunError } from './payroll-runs.types';
import { generatePayslipPdf } from './payroll-pdf.service';
import { prisma } from '../../database/prisma';

export const payrollRunsRouter = Router();

const base = '/org/:orgId/payroll-runs';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof PayrollRunError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/payroll-runs — create run ────────────────────────

payrollRunsRouter.post(
  base,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const run = await service.createRun(
        { organizationId: orgId, userId: req.user?.userId },
        req.body,
      );
      res.status(201).json(run);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs — list runs ──────────────────────────

payrollRunsRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.listRuns(
        { organizationId: orgId, userId: req.user?.userId },
        {
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
          status: req.query.status as string | undefined,
          runType: req.query.runType as string | undefined,
          referenceMonth: req.query.referenceMonth as string | undefined,
        },
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs/preview/:runId — preview employees ───
// NOTE: must be registered BEFORE /:id to prevent Express 5 route shadowing

payrollRunsRouter.get(
  `${base}/preview/:runId`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const runId = req.params.runId as string;

      // Get run
      const run = await prisma.payrollRun.findFirst({
        where: { id: runId, organizationId: orgId },
        select: { id: true, referenceMonth: true, runType: true, status: true },
      });

      if (!run) {
        res.status(404).json({ error: 'Folha não encontrada' });
        return;
      }

      // Get active employees with timesheet status for the reference month
      const employees = await prisma.employee.findMany({
        where: { organizationId: orgId, status: 'ATIVO' },
        select: {
          id: true,
          name: true,
          cpf: true,
          admissionDate: true,
          salaryHistory: {
            where: { effectiveAt: { lte: run.referenceMonth } },
            orderBy: { effectiveAt: 'desc' },
            take: 1,
            select: { salary: true },
          },
          timesheets: {
            where: { referenceMonth: run.referenceMonth },
            select: { status: true },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      });

      const preview = employees.map((emp) => ({
        employeeId: emp.id,
        employeeName: emp.name,
        cpf: emp.cpf,
        baseSalary: emp.salaryHistory[0]?.salary ?? null,
        timesheetStatus: emp.timesheets[0]?.status ?? null,
        canCalculate: emp.timesheets[0]?.status === 'APPROVED',
      }));

      res.json({ runId, referenceMonth: run.referenceMonth, employees: preview });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs/:id/cp-preview — dry-run CP list ──────
// NOTE: must be registered BEFORE /:id to prevent Express 5 route shadowing

payrollRunsRouter.get(
  `${base}/:id/cp-preview`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const result = await service.cpPreview(
        { organizationId: orgId, userId: req.user?.userId },
        id,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs/:id — get run details ────────────────

payrollRunsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const run = await service.getRun({ organizationId: orgId, userId: req.user?.userId }, id);
      res.json(run);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-runs/:id/process — start batch processing ─

payrollRunsRouter.post(
  `${base}/:id/process`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      await service.processRun({ organizationId: orgId, userId: req.user?.userId }, id);
      res.json({ message: 'Processamento iniciado com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-runs/:id/recalculate/:employeeId ──────────

payrollRunsRouter.post(
  `${base}/:id/recalculate/:employeeId`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const employeeId = req.params.employeeId as string;
      await service.recalculateEmployee(
        { organizationId: orgId, userId: req.user?.userId },
        id,
        employeeId,
      );
      res.json({ message: 'Recalculo realizado com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-runs/:id/close — finalize run ──────────────

payrollRunsRouter.post(
  `${base}/:id/close`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      await service.closeRun({ organizationId: orgId, userId: req.user?.userId }, id);
      res.json({ message: 'Folha fechada com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/payroll-runs/:id/revert — estorno ─────────────────

payrollRunsRouter.post(
  `${base}/:id/revert`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      await service.revertRun({ organizationId: orgId, userId: req.user?.userId }, id);
      res.json({ message: 'Folha estornada com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs/:id/payslips — download ZIP of all PDFs ─

payrollRunsRouter.get(
  `${base}/:id/payslips`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;

      const buffer = await service.downloadPayslipsZip(
        { organizationId: orgId, userId: req.user?.userId },
        id,
      );

      // Get referenceMonth for filename
      const run = await prisma.payrollRun.findFirst({
        where: { id, organizationId: orgId },
        select: { referenceMonth: true },
      });

      const month = run
        ? `${run.referenceMonth.getUTCFullYear()}-${String(run.referenceMonth.getUTCMonth() + 1).padStart(2, '0')}`
        : id;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="holerites-${month}.zip"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-runs/:id/items/:itemId/payslip — individual PDF ─

payrollRunsRouter.get(
  `${base}/:id/items/:itemId/payslip`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const itemId = req.params.itemId as string;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = (await (prisma.payrollRunItem.findFirst as any)({
        where: { id: itemId, payrollRunId: id },
        include: {
          payrollRun: {
            select: {
              referenceMonth: true,
              runType: true,
              organization: { select: { name: true } },
            },
          },
          employee: {
            select: {
              name: true,
              cpf: true,
              admissionDate: true,
              contracts: {
                where: { isActive: true },
                select: { position: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any;

      if (!item) {
        res.status(404).json({ error: 'Item não encontrado' });
        return;
      }

      const lineItems = Array.isArray(item.lineItemsJson)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item.lineItemsJson as any[]).map((li: any) => ({
            ...li,
            value: typeof li.value === 'string' ? parseFloat(li.value) : li.value,
          }))
        : [];

      const pdfBuffer = await generatePayslipPdf({
        orgName: item.payrollRun?.organization?.name ?? orgId,
        orgCnpj: '',
        employeeName: item.employee.name,
        employeeCpf: item.employee.cpf,
        employeeCargo: item.employee.contracts[0]?.position?.name ?? '',
        admissionDate: item.employee.admissionDate,
        referenceMonth: `${item.payrollRun.referenceMonth.getUTCFullYear()}-${String(item.payrollRun.referenceMonth.getUTCMonth() + 1).padStart(2, '0')}`,
        runType: item.payrollRun.runType,
        lineItems,
        grossSalary: parseFloat(item.grossSalary.toString()),
        totalDeductions:
          parseFloat(item.grossSalary.toString()) - parseFloat(item.netSalary.toString()),
        netSalary: parseFloat(item.netSalary.toString()),
        inssBase: parseFloat(item.grossSalary.toString()),
        irrfBase: parseFloat(item.grossSalary.toString()),
        fgtsMonth: parseFloat(item.fgtsAmount.toString()),
        // NOTE: Derives fgtsBase from fgtsAmount assuming standard 8% FGTS rate (Lei 8.036/90).
        fgtsBase:
          parseFloat(item.fgtsAmount.toString()) === 0
            ? 0
            : parseFloat((parseFloat(item.fgtsAmount.toString()) / 0.08).toFixed(2)),
      });

      const filename = `holerite_${item.payrollRun.referenceMonth.getUTCFullYear()}-${String(item.payrollRun.referenceMonth.getUTCMonth() + 1).padStart(2, '0')}_${item.employee.name.toUpperCase().replace(/\s+/g, '-')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
