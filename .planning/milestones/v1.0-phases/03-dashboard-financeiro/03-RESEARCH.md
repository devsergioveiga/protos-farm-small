# Phase 3: Dashboard Financeiro - Research

**Researched:** 2026-03-16
**Domain:** Financial dashboard — read-only aggregation of bank accounts, payables, and receivables
**Confidence:** HIGH

## Summary

Phase 3 is a **read-only** frontend dashboard that consumes data from three already-implemented backend modules: `bank-accounts`, `payables`, and `receivables`. No new Prisma models are required. The primary backend work is a single new aggregation endpoint (`GET /api/org/financial-dashboard`) that joins data from these three sources.

The frontend follows the established pattern of a dedicated `FinancialDashboardPage` with a matching CSS module, a custom `useFinancialDashboard` hook, Recharts-based charts (already installed at v3.7.0), and Vitest+RTL spec file. The page becomes the home screen of the FINANCEIRO sidebar group — the first sidebar item, and the route at `/financial-dashboard`.

The most critical constraint is **never mixing saldo bancário real (bank balance) and saldo contábil (accounting balance)** in a single KPI number. These must be labeled and surfaced separately throughout the dashboard.

**Primary recommendation:** Build one new backend endpoint that aggregates from existing tables, then wire it to one new page using the project's established dashboard patterns (hook + page + CSS + spec).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout e KPIs**

- 4 cards KPI no topo: Saldo total | CP próximos 30d | CR próximos 30d | Resultado do mês
- Cada card mostra % variação vs mesmo mês ano anterior (seta verde / vermelha + percentual)
- Se não houver dados do ano anterior, mostrar "—" onde seria o comparativo

**Gráficos**

- Gráfico de barras: receitas vs despesas por mês (Recharts já instalado no projeto)
- Gráfico de pizza: top 5 categorias de despesa com percentual
- Ambos respondem ao filtro de fazenda e período

**Top 5 Despesas e Receitas**

- Cards ranqueados com ranking visual (1º, 2º...) e barra de progresso relativa
- Top 5 despesas por categoria | Top 5 clientes por receita
- Lado a lado em desktop, empilhados em mobile

**Comparativo Ano Anterior**

- % variação nos cards KPI — seta + percentual no próprio card
- Sem gráfico sobreposto (mantém visual limpo)
- Dados insuficientes: mostrar "—" (traço), nunca esconder o espaço

**Filtros e Período**

- Período padrão: mês atual (abre com mês corrente selecionado)
- Filtro por fazenda: dropdown com "Todas as fazendas" como padrão (consolida quando "Todas")
- Não usar FarmContext global — filtro local no dashboard para flexibilidade

**Rota e Navegação**

- Dashboard é a home do módulo financeiro — primeira página ao acessar o grupo FINANCEIRO
- Rota: `/financial-dashboard`
- Sidebar: adicionar item "Dashboard" como primeiro item do grupo FINANCEIRO (antes de Contas bancárias)

### Claude's Discretion

- Alertas: quais alertas mostrar e formato (vencidos, saldo negativo projetado, faturas cartão)
- Design exato dos cards KPI (tamanho, ícones, cores)
- Responsividade dos gráficos em mobile
- Período seletor: dropdown (Mês atual / Mês anterior / Último trimestre) vs date picker

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                   | Research Support                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| FN-15 | Proprietário pode ver dashboard financeiro consolidado com saldo total, CP vs CR 7/30 dias, resultado do mês, endividamento, top despesas/receitas e comparativo ano anterior | Single aggregation endpoint; all source data already in bank_account_balance, payable, receivable tables; Recharts already installed |

</phase_requirements>

---

## Standard Stack

### Core

| Library           | Version  | Purpose                                                    | Why Standard                                                              |
| ----------------- | -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| recharts          | 3.7.0    | BarChart (revenues vs expenses), PieChart (top categories) | Already installed and used in WeighingChartInner and CultivarProductivity |
| lucide-react      | existing | KPI card icons, alert icons                                | Project standard; used in all pages                                       |
| React 19 + Vitest | existing | Component + hook with spec file                            | Project standard for all frontend pages                                   |

### Supporting

| Library                   | Version  | Purpose                        | When to Use                                                                     |
| ------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------- |
| @protos-farm/shared Money | existing | Format BRL values in KPIs      | All monetary display — toBRL() or toLocaleString('pt-BR')                       |
| FarmContext (read only)   | existing | Provide farm list for dropdown | Use `farms` list only — do NOT use `selectedFarmId` (override with local state) |

### Alternatives Considered

| Instead of                  | Could Use                          | Tradeoff                                                                                             |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Single aggregation endpoint | Multiple parallel frontend fetches | Single endpoint reduces waterfalls and keeps aggregation logic server-side where Prisma can optimize |
| CSS modules (page.css)      | Tailwind                           | Project uses CSS modules + CSS vars for all pages — do not introduce Tailwind into pages             |

**Installation:** No new packages needed — recharts 3.7.0 already in `apps/frontend/package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/financial-dashboard/
├── financial-dashboard.routes.ts   # GET /org/financial-dashboard
├── financial-dashboard.service.ts  # aggregation logic
└── financial-dashboard.types.ts    # FinancialDashboardOutput

apps/frontend/src/
├── pages/
│   ├── FinancialDashboardPage.tsx  # main page component
│   ├── FinancialDashboardPage.css  # CSS module
│   └── FinancialDashboardPage.spec.tsx
├── hooks/
│   └── useFinancialDashboard.ts    # fetch + state + filters
└── components/financial-dashboard/
    ├── RevenueExpenseChart.tsx     # Recharts BarChart
    ├── TopCategoriesChart.tsx      # Recharts PieChart
    └── AlertsPanel.tsx             # overdue / projected negative balance
```

### Pattern 1: Aggregation Endpoint — GET /api/org/financial-dashboard

**What:** Single backend endpoint that aggregates from `BankAccountBalance`, `Payable`/`PayableInstallment`, `Receivable`/`ReceivableInstallment` tables using RLS context (orgId).

**Query parameters:** `farmId` (optional, empty = all farms), `year` (int), `month` (int, 1-12).

**Response shape:**

```typescript
// Source: derived from existing types in bank-accounts.types.ts, payables.service.ts, receivables.service.ts
interface FinancialDashboardOutput {
  // KPI 1: real bank balance (sum of BankAccountBalance.currentBalance where isActive = true)
  totalBankBalance: number;
  totalBankBalancePrevYear: number | null; // null = no data

  // KPI 2: payables due in next 30 days (status PENDING or OVERDUE, dueDate <= today + 30d)
  payablesDue30d: number;
  payablesDue30dPrevYear: number | null;

  // KPI 3: receivables expected in next 30 days (status PENDING, dueDate <= today + 30d)
  receivablesDue30d: number;
  receivablesDue30dPrevYear: number | null;

  // KPI 4: month result = settled CR - settled CP in selected month
  // settled CP = status PAID, paidAt in month; settled CR = status RECEIVED, receivedAt in month
  monthResult: number;
  monthResultPrevYear: number | null;

  // Bar chart: last 6 months revenues vs expenses (realized only)
  monthlyTrend: Array<{
    yearMonth: string; // "2026-01"
    revenues: number; // sum of receivedAmount for CRs settled in that month
    expenses: number; // sum of amountPaid for CPs settled in that month
  }>;

  // Pie chart: top 5 expense categories by total amount (all statuses in selected period)
  topExpenseCategories: Array<{
    category: string;
    categoryLabel: string;
    total: number;
    percentage: number;
  }>;

  // Ranked list: top 5 payable categories
  topPayablesByCategory: Array<{
    rank: number;
    category: string;
    categoryLabel: string;
    total: number;
    relativePercent: number; // % relative to #1
  }>;

  // Ranked list: top 5 receivable clients
  topReceivablesByClient: Array<{
    rank: number;
    clientName: string;
    total: number;
    relativePercent: number;
  }>;

  // Alerts (Claude's discretion: overdue payables, projected negative balance)
  alerts: {
    overduePayablesCount: number;
    overduePayablesTotal: number;
    projectedBalanceNegative: boolean; // totalBankBalance - payablesDue30d < 0
  };
}
```

**When to use:** Always — this is the only backend endpoint for the phase.

**Example service skeleton:**

```typescript
// Source: pattern from payables-aging.service.ts + bank-accounts.service.ts
export async function getFinancialDashboard(
  ctx: RlsContext,
  query: { farmId?: string; year: number; month: number },
): Promise<FinancialDashboardOutput> {
  return withRlsContext(ctx, async (tx) => {
    const { farmId, year, month } = query;
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 86400000);

    const prevYear = year - 1;
    const prevMonthStart = new Date(Date.UTC(prevYear, month - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(prevYear, month, 0, 23, 59, 59, 999));

    // farmId filter: if provided, use on payable.farmId and bank account farms join
    // ...queries...
  });
}
```

### Pattern 2: Hook — useFinancialDashboard

**What:** Custom hook that holds filter state (farmId, year, month) and fetches from the aggregation endpoint.

**Follow:** Exact same pattern as `useMilkDashboard` — local state for period/farm, `useCallback` for fetch, `useEffect` on dependencies.

```typescript
// Source: apps/frontend/src/hooks/useMilkDashboard.ts pattern
export type FinancialDashboardPeriod = { year: number; month: number };

export function useFinancialDashboard(params: {
  farmId: string | null;
  period: FinancialDashboardPeriod;
}): {
  data: FinancialDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};
```

### Pattern 3: Recharts BarChart — Monthly Revenue vs Expenses

**What:** Grouped BarChart, two bars per month (receitas = green, despesas = red/neutral).

**Follow:** Pattern from `CultivarProductivity.tsx`:

```typescript
// Source: apps/frontend/src/components/cultivars/CultivarProductivity.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

<ResponsiveContainer width="100%" height={240}>
  <BarChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
    <XAxis dataKey="yearMonth" tick={{ fontSize: 12, fontFamily: "'Source Sans 3', system-ui, sans-serif" }} />
    <YAxis tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />
    <Tooltip contentStyle={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: '0.875rem' }}
             formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
    <Legend />
    <Bar dataKey="revenues" name="Receitas" fill="var(--color-primary-600)" />
    <Bar dataKey="expenses" name="Despesas" fill="var(--color-neutral-400)" />
  </BarChart>
</ResponsiveContainer>
```

### Pattern 4: Recharts PieChart — Top 5 Expense Categories

**What:** Simple PieChart with percentage labels and a legend below. No onClick. aria-label on container.

**Mobile:** On mobile (< 768px), reduce height to 200px and show legend below the chart, not beside it.

### Pattern 5: KPI Card with Year-over-Year Comparison

**What:** Card showing current value, trend arrow, and % change. Pattern used in `MilkDashboardPage`.

```tsx
// Source: apps/frontend/src/pages/MilkDashboardPage.tsx TrendIcon pattern
function YoyBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="fin-dashboard__yoy--neutral">—</span>;
  const pct = (value * 100).toFixed(1);
  if (value > 0)
    return (
      <span className="fin-dashboard__yoy--up" aria-label={`+${pct}% vs ano anterior`}>
        ↑ {pct}%
      </span>
    );
  if (value < 0)
    return (
      <span className="fin-dashboard__yoy--down" aria-label={`${pct}% vs ano anterior`}>
        ↓ {pct}%
      </span>
    );
  return (
    <span className="fin-dashboard__yoy--neutral" aria-label="Sem variação">
      — 0%
    </span>
  );
}
```

### Pattern 6: Farm Filter Dropdown — Local State, Not FarmContext

**What:** The dashboard uses a LOCAL `farmId` state initialized to `null` (= "Todas as fazendas"). It reads `farms` from FarmContext for the dropdown options but does NOT write to `selectFarm`.

```tsx
// Pattern: local filter, reads FarmContext farms list only
const { farms } = useFarmContext();
const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
// Pass selectedFarmId to useFinancialDashboard, not FarmContext.selectedFarmId
```

### Pattern 7: Period Selector

**Recommendation (Claude's discretion):** Use a simple dropdown (`<select>`) not a date picker — consistent with `MilkDashboardPage`'s PERIOD_OPTIONS pattern.

```typescript
const PERIOD_OPTIONS = [
  { label: 'Mês atual', value: 'current' },
  { label: 'Mês anterior', value: 'previous' },
  { label: 'Último trimestre', value: 'quarter' }, // maps to current quarter month-by-month for charts
];
```

Resolve to `{ year, month }` for the hook. "Último trimestre" shows 3 months in the trend chart and picks the first month of the quarter for KPI aggregation.

### Pattern 8: Alerts Panel (Claude's discretion)

Three alert types to show:

1. **Vencidas** — `overduePayablesCount > 0`: "N contas a pagar vencidas totalizando R$ X"
2. **Saldo projetado negativo** — `projectedBalanceNegative === true`: "Saldo bancário pode ficar negativo nos próximos 30 dias"
3. No alerts: empty state with CheckCircle icon — matches `DashboardPage` AlertsSection pattern

### Anti-Patterns to Avoid

- **Do not mix saldo bancário real with saldo contábil.** The KPI "Saldo total" shows only `BankAccountBalance.currentBalance` (real bank balance). Never add pending CP/CR to this number.
- **Do not call multiple backend endpoints in parallel from the page.** Use the single aggregation endpoint. Multiple calls create race conditions and inconsistent filter application.
- **Do not use `FarmContext.selectedFarmId` as the initial farm filter.** The dashboard has its own local filter state defaulting to "Todas as fazendas".
- **Do not import Recharts at page level.** Use `React.lazy` or an inner component file (see `WeighingChartInner.tsx` pattern) — Recharts is a large bundle.

---

## Don't Hand-Roll

| Problem                                     | Don't Build                  | Use Instead                                               | Why                                                     |
| ------------------------------------------- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Bar/pie charts                              | Custom SVG charts            | recharts BarChart + PieChart                              | Responsive, accessible, tooltips included               |
| Currency formatting                         | Custom formatter             | `toLocaleString('pt-BR', { minimumFractionDigits: 2 })`   | Locale-correct BRL formatting — already used everywhere |
| Aging calculation (which CP are due in 30d) | Custom date math in frontend | Backend endpoint query with `dueDate <= today + 30d`      | Keeps date logic server-side, avoids timezone bugs      |
| YoY % calculation                           | Frontend diff                | Backend computes `prevYearValue` — frontend just displays | Backend has access to all data; frontend only displays  |

**Key insight:** The entire aggregation logic belongs in the backend service. The frontend is a display layer — it receives pre-computed KPIs, chart data, and alert flags.

---

## Common Pitfalls

### Pitfall 1: Saldo Real vs Saldo Contábil Confusion

**What goes wrong:** Developer adds pending CP/CR to the bank balance KPI "for a better picture", producing a number that is neither real nor accounting-correct.
**Why it happens:** Intuitive desire to show "effective" position.
**How to avoid:** KPI 1 ONLY shows `BankAccountBalance.currentBalance`. KPIs 2 and 3 show upcoming CP/CR separately. Never add them.
**Warning signs:** If a single KPI card shows "Saldo: R$ X (inclui R$ Y a receber)" — that is the anti-pattern.

### Pitfall 2: Timezone-Shifted Month Boundaries

**What goes wrong:** Month-start date computed as `new Date(year, month-1, 1)` evaluates at local midnight, not UTC midnight, so records near midnight on boundary dates fall in the wrong month.
**Why it happens:** JavaScript's `new Date(y, m, d)` uses local timezone.
**How to avoid:** Use `new Date(Date.UTC(year, month - 1, 1))` — same pattern as Phase 2 decision in STATE.md.
**Warning signs:** Tests that pass in UTC-0 environment but fail in BRT (UTC-3).

### Pitfall 3: Missing farmId Filter on Payables/Receivables Queries

**What goes wrong:** When farmId filter is provided but payables or receivables have `farmId = null` (org-level), the query might exclude them incorrectly.
**Why it happens:** Some CP/CR are not linked to a specific farm.
**How to avoid:** When farmId filter is "Todas as fazendas" (null), omit the farmId WHERE clause. When a specific farmId is selected, filter on `farmId = ?` but note that some CP/CR may have null farmId — decide upfront whether to include them (recommendation: include null-farmId records when a specific farm is selected, as they are org-level obligations).

### Pitfall 4: Recharts Bundle Size in Test Environment

**What goes wrong:** Vitest spec file fails or is slow because Recharts imports are not mocked.
**Why it happens:** Recharts relies on browser APIs not available in jsdom.
**How to avoid:** Add `vi.mock('recharts', ...)` at top of spec file — exact same pattern as `WeighingTab.spec.tsx` and `MonitoringTimelinePage.spec.tsx`.

### Pitfall 5: Resultado do Mês — Which Statuses Count

**What goes wrong:** Developer counts PENDING CP/CR in the month result, making it a projection not a realized result.
**Why it happens:** Ambiguity between "expected" and "realized".
**How to avoid:** Resultado do mês = sum of `amountPaid` where `paidAt` is in month (status PAID) MINUS sum of `receivedAmount` where `receivedAt` is in month (status RECEIVED). Never include PENDING records.

### Pitfall 6: YoY Comparison When No Prior-Year Data Exists

**What goes wrong:** Division by zero or NaN when computing percentage change from 0 to nonzero.
**How to avoid:** Return `null` from backend when previous year has no data (no records in that month). Frontend renders "—" for null. Never compute `(current - 0) / 0`.

---

## Code Examples

Verified patterns from existing codebase:

### Recharts mock in spec file

```typescript
// Source: apps/frontend/src/components/animals/WeighingTab.spec.tsx
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Bar: () => <div />,
  Pie: () => <div />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
}));
```

### Lazy route registration pattern

```typescript
// Source: apps/frontend/src/App.tsx
const FinancialDashboardPage = lazy(() => import('@/pages/FinancialDashboardPage'));
// ...
<Route path="/financial-dashboard" element={<FinancialDashboardPage />} />
```

### Sidebar FINANCEIRO group update

```typescript
// Source: apps/frontend/src/components/layout/Sidebar.tsx — current FINANCEIRO group
// Current: { to: '/bank-accounts', icon: Building2, label: 'Contas bancárias' }
// Add BEFORE it:
{ to: '/financial-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
```

### Backend route registration in app.ts

```typescript
// Source: apps/backend/src/app.ts — add alongside existing financial routers
import { financialDashboardRouter } from './modules/financial-dashboard/financial-dashboard.routes';
// ...
app.use('/api', financialDashboardRouter);
```

### RLS context pattern (consistent with all financial modules)

```typescript
// Source: apps/backend/src/modules/payables-aging/payables-aging.routes.ts
function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) throw new Error('Acesso negado: usuário sem organização vinculada');
  return { organizationId };
}
```

### Money aggregation pattern

```typescript
// Source: apps/backend/src/modules/bank-accounts/bank-accounts.service.ts getDashboard()
let totalBalance = Money(0);
for (const acc of accounts) {
  const current = Money.fromPrismaDecimal(acc.balance?.currentBalance ?? 0);
  totalBalance = totalBalance.add(current);
}
return { totalBalance: totalBalance.toNumber() };
```

---

## State of the Art

| Old Approach                         | Current Approach             | When Changed         | Impact                                                                             |
| ------------------------------------ | ---------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| FarmContext selectedFarmId as filter | Local dashboard filter state | Phase 3 decision     | Dashboard shows "Todas as fazendas" by default without changing global nav context |
| Saldo projetado placeholder ('--')   | Real bank balance KPI        | Phase 1 decision doc | Phase 3 now has real data to show                                                  |

**Deprecated/outdated:**

- Saldo projetado in BankAccountsPage showed '--' placeholder pending AR/AP integration (Phase 1 decision). Phase 3 adds real projected balance alerts using actual CP/CR data — but the BankAccountsPage placeholder stays as-is.

---

## Open Questions

1. **Endividamento total (FN-15 requirement)**
   - What we know: FN-15 mentions "endividamento" as a KPI. CONTEXT.md specifics section says: "Endividamento total = soma dos saldos devedores de crédito rural (quando Phase 6 existir, por agora pode ser omitido ou mostrar 0)"
   - What's unclear: Should the KPI card exist but show 0, or be omitted entirely until Phase 6?
   - Recommendation: Show the KPI card with value "0" and subtitle "Crédito rural disponível na Fase 6" — this satisfies FN-15 visually while making the placeholder obvious.

2. **Bank balance filter by farmId**
   - What we know: `BankAccount` has a many-to-many with `Farm` (via `BankAccountFarm`). The dashboard filter is by farm.
   - What's unclear: Should "Saldo total" when filtered by farm X show only accounts linked to farm X?
   - Recommendation: Yes — query bank accounts where `farms.some(f => f.farmId === farmId)`. For "Todas as fazendas", sum all active accounts. This is the most intuitive behavior.

3. **Period "Último trimestre" and chart data**
   - What we know: Bar chart shows monthly data. "Último trimestre" covers 3 months.
   - What's unclear: For the 4 KPI cards, which single month do we show when trimestre is selected?
   - Recommendation: When "Último trimestre" is selected, KPI cards show the full 3-month aggregate (not a single month), and the trend chart shows those 3 months. Resultado do mês label changes to "Resultado do trimestre".

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Vitest + @testing-library/react (jsdom)                                |
| Config file        | `apps/frontend/vitest.config.ts` (globals: true, environment: jsdom)   |
| Quick run command  | `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboard` |
| Full suite command | `pnpm --filter @protos-farm/frontend test --run`                       |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                       | Test Type      | Automated Command                                                          | File Exists? |
| ------- | -------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------- | ------------ |
| FN-15-A | KPI cards render saldo total, CP 30d, CR 30d, resultado do mês | unit           | `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboardPage` | ❌ Wave 0    |
| FN-15-B | Dashboard shows YoY % with arrow or "—" when no prior data     | unit           | `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboardPage` | ❌ Wave 0    |
| FN-15-C | Farm filter changes data fetch query params                    | unit           | `pnpm --filter @protos-farm/frontend test --run -- useFinancialDashboard`  | ❌ Wave 0    |
| FN-15-D | Bar chart renders (mocked recharts)                            | unit           | `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboardPage` | ❌ Wave 0    |
| FN-15-E | Skeleton shown during loading, error state shown on failure    | unit           | `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboardPage` | ❌ Wave 0    |
| FN-15-F | Backend endpoint aggregates CP due in 30d correctly            | unit (backend) | `pnpm --filter @protos-farm/backend test -- financial-dashboard`           | ❌ Wave 0    |
| FN-15-G | totalBankBalance never mixes with pending CP/CR                | unit (backend) | `pnpm --filter @protos-farm/backend test -- financial-dashboard`           | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/frontend test --run -- FinancialDashboard`
- **Per wave merge:** `pnpm --filter @protos-farm/frontend test --run && pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/frontend/src/pages/FinancialDashboardPage.spec.tsx` — covers FN-15-A, FN-15-B, FN-15-D, FN-15-E
- [ ] `apps/frontend/src/hooks/useFinancialDashboard.spec.ts` — covers FN-15-C (optional, hook is thin)
- [ ] `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.spec.ts` — covers FN-15-F, FN-15-G

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `apps/frontend/src/hooks/useMilkDashboard.ts` — hook pattern
- Codebase inspection: `apps/frontend/src/components/animals/WeighingChartInner.tsx` — Recharts LineChart pattern
- Codebase inspection: `apps/frontend/src/components/cultivars/CultivarProductivity.tsx` — Recharts BarChart + Cell pattern
- Codebase inspection: `apps/backend/src/modules/bank-accounts/bank-accounts.service.ts` getDashboard() — Money aggregation pattern
- Codebase inspection: `apps/backend/src/modules/payables-aging/payables-aging.service.ts` — aging bucket + date query pattern
- Codebase inspection: `apps/frontend/src/components/layout/Sidebar.tsx` — FINANCEIRO group structure
- Codebase inspection: `apps/frontend/src/App.tsx` — lazy route registration
- `.planning/STATE.md` — Phase 2 decisions: UTC date methods, Money factory, RLS context

### Secondary (MEDIUM confidence)

- `recharts` v3.7.0 package.json entry — version confirmed installed
- `WeighingTab.spec.tsx` + `MonitoringTimelinePage.spec.tsx` — recharts mock pattern verified

### Tertiary (LOW confidence)

- None — all findings verified from direct codebase inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed installed via package.json inspection
- Architecture: HIGH — patterns directly copied from 4+ existing dashboard pages in the codebase
- Pitfalls: HIGH — derived from Phase 1 and Phase 2 STATE.md decisions and direct code inspection
- Backend query structure: MEDIUM — table structure confirmed via service files, but exact Prisma query for cross-table aggregation not prototyped

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain — no fast-moving dependencies)
