import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import type {
  CreateAbsenceInput,
  UpdateAbsenceInput,
  RegisterReturnInput,
  AbsencePayrollImpact,
  AbsenceOutput,
  ListAbsenceFilters,
} from './employee-absences.types';
import { AbsenceError } from './employee-absences.types';

// ─── Type Defaults ────────────────────────────────────────────────────

/**
 * Absence payroll impact matrix (RESEARCH.md Pattern 3):
 * AbsenceType        | Company pays | INSS | FGTS | Stability
 * --------------------|-------------|------|------|----------
 * MEDICAL_CERTIFICATE | Days 1-15   | Yes  | Yes  | No
 * INSS_LEAVE          | 0 (from day 16) | No | Yes | No
 * WORK_ACCIDENT       | Days 1-15   | No   | Yes  | 12 months post-return
 * MATERNITY           | All 120 days | No  | Yes  | From conception + 60 days post-return
 * PATERNITY           | 5 days      | Yes  | Yes  | No
 * MARRIAGE            | 3 days      | Yes  | Yes  | No
 * BEREAVEMENT         | 2 days      | Yes  | Yes  | No
 */

interface AbsenceDefaults {
  totalDays?: number;
  asoRequired: boolean;
  fgtsFullMonth: boolean;
}

const ABSENCE_DEFAULTS: Record<string, AbsenceDefaults> = {
  MEDICAL_CERTIFICATE: { asoRequired: false, fgtsFullMonth: true },
  INSS_LEAVE: { asoRequired: true, fgtsFullMonth: true },
  WORK_ACCIDENT: { asoRequired: true, fgtsFullMonth: true },
  MATERNITY: { totalDays: 120, asoRequired: false, fgtsFullMonth: true },
  PATERNITY: { totalDays: 5, asoRequired: false, fgtsFullMonth: false },
  MARRIAGE: { totalDays: 3, asoRequired: false, fgtsFullMonth: false },
  BEREAVEMENT: { totalDays: 2, asoRequired: false, fgtsFullMonth: false },
  MILITARY: { asoRequired: false, fgtsFullMonth: false },
  OTHER: { asoRequired: false, fgtsFullMonth: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function diffDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1; // inclusive
}

/**
 * Computes payrollImpact JSON for an absence (RESEARCH.md Pattern 3).
 */
function computePayrollImpact(
  absenceType: string,
  totalDays: number | null,
  _fgtsFullMonth: boolean,
): AbsencePayrollImpact {
  switch (absenceType) {
    case 'MEDICAL_CERTIFICATE': {
      const companyDays = Math.min(totalDays ?? 0, 15);
      const inssDays = Math.max((totalDays ?? 0) - 15, 0);
      return {
        companyPaidDays: companyDays,
        inssPaidDays: inssDays,
        suspendedDays: 0,
        fgtsFullMonth: true,
      };
    }
    case 'INSS_LEAVE':
      return {
        companyPaidDays: 15, // first 15 days company pays (medical cert → INSS)
        inssPaidDays: totalDays ? Math.max(totalDays - 15, 0) : 0,
        suspendedDays: 0,
        fgtsFullMonth: true,
      };
    case 'WORK_ACCIDENT':
      return {
        companyPaidDays: 15,
        inssPaidDays: totalDays ? Math.max(totalDays - 15, 0) : 0,
        suspendedDays: 0,
        fgtsFullMonth: true,
      };
    case 'MATERNITY':
      return {
        companyPaidDays: 120, // company pays, INSS reimburses
        inssPaidDays: 0,
        suspendedDays: 0,
        fgtsFullMonth: true,
      };
    case 'PATERNITY':
      return {
        companyPaidDays: 5,
        inssPaidDays: 0,
        suspendedDays: 0,
        fgtsFullMonth: false,
      };
    case 'MARRIAGE':
      return {
        companyPaidDays: 3,
        inssPaidDays: 0,
        suspendedDays: 0,
        fgtsFullMonth: false,
      };
    case 'BEREAVEMENT':
      return {
        companyPaidDays: 2,
        inssPaidDays: 0,
        suspendedDays: 0,
        fgtsFullMonth: false,
      };
    default:
      return {
        companyPaidDays: 0,
        inssPaidDays: 0,
        suspendedDays: totalDays ?? 0,
        fgtsFullMonth: false,
      };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToOutput(absence: any): AbsenceOutput {
  return {
    id: absence.id,
    organizationId: absence.organizationId,
    employeeId: absence.employeeId,
    employeeName: absence.employee?.name ?? '',
    absenceType: absence.absenceType,
    startDate: absence.startDate,
    endDate: absence.endDate ?? null,
    totalDays: absence.totalDays ?? null,
    catNumber: absence.catNumber ?? null,
    inssStartDate: absence.inssStartDate ?? null,
    stabilityEndsAt: absence.stabilityEndsAt ?? null,
    returnDate: absence.returnDate ?? null,
    asoRequired: absence.asoRequired,
    asoDocumentId: absence.asoDocumentId ?? null,
    payrollImpact: absence.payrollImpact ? JSON.parse(absence.payrollImpact) : null,
    notes: absence.notes ?? null,
    createdBy: absence.createdBy,
    createdAt: absence.createdAt,
  };
}

// ─── Create Absence ──────────────────────────────────────────────────

export async function createAbsence(
  input: CreateAbsenceInput,
  ctx: RlsContext,
): Promise<AbsenceOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Validate WORK_ACCIDENT requires catNumber
    if (input.absenceType === 'WORK_ACCIDENT' && !input.catNumber) {
      throw new AbsenceError(
        'Número da CAT é obrigatório para acidentes de trabalho',
        422,
        'CAT_REQUIRED',
      );
    }

    const startDateObj = new Date(input.startDate);
    const defaults = ABSENCE_DEFAULTS[input.absenceType] ?? ABSENCE_DEFAULTS['OTHER'];

    // Check for overlapping absence (same employee)
    const overlap = await tx.employeeAbsence.findFirst({
      where: {
        employeeId: input.employeeId,
        returnDate: null, // open absences
      },
    });
    if (overlap) {
      throw new AbsenceError(
        'Colaborador já possui um afastamento em aberto. Registre o retorno antes de criar um novo.',
        409,
        'OVERLAPPING_ABSENCE',
      );
    }

    // Compute type-specific fields
    let endDateObj: Date | null = input.endDate ? new Date(input.endDate) : null;
    let totalDays: number | null = null;
    let inssStartDate: Date | null = null;

    switch (input.absenceType) {
      case 'MATERNITY':
        totalDays = 120;
        endDateObj = addDays(startDateObj, 119); // 120 days inclusive
        break;
      case 'PATERNITY':
        totalDays = 5;
        endDateObj = addDays(startDateObj, 4);
        break;
      case 'MARRIAGE':
        totalDays = 3;
        endDateObj = addDays(startDateObj, 2);
        break;
      case 'BEREAVEMENT':
        totalDays = 2;
        endDateObj = addDays(startDateObj, 1);
        break;
      case 'MEDICAL_CERTIFICATE':
        if (endDateObj) {
          totalDays = diffDays(startDateObj, endDateObj);
        }
        break;
      case 'INSS_LEAVE':
        // Day 16+ is INSS-paid; endDate is open-ended
        inssStartDate = addDays(startDateObj, 15);
        endDateObj = null; // open-ended until return
        if (input.endDate) {
          endDateObj = new Date(input.endDate);
          totalDays = diffDays(startDateObj, endDateObj);
        }
        break;
      case 'WORK_ACCIDENT':
        // endDate open-ended until return; stability set on return
        if (endDateObj) {
          totalDays = diffDays(startDateObj, endDateObj);
        }
        break;
      default:
        if (endDateObj) {
          totalDays = diffDays(startDateObj, endDateObj);
        }
    }

    const payrollImpact = computePayrollImpact(input.absenceType, totalDays, defaults.fgtsFullMonth);

    // Validate employee exists in org
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, organizationId: input.organizationId },
      select: { id: true, status: true },
    });
    if (!employee) {
      throw new AbsenceError('Colaborador não encontrado', 404);
    }

    // Transition employee status to AFASTADO
    const [absence] = await Promise.all([
      tx.employeeAbsence.create({
        data: {
          organizationId: input.organizationId,
          employeeId: input.employeeId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          absenceType: input.absenceType as any,
          startDate: startDateObj,
          endDate: endDateObj,
          totalDays,
          catNumber: input.catNumber ?? null,
          inssStartDate,
          stabilityEndsAt: null, // Set on return for WORK_ACCIDENT
          returnDate: null,
          asoRequired: defaults.asoRequired,
          asoDocumentId: null,
          payrollImpact: JSON.stringify(payrollImpact),
          notes: input.notes ?? null,
          createdBy: input.createdBy,
        },
        include: {
          employee: { select: { name: true } },
        },
      }),
      tx.employee.update({
        where: { id: input.employeeId },
        data: { status: 'AFASTADO' },
      }),
      tx.employeeStatusHistory.create({
        data: {
          employeeId: input.employeeId,
          fromStatus: employee.status,
          toStatus: 'AFASTADO',
          reason: `Afastamento: ${input.absenceType}`,
          changedBy: input.createdBy,
        },
      }),
    ]);

    return mapToOutput(absence);
  });
}

// ─── Register Return ─────────────────────────────────────────────────

export async function registerReturn(
  absenceId: string,
  input: RegisterReturnInput,
  ctx: RlsContext,
): Promise<AbsenceOutput> {
  return withRlsContext(ctx, async (tx) => {
    const absence = await tx.employeeAbsence.findFirst({
      where: { id: absenceId, organizationId: ctx.organizationId },
      include: { employee: { select: { name: true, status: true } } },
    });
    if (!absence) {
      throw new AbsenceError('Afastamento não encontrado', 404);
    }
    if (absence.returnDate) {
      throw new AbsenceError('Retorno já registrado para este afastamento', 400);
    }

    const returnDateObj = new Date(input.returnDate);
    let stabilityEndsAt: Date | null = null;

    // WORK_ACCIDENT: stability = 12 months post-return (CLT Art. 118)
    if (absence.absenceType === 'WORK_ACCIDENT') {
      stabilityEndsAt = addMonths(returnDateObj, 12);
    }

    // Recompute totalDays if endDate was open
    let totalDays = absence.totalDays;
    if (!absence.endDate) {
      totalDays = diffDays(absence.startDate, returnDateObj);
    }

    const [updated] = await Promise.all([
      tx.employeeAbsence.update({
        where: { id: absenceId },
        data: {
          returnDate: returnDateObj,
          endDate: absence.endDate ?? returnDateObj,
          totalDays,
          stabilityEndsAt,
        },
        include: { employee: { select: { name: true } } },
      }),
      tx.employee.update({
        where: { id: absence.employeeId },
        data: { status: 'ATIVO' },
      }),
      tx.employeeStatusHistory.create({
        data: {
          employeeId: absence.employeeId,
          fromStatus: 'AFASTADO',
          toStatus: 'ATIVO',
          reason: `Retorno de afastamento: ${absence.absenceType}`,
          changedBy: ctx.userId ?? 'system',
        },
      }),
    ]);

    return mapToOutput(updated);
  });
}

// ─── Get Absence Impact for Month ────────────────────────────────────

/**
 * Returns per-type impact for absences overlapping with a reference month.
 * Used by payroll engine to compute pro-rata deductions.
 */
export async function getAbsenceImpactForMonth(
  employeeId: string,
  referenceMonth: Date,
  tx: TxClient,
): Promise<AbsencePayrollImpact> {
  // Reference month boundaries
  const monthStart = new Date(
    Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() + 1, 0),
  );

  const absences = await tx.employeeAbsence.findMany({
    where: {
      employeeId,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
  });

  if (absences.length === 0) {
    return {
      companyPaidDays: 0,
      inssPaidDays: 0,
      suspendedDays: 0,
      fgtsFullMonth: false,
    };
  }

  // Aggregate across all overlapping absences for the month
  let companyPaidDays = 0;
  let inssPaidDays = 0;
  let suspendedDays = 0;
  let fgtsFullMonth = false;

  for (const absence of absences) {
    const absStart = absence.startDate > monthStart ? absence.startDate : monthStart;
    const absEnd =
      absence.endDate && absence.endDate < monthEnd ? absence.endDate : monthEnd;

    const daysInMonth = diffDays(absStart, absEnd);
    const impact = computePayrollImpact(absence.absenceType, daysInMonth, false);

    companyPaidDays += impact.companyPaidDays;
    inssPaidDays += impact.inssPaidDays;
    suspendedDays += impact.suspendedDays;
    if (
      absence.absenceType === 'WORK_ACCIDENT' ||
      absence.absenceType === 'INSS_LEAVE' ||
      absence.absenceType === 'MATERNITY'
    ) {
      fgtsFullMonth = true;
    }
  }

  return { companyPaidDays, inssPaidDays, suspendedDays, fgtsFullMonth };
}

// ─── List Absences ────────────────────────────────────────────────────

export async function listAbsences(
  orgId: string,
  filters: ListAbsenceFilters,
  ctx: RlsContext,
): Promise<AbsenceOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.absenceType) where.absenceType = filters.absenceType;
    if (filters.from || filters.to) {
      where.startDate = {};
      if (filters.from) where.startDate.gte = new Date(filters.from);
      if (filters.to) where.startDate.lte = new Date(filters.to);
    }

    const absences = await tx.employeeAbsence.findMany({
      where,
      include: { employee: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    });

    return absences.map(mapToOutput);
  });
}

// ─── Get Absence By ID ────────────────────────────────────────────────

export async function getAbsenceById(
  absenceId: string,
  orgId: string,
  ctx: RlsContext,
): Promise<AbsenceOutput> {
  return withRlsContext(ctx, async (tx) => {
    const absence = await tx.employeeAbsence.findFirst({
      where: { id: absenceId, organizationId: orgId },
      include: { employee: { select: { name: true } } },
    });
    if (!absence) {
      throw new AbsenceError('Afastamento não encontrado', 404);
    }
    return mapToOutput(absence);
  });
}

// ─── Update Absence ───────────────────────────────────────────────────

export async function updateAbsence(
  absenceId: string,
  updates: UpdateAbsenceInput,
  ctx: RlsContext,
): Promise<AbsenceOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.employeeAbsence.findFirst({
      where: { id: absenceId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new AbsenceError('Afastamento não encontrado', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.endDate !== undefined) {
      // Only allow updating endDate for open-ended absences
      if (existing.endDate && existing.absenceType !== 'INSS_LEAVE') {
        throw new AbsenceError(
          'Data de término só pode ser atualizada em afastamentos em aberto',
          400,
        );
      }
      data.endDate = new Date(updates.endDate);
    }

    const updated = await tx.employeeAbsence.update({
      where: { id: absenceId },
      data,
      include: { employee: { select: { name: true } } },
    });
    return mapToOutput(updated);
  });
}
