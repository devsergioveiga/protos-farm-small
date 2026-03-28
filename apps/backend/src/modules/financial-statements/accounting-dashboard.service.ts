// ─── Accounting Dashboard Service ────────────────────────────────────────────
// Aggregates data for the executive accounting dashboard.
// Uses getDre + getBalanceSheet + raw SQL for efficiency.

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { getDre, getBalanceSheet } from './financial-statements.service';
import type {
  AccountingDashboardFilters,
  AccountingDashboardOutput,
  DashboardKpiCard,
  MonthlyRevenueExpense,
  CostCompositionItem,
  BpIndicatorCard,
  AccountingAlert,
} from './accounting-dashboard.types';

// ─── Delta calculation ────────────────────────────────────────────────────────

function computeDelta(
  current: string,
  prior: string,
): { deltaPercent: string | null; deltaDirection: 'up' | 'down' | 'neutral' } {
  const cur = new Decimal(current);
  const pri = new Decimal(prior);

  if (pri.isZero()) {
    return { deltaPercent: null, deltaDirection: 'neutral' };
  }

  const pct = cur.minus(pri).div(pri.abs()).times(100);
  const formatted = (pct.gte(0) ? '+' : '') + pct.toFixed(2);

  let deltaDirection: 'up' | 'down' | 'neutral';
  if (pct.gt(0)) {
    deltaDirection = 'up';
  } else if (pct.lt(0)) {
    deltaDirection = 'down';
  } else {
    deltaDirection = 'neutral';
  }

  return { deltaPercent: formatted, deltaDirection };
}

// ─── Extract YTD sums from DRE sections ──────────────────────────────────────

function sumSectionsYtd(
  sections: Array<{ id: string; total: { ytd: string } }>,
  ids: string[],
): Decimal {
  return ids.reduce((sum, id) => {
    const section = sections.find((s) => s.id === id);
    return section ? sum.plus(new Decimal(section.total.ytd)) : sum;
  }, new Decimal(0));
}

// ─── getAccountingDashboard ──────────────────────────────────────────────────

export async function getAccountingDashboard(
  organizationId: string,
  filters: AccountingDashboardFilters,
): Promise<AccountingDashboardOutput> {
  // ─── 1. KPI Cards ─────────────────────────────────────────────────────────

  const dre = await getDre(organizationId, filters);

  // Prior month DRE for delta calculation (month-1, same fiscal year)
  let priorDre: Awaited<ReturnType<typeof getDre>> | null = null;
  if (filters.month > 1) {
    try {
      priorDre = await getDre(organizationId, {
        fiscalYearId: filters.fiscalYearId,
        month: filters.month - 1,
      });
    } catch {
      // If prior month DRE fails, deltas will be null
      priorDre = null;
    }
  }

  // Revenue section IDs in DRE
  const receitaIds = [
    'receita-bruta-agricola',
    'receita-bruta-pecuaria',
    'receita-bruta-industrializacao',
    'receita-financeira',
    'outras-receitas',
    'receita-liquida',
  ];
  // Expense section IDs in DRE
  const despesaIds = [
    'cpv-agricola',
    'cpv-pecuario',
    'despesas-admin',
    'despesas-comerciais',
    'despesas-financeiras',
    'despesas-depreciacao',
    'despesas-pessoal',
    'cpc29',
  ];

  const resultadoAcumulado = dre.resultadoLiquido.ytd;
  const receitaTotal = sumSectionsYtd(dre.sections, receitaIds).toFixed(2);
  const despesaTotal = sumSectionsYtd(dre.sections, despesaIds).toFixed(2);

  // Margem Operacional: resultado-antes-ir if present, else (receita - despesa) / receita * 100
  let margemOperacional = '0.00';
  const resultadoAntesIr = dre.sections.find((s) => s.id === 'resultado-antes-ir');
  if (resultadoAntesIr) {
    const recTotal = new Decimal(receitaTotal);
    const raiYtd = new Decimal(resultadoAntesIr.total.ytd);
    margemOperacional = recTotal.isZero() ? '0.00' : raiYtd.div(recTotal).times(100).toFixed(2);
  } else {
    const rec = new Decimal(receitaTotal);
    const des = new Decimal(despesaTotal);
    margemOperacional = rec.isZero() ? '0.00' : rec.minus(des).div(rec).times(100).toFixed(2);
  }

  // Prior values for deltas
  const priorResultado = priorDre?.resultadoLiquido.ytd ?? '0';
  const priorReceita = priorDre ? sumSectionsYtd(priorDre.sections, receitaIds).toFixed(2) : '0';
  const priorDespesa = priorDre ? sumSectionsYtd(priorDre.sections, despesaIds).toFixed(2) : '0';

  let priorMargem = '0.00';
  if (priorDre) {
    const priorResultadoAntesIr = priorDre.sections.find((s) => s.id === 'resultado-antes-ir');
    if (priorResultadoAntesIr) {
      const priorRec = new Decimal(priorReceita);
      const priorRai = new Decimal(priorResultadoAntesIr.total.ytd);
      priorMargem = priorRec.isZero() ? '0.00' : priorRai.div(priorRec).times(100).toFixed(2);
    } else {
      const priorRec = new Decimal(priorReceita);
      const priorDes = new Decimal(priorDespesa);
      priorMargem = priorRec.isZero()
        ? '0.00'
        : priorRec.minus(priorDes).div(priorRec).times(100).toFixed(2);
    }
  }

  const kpiCards: DashboardKpiCard[] = [
    {
      label: 'Resultado Acumulado',
      value: resultadoAcumulado,
      ...computeDelta(resultadoAcumulado, priorResultado),
    },
    {
      label: 'Receita Total',
      value: receitaTotal,
      ...computeDelta(receitaTotal, priorReceita),
    },
    {
      label: 'Despesa Total',
      value: despesaTotal,
      ...computeDelta(despesaTotal, priorDespesa),
    },
    {
      label: 'Margem Operacional',
      value: margemOperacional,
      ...computeDelta(margemOperacional, priorMargem),
    },
  ];

  // ─── 2. 12-Month Revenue vs Expense Chart (single raw SQL query) ──────────

  type MonthlyRow = {
    month: number | string;
    receita: unknown;
    despesa: unknown;
  };

  const monthlyRows = await prisma.$queryRaw<MonthlyRow[]>`
    SELECT ab.month,
      SUM(CASE WHEN coa."accountType" = 'RECEITA' THEN ab."creditTotal" - ab."debitTotal" ELSE 0 END) as receita,
      SUM(CASE WHEN coa."accountType" = 'DESPESA' THEN ab."debitTotal" - ab."creditTotal" ELSE 0 END) as despesa
    FROM account_balances ab
    JOIN chart_of_accounts coa ON coa.id = ab."accountId"
    WHERE ab."organizationId" = ${organizationId}
      AND ab."fiscalYearId" = ${filters.fiscalYearId}
      AND coa."accountType" IN ('RECEITA', 'DESPESA')
      AND coa."isSynthetic" = false
    GROUP BY ab.month
    ORDER BY ab.month
  `;

  // Build a map for months 1-12, fill missing months with 0
  const monthlyMap = new Map<number, { receita: Decimal; despesa: Decimal }>();
  for (const row of monthlyRows) {
    const m = typeof row.month === 'string' ? parseInt(row.month, 10) : Number(row.month);
    monthlyMap.set(m, {
      receita: new Decimal(String(row.receita ?? '0')),
      despesa: new Decimal(String(row.despesa ?? '0')),
    });
  }

  const monthlyChart: MonthlyRevenueExpense[] = [];
  for (let m = 1; m <= 12; m++) {
    const data = monthlyMap.get(m);
    monthlyChart.push({
      month: m,
      receita: (data?.receita ?? new Decimal(0)).toFixed(2),
      despesa: (data?.despesa ?? new Decimal(0)).toFixed(2),
    });
  }

  // ─── 3. Cost Composition Donut ────────────────────────────────────────────

  type CostRow = {
    label: string;
    total: unknown;
  };

  const costRows = await prisma.$queryRaw<CostRow[]>`
    SELECT
      CASE
        WHEN coa.code LIKE '5.1.%' THEN 'CPV'
        WHEN coa.code LIKE '5.2.01%' THEN 'Despesas Administrativas'
        WHEN coa.code LIKE '5.2.02%' THEN 'Despesas Comerciais'
        WHEN coa.code LIKE '5.2.03%' THEN 'Depreciacao'
        WHEN coa.code LIKE '5.2.04%' THEN 'Despesas com Pessoal'
        WHEN coa.code LIKE '6.1.%' THEN 'Despesas com Pessoal'
        WHEN coa.code LIKE '5.2.05%' THEN 'Despesas Financeiras'
        WHEN coa.code LIKE '5.3.%' THEN 'Despesas Financeiras'
        ELSE 'Outras Despesas'
      END as label,
      SUM(ab."debitTotal" - ab."creditTotal") as total
    FROM account_balances ab
    JOIN chart_of_accounts coa ON coa.id = ab."accountId"
    WHERE ab."organizationId" = ${organizationId}
      AND ab."fiscalYearId" = ${filters.fiscalYearId}
      AND ab.month <= ${filters.month}
      AND coa."accountType" = 'DESPESA'
      AND coa."isSynthetic" = false
    GROUP BY label
    HAVING SUM(ab."debitTotal" - ab."creditTotal") > 0
    ORDER BY total DESC
  `;

  const costTotals = costRows.map((r) => new Decimal(String(r.total ?? '0')));
  const totalCost = costTotals.reduce((sum, v) => sum.plus(v), new Decimal(0));

  // Aggregate duplicate labels (e.g. multiple 'Despesas com Pessoal' rows)
  const costMap = new Map<string, Decimal>();
  for (const row of costRows) {
    const val = new Decimal(String(row.total ?? '0'));
    costMap.set(row.label, (costMap.get(row.label) ?? new Decimal(0)).plus(val));
  }

  const costComposition: CostCompositionItem[] = Array.from(costMap.entries()).map(
    ([label, value]) => ({
      label,
      value: value.toFixed(2),
      percent: totalCost.isZero() ? '0.00' : value.div(totalCost).times(100).toFixed(2),
    }),
  );

  // ─── 4. BP Indicators ────────────────────────────────────────────────────

  const bp = await getBalanceSheet(organizationId, filters);

  const bpIndicators: BpIndicatorCard[] = [
    {
      id: 'liquidez-corrente',
      label: 'Liquidez Corrente',
      value: bp.indicators.liquidezCorrente,
      sparkline: bp.indicators.sparklines['liquidezCorrente'] ?? [],
    },
    {
      id: 'endividamento-geral',
      label: 'Endividamento Geral',
      value: bp.indicators.endividamentoGeral,
      sparkline: bp.indicators.sparklines['endividamentoGeral'] ?? [],
    },
    {
      id: 'roe',
      label: 'ROE',
      value: bp.indicators.roe,
      sparkline: bp.indicators.sparklines['roe'] ?? [],
    },
    {
      id: 'pl-ha',
      label: 'PL/ha',
      value: bp.indicators.plPorHectare,
      sparkline: bp.indicators.sparklines['plPorHectare'] ?? [],
    },
  ];

  // ─── 5. Accounting Alerts (only include alerts where count > 0) ───────────

  const [openPeriods, pendingPostings, unmappedAccounts] = await Promise.all([
    prisma.accountingPeriod.count({
      where: { organizationId, status: 'OPEN' },
    }),
    prisma.pendingJournalPosting.count({
      where: { organizationId, status: 'PENDING' },
    }),
    prisma.chartOfAccount.count({
      where: { organizationId, isActive: true, isSynthetic: false, spedRefCode: null },
    }),
  ]);

  const alerts: AccountingAlert[] = [];

  if (openPeriods > 0) {
    alerts.push({
      id: 'periodos-abertos',
      label: `${openPeriods} periodo(s) nao fechado(s) — clique para revisar`,
      count: openPeriods,
      navigateTo: '/fiscal-periods',
      severity: 'warning' as const,
    });
  }

  if (pendingPostings > 0) {
    alerts.push({
      id: 'lancamentos-pendentes',
      label: `${pendingPostings} lancamento(s) aguardando contabilizacao automatica — clique para processar`,
      count: pendingPostings,
      navigateTo: '/accounting-entries',
      severity: 'warning' as const,
    });
  }

  if (unmappedAccounts > 0) {
    alerts.push({
      id: 'contas-sem-sped',
      label: `${unmappedAccounts} conta(s) analitica(s) sem mapeamento SPED — clique para mapear`,
      count: unmappedAccounts,
      navigateTo: '/chart-of-accounts',
      severity: 'info' as const,
    });
  }

  return {
    kpiCards,
    monthlyChart,
    costComposition,
    bpIndicators,
    alerts,
  };
}
