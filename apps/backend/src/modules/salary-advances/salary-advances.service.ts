import Decimal from 'decimal.js';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  SalaryAdvanceError,
  type CreateAdvanceInput,
  type BatchAdvanceInput,
} from './salary-advances.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const months: Record<string, string> = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro',
  };
  return `${months[month] ?? month}/${year}`;
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

// ─── createAdvance ────────────────────────────────────────────────────

export async function createAdvance(
  rls: RlsContext,
  input: CreateAdvanceInput,
): Promise<Record<string, unknown>> {
  return withRlsContext(rls, async (tx) => {
    // 1. Fetch employee with salary history and farm relation
    const employee = await tx.employee.findFirst({
      where: {
        id: input.employeeId,
        organizationId: rls.organizationId,
      },
      select: {
        id: true,
        name: true,
        cpf: true,
        status: true,
        farms: {
          where: { status: 'ATIVO' },
          select: { farmId: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        salaryHistory: {
          orderBy: { effectiveAt: 'desc' },
          take: 1,
          select: { salary: true },
        },
        contracts: {
          where: { endDate: null },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { salary: true },
        },
      },
    });

    if (!employee) {
      throw new SalaryAdvanceError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND', 404);
    }

    // 2. Validate employee is ACTIVE
    if (employee.status !== 'ATIVO') {
      throw new SalaryAdvanceError(
        'Adiantamento não permitido para colaborador inativo',
        'EMPLOYEE_NOT_ACTIVE',
      );
    }

    // 3. Get current salary from history or contract
    const currentSalary = employee.salaryHistory[0]?.salary ?? employee.contracts[0]?.salary;

    if (!currentSalary) {
      throw new SalaryAdvanceError(
        'Colaborador não possui histórico salarial ou contrato ativo',
        'NO_SALARY_FOUND',
      );
    }

    // 4. Validate advance limit (default 40% of salary)
    const maxPercent = 40;
    const salaryDecimal = new Decimal(currentSalary.toString());
    const maxAmount = salaryDecimal.mul(maxPercent).div(100);
    const requestedAmount = new Decimal(input.amount);

    if (requestedAmount.greaterThan(maxAmount)) {
      throw new SalaryAdvanceError(
        `Adiantamento excede o limite de ${maxPercent}% do salário (máximo ${formatCurrency(maxAmount.toNumber())})`,
        'LIMIT_EXCEEDED',
      );
    }

    // 5. Check for duplicate advance in same referenceMonth
    const referenceMonthDate = new Date(input.referenceMonth + '-01');
    const existingAdvance = await tx.salaryAdvance.findFirst({
      where: {
        employeeId: input.employeeId,
        organizationId: rls.organizationId,
        referenceMonth: referenceMonthDate,
      },
    });

    if (existingAdvance) {
      throw new SalaryAdvanceError(
        `Já existe adiantamento para o colaborador no mês ${formatMonthLabel(input.referenceMonth)}`,
        'DUPLICATE_ADVANCE',
      );
    }

    // 6. Get farmId from employee farms
    const farmId = employee.farms[0]?.farmId ?? null;
    const monthLabel = formatMonthLabel(input.referenceMonth);
    const advanceDate = new Date(input.advanceDate);

    // 7. Create SalaryAdvance + Payable in transaction
    const advance = await tx.salaryAdvance.create({
      data: {
        organizationId: rls.organizationId,
        employeeId: input.employeeId,
        referenceMonth: referenceMonthDate,
        amount: requestedAmount,
        advanceDate,
        notes: input.notes ?? null,
        createdBy: rls.userId ?? 'system',
      },
    });

    // 8. Create Payable with originType='SALARY_ADVANCE'
    const payable = await tx.payable.create({
      data: {
        organizationId: rls.organizationId,
        farmId,
        supplierName: employee.name,
        category: 'PAYROLL',
        description: `Adiantamento salarial ${monthLabel} - ${employee.name}`,
        totalAmount: requestedAmount,
        dueDate: advanceDate,
        status: 'PENDING',
        originType: 'SALARY_ADVANCE',
        originId: advance.id,
        installmentCount: 1,
      },
    });

    // 9. Update advance with payableId
    const updatedAdvance = await tx.salaryAdvance.update({
      where: { id: advance.id },
      data: { payableId: payable.id },
    });

    return {
      ...updatedAdvance,
      referenceMonth: updatedAdvance.referenceMonth.toISOString(),
      advanceDate: updatedAdvance.advanceDate.toISOString(),
      createdAt: updatedAdvance.createdAt.toISOString(),
      amount: Number(updatedAdvance.amount),
    };
  });
}

// ─── createBatchAdvances ──────────────────────────────────────────────

export async function createBatchAdvances(
  rls: RlsContext,
  input: BatchAdvanceInput,
): Promise<{ batchId: string; count: number; advances: Record<string, unknown>[] }> {
  const percentOfSalary = input.percentOfSalary ?? 40;
  const referenceMonthDate = new Date(input.referenceMonth + '-01');

  // 1. Fetch all active employees for the org
  const activeEmployees = await withRlsContext(rls, async (tx) => {
    return tx.employee.findMany({
      where: {
        organizationId: rls.organizationId,
        status: 'ATIVO',
      },
      select: {
        id: true,
        name: true,
        salaryHistory: {
          orderBy: { effectiveAt: 'desc' },
          take: 1,
          select: { salary: true },
        },
        contracts: {
          where: { endDate: null },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { salary: true },
        },
        // Check existing advance for this month
        salaryAdvances: {
          where: { referenceMonth: referenceMonthDate },
          select: { id: true },
          take: 1,
        },
      },
    });
  });

  const batchId = `batch-${Date.now()}`;
  const advances: Record<string, unknown>[] = [];

  for (const employee of activeEmployees) {
    // 2. Skip if advance already exists for this referenceMonth
    if (employee.salaryAdvances.length > 0) {
      continue;
    }

    // 3. Get current salary
    const currentSalary = employee.salaryHistory[0]?.salary ?? employee.contracts[0]?.salary;

    if (!currentSalary) {
      continue; // skip employees without salary
    }

    // 4. Calculate amount = salary * percent / 100, rounded to 2dp
    const salaryDecimal = new Decimal(currentSalary.toString());
    const amount = salaryDecimal
      .mul(percentOfSalary)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    try {
      const advance = await createAdvance(rls, {
        employeeId: employee.id,
        referenceMonth: input.referenceMonth,
        amount,
        advanceDate: input.advanceDate,
        notes: `Adiantamento em lote - ${batchId}`,
      });

      // Tag with batchId
      await withRlsContext(rls, async (tx) => {
        await tx.salaryAdvance.update({
          where: { id: advance.id as string },
          data: { batchId },
        });
      });

      advances.push({ ...advance, batchId });
    } catch {
      // Skip employees that fail (e.g., exceed limit somehow)
    }
  }

  return { batchId, count: advances.length, advances };
}

// ─── listAdvances ─────────────────────────────────────────────────────

export async function listAdvances(
  rls: RlsContext,
  filters: {
    referenceMonth?: string;
    employeeId?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(rls, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: rls.organizationId,
    };

    if (filters.referenceMonth) {
      where.referenceMonth = new Date(filters.referenceMonth + '-01');
    }

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    const [data, total] = await Promise.all([
      tx.salaryAdvance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: { name: true, cpf: true },
          },
        },
      }),
      tx.salaryAdvance.count({ where }),
    ]);

    return {
      data: data.map((advance) => ({
        ...advance,
        referenceMonth: advance.referenceMonth.toISOString(),
        advanceDate: advance.advanceDate.toISOString(),
        createdAt: advance.createdAt.toISOString(),
        amount: Number(advance.amount),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employeeName: (advance as any).employee?.name ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employeeCpf: (advance as any).employee?.cpf ?? null,
      })),
      total,
    };
  });
}

// ─── generateAdvanceReceiptPdf ────────────────────────────────────────

export async function generateAdvanceReceiptPdf(
  rls: RlsContext,
  advanceId: string,
): Promise<Buffer> {
  return withRlsContext(rls, async (tx) => {
    const advance = await tx.salaryAdvance.findFirst({
      where: {
        id: advanceId,
        organizationId: rls.organizationId,
      },
      include: {
        employee: {
          select: {
            name: true,
            cpf: true,
            contracts: {
              where: { endDate: null },
              orderBy: { startDate: 'desc' },
              take: 1,
              include: {
                position: {
                  select: { name: true },
                },
              },
            },
          },
        },
        organization: {
          select: { name: true },
        },
      },
    });

    if (!advance) {
      throw new SalaryAdvanceError('Adiantamento não encontrado', 'NOT_FOUND', 404);
    }

    // ─── Build PDF ──────────────────────────────────────────────────
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgName = (advance as any).organization?.name ?? 'Organização';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeName = (advance as any).employee?.name ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeCpf = (advance as any).employee?.cpf ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionName = (advance as any).employee?.contracts?.[0]?.position?.name ?? '';
    const amount = Number(advance.amount);
    const monthLabel = formatMonthLabel(
      `${advance.referenceMonth.getFullYear()}-${String(advance.referenceMonth.getMonth() + 1).padStart(2, '0')}`,
    );
    const advanceDateStr = advance.advanceDate.toLocaleDateString('pt-BR');

    // ─── Header ────────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text(orgName, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('RECIBO DE ADIANTAMENTO SALARIAL', { align: 'center' });
    doc.moveDown(1);

    // ─── Separator ────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // ─── Employee Info ────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica');
    doc.text(`Colaborador: ${employeeName}`);
    doc.text(`CPF: ${formatCpf(employeeCpf)}`);
    if (positionName) {
      doc.text(`Cargo: ${positionName}`);
    }
    doc.moveDown(0.5);

    // ─── Advance Details ──────────────────────────────────────────
    doc.text(`Competência: ${monthLabel}`);
    doc.text(`Data do Adiantamento: ${advanceDateStr}`);
    doc.moveDown(1);

    // ─── Amount ───────────────────────────────────────────────────
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Valor do Adiantamento: ${formatCurrency(amount)}`, { align: 'center' });
    doc.moveDown(1);

    // ─── Text confirmation ────────────────────────────────────────
    doc.fontSize(10).font('Helvetica');
    doc.text(
      `Declaro que recebi a importância de ${formatCurrency(amount)} ` +
        `referente ao adiantamento salarial da competência ${monthLabel}, ` +
        `a ser descontado no próximo processamento de folha de pagamento.`,
      { align: 'justify' },
    );
    doc.moveDown(2);

    // ─── Signature Line ───────────────────────────────────────────
    doc.text('_'.repeat(50), { align: 'center' });
    doc.moveDown(0.3);
    doc.text(employeeName, { align: 'center' });
    doc.fontSize(9).text(`CPF: ${formatCpf(employeeCpf)}`, { align: 'center' });
    doc.moveDown(1);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'right' });

    doc.end();
    return pdfPromise;
  });
}
