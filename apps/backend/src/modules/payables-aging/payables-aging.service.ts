import { Money } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ────────────────────────────────────────────────────────────────

export interface AgingBucket {
  /** Internal bucket key */
  label: string;
  /** Human-readable label in pt-BR */
  displayLabel: string;
  /** Number of payables in this bucket */
  count: number;
  /** Total amount in BRL */
  totalAmount: number;
}

export interface PayablesAgingOutput {
  buckets: AgingBucket[];
  grandTotal: number;
  overdueCount: number;
}

export interface AgingPayableOutput {
  id: string;
  supplierName: string;
  category: string;
  totalAmount: number;
  dueDate: string;
  status: string;
  documentNumber: string | null;
  farmId: string;
  daysOverdue: number;
}

export interface PaginatedAgingPayables {
  data: AgingPayableOutput[];
  total: number;
  page: number;
  limit: number;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  count: number;
  totalAmount: number;
}

// ─── Bucket definitions ───────────────────────────────────────────────────
// Represents the 7 faixas de vencimento for CP aging
// daysOffset < 0 means past due (overdue)
// daysOffset = 0..N means due in N days ahead

const AGING_BUCKETS_DEF = [
  { label: 'vencidas', displayLabel: 'Vencidas', minDays: null as null | number, maxDays: -1 },
  { label: '7_dias', displayLabel: 'Até 7 dias', minDays: 0, maxDays: 7 },
  { label: '15_dias', displayLabel: '8 a 15 dias', minDays: 8, maxDays: 15 },
  { label: '30_dias', displayLabel: '16 a 30 dias', minDays: 16, maxDays: 30 },
  { label: '60_dias', displayLabel: '31 a 60 dias', minDays: 31, maxDays: 60 },
  { label: '90_dias', displayLabel: '61 a 90 dias', minDays: 61, maxDays: 90 },
  {
    label: 'acima_90',
    displayLabel: 'Acima de 90 dias',
    minDays: 91,
    maxDays: null as null | number,
  },
];

// ─── Helper: determine bucket for a days-until-due value ─────────────────
// daysUntilDue > 0: future (due in N days)
// daysUntilDue = 0: today
// daysUntilDue < 0: overdue (negative days)

function getBucketLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) return 'vencidas';
  if (daysUntilDue <= 7) return '7_dias';
  if (daysUntilDue <= 15) return '15_dias';
  if (daysUntilDue <= 30) return '30_dias';
  if (daysUntilDue <= 60) return '60_dias';
  if (daysUntilDue <= 90) return '90_dias';
  return 'acima_90';
}

// ─── getPayablesAging ─────────────────────────────────────────────────────

export async function getPayablesAging(
  ctx: RlsContext,
  farmId?: string,
): Promise<PayablesAgingOutput> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      organizationId: ctx.organizationId,
      status: { in: ['PENDING', 'OVERDUE'] },
    };
    if (farmId) where.farmId = farmId;

    const rows = await (tx as any).payable.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
        status: true,
      },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Initialize buckets
    const bucketMap = new Map<string, { count: number; total: ReturnType<typeof Money> }>();
    for (const def of AGING_BUCKETS_DEF) {
      bucketMap.set(def.label, { count: 0, total: Money(0) });
    }

    let grandTotal = Money(0);
    let overdueCount = 0;

    for (const row of rows) {
      const dueDate = new Date(row.dueDate as Date);
      dueDate.setUTCHours(0, 0, 0, 0);
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const amount = Money.fromPrismaDecimal(row.totalAmount);
      const bucketLabel = getBucketLabel(daysUntilDue);

      const bucket = bucketMap.get(bucketLabel)!;
      bucket.count++;
      bucket.total = bucket.total.add(amount);

      grandTotal = grandTotal.add(amount);

      if (daysUntilDue < 0) {
        overdueCount++;
      }
    }

    const buckets: AgingBucket[] = AGING_BUCKETS_DEF.map((def) => {
      const bucket = bucketMap.get(def.label)!;
      return {
        label: def.label,
        displayLabel: def.displayLabel,
        count: bucket.count,
        totalAmount: bucket.total.toNumber(),
      };
    });

    return {
      buckets,
      grandTotal: grandTotal.toNumber(),
      overdueCount,
    };
  });
}

// ─── getPayablesByBucket ──────────────────────────────────────────────────

export async function getPayablesByBucket(
  ctx: RlsContext,
  bucket: string,
  farmId?: string,
  page = 1,
  limit = 20,
): Promise<PaginatedAgingPayables> {
  // Validate bucket name
  const validBuckets = AGING_BUCKETS_DEF.map((b) => b.label);
  if (!validBuckets.includes(bucket)) {
    throw new Error(`Faixa de aging inválida: ${bucket}`);
  }

  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      organizationId: ctx.organizationId,
      status: { in: ['PENDING', 'OVERDUE'] },
    };
    if (farmId) where.farmId = farmId;

    const rows = await (tx as any).payable.findMany({
      where,
      select: {
        id: true,
        supplierName: true,
        category: true,
        totalAmount: true,
        dueDate: true,
        status: true,
        documentNumber: true,
        farmId: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Filter in application layer to match the bucket
    const bucketRows = rows.filter((row: any) => {
      const dueDate = new Date(row.dueDate as Date);
      dueDate.setUTCHours(0, 0, 0, 0);
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return getBucketLabel(daysUntilDue) === bucket;
    });

    const total = bucketRows.length;
    const skip = (page - 1) * limit;
    const paged = bucketRows.slice(skip, skip + limit);

    const data: AgingPayableOutput[] = paged.map((row: any) => {
      const dueDate = new Date(row.dueDate as Date);
      dueDate.setUTCHours(0, 0, 0, 0);
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

      return {
        id: row.id as string,
        supplierName: row.supplierName as string,
        category: row.category as string,
        totalAmount: Money.fromPrismaDecimal(row.totalAmount).toNumber(),
        dueDate: (row.dueDate as Date).toISOString(),
        status: row.status as string,
        documentNumber: (row.documentNumber as string) ?? null,
        farmId: row.farmId as string,
        daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0,
      };
    });

    return { data, total, page, limit };
  });
}

// ─── getOverdueCount ──────────────────────────────────────────────────────

export async function getOverdueCount(ctx: RlsContext): Promise<number> {
  return withRlsContext(ctx, async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const count = await (tx as any).payable.count({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: today },
      },
    });

    return count as number;
  });
}

// ─── getFinancialCalendar ─────────────────────────────────────────────────

export async function getFinancialCalendar(
  ctx: RlsContext,
  year: number,
  month: number,
  farmId?: string,
): Promise<CalendarDay[]> {
  return withRlsContext(ctx, async (tx) => {
    // Build date range for the requested month (UTC)
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // last day of month

    const where: any = {
      organizationId: ctx.organizationId,
      status: { in: ['PENDING', 'OVERDUE', 'PAID'] }, // include all for calendar view
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (farmId) where.farmId = farmId;

    const rows = await (tx as any).payable.findMany({
      where,
      select: {
        dueDate: true,
        totalAmount: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Group by date (YYYY-MM-DD)
    const dayMap = new Map<string, { count: number; total: ReturnType<typeof Money> }>();

    for (const row of rows) {
      const dueDate = row.dueDate as Date;
      const dateKey = new Date(dueDate).toISOString().slice(0, 10); // YYYY-MM-DD

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { count: 0, total: Money(0) });
      }
      const day = dayMap.get(dateKey)!;
      day.count++;
      day.total = day.total.add(Money.fromPrismaDecimal(row.totalAmount));
    }

    const result: CalendarDay[] = [];
    for (const [date, day] of dayMap) {
      result.push({
        date,
        count: day.count,
        totalAmount: day.total.toNumber(),
      });
    }

    // Sort by date
    result.sort((a, b) => a.date.localeCompare(b.date));

    return result;
  });
}
