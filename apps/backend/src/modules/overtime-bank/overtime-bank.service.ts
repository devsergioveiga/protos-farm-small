import { withRlsContext, type RlsContext } from '../../database/rls';
import type {
  CreateOvertimeBankInput,
  OvertimeBankQuery,
  OvertimeBankOutput,
  OvertimeBankSummary,
} from './overtime-bank.types';
import { TimeEntryError } from '../time-entries/time-entries.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatEntry(row: {
  id: string;
  employeeId: string;
  employee: { name: string };
  referenceMonth: Date;
  minutes: number;
  balanceType: string;
  description: string | null;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
}): OvertimeBankOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    referenceMonth: row.referenceMonth.toISOString().split('T')[0],
    minutes: row.minutes,
    balanceType: row.balanceType as OvertimeBankOutput['balanceType'],
    description: row.description,
    expiresAt: row.expiresAt.toISOString().split('T')[0],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

const ENTRY_SELECT = {
  id: true,
  employeeId: true,
  employee: { select: { name: true } },
  referenceMonth: true,
  minutes: true,
  balanceType: true,
  description: true,
  expiresAt: true,
  createdBy: true,
  createdAt: true,
} as const;

// ─── getOvertimeBankSummary ───────────────────────────────────────────

export async function getOvertimeBankSummary(
  ctx: RlsContext,
  orgId: string,
  employeeId: string,
): Promise<OvertimeBankSummary> {
  return withRlsContext(ctx, async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!employee || employee.organizationId !== orgId) {
      throw new TimeEntryError('Colaborador não encontrado nesta organização', 404);
    }

    const entries = await tx.overtimeBankEntry.findMany({
      where: { employeeId, organizationId: orgId },
      select: ENTRY_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let totalCredits = 0;
    let totalCompensations = 0;
    let totalExpirations = 0;
    let expiringIn30Days = 0;
    let expiringIn7Days = 0;

    for (const e of entries) {
      if (e.balanceType === 'CREDIT') {
        totalCredits += e.minutes;
        if (e.expiresAt <= in30Days) {
          expiringIn30Days += e.minutes;
        }
        if (e.expiresAt <= in7Days) {
          expiringIn7Days += e.minutes;
        }
      } else if (e.balanceType === 'COMPENSATION') {
        totalCompensations += e.minutes;
      } else if (e.balanceType === 'EXPIRATION') {
        totalExpirations += e.minutes;
      }
    }

    const currentBalance = totalCredits - totalCompensations - totalExpirations;

    return {
      employeeId,
      employeeName: employee.name,
      totalCredits,
      totalCompensations,
      totalExpirations,
      currentBalance,
      expiringIn30Days,
      expiringIn7Days,
      entries: entries.map((e) => formatEntry(e as Parameters<typeof formatEntry>[0])),
    };
  });
}

// ─── listOvertimeBankEntries ──────────────────────────────────────────

export async function listOvertimeBankEntries(
  ctx: RlsContext,
  orgId: string,
  query: OvertimeBankQuery,
): Promise<{ data: OvertimeBankOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.expiringBefore) {
    where.expiresAt = { lte: new Date(query.expiringBefore) };
  }

  return withRlsContext(ctx, async (tx) => {
    const [entries, total] = await Promise.all([
      tx.overtimeBankEntry.findMany({
        where,
        select: ENTRY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.overtimeBankEntry.count({ where }),
    ]);

    return {
      data: entries.map((e) => formatEntry(e as Parameters<typeof formatEntry>[0])),
      total,
      page,
      limit,
    };
  });
}

// ─── createOvertimeBankEntry ──────────────────────────────────────────

export async function createOvertimeBankEntry(
  ctx: RlsContext,
  orgId: string,
  input: CreateOvertimeBankInput,
): Promise<OvertimeBankOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Validate employee belongs to org
    const employee = await tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, organizationId: true },
    });

    if (!employee || employee.organizationId !== orgId) {
      throw new TimeEntryError('Colaborador não encontrado nesta organização', 404);
    }

    const referenceMonth = new Date(input.referenceMonth);
    // expiresAt = referenceMonth + 6 months if not provided
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 6, 1);

    const entry = await tx.overtimeBankEntry.create({
      data: {
        organizationId: orgId,
        employeeId: input.employeeId,
        referenceMonth,
        minutes: input.minutes,
        balanceType: input.balanceType,
        description: input.description,
        expiresAt,
        timesheetId: input.timesheetId,
        createdBy: ctx.userId ?? 'system',
      },
      select: ENTRY_SELECT,
    });

    return formatEntry(entry as Parameters<typeof formatEntry>[0]);
  });
}
