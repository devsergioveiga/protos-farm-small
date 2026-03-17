import { Money } from '@protos-farm/shared';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { PAYABLE_CATEGORY_LABELS } from '../payables/payables.types';
import { getNegativeBalanceAlert } from '../cashflow/cashflow.service';
import {
  type FinancialDashboardQuery,
  type FinancialDashboardOutput,
} from './financial-dashboard.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── getNegativeBalanceAlertForDashboard ──────────────────────────────

export async function getNegativeBalanceAlertForDashboard(
  ctx: RlsContext,
  farmId?: string,
): Promise<{ negativeBalanceDate: string; negativeBalanceAmount: number } | null> {
  const result = await getNegativeBalanceAlert(ctx, farmId);
  if (result === null) return null;
  return {
    negativeBalanceDate: result.date,
    negativeBalanceAmount: result.amount,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function monthBoundaries(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function zeroPad(n: number): string {
  return n.toString().padStart(2, '0');
}

// ─── getFinancialDashboard ────────────────────────────────────────────

export async function getFinancialDashboard(
  ctx: RlsContext,
  query: FinancialDashboardQuery,
): Promise<FinancialDashboardOutput> {
  const { farmId, year, month } = query;

  const today = new Date();
  // Normalize today to start of day UTC
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const in30Days = new Date(todayUtc.getTime() + 30 * 86400000);

  const { start: monthStart, end: monthEnd } = monthBoundaries(year, month);

  const prevYear = year - 1;
  const { start: prevMonthStart, end: prevMonthEnd } = monthBoundaries(prevYear, month);
  const prevIn30Days = new Date(todayUtc.getTime() - 365 * 86400000 + 30 * 86400000);
  const prevTodayUtc = new Date(todayUtc.getTime() - 365 * 86400000);

  return withRlsContext(ctx, async (tx) => {
    // ── KPI 1: totalBankBalance ──────────────────────────────────────
    // CRITICAL: only from BankAccountBalance.currentBalance, never add pending CP/CR

    const bankAccountWhere: any = {
      organizationId: ctx.organizationId,
      isActive: true,
    };
    if (farmId) {
      bankAccountWhere.farms = { some: { farmId } };
    }

    const activeAccounts = await (tx as any).bankAccount.findMany({
      where: bankAccountWhere,
      include: { balance: true },
    });

    let totalBankBalance = Money(0);
    for (const acc of activeAccounts) {
      const cur = Money.fromPrismaDecimal(acc.balance?.currentBalance ?? 0);
      totalBankBalance = totalBankBalance.add(cur);
    }

    // prevYear totalBankBalance: return null (we don't have historical balance snapshots)
    const totalBankBalancePrevYear: number | null = null;

    // ── KPI 2: payablesDue30d ────────────────────────────────────────

    const payableInstallmentWhere: any = {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { gte: todayUtc, lte: in30Days },
    };
    if (farmId) {
      payableInstallmentWhere.payable = { farmId };
    }
    // Add org filter via payable relation
    payableInstallmentWhere.payable = {
      ...(payableInstallmentWhere.payable ?? {}),
      organizationId: ctx.organizationId,
    };

    const due30dInstallments = await (tx as any).payableInstallment.findMany({
      where: payableInstallmentWhere,
      select: { amount: true },
    });

    let payablesDue30d = Money(0);
    for (const inst of due30dInstallments) {
      payablesDue30d = payablesDue30d.add(Money.fromPrismaDecimal(inst.amount));
    }

    // prevYear payablesDue30d
    const prevPayableInstallmentWhere: any = {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { gte: prevTodayUtc, lte: prevIn30Days },
      payable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };
    const prevDue30dInstallments = await (tx as any).payableInstallment.findMany({
      where: prevPayableInstallmentWhere,
      select: { amount: true },
    });
    const payablesDue30dPrevYear: number | null =
      prevDue30dInstallments.length === 0
        ? null
        : prevDue30dInstallments
            .reduce(
              (acc: any, inst: any) => acc.add(Money.fromPrismaDecimal(inst.amount)),
              Money(0),
            )
            .toNumber();

    // ── KPI 3: receivablesDue30d ─────────────────────────────────────

    const receivableInstallmentWhere: any = {
      status: 'PENDING',
      dueDate: { gte: todayUtc, lte: in30Days },
      receivable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };

    const receivableDue30dInstallments = await (tx as any).receivableInstallment.findMany({
      where: receivableInstallmentWhere,
      select: { amount: true },
    });

    let receivablesDue30d = Money(0);
    for (const inst of receivableDue30dInstallments) {
      receivablesDue30d = receivablesDue30d.add(Money.fromPrismaDecimal(inst.amount));
    }

    // prevYear receivablesDue30d
    const prevReceivableInstallmentWhere: any = {
      status: 'PENDING',
      dueDate: { gte: prevTodayUtc, lte: prevIn30Days },
      receivable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };
    const prevReceivableDue30dInstallments = await (tx as any).receivableInstallment.findMany({
      where: prevReceivableInstallmentWhere,
      select: { amount: true },
    });
    const receivablesDue30dPrevYear: number | null =
      prevReceivableDue30dInstallments.length === 0
        ? null
        : prevReceivableDue30dInstallments
            .reduce(
              (acc: any, inst: any) => acc.add(Money.fromPrismaDecimal(inst.amount)),
              Money(0),
            )
            .toNumber();

    // ── KPI 4: monthResult ───────────────────────────────────────────
    // settled CR in month - settled CP in month

    const paidInstallmentsWhere: any = {
      status: 'PAID',
      paidAt: { gte: monthStart, lt: monthEnd },
      payable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };
    const paidInstallments = await (tx as any).payableInstallment.findMany({
      where: paidInstallmentsWhere,
      select: { amountPaid: true, amount: true },
    });

    let totalPaidInMonth = Money(0);
    for (const inst of paidInstallments) {
      const paid =
        inst.amountPaid != null
          ? Money.fromPrismaDecimal(inst.amountPaid)
          : Money.fromPrismaDecimal(inst.amount);
      totalPaidInMonth = totalPaidInMonth.add(paid);
    }

    const receivedInstallmentsWhere: any = {
      status: 'RECEIVED',
      receivedAt: { gte: monthStart, lt: monthEnd },
      receivable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };
    const receivedInstallments = await (tx as any).receivableInstallment.findMany({
      where: receivedInstallmentsWhere,
      select: { amountReceived: true, amount: true },
    });

    let totalReceivedInMonth = Money(0);
    for (const inst of receivedInstallments) {
      const received =
        inst.amountReceived != null
          ? Money.fromPrismaDecimal(inst.amountReceived)
          : Money.fromPrismaDecimal(inst.amount);
      totalReceivedInMonth = totalReceivedInMonth.add(received);
    }

    const monthResult = totalReceivedInMonth.subtract(totalPaidInMonth).toNumber();

    // prevYear monthResult
    const prevPaidInstallments = await (tx as any).payableInstallment.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: prevMonthStart, lt: prevMonthEnd },
        payable: {
          organizationId: ctx.organizationId,
          ...(farmId ? { farmId } : {}),
        },
      },
      select: { amountPaid: true, amount: true },
    });
    const prevReceivedInstallments = await (tx as any).receivableInstallment.findMany({
      where: {
        status: 'RECEIVED',
        receivedAt: { gte: prevMonthStart, lt: prevMonthEnd },
        receivable: {
          organizationId: ctx.organizationId,
          ...(farmId ? { farmId } : {}),
        },
      },
      select: { amountReceived: true, amount: true },
    });

    let monthResultPrevYear: number | null = null;
    if (prevPaidInstallments.length > 0 || prevReceivedInstallments.length > 0) {
      let prevPaid = Money(0);
      for (const inst of prevPaidInstallments) {
        const paid =
          inst.amountPaid != null
            ? Money.fromPrismaDecimal(inst.amountPaid)
            : Money.fromPrismaDecimal(inst.amount);
        prevPaid = prevPaid.add(paid);
      }
      let prevReceived = Money(0);
      for (const inst of prevReceivedInstallments) {
        const received =
          inst.amountReceived != null
            ? Money.fromPrismaDecimal(inst.amountReceived)
            : Money.fromPrismaDecimal(inst.amount);
        prevReceived = prevReceived.add(received);
      }
      monthResultPrevYear = prevReceived.subtract(prevPaid).toNumber();
    }

    // ── monthlyTrend: last 6 months ──────────────────────────────────

    const monthlyTrend: Array<{ yearMonth: string; revenues: number; expenses: number }> = [];

    for (let i = 5; i >= 0; i--) {
      // month - i (go back i months from selected month)
      let tMonth = month - i;
      let tYear = year;
      while (tMonth <= 0) {
        tMonth += 12;
        tYear -= 1;
      }

      const { start: tStart, end: tEnd } = monthBoundaries(tYear, tMonth);

      const tPaidInstallments = await (tx as any).payableInstallment.findMany({
        where: {
          status: 'PAID',
          paidAt: { gte: tStart, lt: tEnd },
          payable: {
            organizationId: ctx.organizationId,
            ...(farmId ? { farmId } : {}),
          },
        },
        select: { amountPaid: true, amount: true },
      });

      const tReceivedInstallments = await (tx as any).receivableInstallment.findMany({
        where: {
          status: 'RECEIVED',
          receivedAt: { gte: tStart, lt: tEnd },
          receivable: {
            organizationId: ctx.organizationId,
            ...(farmId ? { farmId } : {}),
          },
        },
        select: { amountReceived: true, amount: true },
      });

      let revenues = Money(0);
      for (const inst of tReceivedInstallments) {
        const received =
          inst.amountReceived != null
            ? Money.fromPrismaDecimal(inst.amountReceived)
            : Money.fromPrismaDecimal(inst.amount);
        revenues = revenues.add(received);
      }

      let expenses = Money(0);
      for (const inst of tPaidInstallments) {
        const paid =
          inst.amountPaid != null
            ? Money.fromPrismaDecimal(inst.amountPaid)
            : Money.fromPrismaDecimal(inst.amount);
        expenses = expenses.add(paid);
      }

      monthlyTrend.push({
        yearMonth: `${tYear}-${zeroPad(tMonth)}`,
        revenues: revenues.toNumber(),
        expenses: expenses.toNumber(),
      });
    }

    // ── topExpenseCategories ─────────────────────────────────────────
    // Group Payable by category for selected month (by dueDate or paidAt in month)
    // Use all payables with dueDate in the month (regardless of status)

    const payablesInMonth = await (tx as any).payable.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
        dueDate: { gte: monthStart, lt: monthEnd },
      },
      select: { category: true, totalAmount: true },
    });

    const categoryTotals = new Map<string, { total: typeof totalBankBalance }>();
    let grandTotal = Money(0);

    for (const p of payablesInMonth) {
      const cat = p.category as string;
      const amount = Money.fromPrismaDecimal(p.totalAmount);
      grandTotal = grandTotal.add(amount);
      const existing = categoryTotals.get(cat);
      if (existing) {
        existing.total = existing.total.add(amount);
      } else {
        categoryTotals.set(cat, { total: amount });
      }
    }

    const sortedCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1].total.toNumber() - a[1].total.toNumber())
      .slice(0, 5);

    const grandTotalNum = grandTotal.toNumber();
    const topExpenseCategories = sortedCategories.map(([category, { total }]) => {
      const totalNum = total.toNumber();
      return {
        category,
        categoryLabel:
          PAYABLE_CATEGORY_LABELS[category as keyof typeof PAYABLE_CATEGORY_LABELS] ?? category,
        total: totalNum,
        percentage: grandTotalNum > 0 ? Math.round((totalNum / grandTotalNum) * 10000) / 100 : 0,
      };
    });

    // ── topPayablesByCategory ────────────────────────────────────────
    // Same grouping as topExpenseCategories but with rank and relativePercent

    const topPayablesByCategory = sortedCategories.map(([category, { total }], index) => {
      const totalNum = total.toNumber();
      const rank1Total = sortedCategories.length > 0 ? sortedCategories[0][1].total.toNumber() : 0;
      return {
        rank: index + 1,
        category,
        categoryLabel:
          PAYABLE_CATEGORY_LABELS[category as keyof typeof PAYABLE_CATEGORY_LABELS] ?? category,
        total: totalNum,
        relativePercent: rank1Total > 0 ? Math.round((totalNum / rank1Total) * 10000) / 100 : 0,
      };
    });

    // ── topReceivablesByClient ───────────────────────────────────────
    // Group Receivable by clientName for selected month

    const receivablesInMonth = await (tx as any).receivable.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
        dueDate: { gte: monthStart, lt: monthEnd },
      },
      select: { clientName: true, totalAmount: true },
    });

    const clientTotals = new Map<string, { total: typeof totalBankBalance }>();
    for (const r of receivablesInMonth) {
      const client = r.clientName as string;
      const amount = Money.fromPrismaDecimal(r.totalAmount);
      const existing = clientTotals.get(client);
      if (existing) {
        existing.total = existing.total.add(amount);
      } else {
        clientTotals.set(client, { total: amount });
      }
    }

    const sortedClients = Array.from(clientTotals.entries())
      .sort((a, b) => b[1].total.toNumber() - a[1].total.toNumber())
      .slice(0, 5);

    const topReceivablesByClient = sortedClients.map(([clientName, { total }], index) => {
      const totalNum = total.toNumber();
      const rank1Total = sortedClients.length > 0 ? sortedClients[0][1].total.toNumber() : 0;
      return {
        rank: index + 1,
        clientName,
        total: totalNum,
        relativePercent: rank1Total > 0 ? Math.round((totalNum / rank1Total) * 10000) / 100 : 0,
      };
    });

    // ── alerts ───────────────────────────────────────────────────────

    const overdueInstallmentWhere: any = {
      status: 'OVERDUE',
      payable: {
        organizationId: ctx.organizationId,
        ...(farmId ? { farmId } : {}),
      },
    };

    const overdueInstallments = await (tx as any).payableInstallment.findMany({
      where: overdueInstallmentWhere,
      select: { amount: true },
    });

    let overduePayablesTotal = Money(0);
    for (const inst of overdueInstallments) {
      overduePayablesTotal = overduePayablesTotal.add(Money.fromPrismaDecimal(inst.amount));
    }

    const overduePayablesCount = overdueInstallments.length as number;
    const overduePayablesTotalNum = overduePayablesTotal.toNumber();
    const projectedBalanceNegative = totalBankBalance.toNumber() - payablesDue30d.toNumber() < 0;

    // ── Accounting Balance (saldo contabil) ──────────────────────────
    // Inline logic (avoids nested withRlsContext)
    const checkAccountingWhere: any = {
      organizationId: ctx.organizationId,
      status: 'A_COMPENSAR',
    };
    if (farmId) {
      checkAccountingWhere.bankAccount = { farms: { some: { farmId } } };
    }

    const accountingChecks = await (tx as any).check.findMany({
      where: checkAccountingWhere,
      select: { type: true, amount: true },
    });

    let pendingEmitidosMoney = Money(0);
    let pendingRecebidosMoney = Money(0);
    for (const ch of accountingChecks) {
      const amt = Money.fromPrismaDecimal(ch.amount);
      if (ch.type === 'EMITIDO') {
        pendingEmitidosMoney = pendingEmitidosMoney.add(amt);
      } else {
        pendingRecebidosMoney = pendingRecebidosMoney.add(amt);
      }
    }

    const pendingEmitidos = pendingEmitidosMoney.toNumber();
    const pendingRecebidos = pendingRecebidosMoney.toNumber();
    const accountingBalance = totalBankBalance
      .subtract(pendingEmitidosMoney)
      .add(pendingRecebidosMoney)
      .toNumber();

    // ── Open Bills Count ─────────────────────────────────────────────
    const openBillsWhere: any = {
      organizationId: ctx.organizationId,
      status: 'OPEN',
      expenses: { some: {} },
    };
    if (farmId) {
      openBillsWhere.creditCard = { farmId };
    }

    const openBillsCount = await (tx as any).creditCardBill.count({
      where: openBillsWhere,
    });

    // ── Checks Near Compensation (7 days) ────────────────────────────
    const sevenDaysFromNow = new Date(todayUtc.getTime() + 7 * 86400000);
    const checksNearCompWhere: any = {
      organizationId: ctx.organizationId,
      status: 'A_COMPENSAR',
      expectedCompensationDate: { gte: todayUtc, lte: sevenDaysFromNow },
    };
    if (farmId) {
      checksNearCompWhere.bankAccount = { farms: { some: { farmId } } };
    }

    const checksNearCompensation = await (tx as any).check.count({
      where: checksNearCompWhere,
    });

    return {
      totalBankBalance: totalBankBalance.toNumber(),
      totalBankBalancePrevYear,
      payablesDue30d: payablesDue30d.toNumber(),
      payablesDue30dPrevYear,
      receivablesDue30d: receivablesDue30d.toNumber(),
      receivablesDue30dPrevYear,
      monthResult,
      monthResultPrevYear,
      monthlyTrend,
      topExpenseCategories,
      topPayablesByCategory,
      topReceivablesByClient,
      alerts: {
        overduePayablesCount,
        overduePayablesTotal: overduePayablesTotalNum,
        projectedBalanceNegative,
      },
      accountingBalance,
      pendingEmitidos,
      pendingRecebidos,
      openBillsCount,
      checksNearCompensation,
    };
  });
}
