# Phase 35: Plano de Contas e Períodos Fiscais — Research

**Researched:** 2026-03-26
**Domain:** Hierarchical chart of accounts (COA), fiscal period management, Brazilian rural accounting standards (CFC/Embrapa), SPED ECD referential plan L300R, AccountBalance cache, cost-center rateio utilities
**Confidence:** HIGH (stack verified via direct codebase inspection; Brazilian standards from official sources; patterns confirmed against existing StockBalance, installments.ts, AssetHierarchyTab.tsx)

---

## Summary

Phase 35 is the hard foundation gate for the entire v1.4 accounting milestone. Nothing downstream (journal entries, closing workflow, DRE, BP, DFC, SPED ECD) can be written without a valid COA and open accounting periods. This phase introduces four new Prisma models (`ChartOfAccount`, `FiscalYear`, `AccountingPeriod`, `AccountBalance`), three shared utilities (`assertPeriodOpen()`, `assertBalanced()`, `rateio()`), a rural template seed (CFC/Embrapa model with SPED L300R mapping), a CRUD API, and a frontend expandable tree page.

The most critical constraint is that the existing flat-row `AccountingEntry` model in `modules/accounting-entries/` must NOT be extended — it is frozen read-only. The `ChartOfAccount` model created here will be the authority for all future GL writes. The `ACCOUNT_CODES` constants hardcoded in `accounting-entries.types.ts` (e.g. `6.1.01`, `2.1.01`) should match the rural template seed codes so the existing payroll entries continue to resolve correctly once mapped to the new COA.

The `CostCenter` model already exists at `prisma/schema.prisma:1927` and has `farmId`, `code`, `name`, `isActive`. Phase 35 extends it by making it linkable to `ChartOfAccount` entries (COA-05), but does NOT create cost centers — it wires the existing ones into the new COA context via a relation on `AccountBalance` and via the future `JournalEntryLine` model.

**Primary recommendation:** Build the four models + seed + three utilities + API + frontend tree in a single phase, in this order: migrations → seed → service utilities → routes → frontend page. All utilities go in `packages/shared/src/utils/accounting/` following the `installments.ts` pattern already there.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COA-01 | Hierarchical COA CRUD (5 levels), code/name/type/nature/flags, tree visualization | Self-referential Prisma model + `$queryRaw` recursive CTE; existing AssetHierarchyTab.tsx tree pattern for frontend |
| COA-02 | Rural template pre-loaded (CFC/Embrapa): ativo biológico CPC 29, culturas em formação, FUNRURAL, crédito rural PRONAF/Funcafé | Seed file in `prisma/fixtures/`; ~80-120 accounts across 5 levels; codes verified against CFC NBT manual |
| COA-03 | SPED L300R mapping per analytic account (N:1 internal → referential), compatibility validation, unmapped account report | `spedReferentialCode` field on `ChartOfAccount`; validation query before period close |
| COA-04 | FiscalYear (jan-dez or safra jul-jun) + AccountingPeriod (monthly, OPEN/CLOSED/BLOCKED), auto-open next period, period-lock enforcement | `FiscalYear` model with `startDate`/`endDate` (not just `year: Int`); `assertPeriodOpen()` utility |
| COA-05 | Cost center linkable to journal entries for DRE gerencial; proportional rateio for multi-center entries | `rateio()` utility in `packages/shared`; `CostCenter` already exists — add FK on `AccountBalance`; `assertBalanced()` utility |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Express 5:** `req.params.id as string` — always cast, never destructure params
- **Prisma enums:** never type as `string`; use `as const` on literals; import from `@prisma/client`
- **Decimal.js:** `Decimal.max(a, b)` static, not instance method; use existing `Money()` factory
- **Module pattern:** colocated `modules/{dominio}/controller+service+routes+types`
- **`app.ts` vs `main.ts`:** keep separate for testability
- **Prisma field names:** verify exact names in `schema.prisma` before writing `select`
- **Prisma 7:** `prisma generate` required before `tsc` in CI
- **Enums in mock data:** `status: 'OPEN' as const`
- **Frontend:** formulários de criação/edição em modal, nunca página dedicada
- **Frontend:** `ConfirmModal` not `window.confirm()` for destructive actions
- **Frontend:** `<button>` not `<div onClick>`, semantic HTML, `aria-label` on icon-only buttons
- **TypeScript:** no `any` on frontend; `as string` casts only in Express 5 param extraction on backend
- **Design system:** DM Sans headlines, Source Sans 3 body, JetBrains Mono data; 4px spacing scale; `var(--color-*)` tokens only

---

## Standard Stack

### Core (no new packages needed — confirmed against project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` | ^7.4.1 | ORM + migrations; self-referential model for COA tree | Already installed; `$queryRaw` covers recursive CTEs Prisma can't express natively |
| `decimal.js` via `Money()` | ^10.6.0 | All monetary arithmetic in `rateio()`, `AccountBalance` | Project-wide standard; `ROUND_HALF_UP` for BRL; `packages/shared/src/types/money.ts` |
| `date-fns` | ^4.1.0 | FiscalYear/AccountingPeriod date arithmetic, period boundary checks | Already installed; used by payroll module |
| `pino` | ^10.3.1 | Audit logging for period open/close/reopen | Already installed |

### No new npm packages
The entire phase is implementable with the existing dependency set. Confirmed March 2026.

**Installation:**
```bash
# No install needed — all packages already present
```

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/
├── chart-of-accounts/
│   ├── chart-of-accounts.routes.ts
│   ├── chart-of-accounts.routes.spec.ts
│   ├── chart-of-accounts.service.ts
│   └── chart-of-accounts.types.ts
└── fiscal-periods/
    ├── fiscal-periods.routes.ts
    ├── fiscal-periods.routes.spec.ts
    ├── fiscal-periods.service.ts
    └── fiscal-periods.types.ts

packages/shared/src/utils/accounting/
├── assert-period-open.ts        ← throws if period is CLOSED or BLOCKED
├── assert-balanced.ts           ← throws if sum(debits) != sum(credits)
├── rateio.ts                    ← splits amount across N cost centers
└── __tests__/
    ├── rateio.spec.ts
    └── assert-balanced.spec.ts

apps/backend/prisma/
├── fixtures/
│   └── coa-rural-template.ts    ← CFC/Embrapa seed data (~100 accounts)
└── migrations/
    ├── 20260508100000_add_chart_of_accounts/
    ├── 20260509100000_add_fiscal_year_and_periods/
    └── 20260510100000_add_account_balance/

apps/frontend/src/
├── pages/
│   ├── ChartOfAccountsPage.tsx
│   ├── ChartOfAccountsPage.css
│   └── FiscalPeriodsPage.tsx
│   └── FiscalPeriodsPage.css
└── components/accounting/
    ├── CoaTreeNode.tsx           ← recursive tree node (mirrors AssetHierarchyTab pattern)
    ├── CoaTreeNode.css
    ├── CoaModal.tsx              ← create/edit form in modal (never dedicated page)
    ├── CoaModal.css
    ├── FiscalYearModal.tsx
    └── FiscalYearModal.css
```

### Pattern 1: Self-Referential Prisma Model for COA Tree

**What:** ChartOfAccount has `parentId` FK pointing to itself. Prisma supports self-relations; tree traversal for arbitrary depth requires `$queryRaw` with PostgreSQL `WITH RECURSIVE`.

**When to use:** Always for getting a subtree or full tree. Never use Prisma nested `include` for arbitrary depth — it requires N+1 queries for each level.

**Prisma schema:**
```prisma
model ChartOfAccount {
  id               String          @id @default(uuid())
  organizationId   String
  parentId         String?
  code             String          // e.g. "1.1.01.001"
  name             String
  accountType      AccountType     // ATIVO | PASSIVO | PL | RECEITA | DESPESA
  nature           AccountNature   // DEVEDORA | CREDORA
  isSynthetic      Boolean         @default(false)  // true = grupo; false = analítica
  allowManualEntry Boolean         @default(true)
  isActive         Boolean         @default(true)
  isFairValueAdj   Boolean         @default(false)  // CPC 29 flag for DFC indirect
  spedRefCode      String?         // L300R referential code (N:1 allowed)
  level            Int             // 1-5, auto-computed from code structure
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  organization     Organization    @relation(fields: [organizationId], references: [id])
  parent           ChartOfAccount? @relation("CoaTree", fields: [parentId], references: [id])
  children         ChartOfAccount[] @relation("CoaTree")
  accountBalances  AccountBalance[]

  @@unique([organizationId, code])
  @@index([organizationId, accountType])
  @@index([parentId])
  @@map("chart_of_accounts")
}
```

**Recursive CTE for full tree (use `prisma.$queryRaw`):**
```typescript
// Source: .planning/research/STACK.md — confirmed PostgreSQL 16 pattern
export async function getAccountTree(
  prisma: PrismaClient,
  organizationId: string,
): Promise<ChartOfAccountNode[]> {
  return prisma.$queryRaw`
    WITH RECURSIVE coa_tree AS (
      SELECT id, code, name, "parentId", level, "accountType", nature,
             "isSynthetic", "isActive", "spedRefCode", "isFairValueAdj"
      FROM chart_of_accounts
      WHERE "organizationId" = ${organizationId} AND "parentId" IS NULL
      UNION ALL
      SELECT c.id, c.code, c.name, c."parentId", c.level, c."accountType", c.nature,
             c."isSynthetic", c."isActive", c."spedRefCode", c."isFairValueAdj"
      FROM chart_of_accounts c
      JOIN coa_tree p ON c."parentId" = p.id
      WHERE c."organizationId" = ${organizationId}
    )
    SELECT * FROM coa_tree ORDER BY code
  `;
}
```

**Confidence: HIGH** — PostgreSQL 16 with recursive CTE, verified against official PostgreSQL docs.

### Pattern 2: AccountBalance Incremental Cache (mirrors StockBalance)

**What:** One row per `(organizationId, accountId, fiscalYearId, month)`. Updated in the SAME Prisma transaction as any journal entry posting. Never computed from SUM on demand for statements — read from cache table.

**Existing reference:** `StockBalance` at `schema.prisma:3157` — same principle: `currentQuantity`, `averageCost`, `totalValue` updated transactionally with each stock movement.

**Prisma schema:**
```prisma
model AccountBalance {
  id             String   @id @default(uuid())
  organizationId String
  accountId      String
  fiscalYearId   String
  month          Int      // 1-12
  openingBalance Decimal  @default(0) @db.Decimal(14, 2)  // balance at start of month
  debitTotal     Decimal  @default(0) @db.Decimal(14, 2)
  creditTotal    Decimal  @default(0) @db.Decimal(14, 2)
  closingBalance Decimal  @default(0) @db.Decimal(14, 2)  // = opening + debit - credit (for devedora)
  updatedAt      DateTime @updatedAt

  organization Organization   @relation(fields: [organizationId], references: [id])
  account      ChartOfAccount @relation(fields: [accountId], references: [id])
  fiscalYear   FiscalYear     @relation(fields: [fiscalYearId], references: [id])

  @@unique([organizationId, accountId, fiscalYearId, month])
  @@index([organizationId, fiscalYearId])
  @@map("account_balances")
}
```

**Update pattern (in transaction alongside journal entry posting — Phase 36 concern, but schema created here):**
```typescript
// Mirror of stock-entries.service.ts StockBalance upsert pattern
await tx.accountBalance.upsert({
  where: { organizationId_accountId_fiscalYearId_month: { organizationId, accountId, fiscalYearId, month } },
  update: {
    debitTotal: { increment: debitAmount },
    closingBalance: { increment: debitAmount },  // for DEVEDORA accounts
  },
  create: {
    organizationId, accountId, fiscalYearId, month,
    openingBalance: 0, debitTotal: debitAmount, creditTotal: 0,
    closingBalance: debitAmount,
  },
});
```

### Pattern 3: FiscalYear + AccountingPeriod Models

**What:** `FiscalYear` uses `startDate`/`endDate` (not just `year: Int`) to support safra-aligned fiscal years (Jul–Jun). `AccountingPeriod` stores each month as a row with `status` enum.

```prisma
enum PeriodStatus {
  OPEN
  CLOSED
  BLOCKED
}

model FiscalYear {
  id             String   @id @default(uuid())
  organizationId String
  name           String   // e.g. "2026" or "Safra 2025/2026"
  startDate      DateTime @db.Date
  endDate        DateTime @db.Date
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization     Organization     @relation(fields: [organizationId], references: [id])
  accountingPeriods AccountingPeriod[]
  accountBalances  AccountBalance[]

  @@unique([organizationId, startDate])
  @@index([organizationId])
  @@map("fiscal_years")
}

model AccountingPeriod {
  id             String       @id @default(uuid())
  organizationId String
  fiscalYearId   String
  month          Int          // 1-12
  year           Int          // calendar year of this month
  status         PeriodStatus @default(OPEN)
  openedAt       DateTime     @default(now())
  closedAt       DateTime?
  closedBy       String?
  reopenedAt     DateTime?
  reopenedBy     String?
  reopenReason   String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  fiscalYear   FiscalYear   @relation(fields: [fiscalYearId], references: [id])
  closedByUser User?        @relation("PeriodClose", fields: [closedBy], references: [id])
  reopenedByUser User?      @relation("PeriodReopen", fields: [reopenedBy], references: [id])

  @@unique([organizationId, fiscalYearId, month, year])
  @@index([organizationId, status])
  @@map("accounting_periods")
}
```

### Pattern 4: assertPeriodOpen() Utility

**What:** Guard function that throws a domain error if the target accounting period is not OPEN. Called on every GL write path (Phase 36+). Defined now in `packages/shared/src/utils/accounting/` so all future modules can import it.

```typescript
// packages/shared/src/utils/accounting/assert-period-open.ts
export class PeriodNotOpenError extends Error {
  constructor(public month: number, public year: number, public status: string) {
    super(`Período ${month}/${year} está ${status} — lançamentos não permitidos`);
    this.name = 'PeriodNotOpenError';
  }
}

export function assertPeriodOpen(period: { month: number; year: number; status: string }): void {
  if (period.status !== 'OPEN') {
    throw new PeriodNotOpenError(period.month, period.year, period.status);
  }
}
```

### Pattern 5: assertBalanced() Utility

**What:** Validates that the sum of debit lines equals the sum of credit lines in a journal entry. Uses `Money()` (decimal.js) to avoid floating-point errors.

```typescript
// packages/shared/src/utils/accounting/assert-balanced.ts
import { Money } from '../types/money';

export class UnbalancedEntryError extends Error {
  constructor(debitTotal: string, creditTotal: string) {
    super(`Lançamento desequilibrado: débitos ${debitTotal} ≠ créditos ${creditTotal}`);
    this.name = 'UnbalancedEntryError';
  }
}

export function assertBalanced(
  lines: Array<{ side: 'DEBIT' | 'CREDIT'; amount: number | string }>,
): void {
  let debits = Money(0);
  let credits = Money(0);
  for (const line of lines) {
    if (line.side === 'DEBIT') debits = debits.add(Money(line.amount));
    else credits = credits.add(Money(line.amount));
  }
  if (!debits.equals(credits)) {
    throw new UnbalancedEntryError(debits.toBRL(), credits.toBRL());
  }
}
```

### Pattern 6: rateio() Utility — Remainder on Largest Share

**What:** Splits a total amount proportionally across N cost centers. The LARGEST share absorbs the centavo remainder. This mirrors `generateInstallments()` in `packages/shared/src/utils/installments.ts` (residual on first installment) but directed to the largest rather than first, which is more correct for rateio.

**Why "largest absorbs remainder":** The PVA SPED ECD validator requires `SUM(debits) = SUM(credits)` to the centavo. Naive `total * rate` per line accumulates rounding errors. Assigning residual to the largest share is the Brazilian standard (NBT 2.2 "taxa de rateio").

```typescript
// packages/shared/src/utils/accounting/rateio.ts
import Decimal from 'decimal.js';
import { Money } from '../types/money';
import type { IMoney } from '../types/money';

export interface RateioInput {
  costCenterId: string;
  percentage: number; // 0-100, must sum to 100 ± 0.01
}

export interface RateioOutput {
  costCenterId: string;
  amount: IMoney;
}

export function rateio(total: IMoney, items: RateioInput[]): RateioOutput[] {
  if (items.length === 0) throw new Error('rateio requer pelo menos um item');

  const sum = items.reduce((acc, i) => acc + i.percentage, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Percentuais devem somar 100%. Soma: ${sum.toFixed(4)}%`);
  }

  const totalDecimal = total.toDecimal();

  // Calculate each share, truncating to 2dp
  const shares = items.map((item) => ({
    costCenterId: item.costCenterId,
    share: totalDecimal.times(item.percentage).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_DOWN),
    percentage: item.percentage,
  }));

  // Remainder = total - sum of truncated shares
  const sumShares = shares.reduce((acc, s) => acc.plus(s.share), new Decimal(0));
  const remainder = totalDecimal.minus(sumShares);

  // Find index of largest share (it absorbs the remainder)
  const largestIdx = shares.reduce(
    (maxIdx, s, i) => (s.share.greaterThan(shares[maxIdx].share) ? i : maxIdx),
    0,
  );

  return shares.map((s, i) => ({
    costCenterId: s.costCenterId,
    amount: i === largestIdx
      ? Money(s.share.plus(remainder))
      : Money(s.share),
  }));
}
```

**Confidence: HIGH** — Pattern adapted from existing `generateInstallments()` in `packages/shared/src/utils/installments.ts` which already uses `ROUND_DOWN` + residual on first installment approach.

### Pattern 7: Frontend COA Tree (mirrors AssetHierarchyTab.tsx)

**What:** Recursive `CoaTreeNode` component with expand/collapse per node. Uses `useState<Set<string>>` for expanded node IDs. The existing `AssetHierarchyTab.tsx` at `apps/frontend/src/components/assets/AssetHierarchyTab.tsx` shows the correct pattern for a recursive tree with CSS indent levels.

**The COA tree needs expand/collapse** (the asset hierarchy doesn't need it because it renders a full linear subtree). Add `expandedIds: Set<string>` state at page level, passed down.

**Key implementation notes:**
- COA page is a LIST page with tree view — use page layout, not modal
- CREATE/EDIT account form opens in `CoaModal` (form-in-modal rule from CLAUDE.md)
- Deactivation uses `ConfirmModal` with `variant="warning"` (medium criticality)
- Accounts with children cannot be deleted — show informative error
- Synthetic accounts (isSynthetic=true) show in a different visual style (no edit button for lançamento manual)

**Confidence: HIGH** — Direct codebase inspection of AssetHierarchyTab.tsx pattern.

### Anti-Patterns to Avoid

- **`isSynthetic` check missing on create:** A synthetic (group) account must not have `allowManualEntry: true`. Enforce in service layer, not just frontend.
- **`code` uniqueness scoped wrong:** Code must be unique per `organizationId`, not globally. The `@@unique([organizationId, code])` constraint handles this but service layer must surface a clean error.
- **FiscalYear as `year: Int`:** Would break safra fiscal years (Jul-Jun). Always use `startDate`/`endDate`.
- **AccountBalance recomputed from SUM on every request:** Materialized view has multi-second refresh on insert. Use incremental cache table (StockBalance pattern).
- **Deleting an account with journal entries:** Must be blocked at service layer (check for linked AccountBalance rows or future JournalEntryLine rows).
- **`prisma.$queryRaw` returning untyped `any[]`:** Always add explicit return type annotation. The template in STACK.md shows `Promise<ChartOfAccountNode[]>`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monetary arithmetic in rateio splits | Custom `Math.round()` | `Money()` factory (decimal.js) | IEEE 754 rounding errors compound; `ROUND_DOWN` + residual is the established pattern in `installments.ts` |
| Recursive tree traversal at arbitrary depth | Prisma nested `include` | `prisma.$queryRaw` + `WITH RECURSIVE` | Prisma `include` requires N+1 queries per depth level; CTE is O(log n) |
| Account balance aggregation on-demand | `SUM(amount)` on JournalEntryLine per request | `AccountBalance` incremental cache table | SUM on large entry sets causes slow statement generation; StockBalance pattern proven in 6 modules |
| Period validation in each module | Each module checks period status independently | `assertPeriodOpen()` from `packages/shared` | Ensures consistency — if period check logic changes, it changes in one place |
| Balance validation per form | Custom form-level check | `assertBalanced()` from `packages/shared` | Used identically in manual entries (Phase 36) and auto-generation (Phase 37) |

**Key insight:** The `packages/shared/src/utils/` directory already contains `installments.ts` and `validateCostCenterItems()` — the rateio and balance utilities belong in the same directory alongside a new `accounting/` subfolder.

---

## Brazilian Rural COA Template (COA-02)

### CFC/Embrapa Rural Plan — Account Group Structure

The standard Brazilian rural chart of accounts follows CFC Resolution 1.103/2007 and Embrapa's "Plano de Contas para Empresas Rurais" (2nd edition). The structure for agropecuária is:

**Level 1 — Account Classes (5 groups):**

| Code | Name | Type | Nature |
|------|------|------|--------|
| 1 | ATIVO | ATIVO | DEVEDORA |
| 2 | PASSIVO | PASSIVO | CREDORA |
| 3 | PATRIMÔNIO LÍQUIDO | PL | CREDORA |
| 4 | RECEITAS | RECEITA | CREDORA |
| 5 | DESPESAS E CUSTOS | DESPESA | DEVEDORA |

**Level 2 — Key Rural Subgroups:**

| Code | Name | Type | Rural Specific |
|------|------|------|----------------|
| 1.1 | Ativo Circulante | ATIVO | — |
| 1.2 | Ativo Não Circulante | ATIVO | — |
| 1.2.1 | Ativo Biológico (CPC 29) | ATIVO | YES — CPC 29 fair value; `isFairValueAdj: true` on adj account |
| 1.2.2 | Culturas em Formação | ATIVO | YES — pre-harvest capitalization |
| 1.2.3 | Imobilizado Rural | ATIVO | Terras, máquinas agrícolas, benfeitorias |
| 2.1 | Passivo Circulante | PASSIVO | — |
| 2.2 | Passivo Não Circulante | PASSIVO | Crédito rural LP (PRONAF, Funcafé) |
| 4.1 | Receitas Agropecuárias | RECEITA | Vendas agrícolas + pecuárias |
| 5.1 | Custo dos Produtos Vendidos | DESPESA | CPV por cultura |
| 5.2 | Despesas Operacionais | DESPESA | — |
| 5.3 | FUNRURAL s/ Vendas | DESPESA | YES — 1.5% Lucro Real or 2.5% Presumido |

**Key analytic accounts required by COA-02:**

| Code | Name | Notes |
|------|------|-------|
| 1.1.01.001 | Caixa | Disponibilidades |
| 1.1.01.002 | Bancos c/ Movimento | Disponibilidades |
| 1.1.02.001 | Estoques — Insumos Agrícolas | Links to US-090/091 stock |
| 1.2.01.001 | Ativo Biológico — Rebanho Bovino | CPC 29; `isFairValueAdj: false` (base) |
| 1.2.01.002 | Ajuste VJL Ativo Biológico | CPC 29; `isFairValueAdj: true` |
| 1.2.02.001 | Culturas em Formação — Café | Agro-specific capitalization |
| 1.2.02.002 | Culturas em Formação — Citrus | — |
| 1.2.03.001 | Terras Rurais | Never depreciates per ITG 10 |
| 1.2.03.002 | Máquinas e Implementos Agrícolas | Depreciated — links to assets module |
| 1.2.03.003 | (-) Depreciação Acumulada Máquinas | Contra-account |
| 2.1.01.001 | Salários a Pagar | Maps ACCOUNT_CODES.PAYROLL_SALARY.credit |
| 2.1.02.001 | Encargos Sociais a Recolher | Maps ACCOUNT_CODES.PAYROLL_CHARGES.credit |
| 2.1.03.001 | FUNRURAL a Recolher | Rural-specific |
| 2.1.04.001 | INSS/IRRF a Recolher | Maps ACCOUNT_CODES.TAX_LIABILITY.credit |
| 2.2.01.001 | Crédito Rural — PRONAF CP | <12 months |
| 2.2.02.001 | Crédito Rural — Funcafé LP | >12 months |
| 3.1.01.001 | Capital Social | PL |
| 3.1.02.001 | Lucros/Prejuízos Acumulados | Opening balance wizard target |
| 4.1.01.001 | Receita Vendas Agrícolas | Grãos, café, citrus |
| 4.1.02.001 | Receita Vendas Pecuárias | Gado, leite |
| 4.1.03.001 | Variação VJL Ativo Biológico | CPC 29 fair value gain; `isFairValueAdj: true` |
| 5.1.01.001 | CPV — Culturas Anuais | DRE gerencial por cultura via cost center |
| 5.1.02.001 | CPV — Café | — |
| 5.1.03.001 | CPV — Pecuária | — |
| 5.2.01.001 | Despesas com Pessoal | Maps ACCOUNT_CODES.PAYROLL_SALARY.debit |
| 5.2.01.002 | Encargos Sociais | Maps ACCOUNT_CODES.PAYROLL_CHARGES.debit |
| 5.2.02.001 | FUNRURAL s/ Vendas | 1.5% or 2.5% on rural revenue |
| 5.2.03.001 | Depreciação | Maps depreciation module |
| 5.2.04.001 | Provisão Férias | Maps ACCOUNT_CODES.VACATION_PROVISION.debit |
| 5.2.04.002 | Provisão 13º Salário | Maps ACCOUNT_CODES.THIRTEENTH_PROVISION.debit |

**Confidence: MEDIUM** — CFC resolution and Embrapa documentation are official sources, but exact code numbering at levels 3-5 varies by organization. The seed should define a sensible default that matches the existing `ACCOUNT_CODES` hardcoded values. Organizations can extend via the CRUD after load.

**Critical mapping:** The existing `ACCOUNT_CODES` in `accounting-entries.types.ts` use codes `6.1.01`, `6.1.02` etc. for expense accounts and `2.1.01`, `2.2.01` for liability accounts. The rural template seed MUST include accounts with these exact codes (even if different from the standard CFC L1=1 convention) OR the `ACCOUNT_CODES` constants must be updated to match the template. **Recommendation:** The seed should use `5.x.x` for expenses (standard CFC) and `2.x.x` for liabilities, and the `ACCOUNT_CODES` constants must be updated in the same migration wave to align. Document the code-mapping table in the seed file.

### SPED L300R Referential Account Mapping (COA-03)

The SPED ECD Bloco I requires each analytic account in `I050` to carry a `COD_CTA_REF` pointing to the plano referencial. For rural agropecuária, the applicable plan is `L300R` ("Plano Referencial para Empresas em Geral com Atividade Rural").

**L300R key codes:**

| L300R Code | Description | Maps to internal |
|-----------|-------------|-----------------|
| 1.01.01.01.01 | Caixa | 1.1.01.001 |
| 1.01.01.01.02 | Bancos | 1.1.01.002 |
| 1.02.02.01 | Ativo Biológico | 1.2.01.001 |
| 2.01.01.01.01 | Fornecedores | 2.1.x.x |
| 2.01.01.02.01 | Obrigações Trabalhistas | 2.1.01.001 |
| 3.01.01.01.01 | Capital Social | 3.1.01.001 |

**N:1 rule:** Multiple internal accounts can map to the same L300R code. Example: `1.1.01.002 Banco Bradesco` and `1.1.01.003 Banco Itaú` both map to `1.01.01.01.02`. This is stored as `spedRefCode: String?` on `ChartOfAccount`.

**Confidence: MEDIUM** — L300R codes sourced from SPED ECD official manual (sped.rfb.gov.br). The mapping between internal accounts and L300R codes is organization-specific and will need refinement in Phase 41 (SPED ECD); Phase 35 only needs the field + basic validation.

---

## Common Pitfalls

### Pitfall 1: Flat ACCOUNT_CODES Hardcode Not Updated

**What goes wrong:** After Phase 35 creates the real COA, the existing payroll entries still use string codes like `'6.1.01'` from `ACCOUNT_CODES` in `accounting-entries.types.ts`. If the COA template uses different codes (e.g., `'5.2.01.001'`), the payroll entries reference accounts that don't exist in the new COA.

**Why it happens:** The stub `ACCOUNT_CODES` was intentionally simplified in Phase 32 (comment in `accounting-entries.types.ts`: "Hardcoded chart-of-accounts per REQUIREMENTS.md v1.4 scope"). The codes were placeholders.

**How to avoid:** During Phase 35, decide: (a) make the rural template use the SAME codes as `ACCOUNT_CODES`, or (b) update `ACCOUNT_CODES` to match the rural template. Option (a) is simpler; it means using non-standard code numbering but avoids touching the payroll module. Document this choice explicitly.

**Warning signs:** After seed runs, `SELECT id FROM chart_of_accounts WHERE code = '6.1.01'` returns 0 rows.

### Pitfall 2: Prisma Self-Relation Name Collision

**What goes wrong:** Prisma self-referential relations require a unique relation name. If you write `parent ChartOfAccount?` and `children ChartOfAccount[]` without naming the relation, Prisma generates an ambiguous migration or throws a type error.

**How to avoid:** Always name the relation: `@relation("CoaTree")` on both `parent` and `children` sides.

### Pitfall 3: Level Computed vs. Stored

**What goes wrong:** Storing `level: Int` means it must be updated if an account is moved to a different parent. Computing it dynamically from the `code` field (counting dots) avoids stale data.

**How to avoid:** Compute `level` from the code string in the service: `code.split('.').length`. Store it as a convenience field but recompute on every update. Add a DB constraint `CHECK (level >= 1 AND level <= 5)`.

### Pitfall 4: Period Status Transitions Not Validated

**What goes wrong:** Service allows `CLOSED → OPEN → CLOSED → OPEN` infinite reopen cycles, or blocks `BLOCKED` periods from being unblocked even by admins.

**How to avoid:** Define explicit allowed transitions:
- `OPEN → CLOSED` (normal month close)
- `CLOSED → OPEN` (reopen with audit trail — requires `reopenReason`)
- `OPEN → BLOCKED` (admin block)
- `BLOCKED → OPEN` (admin unblock)
- `CLOSED → BLOCKED` (block after close)

Block any other transition with a domain error.

### Pitfall 5: rateio() Called with floating-point percentages from JS

**What goes wrong:** `50.1 + 49.9` in JavaScript equals `100.00000000000001`, not `100`. The `Math.abs(sum - 100) > 0.01` tolerance handles this but percentages stored in DB as `DECIMAL(7,6)` (0.000001 precision) can accumulate differently.

**How to avoid:** Store percentages as `Decimal(7,4)` (4 decimal places, e.g. `33.3333`). Never use JS native `number` for percentage arithmetic — use `Decimal.js` throughout `rateio()`.

### Pitfall 6: Seed Not Idempotent

**What goes wrong:** Running `prisma db seed` twice creates duplicate accounts (duplicate code+orgId entries exist in dev if unique constraint is violated silently in upsert).

**How to avoid:** Seed uses `upsert` with `where: { organizationId_code: { organizationId, code } }`. Never use `createMany` for seed data that may be rerun.

---

## Code Examples

### Verified Patterns from Codebase

**StockBalance upsert in transaction (apps/backend/prisma/schema.prisma:3157):**
The `AccountBalance` cache follows the same pattern: one row per (account, period), maintained transactionally. The difference is `AccountBalance` needs `openingBalance` (carried forward at period open) in addition to `debitTotal`/`creditTotal`.

**generateInstallments() remainder handling (packages/shared/src/utils/installments.ts:46-53):**
```typescript
// ROUND_DOWN then residual on first → the model for rateio()
const baseDecimal = totalDecimal.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
const sumOfBase = baseAmount.multiply(count);
const residual = totalAmount.subtract(sumOfBase);
// rateio() variation: residual goes to LARGEST share, not first
```

**validateCostCenterItems() (packages/shared/src/utils/installments.ts:87):**
Already validates PERCENTAGE mode sums to 100 — `rateio()` can reuse this exact validation or inline it. Both live in `packages/shared` so no circular dependency.

**AssetHierarchyTab recursive render (apps/frontend/src/components/assets/AssetHierarchyTab.tsx:62-100):**
```tsx
// The COA tree mirrors this — add expand/collapse state:
function CoaTreeNode({ node, level, expandedIds, onToggle, onEdit }) {
  const isExpanded = expandedIds.has(node.id);
  return (
    <>
      <button type="button" className={`coa-tree__node coa-tree__node--level-${level}`}
              aria-expanded={node.isSynthetic ? isExpanded : undefined}
              onClick={() => node.isSynthetic && onToggle(node.id)}>
        {/* ChevronRight/ChevronDown icon for synthetics */}
        <span>{node.code}</span>
        <span>{node.name}</span>
      </button>
      {node.isSynthetic && isExpanded && node.children?.map(child => (
        <CoaTreeNode key={child.id} node={child} level={level + 1}
                     expandedIds={expandedIds} onToggle={onToggle} onEdit={onEdit} />
      ))}
    </>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `AccountingEntry` with string `debitAccount`/`creditAccount` | `ChartOfAccount` model + FK in `JournalEntryLine` | Phase 35 (this phase introduces COA) | Trial balance, cost-center DRE, SPED ECD all become possible |
| `ACCOUNT_CODES` hardcoded string constants | Dynamic lookup via `ChartOfAccount.code` | Phase 35 → Phase 36 transition | Payroll entries in Phase 36 will resolve COA IDs at post time |
| `year: Int` for fiscal year | `startDate`/`endDate` on `FiscalYear` | Phase 35 (new model) | Safra fiscal year (Jul–Jun) supported without hacks |

**Deprecated (do not extend):**
- `AccountingEntry` flat model: frozen read-only after Phase 36 creates `journal_entries` + `journal_entry_lines`
- `ACCOUNT_CODES` hardcoded object: becomes migration-documented then removed in Phase 36

---

## Environment Availability

Step 2.6: Phase is purely code/config changes (new Prisma models, utilities, routes, frontend pages). The only external dependency is PostgreSQL (already running in dev).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 16 | Recursive CTE, migrations | ✓ | 16 (from MEMORY.md) | — |
| Node v24.12 | Backend dev server (tsx) | ✓ | v24.12 (from MEMORY.md) | — |
| pnpm 10.27 | Monorepo package management | ✓ | 10.27 (from MEMORY.md) | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (backend) + Vitest (frontend) |
| Config file | `apps/backend/jest.config.js` / `apps/frontend/vitest.config.ts` |
| Quick run command | `pnpm --filter @protos-farm/backend test -- --testPathPattern chart-of-accounts` |
| Full suite command | `pnpm --filter @protos-farm/backend test` |
| Shared utils tests | `pnpm --filter @protos-farm/shared test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COA-01 | CRUD accounts, code uniqueness, 5-level depth validation, synthetic/analytic flags | unit (service) | `pnpm --filter @protos-farm/backend test -- --testPathPattern chart-of-accounts.routes.spec` | ❌ Wave 0 |
| COA-01 | Tree endpoint returns hierarchical structure via recursive CTE | unit (service) | same | ❌ Wave 0 |
| COA-02 | Rural template seed loads ~100 accounts with correct type/nature/codes | unit (seed) | `pnpm --filter @protos-farm/backend test -- --testPathPattern coa-rural-template.spec` | ❌ Wave 0 |
| COA-03 | SPED ref code N:1 mapping, compatibility validation, unmapped accounts query | unit (service) | `pnpm --filter @protos-farm/backend test -- --testPathPattern chart-of-accounts.routes.spec` | ❌ Wave 0 |
| COA-04 | FiscalYear CRUD, AccountingPeriod auto-open, period status transitions | unit (service) | `pnpm --filter @protos-farm/backend test -- --testPathPattern fiscal-periods.routes.spec` | ❌ Wave 0 |
| COA-04 | `assertPeriodOpen()` throws on CLOSED/BLOCKED, passes on OPEN | unit (shared util) | `pnpm --filter @protos-farm/shared test -- --testPathPattern assert-period-open.spec` | ❌ Wave 0 |
| COA-05 | `rateio()` correct splits, remainder on largest, sums to total exactly | unit (shared util) | `pnpm --filter @protos-farm/shared test -- --testPathPattern rateio.spec` | ❌ Wave 0 |
| COA-05 | `assertBalanced()` throws on unbalanced lines, passes on equal debits/credits | unit (shared util) | `pnpm --filter @protos-farm/shared test -- --testPathPattern assert-balanced.spec` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern "chart-of-accounts|fiscal-periods"`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/shared test`
- **Phase gate:** Full backend + shared suites green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.spec.ts` — covers COA-01, COA-03
- [ ] `apps/backend/src/modules/fiscal-periods/fiscal-periods.routes.spec.ts` — covers COA-04
- [ ] `apps/backend/prisma/fixtures/coa-rural-template.spec.ts` — covers COA-02 (validates ~100 seed accounts load correctly)
- [ ] `packages/shared/src/utils/accounting/__tests__/rateio.spec.ts` — covers COA-05 rateio utility
- [ ] `packages/shared/src/utils/accounting/__tests__/assert-balanced.spec.ts` — covers COA-05 balance guard
- [ ] `packages/shared/src/utils/accounting/__tests__/assert-period-open.spec.ts` — covers COA-04 period guard

---

## Open Questions

1. **ACCOUNT_CODES code alignment**
   - What we know: `ACCOUNT_CODES` in `accounting-entries.types.ts` uses codes `6.1.01`, `2.1.01` etc. Standard CFC uses `5.x.x` for expenses. These don't align.
   - What's unclear: Whether to (a) match the template to ACCOUNT_CODES codes, or (b) update ACCOUNT_CODES to match the standard CFC structure.
   - Recommendation: Use option (a) — seed the rural template with accounts that include the existing codes as aliases, and update ACCOUNT_CODES constants in the same commit wave. Add a comment in the seed file documenting the alignment. This is a Phase 35 decision that affects Phase 36.

2. **organizationId scope for the rural template seed**
   - What we know: All models in this project scope to `organizationId`. The seed file would need an organization ID to load the template.
   - What's unclear: Whether the template loads for ALL organizations at seed time, or is triggered via an API call ("load template for my organization").
   - Recommendation: Implement as an API endpoint `POST /chart-of-accounts/load-template` that a superadmin or org admin calls once. Store the template as a static fixture file; the endpoint reads it and upserts. This is more realistic than a one-time seed (each organization needs their own copy).

3. **CostCenter relation to ChartOfAccount**
   - What we know: `CostCenter` exists (schema:1927) with `farmId`, `code`, `name`, `isActive`. COA-05 requires linking cost centers to accounting entries.
   - What's unclear: Whether the link should be on `ChartOfAccount` (account → CC) or on `AccountBalance` (balance per CC per account) or only on the future `JournalEntryLine` (entry line → CC).
   - Recommendation: The link belongs on `JournalEntryLine` (Phase 36), NOT on `ChartOfAccount`. In Phase 35, `AccountBalance` should NOT have a `costCenterId` — account balances are per-account, not per-account-per-CC. The DRE gerencial by CC is derived from `JournalEntryLine.costCenterId` aggregation. No schema change to `CostCenter` needed in this phase.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection:
  - `apps/backend/prisma/schema.prisma` — CostCenter model (line 1927), StockBalance model (line 3157), AccountingEntry model (line 8833), AccountingSourceType/AccountingEntryType enums
  - `apps/backend/src/modules/accounting-entries/accounting-entries.service.ts` — existing ACCOUNT_CODES pattern and payroll entry creation
  - `apps/backend/src/modules/accounting-entries/accounting-entries.types.ts` — ACCOUNT_CODES hardcoded values
  - `packages/shared/src/utils/installments.ts` — `generateInstallments()` remainder pattern for `rateio()`
  - `apps/frontend/src/components/assets/AssetHierarchyTab.tsx` — recursive tree node pattern for COA frontend
- `.planning/research/STACK.md` — verified no new npm packages needed; recursive CTE pattern
- `.planning/research/SUMMARY.md` — architecture decisions: `FiscalYear.startDate/endDate`, `isFairValueAdjustment` flag, AccountBalance vs. materialized view

### Secondary (MEDIUM confidence)
- CFC Resolution 1.103/2007 + Embrapa "Plano de Contas para Empresas Rurais" — rural COA structure and account group codes (MEDIUM: exact level 3-5 codes vary by organization)
- RFB SPED ECD official documentation (sped.rfb.gov.br) — L300R referential plan structure (MEDIUM: Level-3+ codes for rural-specific accounts need Phase 41 verification)

### Tertiary (LOW confidence)
- ACCOUNT_CODES code numbering convention: the existing `6.1.01` pattern may be a placeholder that doesn't follow any particular standard — treat as requiring alignment with the seed file.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all existing libraries verified
- Architecture (models, utilities): HIGH — direct codebase pattern matches, well-documented PostgreSQL recursive CTE
- Brazilian rural template (COA-02): MEDIUM — CFC/Embrapa structure confirmed; level 3-5 exact codes require alignment with existing ACCOUNT_CODES
- SPED L300R mapping (COA-03): MEDIUM — referential plan confirmed; exact L300R codes for rural specifics verified at Phase 41
- Frontend tree pattern: HIGH — AssetHierarchyTab.tsx directly reusable
- Pitfalls: HIGH — all derived from direct codebase analysis

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable domain — Brazilian accounting standards and project architecture don't change frequently)
