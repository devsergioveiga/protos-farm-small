import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import {
  EmployeeMovementError,
  type CreateMovementInput,
  type BulkSalaryAdjustmentInput,
  type BulkSalaryAdjustmentResult,
  type ListMovementsParams,
  type MovementOutput,
  type TimelineEntry,
} from './employee-movements.types';

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

function mapMovement(row: TxClient): MovementOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name,
    movementType: row.movementType,
    effectiveAt: toIso(row.effectiveAt),
    fromValue: row.fromValue ?? null,
    toValue: row.toValue ?? null,
    reason: row.reason,
    approvedBy: row.approvedBy ?? null,
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt),
  };
}

export async function createMovement(
  ctx: RlsContext,
  input: CreateMovementInput,
): Promise<MovementOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    // Create EmployeeMovement and optionally EmployeeSalaryHistory — always in same transaction
    const movement = await tx.employeeMovement.create({
      data: {
        employeeId: input.employeeId,
        movementType: input.movementType,
        effectiveAt: new Date(input.effectiveAt),
        fromValue: input.fromValue ?? null,
        toValue: input.toValue ?? null,
        reason: input.reason,
        approvedBy: input.approvedBy ?? null,
        createdBy: ctx.userId ?? 'system',
      },
      include: {
        employee: { select: { name: true } },
      },
    });

    // For SALARY_ADJUSTMENT and PROMOTION with salary in toValue, create EmployeeSalaryHistory
    if (
      (input.movementType === 'SALARY_ADJUSTMENT' || input.movementType === 'PROMOTION') &&
      input.toValue
    ) {
      let salary: number | null = null;
      try {
        const parsed = JSON.parse(input.toValue) as Record<string, unknown>;
        if (typeof parsed.salary === 'number') {
          salary = parsed.salary;
        } else if (typeof parsed === 'number') {
          salary = parsed;
        }
      } catch {
        // toValue might be a plain number string
        const n = Number(input.toValue);
        if (!isNaN(n)) salary = n;
      }

      if (salary !== null) {
        await tx.employeeSalaryHistory.create({
          data: {
            employeeId: input.employeeId,
            salary,
            effectiveAt: new Date(input.effectiveAt),
            movementType: input.movementType,
            reason: input.reason,
          },
        });

        // Update the active contract salary if SALARY_ADJUSTMENT
        if (input.movementType === 'SALARY_ADJUSTMENT') {
          await tx.employeeContract.updateMany({
            where: { employeeId: input.employeeId, isActive: true },
            data: { salary },
          });
        }
      }
    }

    return mapMovement(movement);
  });
}

export async function listMovements(
  ctx: RlsContext,
  params: ListMovementsParams,
): Promise<{ data: MovementOutput[]; total: number; page: number; limit: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx: TxClient) => {
    const where: TxClient = {
      employee: { organizationId: ctx.organizationId },
    };

    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.movementType) where.movementType = params.movementType;

    const [data, total] = await Promise.all([
      tx.employeeMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveAt: 'desc' },
        include: {
          employee: { select: { name: true } },
        },
      }),
      tx.employeeMovement.count({ where }),
    ]);

    return { data: data.map(mapMovement), total, page, limit };
  });
}

export async function getTimeline(
  ctx: RlsContext,
  employeeId: string,
): Promise<TimelineEntry[]> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
    });

    if (!employee) {
      throw new EmployeeMovementError('Colaborador não encontrado', 404);
    }

    const [movements, statusHistory] = await Promise.all([
      tx.employeeMovement.findMany({
        where: { employeeId },
        orderBy: { effectiveAt: 'desc' },
      }),
      tx.employeeStatusHistory.findMany({
        where: { employeeId },
        orderBy: { effectiveAt: 'desc' },
      }),
    ]);

    const movementEntries: TimelineEntry[] = movements.map((m: TxClient) => ({
      type: 'movement' as const,
      date: toIso(m.effectiveAt),
      movementType: m.movementType,
      reason: m.reason,
      fromValue: m.fromValue ?? null,
      toValue: m.toValue ?? null,
    }));

    const statusEntries: TimelineEntry[] = statusHistory.map((s: TxClient) => ({
      type: 'status' as const,
      date: toIso(s.effectiveAt),
      fromStatus: s.fromStatus,
      toStatus: s.toStatus,
      reason: s.reason,
    }));

    // Merge and sort by date desc
    const allEntries = [...movementEntries, ...statusEntries];
    allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allEntries;
  });
}

export async function bulkSalaryAdjustment(
  ctx: RlsContext,
  input: BulkSalaryAdjustmentInput,
): Promise<BulkSalaryAdjustmentResult> {
  if (!input.percentage && !input.fixedAmount) {
    throw new EmployeeMovementError('Informe percentage ou fixedAmount para o reajuste', 400);
  }

  // Find all ATIVO employees matching filters
  const employeeFarmWhere: TxClient = {
    endDate: null,
    employee: { organizationId: ctx.organizationId, status: 'ATIVO' },
  };

  if (input.positionId) employeeFarmWhere.positionId = input.positionId;
  if (input.farmId) employeeFarmWhere.farmId = input.farmId;

  const employeeFarms = await prisma.employeeFarm.findMany({
    where: employeeFarmWhere,
    select: {
      employee: {
        select: {
          id: true,
          contracts: {
            where: { isActive: true },
            select: { id: true, salary: true },
            take: 1,
          },
        },
      },
    },
  });

  // Get unique employees with active contracts
  const employeesWithContracts = employeeFarms
    .map((ef: TxClient) => ef.employee)
    .filter((emp: TxClient, idx: number, arr: TxClient[]) =>
      arr.findIndex((e: TxClient) => e.id === emp.id) === idx,
    )
    .filter((emp: TxClient) => emp.contracts.length > 0);

  if (employeesWithContracts.length === 0) {
    return { updated: 0, errors: [] };
  }

  const errors: string[] = [];
  let updated = 0;

  // Single transaction for all updates (Pitfall 3)
  await prisma.$transaction(async (tx: TxClient) => {
    for (const employee of employeesWithContracts) {
      const contract = employee.contracts[0];
      const oldSalary = toNumber(contract.salary);

      let newSalary: number;
      if (input.percentage !== undefined) {
        newSalary = oldSalary * (1 + input.percentage / 100);
      } else {
        newSalary = oldSalary + (input.fixedAmount ?? 0);
      }

      // Round to 2 decimal places
      newSalary = Math.round(newSalary * 100) / 100;

      try {
        // Update contract salary
        await tx.employeeContract.update({
          where: { id: contract.id },
          data: { salary: newSalary },
        });

        // Create EmployeeMovement
        await tx.employeeMovement.create({
          data: {
            employeeId: employee.id,
            movementType: 'SALARY_ADJUSTMENT' as const,
            effectiveAt: new Date(input.effectiveAt),
            fromValue: String(oldSalary),
            toValue: String(newSalary),
            reason: input.reason,
            createdBy: ctx.userId ?? 'system',
          },
        });

        // Create EmployeeSalaryHistory — ALWAYS in same transaction (Pitfall 2)
        await tx.employeeSalaryHistory.create({
          data: {
            employeeId: employee.id,
            salary: newSalary,
            effectiveAt: new Date(input.effectiveAt),
            movementType: 'SALARY_ADJUSTMENT' as const,
            reason: input.reason,
          },
        });

        updated++;
      } catch (err) {
        errors.push(
          `Erro ao reajustar colaborador ${employee.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });

  return { updated, errors };
}
