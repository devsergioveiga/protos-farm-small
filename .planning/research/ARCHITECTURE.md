# Architecture Research

**Domain:** Rural accounting and financial statements module (v1.4 Contabilidade e Demonstrações Financeiras)
**Researched:** 2026-03-26
**Confidence:** HIGH — based on direct codebase inspection + SPED ECD official spec review

---

## Context: What Already Exists vs. What Is New

This milestone adds a full double-entry general ledger on top of four complete milestones. The
existing `accounting-entries` module is a stub: it writes payroll-origin journal entries using
**hardcoded account codes** stored directly in `ACCOUNT_CODES` constants (no Chart of Accounts
table). Account codes like `6.1.01`, `2.1.01` are strings — they have no parent/child structure
and no linking to a `ChartOfAccount` row. The entire v1.4 milestone exists to replace this
hardcoded pattern with a proper hierarchical COA, period management, and statement engine.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React 19 + Vite)                     │
│                                                                          │
│  CONTABILIDADE sidebar group (currently 1 item → grows to ~9 items)     │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐  │
│  │  Plano de │ │Lançamen- │ │Fechamento│ │    DRE    │ │ Dashboard  │  │
│  │  Contas   │ │  tos GL  │ │ Mensal   │ │  BP  DFC  │ │ Contábil  │  │
│  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬──────┘  │
└────────┼────────────┼────────────┼──────────────┼─────────────┼─────────┘
         │            │            │              │             │
         │        REST API /api/org/:orgId/...    │             │
         │            │            │              │             │
┌────────┼────────────┼────────────┼──────────────┼─────────────┼─────────┐
│        │         Backend (Express 5 + TypeScript)              │         │
│  ┌─────▼──────┐ ┌───▼───────┐ ┌──▼──────────┐ ┌──▼──────────┐│         │
│  │chart-of-   │ │journal-   │ │fiscal-      │ │financial-   ││         │
│  │accounts    │ │entries    │ │periods      │ │statements   ││         │
│  │(COA CRUD + │ │(GL engine │ │(open/close/ │ │(DRE/BP/DFC  ││         │
│  │ seed rural)│ │ + rules)  │ │ reopen)     │ │ calculator) ││         │
│  └─────┬──────┘ └───┬───────┘ └──┬──────────┘ └──┬──────────┘│         │
│        │            │            │                │           │         │
│  ┌─────▼────────────▼────────────▼────────────────▼───────────┘         │
│  │                    PostgreSQL 16 / Prisma 7                           │
│  │   ChartOfAccount   JournalEntry   FiscalPeriod   (new tables)        │
│  │   AccountingEntry  (existing — kept read-only, not migrated)         │
│  └──────────────────────────────────────────────────────────────────────┘
│                                                                          │
│  EXISTING MODULES THAT GET GL HOOKS ADDED                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │payroll-runs │  │  depreciation│  │  payables /  │  │stock-entries│  │
│  │(already has │  │  (no GL hook │  │  receivables │  │stock-outputs│  │
│  │ old stub)   │  │  yet)        │  │  (no GL hook)│  │(no GL hook) │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|-----------|---------------|--------|
| `modules/chart-of-accounts/` | CRUD for hierarchical COA; seed rural model; COA code validation | NEW |
| `modules/fiscal-periods/` | Fiscal year and monthly period management; open/close/reopen with checklist | NEW |
| `modules/journal-entries/` | Manual and automatic GL entries; reversal; period-lock guard; razão/livro diário | NEW (supersedes stub in `accounting-entries`) |
| `modules/accounting-rules/` | Mapping table: sourceType → debit/credit account codes; replaces `ACCOUNT_CODES` const | NEW |
| `modules/ledger/` | Read-side: razão por conta, balancete de verificação, saldo progressivo | NEW |
| `modules/financial-statements/` | DRE / BP / DFC calculators; vinculação cruzada validation; PDF export | NEW |
| `modules/sped-ecd/` | SPED ECD Leiaute 9 file generator (pipe-delimited text, Blocos 0/I/J/K/9) | NEW |
| `modules/accounting-dashboard/` | Executive KPI aggregation endpoint | NEW |
| `modules/accounting-entries/` | Existing payroll stub — kept read-only, not deleted | UNCHANGED (frozen) |
| `modules/payroll-runs/` | Calls `createPayrollEntries()` after close | MODIFIED — add new journal-entries hook alongside existing stub |
| `modules/depreciation/` | No GL hook yet | MODIFIED — add post-run GL hook |
| `modules/payables/` | Calls `createReversalEntry()` on settlement | MODIFIED — add new journal-entries hook |
| `modules/receivables/` | No GL hook | MODIFIED — add GL hook on receipt |
| `modules/stock-entries/` | No GL hook | MODIFIED — add GL hook for inventory increase |
| `modules/stock-outputs/` | No GL hook | MODIFIED — add GL hook for consumption |

---

## Recommended Project Structure

New backend modules follow the established colocation pattern exactly:

```
apps/backend/src/modules/
├── chart-of-accounts/
│   ├── chart-of-accounts.service.ts       # CRUD + seed rural COA (CPC 29 agro model)
│   ├── chart-of-accounts.routes.ts        # Express Router + auth middleware
│   ├── chart-of-accounts.types.ts         # Input/output interfaces + error class
│   └── chart-of-accounts.routes.spec.ts
│
├── fiscal-periods/
│   ├── fiscal-periods.service.ts          # Open/close/reopen period with checklist validation
│   ├── fiscal-periods.routes.ts
│   ├── fiscal-periods.types.ts
│   └── fiscal-periods.routes.spec.ts
│
├── journal-entries/
│   ├── journal-entries.service.ts         # GL write engine + period-lock guard
│   ├── journal-entries-calculator.service.ts  # Pure calc, no DB (mirrors payroll-calculation.service.ts)
│   ├── journal-entries.routes.ts
│   ├── journal-entries.types.ts
│   └── journal-entries.routes.spec.ts
│
├── accounting-rules/
│   ├── accounting-rules.service.ts        # Mapping: sourceType → COA account IDs
│   ├── accounting-rules.routes.ts
│   ├── accounting-rules.types.ts
│   └── accounting-rules.routes.spec.ts
│
├── ledger/
│   ├── ledger.service.ts                  # Razão, balancete, livro diário
│   ├── ledger.routes.ts
│   ├── ledger.types.ts
│   └── ledger.routes.spec.ts
│
├── financial-statements/
│   ├── financial-statements.service.ts    # DRE + BP + DFC orchestrator
│   ├── dre-calculator.service.ts          # Pure DRE calc (testable without DB)
│   ├── bp-calculator.service.ts           # Pure BP calc
│   ├── dfc-calculator.service.ts          # Pure DFC calc (direct + indirect)
│   ├── financial-statements-pdf.service.ts  # pdfkit multi-statement PDF
│   ├── financial-statements.routes.ts
│   ├── financial-statements.types.ts
│   └── financial-statements.routes.spec.ts
│
├── sped-ecd/
│   ├── sped-ecd.service.ts               # Orchestrator: loads data + calls builders
│   ├── sped-ecd-builder.ts               # Record builders (I010, I050, I150/I155, I200/I250, I350/I355)
│   ├── sped-ecd.routes.ts
│   ├── sped-ecd.types.ts
│   └── sped-ecd.routes.spec.ts
│
└── accounting-dashboard/
    ├── accounting-dashboard.service.ts
    ├── accounting-dashboard.routes.ts
    ├── accounting-dashboard.types.ts
    └── accounting-dashboard.routes.spec.ts
```

New frontend pages follow `pages/XxxPage.tsx + XxxPage.css` colocation. Modals go in
`components/accounting/`:

```
apps/frontend/src/
├── pages/
│   ├── AccountingDashboardPage.tsx + .css
│   ├── ChartOfAccountsPage.tsx + .css
│   ├── FiscalPeriodsPage.tsx + .css
│   ├── JournalEntriesPage.tsx + .css      # extends/replaces AccountingEntriesPage
│   ├── LedgerPage.tsx + .css
│   ├── BalancetePage.tsx + .css
│   ├── FinancialStatementsPage.tsx + .css # tabs: DRE / Balanço / DFC
│   ├── StatementLinkagePage.tsx + .css    # DRE↔BP↔DFC cross-validation panel
│   └── SpedEcdPage.tsx + .css
│
├── components/
│   └── accounting/
│       ├── AccountModal.tsx + .css        # COA account create/edit
│       ├── JournalEntryModal.tsx + .css   # Manual entry form (partidas dobradas)
│       ├── PeriodCloseModal.tsx + .css    # Closing checklist steps
│       ├── SpedEcdExportModal.tsx + .css  # Export parameters + download
│       └── StatementDrilldownModal.tsx + .css
│
├── hooks/
│   ├── useChartOfAccounts.ts
│   ├── useJournalEntries.ts              # extends useAccountingEntries pattern
│   ├── useFiscalPeriods.ts
│   ├── useLedger.ts
│   └── useFinancialStatements.ts
│
└── types/
    ├── chart-of-accounts.ts
    ├── journal-entries.ts
    ├── fiscal-periods.ts
    └── financial-statements.ts
```

---

## Data Model

### New Prisma Models

```
ChartOfAccount
  id             String       @id @default(uuid())
  organizationId String
  code           String       -- "1.1.01.001" (dot-separated, hierarchical, sortable)
  parentCode     String?      -- null for level-1 root nodes
  name           String
  accountType    AccountType  -- ATIVO | PASSIVO | PL | RECEITA | DESPESA | CUSTO
  nature         AccountNature -- DEVEDORA | CREDORA
  level          Int          -- 1=grupo, 2=subgrupo, 3=conta, 4=subconta
  isAnalytic     Boolean      @default(false)  -- only analytics accept journal entries
  isActive       Boolean      @default(true)
  isSystem       Boolean      @default(false)  -- seeded rural accounts, cannot delete
  dreLineCode    String?      -- optional mapping to DRE/BP statement line position
  createdAt      DateTime     @default(now())
  @@unique([organizationId, code])
  @@index([organizationId, accountType])
  @@map("chart_of_accounts")

FiscalPeriod
  id             String        @id @default(uuid())
  organizationId String
  year           Int
  month          Int           -- 1–12, or 0 for the annual period
  status         PeriodStatus  -- OPEN | CLOSING | CLOSED | REOPENED
  closedAt       DateTime?
  closedBy       String?
  reopenedAt     DateTime?
  reopenedBy     String?
  notes          String?
  @@unique([organizationId, year, month])
  @@map("fiscal_periods")

JournalEntry                           -- supersedes AccountingEntry for new GL data
  id             String       @id @default(uuid())
  organizationId String
  entryNumber    Int          -- sequential per org per year (for livro diário)
  entryDate      DateTime     @db.Date
  referenceMonth DateTime     @db.Date
  description    String
  entryOrigin    EntryOrigin  -- MANUAL | AUTO_PAYROLL | AUTO_DEPRECIATION | AUTO_CP | AUTO_CR | AUTO_STOCK_IN | AUTO_STOCK_OUT
  sourceType     String?      -- mirrors AccountingSourceType for back-compat
  sourceId       String?
  periodId       String       -- FK to FiscalPeriod
  isReversed     Boolean      @default(false)
  reversalOfId   String?      -- FK to original entry being reversed
  createdBy      String
  createdAt      DateTime     @default(now())
  lines          JournalEntryLine[]
  period         FiscalPeriod @relation(...)
  @@index([organizationId, referenceMonth])
  @@index([sourceType, sourceId])
  @@map("journal_entries")

JournalEntryLine
  id             String     @id @default(uuid())
  journalEntryId String
  accountCode    String     -- denormalized from ChartOfAccount.code (display performance)
  accountId      String     -- FK to ChartOfAccount.id (referential integrity)
  nature         LineSide   -- DEBIT | CREDIT
  amount         Decimal    @db.Decimal(14,2)
  costCenterId   String?
  farmId         String?
  memo           String?
  @@map("journal_entry_lines")

AccountingRule
  id              String   @id @default(uuid())
  organizationId  String
  ruleCode        String   -- "PAYROLL_SALARY", "DEPRECIATION_BOOK", "STOCK_CONSUMPTION", etc.
  description     String
  debitAccountId  String   -- FK to ChartOfAccount
  creditAccountId String   -- FK to ChartOfAccount
  isActive        Boolean  @default(true)
  @@unique([organizationId, ruleCode])
  @@map("accounting_rules")
```

### Additions to Existing Models

```
DepreciationEntry
  + journalEntryId String?   -- FK to JournalEntry (added via migration, nullable backfill)

Payable
  + journalEntryId String?   -- FK to JournalEntry for settlement GL entry

Receivable
  + journalEntryId String?   -- FK to JournalEntry for receipt GL entry
```

The existing `AccountingEntry` model is **not changed**. It stays read-only and serves the
existing `AccountingEntriesPage` frontend unmodified. New code does not write to it.

---

## Architectural Patterns

### Pattern 1: GL Hook — Non-blocking Fire-and-Forget

The existing pattern established in `payroll-runs.service.ts` line 1059 is the canonical model
for all automatic GL entry creation. It must be followed for every new source module hook.

**What:** After the primary transaction commits, call the GL hook outside the transaction. Wrap
in `try/catch` with structured logging — GL failure must never abort the source operation.

**When to use:** Every module that generates automatic `JournalEntry` records (payroll, depreciation,
payables settlement, receivables receipt, stock in/out).

**Trade-offs:** GL can drift if the hook throws and is not retried. Mitigation: log `sourceType` +
`sourceId` on every failure so a manual reconciliation query can detect and replay missing entries.

```typescript
// Pattern: depreciation GL hook (mirrors existing payroll pattern)
export async function processDepreciationRun(rls: RlsContext, runId: string): Promise<void> {
  // Primary operation — inside transaction
  await prisma.$transaction(async (tx) => { /* ... */ });

  // GL hook — OUTSIDE transaction, non-blocking
  try {
    await createDepreciationGlEntries(rls.organizationId, runId);
  } catch (err) {
    logger.error({ err, runId }, 'depreciation GL hook failed — manual reconciliation needed');
  }
}
```

### Pattern 2: COA Code as Hierarchical String Key

**What:** Account codes are dot-separated strings (`1.1.01.001`) that encode hierarchy. The `level`
field (1–4) and `parentCode` are explicit for fast tree queries. Only accounts with `isAnalytic: true`
accept `JournalEntryLine` records — the service enforces this before any write.

**When to use:** Every GL write path, every statement aggregation query, every AccountingRule validation.

**Trade-offs:** Account code renames cascade to display strings (the `accountCode` denormalized in
`JournalEntryLine`). The `isSystem: true` flag blocks deletion of seeded rural accounts. The rural
seed must include CPC 29 biological asset accounts and FUNRURAL-specific groupings.

```typescript
// Enforce analytic-only before writing a JournalEntryLine
function assertAnalytic(account: ChartOfAccount): void {
  if (!account.isAnalytic) {
    throw new JournalEntryError(
      `Conta ${account.code} é sintética e não aceita lançamentos diretos`,
      'SYNTHETIC_ACCOUNT',
      400,
    );
  }
}
```

### Pattern 3: Period Lock Guard

**What:** Every `JournalEntry` write first checks that the target `FiscalPeriod` has `status: OPEN`
or `REOPENED`. Closed periods reject writes at the service layer with HTTP 409.

**When to use:** `createJournalEntry()` service function, always — for both manual and automatic entries.

**Trade-offs:** A late correction (e.g., payroll adjustment after period close) requires an explicit
reopen. This is intentional — accounting period integrity requires human acknowledgment.

```typescript
async function assertPeriodOpen(
  organizationId: string,
  referenceMonth: Date,
): Promise<FiscalPeriod> {
  const period = await prisma.fiscalPeriod.findFirst({
    where: {
      organizationId,
      year: referenceMonth.getUTCFullYear(),
      month: referenceMonth.getUTCMonth() + 1,
    },
  });
  if (!period || period.status === 'CLOSED') {
    throw new JournalEntryError('Período contábil fechado', 'PERIOD_CLOSED', 409);
  }
  return period;
}
```

### Pattern 4: Pure Calculation Engine for Financial Statements

**What:** DRE, BP, and DFC calculation logic lives in separate files (`dre-calculator.service.ts`,
`bp-calculator.service.ts`, `dfc-calculator.service.ts`) with no Prisma imports. Each receives
account balance maps as input and returns structured statement output. This mirrors the
`payroll-calculation.service.ts` pattern used in v1.3 (43 tests without DB).

**When to use:** All statement calculation tests. The orchestrator in `financial-statements.service.ts`
loads balance data from DB and passes it to the calculators.

**Trade-offs:** Requires a thin loader-orchestrator split. More files, but calculators are fast,
deterministic, and independently testable.

### Pattern 5: SPED ECD Builder — Record-by-Record String Concatenation

**What:** SPED ECD Leiaute 9 (RFB 2023-12-21) is a pipe-delimited (`|`) plain-text file. Each
line is a "registro" prefixed with its type code (e.g., `|I050|1.1.01|2|S|Bancos|...|`). The
`sped-ecd-builder.ts` exports one function per registro type. The orchestrator concatenates all
lines, adds `|0000|` header (Bloco 0) and terminates with `|9999|`. Encoding: UTF-8, no BOM.

File blocks in order: `0` (identification) → `I` (COA + balances + entries) → `J` (statements) →
`K` (demonstração mutação PL, optional) → `9` (totals/closing).

**Key registers:**
- `I010` — escrituração identifier (LALUR indicator, audit flag)
- `I050` — plano de contas (one row per ChartOfAccount)
- `I100` — centros de custo (optional)
- `I150/I155` — monthly balance per account (saldo inicial, movimentos, saldo final)
- `I200/I250` — each journal entry header / each entry line
- `I350/I355` — resultado antes do fechamento (result accounts per date)
- `J150/J210` — demonstrações contábeis (DRE, BP)

**Trade-offs:** The RFB PVA validator is strict about field ordering, record counts, and line
counter accuracy (`|9001|`, `|9900|`). Tests must assert line counts match register totals.

```typescript
// Example registro builder
function buildI050(account: ChartOfAccount): string {
  // |I050|COD_CTA|NIVEL|IND_CTA|DESC_CTA|COD_CTA_REF|
  const ind = account.isAnalytic ? 'A' : 'S'; // A=analítica, S=sintética
  return `|I050|${account.code}|${account.level}|${ind}|${account.name}||`;
}
```

### Pattern 6: AccountingRule Table Replaces ACCOUNT_CODES Constant

**What:** The hardcoded `ACCOUNT_CODES` object in `accounting-entries.types.ts` is replaced by
rows in the `accounting_rules` table, seeded per organization on first COA setup. Each rule maps a
`ruleCode` string to real `ChartOfAccount` IDs. The GL engine reads the rule at runtime rather than
at compile time, making account remapping possible without a code deploy.

**When to use:** Every automatic journal entry source (payroll, depreciation, stock, CP/CR).

**Trade-offs:** Rules must be seeded for every new organization. A missing rule causes a logged
error (not a crash) following the non-blocking GL hook pattern.

---

## Data Flow

### Automatic Journal Entry Flow (Example: Payroll Close)

```
PayrollRun.closeRun() [primary tx commits]
    │
    ▼  non-blocking try/catch
createPayrollGlEntries(orgId, runId)
    │
    ├─ load AccountingRule WHERE ruleCode IN ['PAYROLL_SALARY', 'PAYROLL_CHARGES', ...]
    │   (these rows point to real ChartOfAccount IDs, replacing ACCOUNT_CODES const)
    │
    ├─ assertPeriodOpen(orgId, referenceMonth)  → FiscalPeriod with status OPEN
    │
    ├─ compute totals from PayrollRunItem rows (same logic as existing createPayrollEntries)
    │
    └─ prisma.journalEntry.create({
         entryOrigin: 'AUTO_PAYROLL',
         sourceType: 'PAYROLL_RUN', sourceId: runId,
         lines: [
           { accountId: rule.debitAccountId,  nature: 'DEBIT',  amount: total },
           { accountId: rule.creditAccountId, nature: 'CREDIT', amount: total },
         ]
       })
```

### Financial Statement Calculation Flow

```
GET /org/:orgId/financial-statements/dre?year=2026&month=3
    │
    ├─ Load JournalEntryLine aggregates by accountCode for period
    │   (SUM debits - credits per account, or credits - debits per account nature)
    │
    ├─ Load ChartOfAccount tree (for hierarchy grouping)
    │
    └─ dreCalculator.calculate(balanceMap, coaTree)
            │
            └─ returns DreOutput: { receitas, custos, despesas, resultado, ... }
               (pure function, no DB, testable in isolation)
```

### SPED ECD Generation Flow

```
POST /org/:orgId/sped-ecd/generate  { year: 2025 }
    │
    ├─ Assert all FiscalPeriods for year have status CLOSED
    ├─ Load ChartOfAccounts for org (for I050 records)
    ├─ Load CostCenters for org (for I100 records, optional)
    ├─ Load monthly JournalEntryLine aggregates per account (for I150/I155)
    ├─ Load all JournalEntry + lines for year (for I200/I250)
    ├─ Load year-end result account balances (for I350/I355)
    ├─ Load DRE + BP for J150/J210 (reuses financial-statements calculator)
    │
    ├─ spedEcdBuilder.build(allData) → UTF-8 string, pipe-delimited, ~10MB typical
    │
    └─ res.setHeader('Content-Disposition', 'attachment; filename="ECD_2025.txt"')
       res.send(fileContent)
       -- Note: for large orgs (>50K entries), consider streaming via res.write()
```

### Frontend State Flow (Journal Entries Page)

```
JournalEntriesPage mounts
    │
    ├─ useJournalEntries({ referenceMonth, farmId, entryOrigin }) → fetch
    │   (same shape as useAccountingEntries, extended with new filter options)
    │
    ├─ User opens "Novo Lançamento" → JournalEntryModal
    │   ├─ COA account picker (searches ChartOfAccount, analytic only)
    │   ├─ Partidas dobradas: debit line(s) + credit line(s), amounts must balance
    │   └─ POST /journal-entries → refetch list
    │
    └─ User clicks entry row → StatementDrilldownModal (source document link)
```

---

## Integration Points

### Existing Modules That Get Modified

| Module | Current State | v1.4 Change | Hook Location |
|--------|--------------|-------------|---------------|
| `payroll-runs` | Calls `createPayrollEntries()` from `accounting-entries` stub | ADD new `createPayrollGlEntries()` call from `journal-entries` module. Keep existing call to not break `AccountingEntriesPage`. | After `closeRun()` — same non-blocking position |
| `payables` | Calls `createReversalEntry()` on settlement | ADD new GL hook for CP settlement | After `settlePayable()` |
| `depreciation` | No GL hook | ADD `createDepreciationGlEntries()` post-run | After `processRun()` batch commits |
| `receivables` | No GL hook | ADD GL hook on receipt status change | After receipt confirmation |
| `stock-entries` | No GL hook | ADD GL hook for inventory increase + cost | After `create()` |
| `stock-outputs` | No GL hook | ADD GL hook for inventory decrease + COGS | After `create()` |

### Existing Data — No Migration Required for v1.4

The existing `accounting_entries` table (6 entry types, payroll-only) stays unchanged and
continues to serve `AccountingEntriesPage`. New GL data writes to `journal_entries` only.

- `AccountingEntriesPage` keeps working with no changes.
- For a future SPED ECD covering a year that predates v1.4, a one-off migration script could
  backfill payroll-only `AccountingEntry` rows into `JournalEntry`. That is out of scope for v1.4.

### Frontend Sidebar Extension

The existing `CONTABILIDADE` group in `Sidebar.tsx` (lines 294–298, currently 1 item) expands to:

```
CONTABILIDADE
  Dashboard Contábil       /accounting-dashboard
  Plano de Contas          /chart-of-accounts
  Períodos Fiscais         /fiscal-periods
  Lançamentos              /journal-entries
  Razão Contábil           /ledger
  Balancete                /balancete
  Demonstrações            /financial-statements    (tabs: DRE / Balanço / DFC)
  Vinculação DRE↔BP↔DFC    /statement-linkage
  SPED ECD                 /sped-ecd
```

The existing `/accounting-entries` route is kept as-is (backward compatibility). It can be linked
from the `JournalEntriesPage` as "ver lançamentos legados (folha)".

---

## Build Order

Modules have strict data dependencies. Build in this order:

**Phase 1 — Foundation (no deps on other v1.4 work)**
1. `chart-of-accounts` — COA CRUD + rural model seed (CPC 29 agro accounts) + frontend page
2. `fiscal-periods` — period management: open/close/reopen + frontend page
3. `accounting-rules` — rule mapping table that replaces `ACCOUNT_CODES` const

**Phase 2 — GL Engine (depends on Phase 1)**
4. `journal-entries` — write engine: period-lock guard + manual entry + debit=credit validation + reversal
5. `journal-entries` frontend page (replaces AccountingEntriesPage visually but coexists)

**Phase 3 — Expand Auto-Entry Hooks (depends on Phase 2 engine being live)**
6. Wire payroll-runs to journal-entries (GL hook alongside existing accounting-entries hook)
7. Wire payables settlement to journal-entries
8. Wire depreciation run to journal-entries
9. Wire receivables receipt to journal-entries
10. Wire stock-entries / stock-outputs to journal-entries

**Phase 4 — Read Side / Ledger (depends on Phase 3 data existing)**
11. `ledger` — razão contábil endpoint: saldo progressivo per account + livro diário
12. `ledger` frontend — LedgerPage with account picker and date range drill-down
13. `balancete` — balancete de verificação endpoint + BalancetePage

**Phase 5 — Period Closing (depends on ledger for checklist validation)**
14. `fiscal-periods` — closing checklist endpoint (validates: balancete balanced, all hooks fired)
15. Frontend: PeriodCloseModal with checklist steps and reopen confirmation

**Phase 6 — Financial Statements (depends on COA + journal data + periods)**
16. `dre-calculator.service.ts` + DRE endpoint (pure engine first, verified by tests)
17. `bp-calculator.service.ts` + BP endpoint
18. `dfc-calculator.service.ts` + DFC endpoint (most complex — requires DFC classification per account)
19. Cross-validation endpoint: DRE net income == BP equity change (DRE↔BP↔DFC linkage)
20. `financial-statements-pdf.service.ts` — pdfkit multi-statement PDF (reuses pdfkit pattern)

**Phase 7 — SPED ECD (depends on all journal data + COA + closed periods)**
21. `sped-ecd-builder.ts` — record builders with unit tests against known-good samples
22. `sped-ecd.service.ts` + route + SpedEcdPage frontend

**Phase 8 — Dashboard and Executive UI**
23. `accounting-dashboard` — executive KPIs (indicadores: liquidez, endividamento, PL/ha)
24. Frontend: AccountingDashboardPage, StatementLinkagePage (DRE↔BP↔DFC panel)

---

## Anti-Patterns

### Anti-Pattern 1: Writing GL Entries Inside the Source Transaction

**What people do:** Wrap both the source operation (payroll close) and the GL entry creation in a
single `prisma.$transaction()`.

**Why it's wrong:** A GL failure (period closed, COA account not found, rule missing) rolls back
the entire payroll close. The payroll is the source of truth — its state must not depend on GL
module health.

**Do this instead:** Follow the existing `payroll-runs.service.ts` line 1059 pattern: commit the
primary transaction first, then call the GL hook in `try/catch` outside the transaction.

### Anti-Pattern 2: Allowing Synthetic (Non-Analytic) Accounts to Receive Entries

**What people do:** Accept any account code in a `JournalEntryLine` without checking `isAnalytic`.

**Why it's wrong:** Synthetic accounts aggregate children. Posting to them bypasses the COA
hierarchy and corrupts balancete calculations silently.

**Do this instead:** `assertAnalytic(account)` check before any `JournalEntryLine` write. Return
HTTP 400: "Conta X é sintética e não aceita lançamentos diretos."

### Anti-Pattern 3: Carrying the Hardcoded ACCOUNT_CODES Pattern Forward

**What people do:** Add new entries to the `ACCOUNT_CODES` constant in `accounting-entries.types.ts`
for depreciation, stock, or CP hooks.

**Why it's wrong:** That constant was an explicit stub pending v1.4. Extending it adds more
hardcoded strings disconnected from any COA table, making them impossible to remap without a
code deploy and invisible to period statements.

**Do this instead:** New hooks use `AccountingRule` rows loaded at runtime from the DB. Seed the
rules on COA setup.

### Anti-Pattern 4: Building Financial Statements from the Old accounting_entries Table

**What people do:** Query `accounting_entries` to build DRE totals.

**Why it's wrong:** `accounting_entries` only contains 6 payroll entry types. A DRE needs all
revenue/expense/cost entries — depreciation, COGS, CP interest, bank charges, rural credit interest.

**Do this instead:** All statement calculations read from `journal_entry_lines` joined to
`chart_of_accounts.accountType`. `accounting_entries` is a pre-v1.4 artifact.

### Anti-Pattern 5: Using xmlbuilder2 for SPED ECD Generation

**What people do:** Use `xmlbuilder2` (already in use for eSocial) to generate the ECD file.

**Why it's wrong:** SPED ECD Leiaute 9 is NOT XML. It is pipe-delimited plain text
(`|I050|1.1.01|2|S|Bancos||`). Using an XML builder would require stripping all XML markup.

**Do this instead:** Plain string concatenation, one function per registro type, UTF-8 output
(no BOM). The pattern mirrors the CNAB builder (`CnabAdapter`) already in the codebase.

### Anti-Pattern 6: DFC Using Only Cash Account Movements

**What people do:** Build the DFC by filtering journal entries on the bank account GL code only.

**Why it's wrong:** DFC (both direct and indirect methods) requires classifying entries into
operating / investing / financing sections — a classification that depends on the originating
account type and the source operation type, not just whether money moved through a bank account.

**Do this instead:** Add a `dfcCategory` field to `ChartOfAccount` (`OPERACIONAL | INVESTIMENTO |
FINANCIAMENTO | null`). The DFC calculator aggregates by this category, not by account group alone.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single farm, < 500 entries/month | Current architecture sufficient. No special indexing needed beyond `@@index([organizationId, referenceMonth])`. |
| Multi-farm org, 5K–50K entries/month | Statement queries aggregate all `journal_entry_lines` per period. Add a `account_monthly_balances` materialized snapshot table updated on each JournalEntry commit. Statements read from snapshot. |
| Large agribusiness, 500K+ entries/year | SPED ECD generation becomes a background job with polling endpoint (mirrors eSocial async pattern). Monthly balance snapshots mandatory. |

### First Bottleneck

Statement calculation reads all `journal_entry_lines` for a period grouped by `accountCode`. With a
full year of multi-module data (payroll + depreciation + stock + CP/CR), this can be 50K–500K rows
per query. The mitigation is a `account_monthly_balances` table (opening balance, total debits,
total credits, closing balance per account per month) updated on every JournalEntry commit. Defer
until first production slowness is observed — premature caching is the primary source of statement
reconciliation bugs.

---

## Sources

- SPED ECD Leiaute 9 (official): [Manual de Orientação da ECD Leiaute 9 — RFB 2023-12-21](http://sped.rfb.gov.br/estatico/2D/9C01A0E619B48BAB27486D63FF9E4E750025D0/Manual_de_Orienta%C3%A7%C3%A3o_da_ECD_Leiaute9_2023_12_21.pdf)
- SPED ECD Bloco I structure: [Bloco I da ECD: um guia completo (e-auditoria.com.br)](https://www.e-auditoria.com.br/blog/bloco-i-ecd-um-guia-completo/)
- SPED ECD Registro I200/I250: [Registro I200 da ECD — Lançamento contábil (vriconsulting.com.br)](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=678)
- Plano de contas rural / CPC 29: [Contabilidade Rural e Obrigações Acessórias — CRCMS 2024-08](https://crcms.org.br/wp-content/uploads/2024/08/Contabilidade-Rural-e-Obrigac%CC%A7o%CC%83es-Acesso%CC%81rias-21_08_2024-Finalizada.pdf)
- CPC 29 Ativos Biológicos: [O que são Ativos Biológicos? CPC 29 (grupocpcon.com)](https://www.grupocpcon.com/o-que-sao-ativos-biologicos-cpc-29-contabilidade/)
- Existing stub: `apps/backend/src/modules/accounting-entries/accounting-entries.types.ts` (ACCOUNT_CODES constant, lines 26–63)
- Existing stub: `apps/backend/src/modules/accounting-entries/accounting-entries.service.ts` (createPayrollEntries pattern, line 52)
- GL hook call site: `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` (line 1059)
- Reversal hook call site: `apps/backend/src/modules/payables/payables.service.ts` (line 4)
- Prisma schema: `apps/backend/prisma/schema.prisma` lines 8742–8857 (AccountingEntry model + enums)
- Sidebar structure: `apps/frontend/src/components/layout/Sidebar.tsx` lines 294–298 (CONTABILIDADE group)

---
*Architecture research for: v1.4 Contabilidade e Demonstrações Financeiras — Protos Farm*
*Researched: 2026-03-26*
