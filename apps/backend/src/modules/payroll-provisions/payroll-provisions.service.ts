// ─── Payroll Provisions Service ──────────────────────────────────────────────
// Monthly calculation of vacation and 13th salary provisions with employer charges.
// Accounting entry stubs are stored for Phase 32 GL integration.

import Decimal from 'decimal.js';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { process as autoPost } from '../auto-posting/auto-posting.service';
import { payrollTablesService } from '../payroll-tables/payroll-tables.service';
import {
  PayrollProvisionError,
  type ProvisionCalcResult,
  type CalculateProvisionsInput,
  type CalculateProvisionsSummary,
  type ProvisionOutput,
  type ProvisionReportRow,
  type AccountingEntryStub,
} from './payroll-provisions.types';

// ─── Pure calculation (no DB) ─────────────────────────────────────────

/**
 * Calculates monthly vacation and 13th salary provisions for a single employee.
 *
 * Formulas (Brazilian CLT + FUNRURAL):
 *   Vacation provision = salary / 12 * (4/3)   [includes 1/3 constitutional bonus]
 *   13th provision     = salary / 12
 *   Charges            = provision * (0.20 INSS patronal + RAT + 0.08 FGTS)
 */
export function calculateMonthlyProvision(
  salary: Decimal,
  ratPercent: Decimal,
): ProvisionCalcResult {
  const chargeRate = new Decimal('0.20').add(ratPercent).add(new Decimal('0.08'));

  // Vacation: salary / 12 * 4/3 — using 1.333333 for the 4/3 factor
  const vacationProvision = salary
    .div(12)
    .mul(new Decimal('1.333333'))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vacationCharges = vacationProvision
    .mul(chargeRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vacationTotal = vacationProvision.add(vacationCharges);

  // 13th: salary / 12
  const thirteenthProvision = salary
    .div(12)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const thirteenthCharges = thirteenthProvision
    .mul(chargeRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const thirteenthTotal = thirteenthProvision.add(thirteenthCharges);

  return {
    vacationProvision,
    vacationCharges,
    vacationTotal,
    thirteenthProvision,
    thirteenthCharges,
    thirteenthTotal,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────


/**
 * Parse "YYYY-MM" into the first day of that month as a Date (UTC).
 */
function parseReferenceMonth(referenceMonth: string): Date {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Load EngineParams (just ratPercent for provisions) from MISC_SCALARS table.
 */
async function loadRatPercent(orgId: string, referenceDate: Date): Promise<Decimal> {
  const miscTable = await payrollTablesService.getEffective(
    orgId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'MISC_SCALARS' as any,
    referenceDate,
  );
  const scalarMap = new Map<string, Decimal>();
  for (const row of miscTable?.scalarValues ?? []) {
    scalarMap.set(row.key, new Decimal(row.value.toString()));
  }
  return scalarMap.get('RAT_PERCENT') ?? new Decimal('0.03');
}

/**
 * Build accounting entry stub for a given provision type.
 */
function buildAccountingEntry(
  provisionType: 'VACATION' | 'THIRTEENTH',
  amount: Decimal,
  referenceMonth: string,
  employeeId: string,
): AccountingEntryStub {
  if (provisionType === 'VACATION') {
    return {
      debitAccount: '6.1.01',
      debitLabel: 'Despesa com Ferias',
      creditAccount: '2.2.01',
      creditLabel: 'Provisao de Ferias a Pagar',
      amount: amount.toNumber(),
      referenceMonth,
      employeeId,
    };
  }
  return {
    debitAccount: '6.1.02',
    debitLabel: 'Despesa com 13o',
    creditAccount: '2.2.02',
    creditLabel: 'Provisao de 13o a Pagar',
    amount: amount.toNumber(),
    referenceMonth,
    employeeId,
  };
}

/**
 * Format a provision DB record into ProvisionOutput.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatProvisionOutput(p: any): ProvisionOutput {
  return {
    id: p.id,
    employeeId: p.employeeId,
    employeeName: p.employee?.name ?? '',
    referenceMonth: p.referenceMonth.toISOString().substring(0, 7),
    provisionType: p.provisionType,
    baseSalary: Number(p.baseSalary),
    provisionAmount: Number(p.provisionAmount),
    chargesAmount: Number(p.chargesAmount),
    totalAmount: Number(p.totalAmount),
    costCenterId: p.costCenterId ?? null,
    costCenterName: p.costCenter?.name ?? null,
    accountingEntryJson: p.accountingEntryJson ?? null,
    reversedAt: p.reversedAt ? p.reversedAt.toISOString() : null,
    reversedBy: p.reversedBy ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

// ─── Service functions (with DB) ──────────────────────────────────────

/**
 * Batch-calculate and persist monthly provisions for all active employees.
 * Uses per-employee transactions (isolation pattern from Phase 28 decision).
 * Returns 409 if provisions already exist for this month.
 */
export async function calculateMonthlyProvisions(
  input: CalculateProvisionsInput,
): Promise<CalculateProvisionsSummary> {
  const ctx: RlsContext = { organizationId: input.organizationId };
  const refDate = parseReferenceMonth(input.referenceMonth);

  // Check if provisions already exist for this month
  const existing = await withRlsContext(ctx, async (tx) => {
    return tx.payrollProvision.count({
      where: {
        organizationId: input.organizationId,
        referenceMonth: refDate,
      },
    });
  });

  if (existing > 0) {
    throw new PayrollProvisionError(
      `Já existem provisões calculadas para ${input.referenceMonth}`,
      'ALREADY_CALCULATED',
      409,
    );
  }

  // Load active employees
  const employees = await withRlsContext(ctx, async (tx) => {
    return tx.employee.findMany({
      where: {
        organizationId: input.organizationId,
        status: 'ATIVO',
      },
      select: {
        id: true,
        name: true,
        salaryHistory: {
          where: { effectiveAt: { lte: refDate } },
          orderBy: { effectiveAt: 'desc' },
          take: 1,
          select: { salary: true },
        },
        timesheets: {
          where: { referenceMonth: refDate },
          select: { id: true },
          take: 1,
        },
      },
    });
  });

  // Load RAT percent
  const ratPercent = await loadRatPercent(input.organizationId, refDate);

  let processedCount = 0;
  let totalVacation = new Decimal(0);
  let totalThirteenth = new Decimal(0);
  let totalCharges = new Decimal(0);

  // Per-employee transactions for isolation (Phase 28 decision)
  for (const employee of employees) {
    const salaryEntry = employee.salaryHistory?.[0];
    if (!salaryEntry) continue;

    const salary = new Decimal(salaryEntry.salary.toString());
    if (salary.isZero()) continue;

    const calc = calculateMonthlyProvision(salary, ratPercent);

    // Determine cost center from timesheet (if exists) for this reference month
    const timesheetId = employee.timesheets?.[0]?.id;
    let costCenterId: string | null = null;

    if (timesheetId) {
      // Look up time entries to find the primary cost center allocation
      const timeEntry = await withRlsContext(ctx, async (tx) => {
        return tx.timeEntry.findFirst({
          where: { timesheetId, costCenterId: { not: null } },
          select: { costCenterId: true },
          orderBy: { date: 'asc' },
        });
      });
      costCenterId = timeEntry?.costCenterId ?? null;
    }

    // Create VACATION and THIRTEENTH provision records per employee
    const { vacationId, thirteenthId } = await withRlsContext(ctx, async (tx) => {
      const vacation = await tx.payrollProvision.create({
        data: {
          organizationId: input.organizationId,
          employeeId: employee.id,
          referenceMonth: refDate,
          provisionType: 'VACATION',
          baseSalary: salary,
          provisionAmount: calc.vacationProvision,
          chargesAmount: calc.vacationCharges,
          totalAmount: calc.vacationTotal,
          costCenterId,
          accountingEntryJson: buildAccountingEntry(
            'VACATION',
            calc.vacationTotal,
            input.referenceMonth,
            employee.id,
          ),
        },
        select: { id: true },
      });

      const thirteenth = await tx.payrollProvision.create({
        data: {
          organizationId: input.organizationId,
          employeeId: employee.id,
          referenceMonth: refDate,
          provisionType: 'THIRTEENTH',
          baseSalary: salary,
          provisionAmount: calc.thirteenthProvision,
          chargesAmount: calc.thirteenthCharges,
          totalAmount: calc.thirteenthTotal,
          costCenterId,
          accountingEntryJson: buildAccountingEntry(
            'THIRTEENTH',
            calc.thirteenthTotal,
            input.referenceMonth,
            employee.id,
          ),
        },
        select: { id: true },
      });

      return { vacationId: vacation.id, thirteenthId: thirteenth.id };
    });

    // Auto-posting GL entries after provision creation (non-blocking — per D-15)
    try {
      await autoPost('PAYROLL_PROVISION_VACATION', vacationId, input.organizationId);
    } catch (err) {
      console.error('[payroll-provisions] Auto-posting vacation failed:', err);
    }
    try {
      await autoPost('PAYROLL_PROVISION_THIRTEENTH', thirteenthId, input.organizationId);
    } catch (err) {
      console.error('[payroll-provisions] Auto-posting thirteenth failed:', err);
    }

    processedCount++;
    totalVacation = totalVacation.add(calc.vacationProvision);
    totalThirteenth = totalThirteenth.add(calc.thirteenthProvision);
    totalCharges = totalCharges
      .add(calc.vacationCharges)
      .add(calc.thirteenthCharges);
  }

  return {
    processedCount,
    totalVacation: totalVacation.toDecimalPlaces(2).toNumber(),
    totalThirteenth: totalThirteenth.toDecimalPlaces(2).toNumber(),
    totalCharges: totalCharges.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Reverse a provision (sets reversedAt + reversedBy). Does NOT delete the record (audit trail).
 */
export async function reverseProvision(
  provisionId: string,
  reversedBy: string,
  ctx: RlsContext,
): Promise<ProvisionOutput> {
  return withRlsContext(ctx, async (tx) => {
    const provision = await tx.payrollProvision.findFirst({
      where: {
        id: provisionId,
        organizationId: ctx.organizationId,
      },
      select: { id: true, reversedAt: true },
    });

    if (!provision) {
      throw new PayrollProvisionError(
        'Provisão não encontrada',
        'NOT_FOUND',
        404,
      );
    }

    if (provision.reversedAt) {
      throw new PayrollProvisionError(
        'Esta provisão já foi estornada',
        'ALREADY_REVERSED',
        400,
      );
    }

    const updated = await tx.payrollProvision.update({
      where: { id: provisionId },
      data: {
        reversedAt: new Date(),
        reversedBy,
      },
      include: {
        employee: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
    });

    return formatProvisionOutput(updated);
  });
}

/**
 * List provisions for a given organization and reference month.
 */
export async function listProvisions(
  orgId: string,
  referenceMonth: string,
  ctx: RlsContext,
): Promise<ProvisionOutput[]> {
  const refDate = parseReferenceMonth(referenceMonth);

  return withRlsContext(ctx, async (tx) => {
    const records = await tx.payrollProvision.findMany({
      where: {
        organizationId: orgId,
        referenceMonth: refDate,
      },
      include: {
        employee: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
      orderBy: [{ employee: { name: 'asc' } }, { provisionType: 'asc' }],
    });

    return records.map(formatProvisionOutput);
  });
}

/**
 * Get provision report aggregated by cost center.
 * Returns totals per cost center and provision type.
 */
export async function getProvisionReport(
  orgId: string,
  referenceMonth: string,
  ctx: RlsContext,
): Promise<ProvisionReportRow[]> {
  const refDate = parseReferenceMonth(referenceMonth);

  return withRlsContext(ctx, async (tx) => {
    const records = await tx.payrollProvision.findMany({
      where: {
        organizationId: orgId,
        referenceMonth: refDate,
        reversedAt: null, // exclude reversed provisions
      },
      include: {
        costCenter: { select: { id: true, name: true } },
      },
    });

    // Aggregate by costCenterId
    const map = new Map<
      string | null,
      { costCenterName: string; vacationTotal: Decimal; thirteenthTotal: Decimal; chargesTotal: Decimal }
    >();

    for (const p of records) {
      const key = p.costCenterId ?? null;
      const name = p.costCenter?.name ?? 'Sem Centro de Custo';

      if (!map.has(key)) {
        map.set(key, {
          costCenterName: name,
          vacationTotal: new Decimal(0),
          thirteenthTotal: new Decimal(0),
          chargesTotal: new Decimal(0),
        });
      }

      const row = map.get(key)!;
      const amount = new Decimal(p.provisionAmount.toString());
      const charges = new Decimal(p.chargesAmount.toString());

      if (p.provisionType === 'VACATION') {
        row.vacationTotal = row.vacationTotal.add(amount);
      } else {
        row.thirteenthTotal = row.thirteenthTotal.add(amount);
      }
      row.chargesTotal = row.chargesTotal.add(charges);
    }

    const rows: ProvisionReportRow[] = [];
    for (const [costCenterId, data] of map) {
      const grandTotal = data.vacationTotal
        .add(data.thirteenthTotal)
        .add(data.chargesTotal);
      rows.push({
        costCenterId,
        costCenterName: data.costCenterName,
        vacationTotal: data.vacationTotal.toDecimalPlaces(2).toNumber(),
        thirteenthTotal: data.thirteenthTotal.toDecimalPlaces(2).toNumber(),
        chargesTotal: data.chargesTotal.toDecimalPlaces(2).toNumber(),
        grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
      });
    }

    return rows.sort((a, b) => (a.costCenterName ?? '').localeCompare(b.costCenterName ?? ''));
  });
}

/**
 * Export provision report as CSV.
 */
export async function exportProvisionReport(
  orgId: string,
  referenceMonth: string,
  ctx: RlsContext,
): Promise<string> {
  const rows = await getProvisionReport(orgId, referenceMonth, ctx);

  const header = 'Centro de Custo,Provisao Ferias,Provisao 13o,Encargos,Total\n';
  const lines = rows.map((r) =>
    [
      r.costCenterName,
      r.vacationTotal.toFixed(2),
      r.thirteenthTotal.toFixed(2),
      r.chargesTotal.toFixed(2),
      r.grandTotal.toFixed(2),
    ].join(','),
  );

  return header + lines.join('\n');
}
