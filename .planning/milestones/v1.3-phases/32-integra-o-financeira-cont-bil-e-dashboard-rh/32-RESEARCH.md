# Phase 32: Integração Financeira, Contábil e Dashboard RH - Research

**Researched:** 2026-03-26
**Domain:** Payroll-to-payables completion, accounting journal entries (regime de competência), HR KPI dashboard
**Confidence:** HIGH (codebase analysis), HIGH (Brazilian accounting rules from established patterns)

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                                                                                                                                                                                               | Research Support                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INTEGR-01 | Ao fechar folha, sistema gera CPs para salários líquidos, INSS, FGTS, IRRF, contribuição sindical, pensão, VT e FUNRURAL com vencimentos corretos, rateio por centro de custo, tela de revisão pré-confirmação, estorno/rollback e reconciliação total folha vs total CPs                                                                 | `closeRun` already creates PAYROLL_RUN_ITEM (net salary), PAYROLL_EMPLOYER_INSS, PAYROLL_EMPLOYER_FGTS. Phase 32 adds: IRRF employee (dia 20), VT employee (dia 5 útil), pension employee (dia 5 útil), FUNRURAL (dia 20 via tax-guides). Cost-center rateio added via PayableCostCenterItem. Review screen queries CPs by originType. Rollback extends existing revertRun. |
| INTEGR-02 | Ao fechar folha, sistema lança automaticamente os créditos contábeis por regime de competência — salários/encargos como despesa, provisões como despesa+passivo, guias como passivo a recolher — com rateio por centro de custo e baixa do passivo ao pagar                                                                               | New model: AccountingEntry with debitAccount/creditAccount/amount/costCenterId. Populates from PayrollProvision.accountingEntryJson stub (Phase 29) and from closeRun totals. Payment-triggered reversal via Payable settle hook. No full chart-of-accounts needed (v1.4 scope).                                                                                            |
| INTEGR-03 | Dashboard RH: total colaboradores por status/tipo contrato, custo total folha bruto/líquido/encargos, custo médio por colaborador, custo MO/hectare, evolução 12 meses, pizza composição folha, custo por atividade/cultura, turnover, previsão encerramentos safra 30/60/90 dias, alertas consolidados, filtros por fazenda/departamento | New endpoint `/org/hr-dashboard`. Sources: PayrollRun.totalGross/Net/Charges, Employee.status/contractType, EmployeeContract.endDate (SEASONAL/TRIAL/DETERMINATE → safra forecast), TimeEntryActivity.costCenterId (cost-by-activity), Farm.totalAreaHa (cost/hectare). Recharts BarChart + PieChart patterns already established.                                          |

</phase_requirements>

---

## Summary

Phase 32 is the final phase of the v1.3 RH milestone. It has three distinct concerns that share data but live in different layers: completing the payables generation (INTEGR-01), adding accounting journal entries (INTEGR-02), and building the HR KPI dashboard (INTEGR-03).

**INTEGR-01** is an extension to the existing `closeRun` function. The current code creates three payables: net salary per employee (PAYROLL_RUN_ITEM), employer INSS (PAYROLL_EMPLOYER_INSS), and FGTS (PAYROLL_EMPLOYER_FGTS). What is missing: employee IRRF withholding (dia 20), employee VT deduction reimbursement to transit operator (dia 5 útil), pension/alimony (dia 5 útil where applicable), and FUNRURAL (already handled by tax-guides module, Phase 31 — must not duplicate). Additionally, the existing CPs have no cost-center items. The PayableCostCenterItem model already exists and is used by other payables; the cost-center allocation for HR comes from TimeEntryActivity.costCenterId proportional to minutes worked in each center. A pre-confirmation review screen must query the CPs-to-be-created before actually writing them. The revert endpoint already cancels the three existing originTypes — it must be extended to cancel the new ones.

**INTEGR-02** requires a new AccountingEntry Prisma model (or reuse of the structured JSON stub from PayrollProvision.accountingEntryJson). The STATE.md note from Phase 29 is clear: "Accounting entry JSON stubs stored now, Phase 32 will wire to real GL entries (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02)". The requirement says "regime de competência" — entries are recognized when the payroll run is closed, not when cash is paid. A separate reversal entry is generated when the Payable is settled. No full chart-of-accounts system is in scope for v1.3 (REQUIREMENTS.md Out of Scope: "Plano de contas contábil completo — Módulo contabilidade é milestone separado v1.4"). What is in scope: a flat AccountingEntry table with six canonical debit/credit pairs (salary expense, employer charges expense, vacation provision, 13th provision, tax liabilities to collect, salaries payable), drill-down DRE per rubrica/department/farm.

**INTEGR-03** is a read-only dashboard. All source data is already in the database. The primary data joins are: PayrollRun + PayrollRunItem (cost figures), Employee + EmployeeContract (headcount, contract types, endDate forecasting), TimeEntryActivity.costCenterId (cost by activity), Farm.totalAreaHa (cost/hectare). The turnover metric requires counting DESLIGADO status transitions from EmployeeStatusHistory within a 12-month window. The frontend pattern is identical to FinancialDashboardPage — `useHrDashboard` hook with `useState + useCallback`, lazy-loaded Recharts components.

**Primary recommendation:** Three backend plans in sequence (INTEGR-01 CP completion, INTEGR-02 accounting entries, INTEGR-03 dashboard endpoint) plus two frontend plans (INTEGR-01 review screen + INTEGR-03 dashboard page). No new npm packages required.

---

## Standard Stack

### Core (all already installed)

| Library        | Version   | Purpose                         | Why Standard                                               |
| -------------- | --------- | ------------------------------- | ---------------------------------------------------------- |
| decimal.js     | ^10.6.0   | All monetary arithmetic         | Mandatory — all payroll uses Decimal per project decisions |
| @prisma/client | ^7.4.1    | ORM — new AccountingEntry model | Standard ORM for this project                              |
| pdfkit         | ^0.17.2   | Not needed for Phase 32         | PDFs done in Phases 28–31                                  |
| recharts       | ^3.7.0    | HR Dashboard charts             | Already used in FinancialDashboardPage                     |
| lucide-react   | (current) | Dashboard icons                 | Standard icon library per CLAUDE.md                        |

### No New Dependencies Required

All Phase 32 functionality is covered by libraries already in the backend and frontend. No new npm installs needed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
├── payroll-runs/
│   ├── payroll-runs.service.ts     # extend closeRun + revertRun
│   └── payroll-runs.routes.ts      # new GET /:id/cp-preview endpoint
├── accounting-entries/              # NEW — INTEGR-02
│   ├── accounting-entries.service.ts
│   ├── accounting-entries.routes.ts
│   ├── accounting-entries.routes.spec.ts
│   └── accounting-entries.types.ts
├── hr-dashboard/                    # NEW — INTEGR-03
│   ├── hr-dashboard.service.ts
│   ├── hr-dashboard.routes.ts
│   ├── hr-dashboard.routes.spec.ts
│   └── hr-dashboard.types.ts

apps/frontend/src/
├── pages/
│   ├── HrDashboardPage.tsx          # NEW
│   └── HrDashboardPage.css          # NEW
├── hooks/
│   └── useHrDashboard.ts            # NEW
├── components/
│   ├── payroll/
│   │   └── PayrollCpReviewModal.tsx # NEW — INTEGR-01 review screen
│   └── hr-dashboard/
│       ├── PayrollCostTrendChart.tsx # NEW (12-month bar)
│       └── PayrollCompositionChart.tsx # NEW (pie)
```

### Pattern 1: Extending closeRun for Additional CPs with Cost-Center Rateio

The existing `closeRun` in `payroll-runs.service.ts` already creates net-salary CPs. Phase 32 must add inside the same per-employee transaction:

**Employee IRRF CP** — aggregate `SUM(irrfAmount)` across all items, one CP per run, originType `PAYROLL_EMPLOYEE_IRRF`, dueDate = 20th of next month (same as INSS patronal).

**Employee VT CP** — per-employee where `vtDeduction > 0`, originType `PAYROLL_EMPLOYEE_VT`, dueDate = 5th business day of next month. supplierName = "Vale-Transporte" (not employee name, because this is paid to transit operator; no individual name needed from legal standpoint).

**Pension/alimony CP** — per-employee where `otherDeductions > 0` and the lineItemsJson contains a rubrica of type DESCONTO with code matching a pension rubrica. Best approach: persist `alimonyAmount` on PayrollRunItem as a new field (requires migration), OR parse lineItemsJson for pension items. Clean approach is new field.

**Cost-center rateio:** For each CP, distribute via `PayableCostCenterItem`. The cost-center weights come from `TimeEntryActivity` grouped by `costCenterId` summing `minutes` for the employee in that reference month. If no time entries, fall back to the employee's `EmployeeContract.costCenterId` as 100%.

**FUNRURAL:** Already handled by `tax-guides.service.ts` as a separate `TaxGuide` with `originType: 'TAX_GUIDE'`. Do NOT add a FUNRURAL CP in closeRun — that would duplicate. The review screen must include TaxGuide entries for FUNRURAL when showing the full picture.

```typescript
// Cost-center rateio helper — runs inside closeRun transaction
async function buildCostCenterItems(
  tx: TxClient,
  employeeId: string,
  referenceMonth: Date,
  farmId: string,
): Promise<CostCenterItemInput[]> {
  // Sum minutes per cost center from TimeEntryActivity
  const activities = await tx.timeEntryActivity.groupBy({
    by: ['costCenterId'],
    where: {
      timeEntry: {
        employeeId,
        date: {
          gte: new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth(), 1)),
          lt: new Date(
            Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() + 1, 1),
          ),
        },
      },
      costCenterId: { not: null },
    },
    _sum: { minutes: true },
  });

  const totalMinutes = activities.reduce((s, a) => s + (a._sum.minutes ?? 0), 0);
  if (totalMinutes === 0 || activities.length === 0) {
    // Fallback: 100% to contract cost center
    const contract = await tx.employeeContract.findFirst({
      where: { employeeId, isActive: true },
      select: { costCenterId: true },
    });
    if (!contract?.costCenterId) return [];
    return [
      { costCenterId: contract.costCenterId, farmId, allocMode: 'PERCENTAGE', percentage: 100 },
    ];
  }

  return activities
    .filter((a) => a.costCenterId !== null)
    .map((a) => ({
      costCenterId: a.costCenterId!,
      farmId,
      allocMode: 'PERCENTAGE' as const,
      percentage: Number(
        new Decimal(a._sum.minutes ?? 0).div(totalMinutes).times(100).toDecimalPlaces(2),
      ),
    }));
}
```

### Pattern 2: AccountingEntry Model and Journal Logic

The `AccountingEntryStub` interface in `payroll-provisions.types.ts` already documents the debit/credit accounts. Phase 32 materializes this into a real DB table:

```
AccountingEntry
  id                String   @id @default(uuid())
  organizationId    String
  referenceMonth    DateTime @db.Date
  entryType         AccountingEntryType  // PAYROLL_SALARY, PAYROLL_CHARGES, VACATION_PROVISION,
                                         // THIRTEENTH_PROVISION, TAX_LIABILITY, SALARY_PAYABLE
  debitAccount      String   // "6.1.01"
  debitLabel        String   // "Despesa com Salários"
  creditAccount     String   // "2.1.01"
  creditLabel       String   // "Salários a Pagar"
  amount            Decimal  @db.Decimal(14, 2)
  costCenterId      String?
  farmId            String?
  sourceType        String   // "PAYROLL_RUN" | "PAYROLL_PROVISION" | "VACATION_PAYMENT" | "TAX_PAYMENT"
  sourceId          String   // runId or provisionId or payableId
  reversedByEntryId String?  // links to the reversal entry
  notes             String?
  createdAt         DateTime @default(now())
```

**Six canonical entry types at payroll close:**

| entryType            | Debit                        | Credit                         | Trigger                                                     |
| -------------------- | ---------------------------- | ------------------------------ | ----------------------------------------------------------- |
| PAYROLL_SALARY       | 6.1.01 Despesa Salários      | 2.1.01 Salários a Pagar        | closeRun — sum(grossSalary)                                 |
| PAYROLL_CHARGES      | 6.1.02 Despesa Encargos Soc. | 2.1.02 Encargos a Recolher     | closeRun — sum(inssPatronal + fgtsAmount)                   |
| VACATION_PROVISION   | 6.1.03 Desp. Prov. Férias    | 2.2.01 Provisão Férias a Pagar | from PayrollProvision.accountingEntryJson (VACATION type)   |
| THIRTEENTH_PROVISION | 6.1.04 Desp. Prov. 13o       | 2.2.02 Provisão 13o a Pagar    | from PayrollProvision.accountingEntryJson (THIRTEENTH type) |
| TAX_LIABILITY        | 6.1.05 Despesa INSS/IRRF     | 2.1.03 INSS/IRRF a Recolher    | closeRun — sum(inssAmount + irrfAmount)                     |
| SALARY_REVERSAL      | 2.1.01 Salários a Pagar      | 1.1.01 Caixa/Bancos            | when Payable PAYROLL_RUN_ITEM is settled                    |

**Reversal on payment:** When a Payable with originType PAYROLL_RUN_ITEM, PAYROLL_EMPLOYER_INSS, etc. transitions to PAID status, the accounting-entries service creates a reversal entry (SALARY_REVERSAL) that debits the liability account and credits the bank account. This is triggered by a new hook in `payables.service.ts` `settlePayable()` function, following the try/catch non-propagating pattern established in Phase 31 for eSocial.

### Pattern 3: HR Dashboard — Query Architecture

The dashboard aggregates from multiple tables. All queries are scoped to `organizationId` (RLS). Farm filter is optional.

```
GET /org/hr-dashboard?farmId=&year=&month=

Response shape:
{
  headcount: {
    total: number,
    byStatus: { ATIVO: number, AFASTADO: number, FERIAS: number, DESLIGADO: number },
    byContractType: { CLT_INDETERMINATE: number, SEASONAL: number, ... }
  },
  currentMonthCost: {
    gross: number,
    net: number,
    charges: number,
    avgPerEmployee: number,
    costPerHectare: number | null,   // sum(gross) / sum(totalAreaHa) for farm filter
  },
  trend12Months: Array<{            // 12 months of PayrollRun.totalGross/Net/Charges
    yearMonth: string,              // "YYYY-MM"
    gross: number,
    net: number,
    charges: number
  }>,
  composition: Array<{              // for pie chart
    label: string,                  // "Salários", "HE", "Encargos", "INSS/IRRF"
    amount: number,
    percentage: number
  }>,
  costByActivity: Array<{           // from TimeEntryActivity grouped by operationType
    activityType: string,
    totalCost: number
  }>,
  turnover: {
    last12MonthsRate: number,       // (admissions + terminations / 2) / avg headcount * 100
    terminationsLast12: number,
    admissionsLast12: number,
  },
  upcomingContractExpirations: Array<{
    days: number,                   // 30 | 60 | 90
    count: number,
    employees: Array<{ id, name, endDate, contractType }>
  }>,
  alerts: {
    overduePayablesPayroll: number,  // payables category=PAYROLL status=OVERDUE
    pendingTimesheets: number,       // timesheets status=PENDING_RH
    expiredContracts: number,
  }
}
```

**Cost per hectare calculation:**

- If farmId filter: `sum(PayrollRun.totalGross) / Farm.totalAreaHa`
- If no filter (org level): `sum(PayrollRun.totalGross) / sum(Farm.totalAreaHa)` for all farms in org

**Upcoming contract expirations query:**

```typescript
// Contracts where endDate is in [today, today + 90 days] and contractType IN ['SEASONAL', 'CLT_DETERMINATE', 'TRIAL']
const expirations = await prisma.employeeContract.findMany({
  where: {
    organizationId,
    isActive: true,
    contractType: { in: ['SEASONAL', 'CLT_DETERMINATE', 'TRIAL'] },
    endDate: {
      gte: today,
      lte: addDays(today, 90),
    },
  },
  include: { employee: { select: { name: true, status: true } } },
  orderBy: { endDate: 'asc' },
});
```

**Turnover rate formula:**
Standard HR formula: `((admissions + terminations) / 2) / avg_headcount * 100`
Where admissions = count(EmployeeStatusHistory where toStatus=ATIVO and createdAt >= 12monthsAgo)
and terminations = count(EmployeeStatusHistory where toStatus=DESLIGADO and createdAt >= 12monthsAgo)

### Pattern 4: Pre-confirmation Review Screen (INTEGR-01)

A new endpoint `GET /org/:orgId/payroll-runs/:id/cp-preview` returns the list of CPs that WOULD be created on close, without writing them. The frontend PayrollCpReviewModal shows this as a table grouped by type. The user confirms → triggers the existing POST close endpoint.

```typescript
// cp-preview returns a dry-run list (no DB writes)
interface CpPreviewItem {
  type: string; // "Salário Líquido", "INSS Patronal", "FGTS", "IRRF", etc.
  employeeName?: string; // for per-employee CPs
  amount: number;
  dueDate: string;
  costCenterName?: string;
  percentage?: number;
}
interface CpPreviewResponse {
  items: CpPreviewItem[];
  totalAmount: number;
  runTotalNet: number; // reconciliation: totalAmount should equal runTotalNet (approx)
}
```

### Anti-Patterns to Avoid

- **Duplicating FUNRURAL CP in closeRun:** The tax-guides module already creates FUNRURAL CPs with originType TAX_GUIDE. Do not create another one in closeRun.
- **Nested withRlsContext in accounting entry creation:** Follow the Phase 28 decision — use `tx.accountingEntry.create` directly inside existing transactions, NOT by calling accounting-entries service (which would start its own RLS context).
- **Full chart-of-accounts system:** REQUIREMENTS.md explicitly defers this to v1.4. Use hardcoded account codes (6.1.01–6.1.05, 2.1.01–2.2.02) as string constants, not a managed hierarchy.
- **Blocking closeRun on accounting entry failure:** Wrap accounting entry creation in try/catch — accounting failures must not abort the payroll close (same pattern as eSocial in Phase 31).
- **Alimony CP supplier name:** Do not use the employee name — use "Pensão Alimentícia — [Employee Name]" as `supplierName` to distinguish from the salary CP.
- **Cost-center percentages summing > 100:** Round each percentage to 2 decimal places, then adjust the last item to absorb rounding to ensure sum = 100.

---

## Don't Hand-Roll

| Problem                           | Don't Build        | Use Instead                                                              | Why                                                            |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Recharts charts                   | Custom SVG bar/pie | recharts BarChart + PieChart (already installed v3.7.0)                  | Responsive, accessible, already used in FinancialDashboardPage |
| Business day calculation          | Custom loop        | `nthBusinessDay()` already in `payroll-runs.service.ts` (private helper) | Extract to shared `payroll-date-utils.ts`                      |
| Decimal summation                 | float accumulation | `decimal.js` reduce pattern already throughout codebase                  | Avoids cent-level rounding drift                               |
| Cost-center percentage allocation | Manual math        | `groupBy` in Prisma + Decimal percentage calc                            | Consistent with PayableCostCenterItem existing pattern         |

**Key insight:** The accounting chart-of-account codes (6.1.01 etc.) are hardcoded string constants in v1.3, not managed configuration. This avoids building a full double-entry accounting engine that is explicitly deferred to v1.4.

---

## Common Pitfalls

### Pitfall 1: Duplicate FUNRURAL CP

**What goes wrong:** Implementing FUNRURAL in `closeRun` when it is already generated by `tax-guides.service.ts` as originType TAX_GUIDE after the run closes.
**Why it happens:** The requirement lists FUNRURAL as a CP to generate "ao fechar folha", but Phase 31 already handles this.
**How to avoid:** Verify in `revertRun` and review screen that FUNRURAL CPs come from TaxGuide records, not from closeRun. The review screen should JOIN with tax-guides for the same referenceMonth.
**Warning signs:** Duplicate payables with description "FUNRURAL" for same month.

### Pitfall 2: Cost-Center Rateio Percentages Not Summing to 100

**What goes wrong:** Decimal rounding in percentage allocation produces totals like 99.99 or 100.01.
**Why it happens:** Each percentage is independently rounded before summing.
**How to avoid:** Round all except the last item, then set last = 100 - sum(others). Use Decimal arithmetic throughout.
**Warning signs:** PayableCostCenterItem constraint violations or reconciliation errors.

### Pitfall 3: Accounting Entries Blocking Payroll Close

**What goes wrong:** An error in the accounting entry creation rolls back the entire `closeRun` transaction, leaving the payroll un-closeable.
**Why it happens:** GL entry creation called inside the main transaction without error isolation.
**How to avoid:** Create accounting entries AFTER the main transaction completes (same pattern as eSocial event generation in closeRun lines 837–846), wrapped in try/catch that logs but does not re-throw.
**Warning signs:** PayrollRun stuck in CALCULATED state due to non-payroll errors.

### Pitfall 4: HR Dashboard Slow Queries on Large Orgs

**What goes wrong:** The 12-month trend query scans PayrollRunItems one row per employee per month, causing slow responses.
**Why it happens:** Aggregating across 12 PayrollRun records with their items when the run-level totals (totalGross/Net/Charges) are already stored on the PayrollRun.
**How to avoid:** Use `PayrollRun.totalGross`, `totalNet`, `totalCharges` for the trend — these are pre-computed at close time. Only drill into PayrollRunItem-level data for the composition breakdown of a single month.
**Warning signs:** Dashboard taking >1s to load; query plan shows sequential scan on payroll_run_items.

### Pitfall 5: Turnover Rate Double-Counting Rehires

**What goes wrong:** An employee who is terminated then re-hired within 12 months counts twice (once as termination, once as admission).
**Why it happens:** Naive count of status transitions.
**How to avoid:** This is actually correct per the standard HR turnover formula (counts movements, not unique people). Document this in the service comment. If distorted, consider distinct employee count instead.

### Pitfall 6: revertRun Missing New originTypes

**What goes wrong:** After adding PAYROLL_EMPLOYEE_IRRF, PAYROLL_EMPLOYEE_VT, PAYROLL_EMPLOYEE_PENSION originTypes in closeRun, the revertRun function only cancels the three original ones.
**Why it happens:** revertRun has a hardcoded OR filter with three conditions.
**How to avoid:** Add the new originTypes to the OR filter in revertRun AND add a test that verifies revert clears ALL payable types.

---

## Code Examples

Verified patterns from existing codebase:

### Existing closeRun CP Creation (template to follow)

```typescript
// Source: apps/backend/src/modules/payroll-runs/payroll-runs.service.ts line 691
await tx.payable.create({
  data: {
    organizationId: rls.organizationId,
    farmId,
    supplierName: item.employee.name,
    category: 'PAYROLL' as any,
    description: `Salário ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
    totalAmount: new Decimal(item.netSalary.toString()),
    dueDate: salaryDueDate,
    originType: 'PAYROLL_RUN_ITEM',
    originId: item.id,
  },
});
```

### Adding CostCenterItems to a Payable (after payable.create)

```typescript
// Source: apps/backend/src/modules/payables/payables.service.ts (existing pattern)
// PayableCostCenterItem is created separately after the Payable
const costCenterItems = await buildCostCenterItems(tx, item.employeeId, run.referenceMonth, farmId);
if (costCenterItems.length > 0) {
  await tx.payableCostCenterItem.createMany({
    data: costCenterItems.map((cc) => ({
      payableId: payable.id,
      costCenterId: cc.costCenterId,
      farmId: cc.farmId,
      allocMode: cc.allocMode,
      percentage: cc.percentage ?? null,
      fixedAmount: null,
    })),
  });
}
```

### Recharts PieChart Pattern (follows existing TopCategoriesChart.tsx)

```typescript
// Source: apps/frontend/src/components/financial-dashboard/TopCategoriesChart.tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['var(--color-primary-600)', 'var(--color-primary-400)', 'var(--color-neutral-400)', ...];

export default function PayrollCompositionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={100}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### AccountingEntry creation at closeRun (non-blocking)

```typescript
// Called AFTER the main closeRun transaction completes — never inside it
try {
  await accountingEntriesService.createPayrollEntries(rls.organizationId, runId);
} catch (err) {
  console.error('[payroll-runs] Failed to create accounting entries:', err);
  // intentionally not re-thrown — payroll is already closed
}
```

### useHrDashboard hook pattern (mirrors useFinancialDashboard)

```typescript
// Source: apps/frontend/src/hooks/useFinancialDashboard.ts (pattern to replicate)
export function useHrDashboard(params: { farmId: string | null; year: number; month: number }) {
  const [data, setData] = useState<HrDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('year', String(params.year));
      query.set('month', String(params.month));
      if (params.farmId) query.set('farmId', params.farmId);
      const result = await api.get<HrDashboardData>(`/org/hr-dashboard?${query}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard RH');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.farmId, params.year, params.month]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);
  return { data, isLoading, error, refetch: fetchDashboard };
}
```

---

## State of the Art

| Old Approach                                                | Current Approach                                         | When Changed | Impact                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| closeRun creates 3 CP types (net salary, INSS patron, FGTS) | Phase 32 adds IRRF, VT, pension CPs + cost-center rateio | Phase 32     | INTEGR-01 now fully covers all payroll obligations        |
| PayrollProvision.accountingEntryJson stores accounting stub | Phase 32 materializes into AccountingEntry table         | Phase 32     | INTEGR-02 enables drill-down DRE by rubrica/CC            |
| No HR KPI aggregation endpoint                              | Phase 32 adds `/org/hr-dashboard`                        | Phase 32     | INTEGR-03 closes the milestone with management visibility |

**Existing but confirmed still valid:**

- `nthBusinessDay()` in payroll-runs.service.ts handles salary due date correctly (5th business day) — extract for reuse
- `PayableCostCenterItem` model and `CostCenterAllocMode` enum already exist — no schema changes needed for cost center allocation on payables
- eSocial non-blocking try/catch pattern (lines 837–846 in closeRun) is the correct template for accounting entry hooks

---

## Open Questions

1. **Alimony amount on PayrollRunItem**
   - What we know: `EmployeePayrollInput.alimonyAmount` feeds the payroll engine and appears in lineItemsJson as a rubrica DESCONTO. The `PayrollRunItem` has `otherDeductions` but it combines alimony + other manual deductions.
   - What's unclear: Whether it is safe to parse lineItemsJson to find pension-specific items, or if a dedicated `alimonyDeduction` field on PayrollRunItem is warranted.
   - Recommendation: Add a `alimonyDeduction Decimal @default(0)` field to PayrollRunItem via migration (requires `prisma migrate dev`). Parse the lineItemsJson in processRun to populate it. This is cleaner than JSON inspection in closeRun.

2. **Accounting entry reversal trigger placement**
   - What we know: Payable settlement happens in `payables.service.ts` `settlePayable()`.
   - What's unclear: Whether to hook into settlePayable via a direct call or via a post-settle event. The project has no event bus.
   - Recommendation: Direct call inside settlePayable, wrapped in try/catch, following the eSocial precedent. Only trigger reversal for PAYROLL-category payables.

3. **Cost-center allocation when employee has multiple active farms/contracts**
   - What we know: EmployeeContract has `costCenterId` and `farmId`. An employee can have contracts on multiple farms.
   - What's unclear: Which contract's cost center to use as fallback when no TimeEntryActivity exists.
   - Recommendation: Use the most recent active contract per the existing pattern in closeRun (farms ordered by startDate desc, take 1).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 32 is purely code changes extending existing backend modules and adding new frontend pages. No external services, CLIs, or tools beyond the existing project stack are required.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Framework          | Jest (backend), Vitest (frontend)                                                                                      |
| Config file        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`                                                        |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern="accounting-entries\|hr-dashboard\|payroll-runs" --passWithNoTests` |
| Full suite command | `cd apps/backend && pnpm test`                                                                                         |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                        | Test Type | Automated Command                                                 | File Exists?        |
| --------- | --------------------------------------------------------------- | --------- | ----------------------------------------------------------------- | ------------------- |
| INTEGR-01 | closeRun generates IRRF, VT, pension CPs with correct due dates | unit      | `pnpm test -- --testPathPattern="payroll-runs.routes.spec"`       | ✅ extends existing |
| INTEGR-01 | revertRun cancels all new originTypes                           | unit      | `pnpm test -- --testPathPattern="payroll-runs.routes.spec"`       | ✅ extends existing |
| INTEGR-01 | Cost-center rateio percentages sum to 100                       | unit      | `pnpm test -- --testPathPattern="payroll-runs.routes.spec"`       | ✅ extends existing |
| INTEGR-01 | cp-preview returns correct CP list without DB writes            | unit      | `pnpm test -- --testPathPattern="payroll-runs.routes.spec"`       | ✅ extends existing |
| INTEGR-02 | createPayrollEntries creates 6 canonical entry types            | unit      | `pnpm test -- --testPathPattern="accounting-entries.routes.spec"` | ❌ Wave 0           |
| INTEGR-02 | Reversal entry created when payable is settled                  | unit      | `pnpm test -- --testPathPattern="accounting-entries.routes.spec"` | ❌ Wave 0           |
| INTEGR-02 | Accounting failure does not abort closeRun                      | unit      | `pnpm test -- --testPathPattern="payroll-runs.routes.spec"`       | ✅ extends existing |
| INTEGR-03 | Dashboard returns correct headcount by status                   | unit      | `pnpm test -- --testPathPattern="hr-dashboard.routes.spec"`       | ❌ Wave 0           |
| INTEGR-03 | Cost per hectare uses Farm.totalAreaHa                          | unit      | `pnpm test -- --testPathPattern="hr-dashboard.routes.spec"`       | ❌ Wave 0           |
| INTEGR-03 | Contract expiry forecast buckets (30/60/90 days)                | unit      | `pnpm test -- --testPathPattern="hr-dashboard.routes.spec"`       | ❌ Wave 0           |

### Sampling Rate

- **Per task commit:** `pnpm test -- --testPathPattern="accounting-entries|hr-dashboard|payroll-runs.routes" --passWithNoTests`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full backend suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/accounting-entries/accounting-entries.routes.spec.ts` — covers INTEGR-02
- [ ] `apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.spec.ts` — covers INTEGR-03

_(payroll-runs.routes.spec.ts already exists — extend with new test cases)_

---

## Sources

### Primary (HIGH confidence)

- Codebase: `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — exact closeRun implementation, existing originTypes, revertRun scope
- Codebase: `apps/backend/prisma/schema.prisma` — PayrollRunItem fields (irrfAmount, vtDeduction, otherDeductions confirmed), PayableCostCenterItem model, Farm.totalAreaHa, EmployeeContract.endDate, ContractType enum
- Codebase: `apps/backend/src/modules/payroll-provisions/payroll-provisions.types.ts` — AccountingEntryStub documenting Phase 32 integration points
- Codebase: `.planning/STATE.md` Accumulated Context — locked decisions for payroll-to-payables and accounting stubs
- Codebase: `apps/frontend/src/hooks/useFinancialDashboard.ts` — hook pattern to replicate
- Codebase: `apps/frontend/src/components/financial-dashboard/RevenueExpenseChart.tsx` — recharts usage pattern

### Secondary (MEDIUM confidence)

- REQUIREMENTS.md Out of Scope table: "Plano de contas contábil completo — Módulo contabilidade é milestone separado v1.4" — confirms hardcoded account codes are correct scope for Phase 32
- STATE.md Phase 29 decision: "Accounting entry JSON stubs stored now, Phase 32 will wire to real GL entries (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02)" — confirms account code scheme

### Tertiary (LOW confidence)

- Brazilian accounting standards (NBC TG 26 / CPC 26) for regime de competência — training data; but the specific account codes (6.x.xx for expense, 2.x.xx for liability) are conventional Brazilian SME chart-of-accounts structure confirmed internally consistent with the stubs in codebase

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified against package.json
- Architecture: HIGH — based on direct codebase analysis of closeRun, PayrollRunItem fields, existing Payable and PayableCostCenterItem models
- Pitfalls: HIGH — all based on reading existing code patterns and the explicit STATE.md decisions
- Accounting entry codes: MEDIUM — consistent with existing stubs but not verified against an authoritative external source (acceptable since v1.4 will refactor this)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain — no fast-moving libraries involved)
