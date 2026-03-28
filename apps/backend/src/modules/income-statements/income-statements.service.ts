// ─── Income Statements Service ────────────────────────────────────────────────
// Generates official "Comprovante de Rendimentos" (replacing DIRF, abolished 2025)
// from PayrollRunItem aggregations. PDF follows RFB model (per D-13).
// Sends by email in batch (per D-14). RAIS consistency report (per D-15).

import Decimal from 'decimal.js';
import { withRlsContext } from '../../database/rls';
import { sendMail } from '../../shared/mail/mail.service';
import {
  IncomeStatementError,
  type IncomeStatementOutput,
  type GenerateIncomeStatementsInput,
  type ListIncomeStatementsQuery,
  type RaisConsistencyOutput,
  type SendIncomeStatementsInput,
} from './income-statements.types';

// ─── Types ─────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type TxClient = any;

interface DownloadResult {
  buffer: Buffer;
  filename: string;
}

interface SendResult {
  sent: number;
  skipped: number;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Annual IRRF deduction per dependent (2025/2026 table) */
const ANNUAL_DEPENDENT_DEDUCTION = 2275.08;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mapToOutput(stmt: any): IncomeStatementOutput {
  return {
    id: stmt.id as string,
    organizationId: stmt.organizationId as string,
    employeeId: stmt.employeeId as string,
    employeeName: (stmt.employee?.name ?? stmt.employeeName ?? '') as string,
    employeeCpf: (stmt.employee?.cpf ?? stmt.employeeCpf ?? '') as string,
    yearBase: stmt.yearBase as number,
    totalTaxable: stmt.totalTaxable?.toString() ?? '0',
    totalInss: stmt.totalInss?.toString() ?? '0',
    totalIrrf: stmt.totalIrrf?.toString() ?? '0',
    totalExempt: stmt.totalExempt?.toString() ?? '0',
    dependentDeduction: stmt.dependentDeduction?.toString() ?? '0',
    pdfKey: stmt.pdfKey as string | null,
    sentAt: stmt.sentAt ? (stmt.sentAt as Date).toISOString() : null,
    sentTo: stmt.sentTo as string | null,
    createdBy: stmt.createdBy as string,
    createdAt: (stmt.createdAt as Date).toISOString(),
  };
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

interface PdfData {
  orgName: string;
  orgCnpj: string;
  employeeName: string;
  employeeCpf: string;
  employeePis: string | null;
  yearBase: number;
  totalTaxable: number;
  totalInss: number;
  totalIrrf: number;
  totalExempt: number;
  dependentDeduction: number;
  dependentCount: number;
  generatedAt: Date;
}

/**
 * Generates an official "Comprovante de Rendimentos" PDF per D-13 / RFB model.
 * Mentions DIRF abolition (abolished in 2025).
 */
async function generateIncomePdf(data: PdfData): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 40;
    const pageWidth = 595.28;
    const usableWidth = pageWidth - margin * 2;
    let y = 40;

    // ── Official header ─────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(
      'COMPROVANTE DE RENDIMENTOS PAGOS E DE IMPOSTO SOBRE A RENDA RETIDO NA FONTE',
      margin,
      y,
      { width: usableWidth, align: 'center' },
    );
    y += 16;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Ano-Calendário: ${data.yearBase}`, margin, y, {
      align: 'center',
      width: usableWidth,
    });
    y += 20;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke();
    y += 8;

    // ── Section 1 — Fonte Pagadora ───────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('1. FONTE PAGADORA', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Nome/Razao Social: ${data.orgName}`, margin, y);
    y += 12;
    if (data.orgCnpj) {
      doc.text(`CNPJ: ${formatCnpj(data.orgCnpj)}`, margin, y);
      y += 12;
    }
    y += 6;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 2 — Pessoa Fisica Beneficiaria ───────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('2. PESSOA FISICA BENEFICIARIA', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Nome: ${data.employeeName}`, margin, y);
    y += 12;
    doc.text(`CPF: ${formatCpf(data.employeeCpf)}`, margin, y);
    y += 12;
    if (data.employeePis) {
      doc.text(`PIS/PASEP: ${data.employeePis}`, margin, y);
      y += 12;
    }
    y += 6;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 3 — Rendimentos Tributaveis ──────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('3. RENDIMENTOS TRIBUTAVEIS', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(
      `Total de Rendimentos Tributaveis (Trabalho Assalariado): ${formatCurrency(data.totalTaxable)}`,
      margin,
      y,
    );
    y += 16;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 4 — Deducoes ─────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('4. DEDUCOES', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(
      `Contribuicao Previdenciaria Oficial (INSS): ${formatCurrency(data.totalInss)}`,
      margin,
      y,
    );
    y += 12;
    if (data.dependentCount > 0) {
      doc.text(
        `Dependentes (${data.dependentCount} x R$ 2.275,08/ano): ${formatCurrency(data.dependentDeduction)}`,
        margin,
        y,
      );
      y += 12;
    }
    const totalDeductions = data.totalInss + data.dependentDeduction;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Total de Deducoes: ${formatCurrency(totalDeductions)}`, margin, y);
    y += 16;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 5 — Imposto de Renda Retido ──────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('5. IMPOSTO DE RENDA RETIDO NA FONTE (IRRF)', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`IRRF Retido: ${formatCurrency(data.totalIrrf)}`, margin, y);
    y += 16;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 6 — Rendimentos Isentos e Nao Tributaveis ────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('6. RENDIMENTOS ISENTOS E NAO TRIBUTAVEIS', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(9);
    if (data.totalExempt > 0) {
      doc.text(
        `Salario-Familia / 13o Salario 1a Parcela: ${formatCurrency(data.totalExempt)}`,
        margin,
        y,
      );
      y += 12;
    } else {
      doc.text('Nao ha rendimentos isentos no periodo.', margin, y);
      y += 12;
    }
    y += 6;

    doc
      .moveTo(margin, y)
      .lineTo(margin + usableWidth, y)
      .stroke('#CCCCCC');
    y += 8;

    // ── Section 7 — Informacoes Complementares ───────────────────────────
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('7. INFORMACOES COMPLEMENTARES', margin, y);
    y += 14;

    doc.font('Helvetica').fontSize(8);
    doc.text(
      'Este documento substitui o antigo DIRF — abolida em 2025 (Lei 14.754/2023 e IN RFB 2.177/2024).',
      margin,
      y,
      { width: usableWidth },
    );
    y += 24;

    // ── Footer ────────────────────────────────────────────────────────────
    const footerY = 760;
    doc.font('Helvetica').fontSize(8);
    doc.text(
      `Ano-base: ${data.yearBase}  |  Emitido em: ${data.generatedAt.toLocaleDateString('pt-BR')}`,
      margin,
      footerY,
      { width: usableWidth, align: 'center' },
    );

    doc.end();
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class IncomeStatementsService {
  /**
   * Generates income statements for all (or specified) employees for the given year.
   * Aggregates PayrollRunItem data: grossSalary → totalTaxable, inssAmount → totalInss,
   * irrfAmount → totalIrrf, salaryFamily → totalExempt.
   * Upserts via unique constraint (orgId + employeeId + yearBase).
   */
  async generateStatements(
    orgId: string,
    input: GenerateIncomeStatementsInput,
    userId: string,
  ): Promise<IncomeStatementOutput[]> {
    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      const { yearBase, employeeIds } = input;

      const yearStart = new Date(Date.UTC(yearBase, 0, 1));
      const yearEnd = new Date(Date.UTC(yearBase + 1, 0, 1));

      // Find all COMPLETED runs in the year
      const runs = await (tx as TxClient).payrollRun.findMany({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          referenceMonth: { gte: yearStart, lt: yearEnd },
        },
        select: { id: true },
      });

      if (runs.length === 0) return [];

      const runIds = runs.map((r: any) => r.id as string);

      // Fetch all PayrollRunItems for those runs (with employee + dependents)
      const itemsWhere: any = {
        payrollRunId: { in: runIds },
      };
      if (employeeIds && employeeIds.length > 0) {
        itemsWhere.employeeId = { in: employeeIds };
      }

      const items = await (tx as TxClient).payrollRunItem.findMany({
        where: itemsWhere,
        include: {
          employee: {
            include: { dependents: { select: { id: true } } },
          },
          payrollRun: { select: { runType: true, referenceMonth: true } },
        },
      });

      // Group by employee
      const byEmployee = new Map<string, typeof items>();
      for (const item of items) {
        const empId = item.employeeId as string;
        if (!byEmployee.has(empId)) byEmployee.set(empId, []);
        byEmployee.get(empId)!.push(item);
      }

      const results: IncomeStatementOutput[] = [];

      for (const [empId, empItems] of byEmployee) {
        const employee = empItems[0].employee;

        // Aggregate numeric totals
        let totalTaxable = new Decimal(0);
        let totalInss = new Decimal(0);
        let totalIrrf = new Decimal(0);
        let totalExempt = new Decimal(0);

        for (const item of empItems) {
          totalTaxable = totalTaxable.plus(new Decimal(item.grossSalary.toNumber()));
          totalInss = totalInss.plus(new Decimal(item.inssAmount.toNumber()));
          totalIrrf = totalIrrf.plus(new Decimal(item.irrfAmount.toNumber()));

          // Exempt: salary-family benefit
          if (item.salaryFamily && item.salaryFamily.toNumber() > 0) {
            totalExempt = totalExempt.plus(new Decimal(item.salaryFamily.toNumber()));
          }

          // Exempt: 13th salary first parcel (non-taxable)
          if (item.payrollRun?.runType === 'THIRTEENTH_FIRST') {
            totalExempt = totalExempt.plus(new Decimal(item.grossSalary.toNumber()));
          }
        }

        // Dependent deduction
        const dependentCount = employee?.dependents?.length ?? 0;
        const dependentDeduction = new Decimal(dependentCount).mul(
          new Decimal(ANNUAL_DEPENDENT_DEDUCTION),
        );

        const stmt = await (tx as TxClient).incomeStatement.upsert({
          where: {
            organizationId_employeeId_yearBase: {
              organizationId: orgId,
              employeeId: empId,
              yearBase,
            },
          },
          create: {
            organizationId: orgId,
            employeeId: empId,
            yearBase,
            totalTaxable: totalTaxable.toDecimalPlaces(2).toNumber(),
            totalInss: totalInss.toDecimalPlaces(2).toNumber(),
            totalIrrf: totalIrrf.toDecimalPlaces(2).toNumber(),
            totalExempt: totalExempt.toDecimalPlaces(2).toNumber(),
            dependentDeduction: dependentDeduction.toDecimalPlaces(2).toNumber(),
            createdBy: userId,
          },
          update: {
            totalTaxable: totalTaxable.toDecimalPlaces(2).toNumber(),
            totalInss: totalInss.toDecimalPlaces(2).toNumber(),
            totalIrrf: totalIrrf.toDecimalPlaces(2).toNumber(),
            totalExempt: totalExempt.toDecimalPlaces(2).toNumber(),
            dependentDeduction: dependentDeduction.toDecimalPlaces(2).toNumber(),
          },
          include: {
            employee: { select: { name: true, cpf: true } },
          },
        });

        results.push(mapToOutput(stmt));
      }

      return results;
    });
  }

  /**
   * Lists income statements for an org, optionally filtered by yearBase or employeeId.
   */
  async listStatements(
    orgId: string,
    query: ListIncomeStatementsQuery,
  ): Promise<{ data: IncomeStatementOutput[]; total: number }> {
    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      const { yearBase, employeeId, page = 1, limit = 20 } = query;

      const where: any = { organizationId: orgId };
      if (yearBase) where.yearBase = yearBase;
      if (employeeId) where.employeeId = employeeId;

      const [stmts, total] = await Promise.all([
        (tx as TxClient).incomeStatement.findMany({
          where,
          include: { employee: { select: { name: true, cpf: true } } },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ yearBase: 'desc' }, { createdAt: 'desc' }],
        }),
        (tx as TxClient).incomeStatement.count({ where }),
      ]);

      return { data: stmts.map(mapToOutput), total };
    });
  }

  /**
   * Downloads (or generates on-the-fly) the income statement PDF for one employee.
   */
  async downloadStatement(orgId: string, statementId: string): Promise<DownloadResult> {
    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      const stmt = await (tx as TxClient).incomeStatement.findFirst({
        where: { id: statementId, organizationId: orgId },
        include: {
          employee: {
            include: { dependents: { select: { id: true } } },
          },
          organization: { select: { name: true, cnpj: true } },
        },
      });

      if (!stmt) {
        throw new IncomeStatementError('Informe de rendimentos nao encontrado', 404);
      }

      const buffer = await generateIncomePdf({
        orgName: stmt.organization?.name ?? orgId,
        orgCnpj: stmt.organization?.cnpj ?? '',
        employeeName: stmt.employee?.name ?? '',
        employeeCpf: stmt.employee?.cpf ?? '',
        employeePis: stmt.employee?.pisPassep ?? null,
        yearBase: stmt.yearBase as number,
        totalTaxable: Number(stmt.totalTaxable),
        totalInss: Number(stmt.totalInss),
        totalIrrf: Number(stmt.totalIrrf),
        totalExempt: Number(stmt.totalExempt),
        dependentDeduction: Number(stmt.dependentDeduction),
        dependentCount: stmt.employee?.dependents?.length ?? 0,
        generatedAt: new Date(),
      });

      const safeName = (stmt.employee?.name ?? 'colaborador')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      return {
        buffer,
        filename: `informe-rendimentos-${safeName}-${stmt.yearBase}.pdf`,
      };
    });
  }

  /**
   * Sends income statement PDFs by email to employees.
   * Skips employees without an email address.
   * Updates sentAt and sentTo after successful delivery.
   */
  async sendStatements(
    orgId: string,
    input: SendIncomeStatementsInput,
    userId: string,
  ): Promise<SendResult> {
    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      const { yearBase, employeeIds } = input;

      const where: any = { organizationId: orgId, yearBase };
      if (employeeIds && employeeIds.length > 0) {
        where.employeeId = { in: employeeIds };
      }

      const stmts = await (tx as TxClient).incomeStatement.findMany({
        where,
        include: {
          employee: {
            select: {
              name: true,
              cpf: true,
              email: true,
              pisPassep: true,
              dependents: { select: { id: true } },
            },
          },
          organization: { select: { name: true, cnpj: true } },
        },
      });

      let sent = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const stmt of stmts) {
        const email = stmt.employee?.email;
        if (!email) {
          skipped++;
          continue;
        }

        try {
          const buffer = await generateIncomePdf({
            orgName: stmt.organization?.name ?? orgId,
            orgCnpj: stmt.organization?.cnpj ?? '',
            employeeName: stmt.employee?.name ?? '',
            employeeCpf: stmt.employee?.cpf ?? '',
            employeePis: stmt.employee?.pisPassep ?? null,
            yearBase: stmt.yearBase as number,
            totalTaxable: Number(stmt.totalTaxable),
            totalInss: Number(stmt.totalInss),
            totalIrrf: Number(stmt.totalIrrf),
            totalExempt: Number(stmt.totalExempt),
            dependentDeduction: Number(stmt.dependentDeduction),
            dependentCount: stmt.employee?.dependents?.length ?? 0,
            generatedAt: new Date(),
          });

          const safeName = (stmt.employee?.name ?? 'colaborador')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          await sendMail({
            to: email,
            subject: `Informe de Rendimentos ${stmt.yearBase} — ${stmt.organization?.name ?? ''}`,
            text: `Prezado(a) ${stmt.employee?.name ?? ''},\n\nSegue em anexo o seu Informe de Rendimentos referente ao ano-base ${stmt.yearBase}.\n\nAtenciosamente,\n${stmt.organization?.name ?? ''}`,
            attachments: [
              {
                filename: `informe-rendimentos-${safeName}-${stmt.yearBase}.pdf`,
                content: buffer,
                contentType: 'application/pdf',
              },
            ],
          });

          // Update sentAt and sentTo
          await (tx as TxClient).incomeStatement.upsert({
            where: {
              organizationId_employeeId_yearBase: {
                organizationId: orgId,
                employeeId: stmt.employeeId as string,
                yearBase: stmt.yearBase as number,
              },
            },
            create: {
              organizationId: orgId,
              employeeId: stmt.employeeId as string,
              yearBase: stmt.yearBase as number,
              totalTaxable: Number(stmt.totalTaxable),
              totalInss: Number(stmt.totalInss),
              totalIrrf: Number(stmt.totalIrrf),
              totalExempt: Number(stmt.totalExempt),
              dependentDeduction: Number(stmt.dependentDeduction),
              createdBy: userId,
              sentAt: new Date(),
              sentTo: email,
            },
            update: { sentAt: new Date(), sentTo: email },
          });

          sent++;
        } catch (err) {
          errors.push(
            `${stmt.employee?.name ?? stmt.employeeId}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
          );
        }
      }

      return { sent, skipped, errors };
    });
  }

  /**
   * RAIS consistency report (per D-15).
   * Verifies that all active employees have the required eSocial events for the year.
   */
  async getRaisConsistency(orgId: string, yearBase: number): Promise<RaisConsistencyOutput> {
    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      const yearStart = new Date(Date.UTC(yearBase, 0, 1));
      const yearEnd = new Date(Date.UTC(yearBase + 1, 0, 1));

      // Employees active during the year
      const employees = await (tx as TxClient).employee.findMany({
        where: {
          organizationId: orgId,
          OR: [{ terminationDate: null }, { terminationDate: { gte: yearStart } }],
          admissionDate: { lt: yearEnd },
        },
        select: { id: true, name: true, terminationDate: true },
      });

      const totalEmployees = employees.length;
      const employeeIds = employees.map((e: any) => e.id as string);
      const employeeNameMap = new Map<string, string>(
        employees.map((e: any) => [e.id as string, e.name as string]),
      );

      if (employeeIds.length === 0) {
        return {
          yearBase,
          totalEmployees: 0,
          employeesWithAdmission: 0,
          employeesWithRemuneration: 0,
          employeesWithTermination: 0,
          missingAdmissionEvents: [],
          missingRemunerationEvents: [],
          isConsistent: true,
        };
      }

      // S-2200 admission events
      const admissionEvents = await (tx as TxClient).esocialEvent.findMany({
        where: {
          organizationId: orgId,
          eventType: 'S-2200',
          sourceId: { in: employeeIds },
        },
        select: { sourceId: true },
      });
      const admissionSet = new Set(admissionEvents.map((e: any) => e.sourceId as string));

      // S-1200 remuneration events (at least one per employee in the year)
      const remunerationEvents = await (tx as TxClient).esocialEvent.findMany({
        where: {
          organizationId: orgId,
          eventType: 'S-1200',
          sourceId: { in: employeeIds },
          ...(yearStart && { createdAt: { gte: yearStart, lt: yearEnd } }),
        },
        select: { sourceId: true },
      });
      const remunerationSet = new Set(remunerationEvents.map((e: any) => e.sourceId as string));

      // S-2299 termination events (only required for terminated employees)
      const terminatedEmployeeIds = employees
        .filter((e: any) => e.terminationDate !== null)
        .map((e: any) => e.id as string);

      const terminationEvents = await (tx as TxClient).esocialEvent.findMany({
        where: {
          organizationId: orgId,
          eventType: 'S-2299',
          sourceId: { in: terminatedEmployeeIds.length > 0 ? terminatedEmployeeIds : ['__none__'] },
        },
        select: { sourceId: true },
      });
      const terminationSet = new Set(terminationEvents.map((e: any) => e.sourceId as string));

      const missingAdmissionEvents = (employeeIds as string[])
        .filter((id: string) => !admissionSet.has(id))
        .map((id: string) => employeeNameMap.get(id) ?? id);

      const missingRemunerationEvents = (employeeIds as string[])
        .filter((id: string) => !remunerationSet.has(id))
        .map((id: string) => employeeNameMap.get(id) ?? id);

      const isConsistent =
        missingAdmissionEvents.length === 0 && missingRemunerationEvents.length === 0;

      return {
        yearBase,
        totalEmployees,
        employeesWithAdmission: admissionSet.size,
        employeesWithRemuneration: remunerationSet.size,
        employeesWithTermination: terminationSet.size,
        missingAdmissionEvents,
        missingRemunerationEvents,
        isConsistent,
      };
    });
  }
}

export const incomeStatementsService = new IncomeStatementsService();
