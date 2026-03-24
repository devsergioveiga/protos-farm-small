import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  EmployeeContractError,
  CONTRACT_END_DATE_RULES,
  CONTRACT_TYPE_LABELS,
  type CreateContractInput,
  type UpdateContractInput,
  type CreateAmendmentInput,
  type ListContractsParams,
  type ContractOutput,
  type ContractDetailOutput,
} from './employee-contracts.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

function toIso(date: unknown): string {
  if (date instanceof Date) return date.toISOString();
  return String(date);
}

function mapContract(row: TxClient): ContractOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    organizationId: row.organizationId,
    positionId: row.positionId,
    workScheduleId: row.workScheduleId ?? null,
    contractType: row.contractType,
    startDate: toIso(row.startDate),
    endDate: row.endDate ? toIso(row.endDate) : null,
    salary: toNumber(row.salary),
    weeklyHours: row.weeklyHours,
    union: row.union ?? null,
    costCenterId: row.costCenterId ?? null,
    notes: row.notes ?? null,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    positionName: row.position?.name,
    workScheduleName: row.workSchedule?.name ?? null,
    amendmentsCount: row._count?.amendments ?? 0,
  };
}

function validateEndDate(input: CreateContractInput): void {
  const rule = CONTRACT_END_DATE_RULES[input.contractType];

  if (rule.forbidden && input.endDate) {
    throw new EmployeeContractError(
      `Contrato ${input.contractType} não permite data de término`,
      400,
    );
  }

  if (rule.required && !input.endDate) {
    throw new EmployeeContractError(
      `Contrato ${input.contractType} requer data de término`,
      400,
    );
  }

  if (rule.maxDays && input.endDate && input.startDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > rule.maxDays) {
      throw new EmployeeContractError(
        `Contrato ${input.contractType} não pode exceder ${rule.maxDays} dias`,
        400,
      );
    }
  }
}

export async function createContract(
  ctx: RlsContext,
  input: CreateContractInput,
): Promise<ContractOutput> {
  validateEndDate(input);

  return withRlsContext(ctx, async (tx: TxClient) => {
    // Deactivate any existing active contract for this employee
    await tx.employeeContract.updateMany({
      where: { employeeId: input.employeeId, isActive: true },
      data: { isActive: false },
    });

    const contract = await tx.employeeContract.create({
      data: {
        employeeId: input.employeeId,
        organizationId: ctx.organizationId,
        positionId: input.positionId,
        workScheduleId: input.workScheduleId ?? null,
        contractType: input.contractType,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        salary: input.salary,
        weeklyHours: input.weeklyHours ?? 44,
        union: input.union ?? null,
        costCenterId: input.costCenterId ?? null,
        notes: input.notes ?? null,
        isActive: true,
        createdBy: ctx.userId ?? 'system',
      },
      include: {
        position: { select: { name: true } },
        workSchedule: { select: { name: true } },
        _count: { select: { amendments: true } },
      },
    });

    // Create initial salary history entry
    await tx.employeeSalaryHistory.create({
      data: {
        employeeId: input.employeeId,
        salary: input.salary,
        effectiveAt: new Date(input.startDate),
        movementType: 'POSITION_CHANGE' as const,
        reason: 'Admissão / novo contrato',
      },
    });

    return mapContract(contract);
  });
}

export async function listContracts(
  ctx: RlsContext,
  params: ListContractsParams,
): Promise<{ data: ContractOutput[]; total: number; page: number; limit: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx: TxClient) => {
    const where: TxClient = {
      organizationId: ctx.organizationId,
    };

    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.contractType) where.contractType = params.contractType;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [data, total] = await Promise.all([
      tx.employeeContract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          position: { select: { name: true } },
          workSchedule: { select: { name: true } },
          _count: { select: { amendments: true } },
        },
      }),
      tx.employeeContract.count({ where }),
    ]);

    return { data: data.map(mapContract), total, page, limit };
  });
}

export async function getContract(
  ctx: RlsContext,
  contractId: string,
): Promise<ContractDetailOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const contract = await tx.employeeContract.findFirst({
      where: { id: contractId, organizationId: ctx.organizationId },
      include: {
        position: { select: { name: true } },
        workSchedule: { select: { name: true } },
        _count: { select: { amendments: true } },
        amendments: {
          orderBy: { effectiveAt: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new EmployeeContractError('Contrato não encontrado', 404);
    }

    const base = mapContract(contract);
    return {
      ...base,
      amendments: contract.amendments.map((a: TxClient) => ({
        id: a.id,
        contractId: a.contractId,
        description: a.description,
        effectiveAt: toIso(a.effectiveAt),
        changes: a.changes as Record<string, { from: unknown; to: unknown }>,
        createdBy: a.createdBy,
        createdAt: toIso(a.createdAt),
      })),
    };
  });
}

export async function updateContract(
  ctx: RlsContext,
  contractId: string,
  input: UpdateContractInput,
): Promise<ContractOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const existing = await tx.employeeContract.findFirst({
      where: { id: contractId, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new EmployeeContractError('Contrato não encontrado', 404);
    }

    const updated = await tx.employeeContract.update({
      where: { id: contractId },
      data: {
        union: input.union !== undefined ? input.union : undefined,
        costCenterId: input.costCenterId !== undefined ? input.costCenterId : undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
        weeklyHours: input.weeklyHours !== undefined ? input.weeklyHours : undefined,
      },
      include: {
        position: { select: { name: true } },
        workSchedule: { select: { name: true } },
        _count: { select: { amendments: true } },
      },
    });

    return mapContract(updated);
  });
}

export async function createAmendment(
  ctx: RlsContext,
  contractId: string,
  input: CreateAmendmentInput,
): Promise<ContractDetailOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const contract = await tx.employeeContract.findFirst({
      where: { id: contractId, organizationId: ctx.organizationId },
    });

    if (!contract) {
      throw new EmployeeContractError('Contrato não encontrado', 404);
    }

    // Create the amendment
    await tx.contractAmendment.create({
      data: {
        contractId,
        description: input.description,
        effectiveAt: new Date(input.effectiveAt),
        changes: input.changes,
        createdBy: ctx.userId ?? 'system',
      },
    });

    // If changes include salary, update contract salary and create salary history
    if (input.changes.salary) {
      const newSalary = (input.changes.salary as { from: unknown; to: number }).to;

      await tx.employeeContract.update({
        where: { id: contractId },
        data: { salary: newSalary },
      });

      await tx.employeeSalaryHistory.create({
        data: {
          employeeId: contract.employeeId,
          salary: newSalary,
          effectiveAt: new Date(input.effectiveAt),
          movementType: 'SALARY_ADJUSTMENT' as const,
          reason: input.description,
        },
      });

      await tx.employeeMovement.create({
        data: {
          employeeId: contract.employeeId,
          movementType: 'SALARY_ADJUSTMENT' as const,
          effectiveAt: new Date(input.effectiveAt),
          fromValue: String(toNumber(contract.salary)),
          toValue: String(newSalary),
          reason: input.description,
          createdBy: ctx.userId ?? 'system',
        },
      });
    }

    return getContract(ctx, contractId);
  });
}

export async function generateContractPdf(
  ctx: RlsContext,
  contractId: string,
): Promise<Buffer> {
  const contract = await getContract(ctx, contractId);

  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const typeLabel = CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType;

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').text('CONTRATO DE TRABALHO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(typeLabel, { align: 'center' });
    doc.moveDown(1);

    // ── Employee & Position ──
    doc.fontSize(11).font('Helvetica-Bold').text('DADOS DO COLABORADOR');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Cargo: ${contract.positionName ?? '—'}`);
    doc.text(`Tipo de Contrato: ${typeLabel}`);
    doc.moveDown(0.5);

    // ── Contract Details ──
    doc.fontSize(11).font('Helvetica-Bold').text('DADOS DO CONTRATO');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Data de Início: ${new Date(contract.startDate).toLocaleDateString('pt-BR')}`);
    if (contract.endDate) {
      doc.text(`Data de Término: ${new Date(contract.endDate).toLocaleDateString('pt-BR')}`);
    }
    doc.text(`Salário: R$ ${contract.salary.toFixed(2)}`);
    doc.text(`Carga Horária Semanal: ${contract.weeklyHours}h`);
    if (contract.union) doc.text(`Sindicato: ${contract.union}`);
    doc.moveDown(0.5);

    if (contract.notes) {
      doc.fontSize(11).font('Helvetica-Bold').text('OBSERVAÇÕES');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(contract.notes);
      doc.moveDown(0.5);
    }

    // ── Signature ──
    doc.moveDown(2);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width / 2 - 20, doc.y)
      .stroke();
    doc.text('Empregador', 50, doc.y + 5, { width: doc.page.width / 2 - 70 });

    doc.end();
  });
}
