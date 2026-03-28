# Phase 39: DRE, Balanco Patrimonial e Validacao Cruzada - Research

**Researched:** 2026-03-28
**Domain:** Financial statements (DRE/BP) from ledger data — pure calculator services, chart-of-accounts code mapping, cross-validation invariants, recharts sparklines/bar charts
**Confidence:** HIGH (all findings verified from existing codebase)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout DRE**

- D-01: Layout fixo rural hardcoded no service. 10 secoes: Receita Operacional Bruta (agricola/pecuaria/industrializacao), Deducoes (FUNRURAL, devolucoes), Receita Liquida, CPV (por grupo agricola/pecuario — nao por cultura), Lucro Bruto, Despesas Operacionais (admin/comerciais/financeiras/depreciacao), Variacao Valor Justo CPC 29, Resultado Antes IR/CSLL, IR/CSLL, Resultado Liquido.
- D-02: Mapeamento de contas as secoes por codigo hierarquico: 3.1.xx = Receita Agricola, 3.2.xx = Pecuaria, 3.3.xx = Industrializacao, 4.1.xx = Deducoes, 5.1.xx = CPV Agricola, 5.2.xx = CPV Pecuario, 6.1.xx = Desp. Admin, 6.2.xx = Desp. Comerciais, 6.3.xx = Desp. Financeiras. Contas com isFairValueAdj=true vao para secao CPC 29.
- D-03: CPV detalhado por grupo (agricola/pecuario) nao por cultura individual.
- D-04: Secao CPC 29 mostra total consolidado (uma linha unica). Soma todas contas com isFairValueAdj=true.

**Comparativos e Filtros**

- D-05: 3 colunas comparativas: Mes atual | Acumulado exercicio | Mesmo periodo ano anterior.
- D-06: Analise V/H via toggle button. OFF por padrao. ON adiciona colunas % vertical (sobre receita liquida) e Delta% horizontal.
- D-07: Filtro por centro de custo: dropdown unico "Consolidado" (default) + lista CCs.
- D-08: Ranking de culturas por margem bruta abaixo da tabela DRE. So aparece quando filtro = Consolidado.

**Balanco Patrimonial e Indicadores**

- D-09: 6 cards indicadores no topo: Liquidez Corrente, Liquidez Seca, Endividamento Geral, Composicao Endividamento, ROE, PL/ha. Cada card com mini-sparkline.
- D-10: PL/ha calculado usando soma de Farm.totalAreaHa de todas as fazendas da organizacao.
- D-11: BP com 2 colunas: Saldo atual | Saldo periodo anterior.

**Painel de Vinculacao**

- D-12: 4 cards grid 2x2 com semaforo verde/vermelho.
- D-13: 4 invariantes: (1) RL DRE = Delta Lucros Acumulados BP, (2) Variacao caixa DFC = variacao caixa/bancos BP (placeholder), (3) AT = PT + PL, (4) Total debitos = total creditos balancete.
- D-14: Invariante DFC↔BP: card placeholder cinza "Aguardando DFC (Phase 40)". Backend retorna null.
- D-15: Invariante falho: card vermelho com diferenca. Botao "Investigar" abre razao/balancete filtrado.

**Navegacao Frontend**

- D-16: 3 paginas separadas: /dre, /balance-sheet, /cross-validation. Sidebar grupo CONTABILIDADE.

### Claude's Discretion

- Estrutura interna do DreCalculatorService e BpCalculatorService (classes puras vs funcoes)
- Queries SQL ou Prisma para agregar AccountBalance por secao
- Detalhes visuais dos sparklines (biblioteca, cores)
- Formato do bar chart no ranking por margem (biblioteca recharts ou similar)
- Verificacao do seed COA rural para sub-contas do grupo 5.x
- Labels e tooltips dos indicadores financeiros

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                         | Research Support                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| DRE-01  | DRE com layout rural: Receita Bruta, Deducoes, Receita Liquida, CPV, Lucro Bruto, Desp. Operacionais, Resultado, CPC 29, IR/CSLL, Resultado Liquido | COA template codes verified; AccountBalance query pattern from getTrialBalance; isFairValueAdj flag exists on ChartOfAccount |
| DRE-02  | Analise vertical (% sobre receita liquida), horizontal (variacao vs periodo anterior), 3 colunas comparativas                                       | Pure calculator arithmetic; multiple AccountBalance reads for different months/years                                         |
| DRE-03  | Filtro por centro de custo; ranking culturas por margem                                                                                             | Critical: costCenterId NOT in AccountBalance unique key — must query JournalEntryLine directly for CC-filtered DRE           |
| BP-01   | BP com classificacao rural: AC, ANC, PC, PNC, PL                                                                                                    | COA template maps: 1.1 = AC, 1.2 = ANC, 2.1 = PC, 2.2 = PNC, 3 = PL; AccountBalance closingBalance is the BP figure          |
| BP-02   | 6 indicadores financeiros calculados automaticamente com sparklines de tendencia                                                                    | Farm.totalAreaHa exists; need 6-12 months of AccountBalance data; recharts 3.7.0 already installed                           |
| VINC-01 | Painel 4 invariantes com semaforo verde/vermelho                                                                                                    | Pure arithmetic comparisons: DRE result vs BP delta; AT=PT+PL; trial balance; DFC placeholder                                |

</phase_requirements>

---

## Summary

Phase 39 builds three pure-calculator report pages (DRE, BP, Cross-Validation) on top of data already written by the auto-posting engine into `AccountBalance` and `JournalEntryLine`. No new migrations are needed — all the underlying data structures exist. The work is: (1) query and aggregate existing data into financial statement shapes; (2) implement pure arithmetic for ratios, V/H analysis, and cross-validation invariants; (3) build three frontend pages with recharts visualizations.

The most critical architectural finding is that **`AccountBalance` does not have a cost-center dimension in its unique index**. The unique constraint is `(organizationId, accountId, fiscalYearId, month)` — no `costCenterId`. This means the cost-center filtered DRE (D-07) cannot read from `AccountBalance` pre-aggregated data; it must aggregate directly from `JournalEntryLine` filtered by `costCenterId`. This is a design trade-off the planner must handle.

The second important finding is a **discrepancy between D-02 and the actual COA template**. Decision D-02 describes the DRE section mapping using codes `3.1.xx`, `3.2.xx`, etc. (Receita = group 3). However, the actual seeded rural template uses group `4` for RECEITAS (`4.1.xx = Receita Venda Graos`, `4.2.xx = Outras Receitas`) and group `5` for DESPESAS/CPV (`5.1.xx = CPV`, `5.2.xx = Despesas Operacionais`). The service must use the actual template codes.

**Primary recommendation:** Implement DreCalculatorService and BpCalculatorService as pure TypeScript functions (not classes) that accept a pre-loaded array of `AccountBalance + ChartOfAccount` records and perform all arithmetic in memory using Decimal.js. The route handler queries the DB; the service transforms and calculates. For CC-filtered DRE, use a separate aggregation path from `JournalEntryLine`.

---

## Standard Stack

### Core (Already Installed)

| Library    | Version | Purpose                                            | Status                |
| ---------- | ------- | -------------------------------------------------- | --------------------- |
| decimal.js | ^10.6.0 | Financial precision arithmetic                     | Installed in backend  |
| pdfkit     | ^0.17.2 | PDF export (future VINC-02, not Phase 39)          | Installed in backend  |
| exceljs    | ^4.4.0  | XLSX export (not Phase 39)                         | Installed in backend  |
| recharts   | ^3.7.0  | Bar charts (ranking), sparklines (indicator cards) | Installed in frontend |

### No New Dependencies Required

This phase requires zero new npm packages. All necessary libraries are already present.

```bash
# No installation needed — all dependencies already present
```

**Version verification (confirmed from package.json):**

- `decimal.js@^10.6.0` — backend package.json, confirmed
- `recharts@^3.7.0` — frontend package.json, confirmed

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
  financial-statements/           # new module
    dre.calculator.ts             # pure function, no Prisma imports
    bp.calculator.ts              # pure function, no Prisma imports
    cross-validation.calculator.ts # pure function, 4 invariants
    financial-statements.service.ts # DB queries + calls calculators
    financial-statements.routes.ts
    financial-statements.routes.spec.ts
    financial-statements.types.ts

apps/frontend/src/
  pages/
    DrePage.tsx + DrePage.css
    BalanceSheetPage.tsx + BalanceSheetPage.css
    CrossValidationPage.tsx + CrossValidationPage.css
  hooks/
    useDre.ts
    useBalanceSheet.ts
    useCrossValidation.ts
  types/
    financial-statements.ts
  components/financial-statements/
    IndicatorCard.tsx        # BP indicator card with sparkline
    DreTable.tsx             # DRE main table with V/H toggle
    MarginRankingChart.tsx   # Horizontal bar chart (recharts)
    InvariantCard.tsx        # Cross-validation card with traffic light
```

### Pattern 1: Pure Calculator Functions

**What:** Calculator services are plain TypeScript functions that receive already-fetched data arrays and return structured output. Zero Prisma imports.

**When to use:** Any calculation that transforms ledger data into financial statements.

```typescript
// Source: CONTEXT.md + existing ledger.service.ts pattern
// apps/backend/src/modules/financial-statements/dre.calculator.ts

import Decimal from 'decimal.js';
import type { DreInput, DreOutput, DreSection } from './financial-statements.types';

// All inputs are plain data; no async, no Prisma
export function calculateDre(input: DreInput): DreOutput {
  const sections = buildSections(input.accounts, input.balances);
  const verticalBase = sections.find((s) => s.id === 'receita-liquida')?.total ?? new Decimal(0);
  // ... arithmetic only
  return { sections, verticalBase: verticalBase.toFixed(2) };
}
```

### Pattern 2: DB Query in Service, Calculation in Calculator

**What:** Service layer does all Prisma reads; then calls pure calculator.

**When to use:** Every report endpoint in this phase.

```typescript
// apps/backend/src/modules/financial-statements/financial-statements.service.ts
import { prisma } from '../../database/prisma';
import { calculateDre } from './dre.calculator';
import type { DreFilters } from './financial-statements.types';

export async function getDre(organizationId: string, filters: DreFilters) {
  // 1. Load COA accounts
  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, code: true, name: true, accountType: true,
              nature: true, isFairValueAdj: true, isSynthetic: true, parentId: true },
  });

  // 2a. Consolidated DRE: read from AccountBalance
  if (!filters.costCenterId) {
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month },
    });
    return calculateDre({ accounts, balances, ... });
  }

  // 2b. CC-filtered DRE: aggregate from JournalEntryLine
  const lines = await prisma.$queryRaw<...>`
    SELECT jel."accountId", jel.side, SUM(jel.amount) as total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalEntryId"
    WHERE je."organizationId" = ${organizationId}
      AND jel."costCenterId" = ${filters.costCenterId}
      AND je.status = 'POSTED'
      AND je."periodId" IN (${...period IDs...})
    GROUP BY jel."accountId", jel.side
  `;
  return calculateDre({ accounts, balances: lineAggregatesToBalances(lines), ... });
}
```

### Pattern 3: AccountBalance Code Mapping for DRE

**What:** Map COA codes to DRE sections using the ACTUAL rural template codes (not the codes described in D-02).

**CRITICAL:** Decision D-02 says `3.1.xx = Receita Agricola`, but the seeded COA uses group `4` for RECEITAS and group `5` for DESPESAS/CPV. The mapping must use the actual account codes from the template.

```typescript
// Actual COA rural template account code structure:
// Group 1 = ATIVO
// Group 2 = PASSIVO
// Group 3 = PATRIMONIO LIQUIDO
// Group 4 = RECEITAS
// Group 5 = DESPESAS E CUSTOS
// Group 6 = DESPESAS COM PESSOAL (LEGADO)

// DRE section mapping (verified from coa-rural-template.ts):
const DRE_SECTION_MAP: Record<string, string> = {
  // Receita Bruta
  '4.1': 'receita-agropecuaria', // 4.1.xx = Receitas Agropecuarias
  '4.1.03': 'cpc29', // isFairValueAdj=true overrides
  '4.2': 'outras-receitas',
  // Deducoes: no explicit code in template (manual mapping needed)
  // CPV
  '5.1': 'cpv-agricola', // 5.1.01 = Custo Producao Vegetal
  '5.1.01': 'cpv-agricola',
  '5.1.02': 'cpv-pecuario',
  // Despesas Operacionais
  '5.2': 'despesas-operacionais', // 5.2.01 = Admin, 5.2.02 = Pessoal, 5.2.03 = Deprec
  '5.3': 'despesas-financeiras',
  '6.1': 'despesas-pessoal-legado', // Legacy group still in use
};
// isFairValueAdj=true always maps to CPC 29 section regardless of code prefix
```

### Pattern 4: Recharts Sparkline for Indicator Cards

**What:** Small `LineChart` with no axes/legend — used for the 6 BP indicator trend cards.

**When to use:** Indicator cards in BalanceSheetPage showing 6-12 month trend.

```typescript
// Source: apps/frontend/src/components/purchasing-dashboard/MonthlyEvolutionChart.tsx (existing pattern)
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

function Sparkline({ data }: { data: { month: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="value" dot={false}
              stroke="var(--color-primary-600)" strokeWidth={1.5} />
        <Tooltip formatter={(v: number) => formatBRL(v)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 5: Horizontal BarChart for Margin Ranking

**What:** `BarChart layout="vertical"` from recharts — used for culture margin ranking section in DRE.

```typescript
// Source: apps/frontend/src/components/purchasing-dashboard/UrgentVsPlannedChart.tsx (existing pattern)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MarginRankingChart({ data }: { data: { name: string; margin: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 36 + 40}>
      <BarChart layout="vertical" data={data}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} />
        <YAxis type="category" dataKey="name" width={140} />
        <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
        <Bar dataKey="margin" fill="var(--color-primary-600)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Recommended API Endpoint Structure

```
GET /api/org/:orgId/financial-statements/dre
  ?fiscalYearId=...&month=...&costCenterId=... (optional)
  Returns: DreOutput

GET /api/org/:orgId/financial-statements/balance-sheet
  ?fiscalYearId=...&month=...
  Returns: BpOutput

GET /api/org/:orgId/financial-statements/cross-validation
  ?fiscalYearId=...&month=...
  Returns: CrossValidationOutput
```

### Anti-Patterns to Avoid

- **Importing Prisma in calculator files:** Calculators must be pure functions. No `import { prisma }` in dre.calculator.ts or bp.calculator.ts. Keeps them unit-testable with in-memory data.
- **Reading AccountBalance for CC-filtered DRE:** AccountBalance unique key is `(org, account, fiscalYear, month)` — no costCenterId. Querying AccountBalance and filtering by costCenterId will return the consolidated balance, not the CC-specific balance. Use JournalEntryLine aggregation instead.
- **Using D-02 code mapping literally:** D-02 says "3.1.xx = Receita Agricola" but the seeded COA uses group 4 for RECEITAS. The service must use the actual template: `4.x.xx` for revenues, `5.x.xx` for costs/expenses.
- **Double-counting synthetic accounts:** The existing `getTrialBalance` already solved this with `analyticIds` set — the same pattern must be used in DRE/BP calculators. Only sum analytic (leaf) accounts, not their synthetic parents.
- **Mixing DRE and BP account types:** DRE = accounts with `accountType IN (RECEITA, DESPESA)` for period movements. BP = accounts with `accountType IN (ATIVO, PASSIVO, PL)` using `closingBalance`. Never mix.

---

## Don't Hand-Roll

| Problem              | Don't Build                 | Use Instead                                   | Why                                                      |
| -------------------- | --------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Financial arithmetic | Custom number operations    | `Decimal.js` (already installed)              | Floating-point precision errors in currency              |
| Bar charts           | Custom SVG charts           | `recharts@3.7.0` (already installed)          | Proven, accessible, already used in purchasing-dashboard |
| Sparklines           | `<canvas>` or custom SVG    | `recharts LineChart` with no axes             | Same library, minimal config needed                      |
| Trial balance totals | Re-aggregating from scratch | Reuse `getTrialBalance()` from ledger.service | Already aggregates synthetic accounts correctly          |
| Auth middleware      | New auth check              | `withRlsContext` + existing JWT middleware    | Same pattern as every other org route                    |

**Key insight:** This phase is 100% calculation and presentation on top of data already written by Phases 36-38. Zero new data writes, zero migrations.

---

## Common Pitfalls

### Pitfall 1: AccountBalance Has No Cost-Center Granularity

**What goes wrong:** Developer reads AccountBalance with `where: { costCenterId }` expecting per-CC figures. Gets the consolidated balance or null rows because the unique constraint ignores costCenterId.

**Why it happens:** The AccountBalance model has `costCenterId String?` as an informational field (from when the entry was last updated), but the `@@unique` is `(org, account, fiscalYear, month)`. The auto-posting engine writes one row per account per month, not one per account per month per CC.

**How to avoid:** For consolidated DRE/BP: use AccountBalance directly. For CC-filtered DRE: use raw SQL aggregation from JournalEntryLine joining JournalEntry where `jel.costCenterId = ?`.

**Warning signs:** CC-filtered DRE returns same numbers as consolidated DRE.

### Pitfall 2: COA Code Mismatch Between D-02 and Actual Template

**What goes wrong:** DreCalculatorService maps `3.1.xx` to "Receita Agricola" as per D-02, but the actual seeded COA has no accounts under group 3 for revenues (group 3 = Patrimonio Liquido in the template).

**Why it happens:** D-02 describes codes in abstract; the actual template uses a different numbering scheme.

**Actual mapping (verified from coa-rural-template.ts):**

- Group 1 = Ativo (BP)
- Group 2 = Passivo (BP)
- Group 3 = Patrimonio Liquido (BP)
- Group 4 = Receitas (DRE revenues)
  - 4.1 = Receitas Agropecuarias
  - 4.1.03 = Variacao Valor Justo (isFairValueAdj=true, CPC 29 section)
  - 4.2 = Outras Receitas Operacionais
  - 4.3 = Receitas Financeiras
- Group 5 = Despesas e Custos (DRE costs/expenses)
  - 5.1 = CPV (5.1.01 Vegetal, 5.1.02 Pecuario)
  - 5.2 = Despesas Operacionais (5.2.01 Admin, 5.2.02 Pessoal, 5.2.03 Depreciacoes)
  - 5.3 = Despesas Financeiras
- Group 6 = Despesas Pessoal Legado (6.1.xx used by auto-posting for payroll)

**How to avoid:** Read coa-rural-template.ts first; derive the section mapping from actual codes.

**Warning signs:** DRE shows zero revenue because `startsWith('3.1')` matches no accounts.

### Pitfall 3: Acumulado do Exercicio Requires Summing Multiple Months

**What goes wrong:** "Acumulado exercicio" column (D-05) is built by summing AccountBalance.debitTotal/creditTotal across months 1..currentMonth of the fiscal year — NOT reading closingBalance of the current month.

**Why it happens:** `closingBalance` = cumulative balance since opening (affected by opening balance). `debitTotal`/`creditTotal` = movements in that specific month only. Summing monthly movements gives the period-to-date movement.

**How to avoid:**

- Current month balance: use AccountBalance.closingBalance
- Acumulado exercicio: SUM(debitTotal) and SUM(creditTotal) across months 1..N of the fiscal year
- Same period previous year: find the corresponding fiscal year and same month

### Pitfall 4: Double-Counting Synthetic Accounts

**What goes wrong:** DRE totals appear doubled because both a synthetic parent (e.g., `5.1 CPV`) and its analytic children (e.g., `5.1.01`, `5.1.02`) are summed.

**Why it happens:** If the calculator iterates all accounts and adds up balances, it counts children via the synthetic parent's aggregation AND again via the analytic rows.

**How to avoid:** Sum only analytic accounts (`isSynthetic = false`). Compute synthetic totals from children — same pattern as `getAccountValues()` in ledger.service.ts.

### Pitfall 5: ROE Division By Zero

**What goes wrong:** `ROE = Resultado Liquido / PL` crashes or returns Infinity when PL = 0.

**Why it happens:** New organizations have no opening balance yet; PL can be zero.

**How to avoid:** Check `PL.isZero()` before dividing; return null when PL = 0. Frontend shows "N/D" for null indicators.

### Pitfall 6: PL/ha Requires Farm.totalAreaHa Sum

**What goes wrong:** PL/ha uses wrong total area because developer reads one Farm instead of all Farms for the org.

**Why it happens:** D-10 specifies "soma de Farm.totalAreaHa de todas as fazendas da organizacao." The Farm model has `totalAreaHa Decimal @db.Decimal(12, 4)`.

**How to avoid:** `SUM(f.totalAreaHa) FROM farms f JOIN organizations org ON ...` for the org.

---

## Code Examples

Verified patterns from existing codebase:

### Aggregating AccountBalance for a Month (Consolidated DRE/BP)

```typescript
// Source: apps/backend/src/modules/ledger/ledger.service.ts, getTrialBalance()
const balances = await prisma.accountBalance.findMany({
  where: {
    organizationId,
    fiscalYearId: filters.fiscalYearId,
    month: filters.month,
  },
  select: {
    accountId: true,
    openingBalance: true,
    debitTotal: true,
    creditTotal: true,
    closingBalance: true,
  },
});
```

### CC-Filtered Aggregation from JournalEntryLine

```typescript
// No existing example — new pattern for this phase
// Aggregate movements per account for a specific cost center
type LineAgg = { accountId: string; debitTotal: string; creditTotal: string };

const lines = await prisma.$queryRaw<LineAgg[]>`
  SELECT
    jel."accountId",
    COALESCE(SUM(CASE WHEN jel.side = 'DEBIT' THEN jel.amount ELSE 0 END), 0)::text AS "debitTotal",
    COALESCE(SUM(CASE WHEN jel.side = 'CREDIT' THEN jel.amount ELSE 0 END), 0)::text AS "creditTotal"
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel."journalEntryId"
  WHERE je."organizationId" = ${organizationId}
    AND jel."costCenterId" = ${costCenterId}
    AND je.status = 'POSTED'
    AND je."periodId" = ANY(${periodIds}::text[])
  GROUP BY jel."accountId"
`;
```

### Decimal.js Financial Arithmetic

```typescript
// Source: apps/backend/src/modules/ledger/ledger.service.ts (existing pattern)
import Decimal from 'decimal.js';

const receita = new Decimal(balance.closingBalance.toString());
const cpv = new Decimal(cpvBalance.closingBalance.toString());
const lucroBruto = receita.minus(cpv);

// Vertical analysis: % over receita liquida
const verticalPct = receitaLiquida.isZero()
  ? new Decimal(0)
  : value.dividedBy(receitaLiquida).times(100);

// Horizontal analysis: delta vs prior period
const delta = priorValue.isZero()
  ? null
  : currentValue.minus(priorValue).dividedBy(priorValue.abs()).times(100);
```

### Recharts Sparkline (minimal, no axes)

```typescript
// Source: apps/frontend/src/components/purchasing-dashboard/MonthlyEvolutionChart.tsx (adapted)
import { LineChart, Line, ResponsiveContainer } from 'recharts';

// Sparkline: height 40px, no axes, no legend, no grid
<ResponsiveContainer width="100%" height={40}>
  <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
    <Line type="monotone" dataKey="value" dot={false}
          stroke="var(--color-primary-600)" strokeWidth={1.5} isAnimationActive={false} />
  </LineChart>
</ResponsiveContainer>
```

### Route Spec Pattern (mock service)

```typescript
// Source: apps/backend/src/modules/ledger/ledger.routes.spec.ts
jest.mock('./financial-statements.service', () => ({
  getDre: jest.fn(),
  getBalanceSheet: jest.fn(),
  getCrossValidation: jest.fn(),
}));
import * as service from './financial-statements.service';
const mockedService = jest.mocked(service);
```

### Frontend Hook Pattern

```typescript
// Source: apps/frontend/src/hooks/useLedger.ts (pattern to follow)
export function useDre(
  orgId: string | undefined,
  fiscalYearId: string | undefined,
  month: number | undefined,
  costCenterId?: string,
) {
  const [data, setData] = useState<DreOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!orgId || !fiscalYearId || !month) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ fiscalYearId, month: String(month) });
      if (costCenterId) qs.set('costCenterId', costCenterId);
      const result = await api.get<DreOutput>(`/org/${orgId}/financial-statements/dre?${qs}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar DRE');
    } finally {
      setLoading(false);
    }
  }, [orgId, fiscalYearId, month, costCenterId]);
  // ...
}
```

---

## State of the Art

| Old Approach                 | Current Approach                                   | When Changed      | Impact                                                        |
| ---------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| AccountingEntry model (stub) | JournalEntry + AccountBalance                      | Phase 37          | AccountingEntry table was absent from DB — Phase 37 confirmed |
| No cross-module isolation    | Pure calculator pattern (no Prisma in calculators) | Phase 39 decision | Testable without DB                                           |

**Relevant existing data confirmed present:**

- `AccountBalance` rows: written by auto-posting engine (Phases 36-37) for every posted JournalEntry
- `JournalEntryLine.costCenterId`: written by auto-posting for payroll, depreciation, stock ops
- `ChartOfAccount.isFairValueAdj`: seeded as `true` for account `4.1.03` (Variacao Valor Justo) in rural template
- `Farm.totalAreaHa`: exists on Farm model as `Decimal @db.Decimal(12, 4)`

---

## Open Questions

1. **DRE section mapping for Deducoes (FUNRURAL)**
   - What we know: D-01 mentions "Deducoes (FUNRURAL, devolucoes)" as a DRE section
   - What's unclear: No account in the COA template is explicitly classified as "Deducoes". FUNRURAL appears in group 2.1 (Obrigacoes Tributarias — Passivo) in the template, not as a revenue deduction account.
   - Recommendation: DreCalculatorService should provide a configurable account code prefix for deducoes (empty by default). The planner should add a comment noting that FUNRURAL in the COA may need a dedicated revenue-deduction account (accountType=RECEITA with negative nature), or the section will show zero unless the org customizes their COA.

2. **IR/CSLL section in DRE**
   - What we know: D-01 includes "Resultado Antes IR/CSLL" and "IR/CSLL" as sections
   - What's unclear: No IR/CSLL expense account exists in the current rural template (which only has groups 1-6 as seeded)
   - Recommendation: Map to any account code starting with `5.x` that matches IR/CSLL keyword in the name, or treat as zero if not present. Document this gap in the service.

3. **Acumulado do Exercicio for Cost-Center Filtered DRE**
   - What we know: Acumulado = sum of monthly movements; for CC-filtered, must query JournalEntryLine per month
   - What's unclear: Performance implications of querying JournalEntryLine across 12 months with a CC filter
   - Recommendation: For CC-filtered "acumulado", run a single SQL query with `je.periodId IN (all periods for fiscal year)` and aggregate in one pass — more efficient than 12 separate queries.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is code-only changes. No external dependencies beyond the project's own code and already-installed npm packages. All tools (Node, TypeScript, Prisma) confirmed present from prior phases.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Framework          | Jest (backend)                                                                            |
| Config file        | `apps/backend/jest.config.ts`                                                             |
| Quick run command  | `cd apps/backend && npx jest financial-statements --testPathPattern financial-statements` |
| Full suite command | `cd apps/backend && npx jest`                                                             |

### Phase Requirements → Test Map

| Req ID  | Behavior                                           | Test Type           | Automated Command                                                | File Exists? |
| ------- | -------------------------------------------------- | ------------------- | ---------------------------------------------------------------- | ------------ |
| DRE-01  | DRE returns 10-section layout with correct totals  | unit (calculator)   | `npx jest financial-statements/dre.calculator`                   | ❌ Wave 0    |
| DRE-01  | DRE route returns 200 with DreOutput shape         | integration (route) | `npx jest financial-statements/financial-statements.routes.spec` | ❌ Wave 0    |
| DRE-02  | Vertical analysis: section as % of receita liquida | unit (calculator)   | `npx jest financial-statements/dre.calculator`                   | ❌ Wave 0    |
| DRE-02  | Horizontal analysis: delta vs prior period         | unit (calculator)   | `npx jest financial-statements/dre.calculator`                   | ❌ Wave 0    |
| DRE-03  | CC-filtered DRE uses JournalEntryLine aggregation  | unit (service mock) | `npx jest financial-statements/financial-statements.routes.spec` | ❌ Wave 0    |
| BP-01   | BP returns AC/ANC/PC/PNC/PL sections               | unit (calculator)   | `npx jest financial-statements/bp.calculator`                    | ❌ Wave 0    |
| BP-02   | Liquidez Corrente = AC/PC                          | unit (calculator)   | `npx jest financial-statements/bp.calculator`                    | ❌ Wave 0    |
| BP-02   | PL/ha = PL / sum(Farm.totalAreaHa)                 | unit (calculator)   | `npx jest financial-statements/bp.calculator`                    | ❌ Wave 0    |
| VINC-01 | AT = PT + PL invariant check returns green/red     | unit (calculator)   | `npx jest financial-statements/cross-validation.calculator`      | ❌ Wave 0    |
| VINC-01 | DFC placeholder returns null in invariant 2        | unit (calculator)   | `npx jest financial-statements/cross-validation.calculator`      | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern financial-statements --passWithNoTests`
- **Per wave merge:** `cd apps/backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/financial-statements/dre.calculator.spec.ts` — covers DRE-01, DRE-02
- [ ] `apps/backend/src/modules/financial-statements/bp.calculator.spec.ts` — covers BP-01, BP-02
- [ ] `apps/backend/src/modules/financial-statements/cross-validation.calculator.spec.ts` — covers VINC-01
- [ ] `apps/backend/src/modules/financial-statements/financial-statements.routes.spec.ts` — covers DRE-03 (route + service mock)

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/ledger/ledger.service.ts` — getTrialBalance() pattern verified; AccountBalance query structure
- `apps/backend/prisma/schema.prisma` — AccountBalance unique constraint confirmed; ChartOfAccount.isFairValueAdj; Farm.totalAreaHa; JournalEntryLine.costCenterId
- `apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts` — Actual account code groups (1=Ativo, 2=Passivo, 3=PL, 4=Receitas, 5=Despesas, 6=Legado)
- `apps/backend/src/modules/auto-posting/auto-posting.service.ts` — AccountBalance upsert pattern; costCenterId on JournalEntryLine confirmed
- `apps/frontend/package.json` — recharts@^3.7.0 confirmed installed
- `apps/backend/package.json` — decimal.js@^10.6.0, pdfkit@^0.17.2, exceljs@^4.4.0 confirmed
- `apps/frontend/src/components/purchasing-dashboard/MonthlyEvolutionChart.tsx` — recharts LineChart pattern
- `apps/frontend/src/hooks/useLedger.ts` — frontend hook pattern for financial data

### Secondary (MEDIUM confidence)

- `.planning/phases/39-dre-balan-o-patrimonial-e-valida-o-cruzada/39-CONTEXT.md` — decisions D-01 through D-16

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified from package.json files
- Architecture: HIGH — patterns directly verified from existing ledger.service.ts and auto-posting.service.ts
- Pitfalls: HIGH — AccountBalance unique constraint pitfall verified from schema.prisma; COA code mismatch verified from coa-rural-template.ts vs CONTEXT.md D-02
- COA section mapping: HIGH — verified from actual coa-rural-template.ts

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain — ledger data structures won't change before Phase 39 implementation)

---

## Critical Pre-Planning Notes for Planner

1. **No migrations needed.** All data structures exist. Zero schema changes.

2. **COA code mapping in D-02 is wrong.** D-02 uses `3.1.xx` for Receita Agricola but the actual seeded template uses `4.1.xx`. The planner must tell the implementer to use the actual template codes, not D-02 literally.

3. **CC-filtered DRE is a separate code path.** Consolidated DRE reads AccountBalance; CC-filtered DRE reads JournalEntryLine with GROUP BY. Both paths call the same DreCalculatorService function but with differently-sourced balance arrays.

4. **Recharts is already installed and in use.** Sparklines and bar charts require zero new dependencies. Pattern is established in `purchasing-dashboard/` components.

5. **Module name suggestion:** `financial-statements` (not `dre` or `balance-sheet`) since the module delivers three related endpoints.
