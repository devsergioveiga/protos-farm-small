# Phase 36: Lançamentos Manuais, Razão e Saldo de Abertura — Research

**Researched:** 2026-03-27
**Domain:** Double-entry bookkeeping (partidas dobradas), manual journal entries, ledger (razão), trial balance (balancete), opening balance wizard, reversals with audit trail
**Confidence:** HIGH (stack verified via direct codebase inspection; Brazilian accounting concepts from project's own requirements; patterns confirmed against Phase 35 implementation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANC-03 | Contador cria lançamentos manuais com N linhas débito/crédito, validação de balanceamento, templates, import CSV | `assertBalanced()` already exists in `packages/shared`; new `JournalEntry` + `JournalEntryLine` Prisma models; multi-line form component follows `StockEntriesPage` pattern |
| LANC-04 | Estorno gera lançamento inverso vinculado ao original, motivo obrigatório, trail de auditoria, bloqueio em período fechado | `assertPeriodOpen()` already exists; reversal pattern mirrors `AccountingEntry.reversedByEntryId` already in schema; `createdBy` field covers audit trail |
| LANC-05 | Saldo de abertura: wizard pré-populado com saldo bancário, CP/CR em aberto, valor contábil líquido dos ativos, provisões — contra conta Lucros/Prejuízos Acumulados | Requires aggregate queries across `BankAccountBalance`, `Payable`/`Receivable`, `DepreciationRun` (netBookValue), `PayrollProvision`; special `OPENING_BALANCE` entry type |
| RAZAO-01 | Razão contábil por conta e período: saldo anterior, lançamentos cronológicos, saldo progressivo, drill-down, export PDF/CSV | Running balance computed in SQL with window function or computed in service layer; PDF via existing `pdfkit` pattern from `pesticide-prescriptions` |
| RAZAO-02 | Balancete 3 colunas (saldo anterior, movimento, saldo atual) para qualquer período, totais por grupo, validação equilíbrio, comparativo, export PDF/XLSX | Aggregates from `AccountBalance` + `JournalEntryLine`; XLSX via existing `exceljs` from `depreciation` module |
| RAZAO-03 | Livro diário: lançamentos cronológicos, termos de abertura/encerramento, numeração sequencial, filtros, export PDF | Numeração sequencial via `entryNumber` sequence field; PDF via `pdfkit` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Express 5:** `req.params.id as string` — always cast, never destructure params
- **Prisma enums:** never type as `string`; use `as const` on literals; import from `@prisma/client`
- **Decimal.js:** `Decimal.max(a, b)` static method; use `Money()` factory from `packages/shared`
- **Module pattern:** colocated `modules/{dominio}/controller+service+routes+types`
- **`app.ts` vs `main.ts`:** keep separate for testability
- **Prisma field names:** verify exact names in `schema.prisma` before writing `select`
- **Prisma 7:** `prisma generate` required before `tsc` in CI; `prisma migrate diff --from-migrations --to-schema-datamodel --shadow-database-url` + `deploy` pattern (established Phase 35) — NOT `migrate dev` in CI
- **Nested transactions:** use `prisma.$transaction([])` with array or callback; never nest `withRlsContext` inside another transaction (deadlock risk — established pattern in `payables.routes.ts`)
- **Frontend:** formulários de criação/edição em modal, nunca página dedicada
- **Frontend:** `ConfirmModal` not `window.confirm()` for destructive actions
- **Frontend:** `<button>` not `<div onClick>`, semantic HTML, `aria-label` on icon-only buttons
- **Design system:** DM Sans headlines, Source Sans 3 body, JetBrains Mono data; 4px spacing scale; `var(--color-*)` tokens only; no hardcoded hex
- **TypeScript:** no `any` on frontend; `as string` casts only in Express 5 param extraction on backend
- **Enums in mock data:** `entryType: 'MANUAL' as const`

---

## Summary

Phase 36 is the first "posting" phase of v1.4. Phase 35 built the infrastructure (COA tree, fiscal periods, `AccountBalance` cache); this phase uses all of it. The core deliverable is a new `JournalEntry` + `JournalEntryLine` data model that represents double-entry bookkeeping with a header (date, description, type, status, entry number) and N lines (account, side DEBIT|CREDIT, amount, optional cost center).

Three capabilities layer on top: (1) manual entry creation with `assertBalanced()` guard and template management, (2) reversal that creates an inverse linked entry and blocks on closed periods using `assertPeriodOpen()`, and (3) an opening balance wizard that pre-populates balances from existing modules. The `AccountBalance` table (already created in Phase 35) must be updated on every journal entry post to keep running totals.

The reports (RAZAO-01/02/03) are read-only aggregations over `JournalEntryLine` joined to `AccountBalance`. The ledger running balance is a window sum computed in SQL. The trial balance is an aggregate group-by. Both follow the XLSX/PDF export pattern already used by `depreciation` (ExcelJS) and `pesticide-prescriptions` (pdfkit).

**Primary recommendation:** Build in order: (1) Prisma migration for `JournalEntry`/`JournalEntryLine` + `AccountBalance` update trigger in service, (2) journal entry service (create/post/reverse/templates), (3) opening balance wizard service, (4) ledger + trial balance + daily book query services, (5) routes, (6) frontend modal + pages. No new npm packages needed.

---

## Standard Stack

### Core (no new packages needed — confirmed against project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` | ^7.4.1 | ORM + migrations; `$queryRaw` for window functions the Prisma query builder cannot express | Already installed; Phase 35 established `prisma migrate diff + deploy` pattern |
| `decimal.js` via `Money()` | ^10.6.0 | All monetary arithmetic: running balance, aggregation, trial balance | Project-wide standard; `packages/shared/src/types/money.ts` |
| `pdfkit` | ^0.15.x | PDF export for razão, balancete, livro diário | Already installed — `pesticide-prescriptions` module uses it |
| `exceljs` | ^4.x | XLSX export for balancete (RAZAO-02 specifies XLSX) | Already installed — `depreciation` module uses it |
| `date-fns` | ^4.1.0 | Entry date validation, period boundary checks | Already installed |
| `pino` | ^10.3.1 | Audit logging for entry creation/reversal | Already installed |

### No new npm packages
The entire phase is implementable with the existing dependency set. Confirmed March 2026.

---

## Architecture Patterns

### New Module Structure

```
apps/backend/src/modules/
├── journal-entries/
│   ├── journal-entries.routes.ts       # POST/GET/PATCH endpoints
│   ├── journal-entries.routes.spec.ts  # ~30 tests
│   ├── journal-entries.service.ts      # create, post, reverse, templates, listEntries
│   └── journal-entries.types.ts        # JournalEntryInput, JournalEntryOutput, etc.
├── ledger/
│   ├── ledger.routes.ts                # GET razão, balancete, livro diário + exports
│   ├── ledger.routes.spec.ts           # ~20 tests
│   ├── ledger.service.ts               # getLedger, getTrialBalance, getDailyBook
│   └── ledger.types.ts                 # LedgerLineOutput, TrialBalanceOutput, etc.
└── opening-balance/
    ├── opening-balance.routes.ts       # GET preview, POST post
    ├── opening-balance.routes.spec.ts  # ~15 tests
    ├── opening-balance.service.ts      # getOpeningBalancePreview, postOpeningBalance
    └── opening-balance.types.ts        # OpeningBalanceLineOutput, etc.

apps/frontend/src/
├── pages/
│   ├── JournalEntriesPage.tsx          # Lists journal entries, opens modal
│   ├── JournalEntriesPage.css
│   ├── LedgerPage.tsx                  # Razão contábil with account selector + filter
│   ├── LedgerPage.css
│   ├── TrialBalancePage.tsx            # Balancete 3 colunas
│   └── TrialBalancePage.css
├── components/accounting/
│   ├── JournalEntryModal.tsx           # Multi-line debit/credit form
│   ├── JournalEntryModal.css
│   ├── JournalEntryTemplateModal.tsx   # Save/load templates
│   ├── OpeningBalanceWizard.tsx        # Step-by-step opening balance
│   └── OpeningBalanceWizard.css
├── hooks/
│   ├── useJournalEntries.ts
│   ├── useLedger.ts
│   └── useOpeningBalance.ts
└── types/
    └── journal-entries.ts              # JournalEntry, JournalEntryLine, etc.
```

### Pattern 1: JournalEntry Prisma Model Design

**What:** Two-table design — header (`journal_entries`) + lines (`journal_entry_lines`). `AccountBalance` updated atomically within the same `prisma.$transaction()` callback.

**Schema additions:**

```prisma
// Migration: 20260602000000_add_journal_entries

enum JournalEntryType {
  MANUAL
  OPENING_BALANCE
  REVERSAL
  TEMPLATE_INSTANCE
}

enum JournalEntryStatus {
  DRAFT
  POSTED
  REVERSED
}

enum LedgerSide {
  DEBIT
  CREDIT
}

model JournalEntry {
  id              String             @id @default(uuid())
  organizationId  String
  entryNumber     Int                // sequential per org, set on POST
  entryDate       DateTime           @db.Date
  periodId        String             // FK → AccountingPeriod
  description     String             @db.VarChar(500)
  entryType       JournalEntryType   @default(MANUAL)
  status          JournalEntryStatus @default(DRAFT)
  reversedById    String?            // FK → JournalEntry (reversal points to original)
  reversalOf      String?            // FK → JournalEntry (original entry)
  reversalReason  String?            @db.VarChar(500)
  templateName    String?            // if saved as template
  costCenterId    String?
  createdBy       String             // userId
  postedAt        DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  organization    Organization       @relation(fields: [organizationId], references: [id])
  period          AccountingPeriod   @relation(fields: [periodId], references: [id])
  lines           JournalEntryLine[]
  reversedBy      JournalEntry?      @relation("Reversal", fields: [reversedById], references: [id])
  reversalOfEntry JournalEntry?      @relation("Reversal")
  costCenter      CostCenter?        @relation(fields: [costCenterId], references: [id])
  createdByUser   User               @relation(fields: [createdBy], references: [id])

  @@unique([organizationId, entryNumber])
  @@index([organizationId, periodId])
  @@index([organizationId, status])
  @@index([organizationId, entryDate])
  @@map("journal_entries")
}

model JournalEntryLine {
  id           String       @id @default(uuid())
  journalEntryId String
  accountId    String
  side         LedgerSide
  amount       Decimal      @db.Decimal(14, 2)
  description  String?      @db.VarChar(300)
  costCenterId String?
  lineOrder    Int          // display order within entry

  journalEntry JournalEntry    @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account      ChartOfAccount  @relation(fields: [accountId], references: [id])
  costCenter   CostCenter?     @relation(fields: [costCenterId], references: [id])

  @@index([journalEntryId])
  @@index([accountId])
  @@map("journal_entry_lines")
}
```

**Key constraints:**
- `entryNumber` is assigned on POST (not on DRAFT creation) — sequential per org, use `SELECT MAX(entryNumber) + 1` inside the same transaction
- Only POSTED entries appear in the ledger and update `AccountBalance`
- Only POSTED entries can be reversed
- DRAFT entries can be edited; POSTED entries are immutable

### Pattern 2: createAndPost / post Transaction

**What:** When posting a journal entry, atomically validate, sequence, update `AccountBalance` rows, and mark POSTED — all in one `prisma.$transaction()`.

```typescript
// Source: prisma.$transaction() callback pattern — established in payroll-runs.service.ts

export async function postJournalEntry(
  organizationId: string,
  entryId: string,
  postedBy: string,
): Promise<JournalEntryOutput> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: entryId, organizationId },
      include: { lines: true, period: true },
    });
    if (!entry) throw new JournalEntryError('Lançamento não encontrado', 'NOT_FOUND', 404);
    if (entry.status !== 'DRAFT') throw new JournalEntryError('Apenas rascunhos podem ser postados', 'ALREADY_POSTED', 409);

    // Guard: period must be OPEN
    assertPeriodOpen(entry.period);

    // Guard: lines must balance
    assertBalanced(entry.lines.map(l => ({ side: l.side as 'DEBIT' | 'CREDIT', amount: l.amount.toString() })));

    // Assign sequential entry number
    const maxResult = await tx.journalEntry.aggregate({
      _max: { entryNumber: true },
      where: { organizationId },
    });
    const nextNumber = (maxResult._max.entryNumber ?? 0) + 1;

    // Update AccountBalance for each line
    for (const line of entry.lines) {
      await tx.accountBalance.upsert({
        where: {
          organizationId_accountId_fiscalYearId_month: {
            organizationId,
            accountId: line.accountId,
            fiscalYearId: entry.period.fiscalYearId,
            month: entry.period.month,
          },
        },
        create: {
          organizationId,
          accountId: line.accountId,
          fiscalYearId: entry.period.fiscalYearId,
          month: entry.period.month,
          openingBalance: 0,
          debitTotal: line.side === 'DEBIT' ? line.amount : 0,
          creditTotal: line.side === 'CREDIT' ? line.amount : 0,
          closingBalance: 0, // recomputed by recomputeClosingBalance()
        },
        update: {
          debitTotal: { increment: line.side === 'DEBIT' ? line.amount : 0 },
          creditTotal: { increment: line.side === 'CREDIT' ? line.amount : 0 },
        },
      });
    }

    // Recompute closingBalance for affected accounts
    // closingBalance = openingBalance +/- net movement based on account nature
    // (DEVEDORA: opening + debits - credits; CREDORA: opening - debits + credits)

    return tx.journalEntry.update({
      where: { id: entryId },
      data: { status: 'POSTED', entryNumber: nextNumber, postedAt: new Date(), createdBy: postedBy },
      include: { lines: { include: { account: true } } },
    });
  });
}
```

### Pattern 3: Reversal (LANC-04)

**What:** Creates an inverse entry (all DEBIT↔CREDIT flipped), links it to the original, marks original as REVERSED.

```typescript
export async function reverseJournalEntry(
  organizationId: string,
  entryId: string,
  reason: string,
  reversedBy: string,
): Promise<JournalEntryOutput> {
  if (!reason.trim()) throw new JournalEntryError('Motivo do estorno é obrigatório', 'REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findFirst({
      where: { id: entryId, organizationId },
      include: { lines: true, period: true },
    });
    if (!original) throw new JournalEntryError('Lançamento não encontrado', 'NOT_FOUND', 404);
    if (original.status !== 'POSTED') throw new JournalEntryError('Apenas lançamentos postados podem ser estornados', 'NOT_POSTED', 409);
    if (original.status === 'REVERSED') throw new JournalEntryError('Lançamento já estornado', 'ALREADY_REVERSED', 409);

    assertPeriodOpen(original.period); // blocks reversal in closed periods

    // Create reversal entry with inverted lines
    const reversal = await tx.journalEntry.create({
      data: {
        organizationId,
        entryNumber: 0, // placeholder — will be overwritten by postJournalEntry logic
        entryDate: new Date(),
        periodId: original.periodId,
        description: `ESTORNO: ${original.description}`,
        entryType: 'REVERSAL',
        status: 'DRAFT',
        reversalOf: entryId,
        reversalReason: reason,
        createdBy: reversedBy,
        lines: {
          create: original.lines.map((l, idx) => ({
            accountId: l.accountId,
            side: l.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            amount: l.amount,
            description: l.description,
            costCenterId: l.costCenterId,
            lineOrder: idx,
          })),
        },
      },
      include: { lines: true, period: true },
    });

    // Mark original as REVERSED
    await tx.journalEntry.update({ where: { id: entryId }, data: { status: 'REVERSED', reversedById: reversal.id } });

    return reversal;
  });
  // Caller then calls postJournalEntry(reversal.id) to assign entryNumber and update balances
}
```

### Pattern 4: Opening Balance Wizard (LANC-05)

**What:** Read-only aggregate query that pulls current balances from 4 sources; user reviews and confirms; system posts one special `OPENING_BALANCE` journal entry.

**Pre-population sources (all verified in schema):**

| Source | Model | Field | How |
|--------|-------|-------|-----|
| Saldo bancário | `BankAccountBalance` | `currentBalance` | Sum per org, map to account `1.1.01` or per-bank COA account |
| CP em aberto | `Payable` | `totalAmount WHERE status IN ('PENDING','PARTIAL','OVERDUE')` | Map to `2.x` COA accounts by `category` |
| CR em aberto | `Receivable` | `totalAmount WHERE status IN ('PENDING','PARTIAL','OVERDUE')` | Map to `1.x` COA accounts |
| Valor líquido ativos | `DepreciationRun` / `Asset` join | `netBookValue` on latest run per asset | Map to `1.2.x` accounts (imobilizado) |
| Provisões trabalhistas | `PayrollProvision` | `vacationProvision`, `thirteenthProvision` | Map to `2.2.01`, `2.2.02` |

**Contra-entry:** All opening balance lines must balance against the "Lucros e Prejuízos Acumulados" account (PL account, typically code `3.x.xx` in the rural template). The wizard computes the net difference automatically.

**Important:** `OPENING_BALANCE` entry must be validated for uniqueness — only one per organization per fiscal year (enforce with unique constraint or service-level guard).

### Pattern 5: Ledger Running Balance (RAZAO-01)

**What:** SQL window function to compute running balance per account.

```sql
-- Source: PostgreSQL window functions — established via $queryRaw pattern in COA service

SELECT
  je.id AS entry_id,
  je.entry_number,
  je."entryDate",
  je.description,
  jel.side,
  jel.amount,
  SUM(
    CASE
      WHEN coa.nature = 'DEVEDORA' THEN
        CASE jel.side WHEN 'DEBIT' THEN jel.amount ELSE -jel.amount END
      ELSE
        CASE jel.side WHEN 'CREDIT' THEN jel.amount ELSE -jel.amount END
    END
  ) OVER (ORDER BY je."entryDate", je.entry_number) AS running_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel."journalEntryId"
JOIN chart_of_accounts coa ON coa.id = jel."accountId"
WHERE je."organizationId" = $1
  AND jel."accountId" = $2
  AND je.status = 'POSTED'
  AND je."entryDate" BETWEEN $3 AND $4
ORDER BY je."entryDate", je.entry_number, jel."lineOrder";
```

**Opening balance for the running sum:** Add `AccountBalance.openingBalance` for the account/period as the seed value before the window function. This gives the "saldo anterior" column.

### Pattern 6: Trial Balance (RAZAO-02)

```typescript
// Source: AccountBalance aggregation — uses existing account_balances table

// Query: group by accountId for a given fiscal year + month range
// Columns:
//   - saldo_anterior:  AccountBalance.openingBalance for first month in range
//   - debitos:         SUM(AccountBalance.debitTotal) for the range
//   - creditos:        SUM(AccountBalance.creditTotal) for the range
//   - saldo_atual:     openingBalance + net movement (nature-adjusted)
// Totals by group: aggregate by accountType (ATIVO/PASSIVO/PL/RECEITA/DESPESA)
// Validation: SUM(all debits) must equal SUM(all credits)
```

### Pattern 7: Daily Book (RAZAO-03)

```typescript
// Livro Diário = all POSTED journal entries ordered by entryDate + entryNumber
// with opening term (termo de abertura) and closing term (termo de encerramento)
// Numbering: entryNumber field — sequential per org, assigned on POST
// Filter: date range, min/max amount, entryType
// Export: pdfkit — same pattern as pesticide-prescriptions PDF
```

### Anti-Patterns to Avoid

- **Updating `AccountBalance` outside a transaction:** `AccountBalance` must always be updated atomically with the journal entry status change. Never update them in a separate service call.
- **Computing running balance in the service layer:** Use the SQL window function — computing in JavaScript requires loading all entries into memory.
- **Allowing posting to CLOSED/BLOCKED periods:** `assertPeriodOpen()` must be called before every post and reversal.
- **Duplicate opening balances:** Guard with unique constraint or explicit service check — only one `OPENING_BALANCE` entry per fiscal year per org.
- **Using AccountingEntry (old model) for new entries:** The old `AccountingEntry` model is frozen (payroll-only). All Phase 36+ entries go into `JournalEntry`.
- **Integer amounts:** All amounts are `Decimal` / `Money()` — never `number` for monetary values on the backend.
- **Missing `JournalEntryLine` → `ChartOfAccount` relation:** Account must exist, be active, and have `allowManualEntry: true` before any line can reference it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debit/credit balance validation | Custom sum loop | `assertBalanced()` in `packages/shared/src/utils/accounting/assert-balanced.ts` | Already exists, tested, handles Decimal/string amounts |
| Period open check | Custom status check | `assertPeriodOpen()` in `packages/shared/src/utils/accounting/assert-period-open.ts` | Already exists, throws `PeriodNotOpenError` |
| Cost center proportional split | Custom division | `rateio()` in `packages/shared/src/utils/accounting/rateio.ts` | Already exists, handles remainder distribution |
| Monetary arithmetic | Plain `number` addition | `Money()` from `packages/shared/src/types/money.ts` | Decimal-precise, `ROUND_HALF_UP` for BRL |
| PDF generation | Custom PDF | `pdfkit` — follow `pesticide-prescriptions.service.ts` pattern | Already installed, proven in production |
| XLSX generation | Custom CSV/HTML | `exceljs` — follow `depreciation.service.ts` pattern | Already installed, multi-sheet support |
| Running balance | In-memory JS reduce | PostgreSQL `SUM(...) OVER (ORDER BY ...)` window function via `$queryRaw` | Database handles ordering + precision; no memory load |

---

## Common Pitfalls

### Pitfall 1: AccountBalance Drift (Balance Inconsistency)
**What goes wrong:** `AccountBalance` rows show wrong totals because a post or reversal failed after partial balance updates.
**Why it happens:** Updating balances in a loop with individual `prisma.accountBalance.upsert()` calls outside a transaction — if any call fails after some succeed, balance becomes inconsistent.
**How to avoid:** All `accountBalance.upsert()` calls for a single `postJournalEntry()` or `reverseJournalEntry()` must be inside the same `prisma.$transaction()` callback.
**Warning signs:** Trial balance where total debits != total credits; ledger running balance doesn't match AccountBalance.closingBalance.

### Pitfall 2: entryNumber Race Condition
**What goes wrong:** Two concurrent POST requests get the same `entryNumber`.
**Why it happens:** `SELECT MAX(entryNumber) + 1` is not atomic across concurrent requests.
**How to avoid:** Run inside `prisma.$transaction()` at SERIALIZABLE level, or use a Postgres sequence (`CREATE SEQUENCE journal_entry_number_seq`). The simpler approach: wrap in `$transaction()` with `isolationLevel: 'Serializable'` for the entry number assignment step.
**Warning signs:** `unique constraint violation` on `[organizationId, entryNumber]`.

### Pitfall 3: Opening Balance Posted Twice
**What goes wrong:** `OPENING_BALANCE` entry created twice → double-counts all balances.
**Why it happens:** Wizard "Post" button clicked twice or re-run after fiscal year already initialized.
**How to avoid:** Add `@@unique([organizationId, fiscalYearId, entryType])` on `JournalEntry` for `OPENING_BALANCE` type, or service-level guard checking `existingOpeningBalance`.
**Warning signs:** AccountBalance values doubled.

### Pitfall 4: Reversal Fails Silently on Closed Period
**What goes wrong:** Reversal button visible on entry but request returns 422; user confused.
**Why it happens:** The period was closed between when the user loaded the list and when they clicked Reverse.
**How to avoid:** Frontend shows period status badge on each entry; reversal button disabled if `period.status !== 'OPEN'`. Backend always re-validates anyway.
**Warning signs:** User sees "Lançamento não pode ser estornado" with no explanation.

### Pitfall 5: closingBalance Not Recomputed After upsert
**What goes wrong:** `AccountBalance.closingBalance` stays 0 or wrong after posting entries.
**Why it happens:** Incrementing `debitTotal`/`creditTotal` but forgetting to recompute `closingBalance = openingBalance + debits - credits` (or reversed for CREDORA accounts).
**How to avoid:** After all upserts, run a separate `UPDATE account_balances SET closing_balance = opening_balance + debit_total - credit_total WHERE nature = 'DEVEDORA'` (and inverse for CREDORA) within the same transaction.
**Warning signs:** Razão shows correct movements but wrong saldo final; trial balance saldo_atual is always 0.

### Pitfall 6: `allowManualEntry: false` Not Enforced
**What goes wrong:** User posts an entry to a synthetic account or a restricted account, corrupting the COA integrity.
**Why it happens:** Service doesn't validate account `isSynthetic` or `allowManualEntry` flags.
**How to avoid:** In `createJournalEntry`, for each line validate: `account.isActive === true`, `account.isSynthetic === false`, `account.allowManualEntry === true`.
**Warning signs:** Synthetic aggregation accounts show direct entries; subtotals broken in trial balance.

### Pitfall 7: PDF Stream Not Piped Correctly
**What goes wrong:** PDF response returns empty or partial content.
**Why it happens:** `pdfkit` uses a streaming API — `doc.end()` must be called and `doc.pipe(res)` must be set before writing content. Forgetting `doc.end()` or calling `res.end()` separately causes issues.
**How to avoid:** Follow the exact pattern in `pesticide-prescriptions.service.ts`: `doc.pipe(res)`, write content, `doc.end()`. Never call `res.end()` or `res.json()` after `doc.pipe(res)`.
**Warning signs:** Browser shows empty PDF or download hangs.

---

## Code Examples

### Creating a Journal Entry (multi-line)

```typescript
// Source: journal-entries.service.ts (to be created)
// Pattern: follows grain-harvests.service.ts create + separate post lifecycle

export async function createJournalEntryDraft(
  organizationId: string,
  input: CreateJournalEntryInput,
  createdBy: string,
): Promise<JournalEntryOutput> {
  // Validate all accounts exist, are active, allow manual entry
  const accountIds = input.lines.map(l => l.accountId);
  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, id: { in: accountIds } },
    select: { id: true, isActive: true, isSynthetic: true, allowManualEntry: true, nature: true },
  });
  for (const line of input.lines) {
    const acc = accounts.find(a => a.id === line.accountId);
    if (!acc) throw new JournalEntryError(`Conta ${line.accountId} não encontrada`, 'ACCOUNT_NOT_FOUND', 404);
    if (!acc.isActive) throw new JournalEntryError('Conta inativa', 'ACCOUNT_INACTIVE', 422);
    if (acc.isSynthetic) throw new JournalEntryError('Conta sintética não aceita lançamentos', 'SYNTHETIC_ACCOUNT', 422);
    if (!acc.allowManualEntry) throw new JournalEntryError('Conta não permite lançamento manual', 'MANUAL_ENTRY_DISALLOWED', 422);
  }

  // Validate balance (DRAFT validation — prevents saving unbalanced entries)
  assertBalanced(input.lines.map(l => ({ side: l.side, amount: l.amount })));

  // Validate period exists and is OPEN
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: input.periodId, organizationId },
  });
  if (!period) throw new JournalEntryError('Período não encontrado', 'PERIOD_NOT_FOUND', 404);
  assertPeriodOpen(period);

  return prisma.journalEntry.create({
    data: {
      organizationId,
      entryNumber: 0, // assigned on POST
      entryDate: new Date(input.entryDate),
      periodId: input.periodId,
      description: input.description,
      entryType: 'MANUAL' as const,
      status: 'DRAFT' as const,
      createdBy,
      costCenterId: input.costCenterId ?? null,
      lines: {
        create: input.lines.map((l, idx) => ({
          accountId: l.accountId,
          side: l.side as 'DEBIT' | 'CREDIT',
          amount: new Decimal(l.amount),
          description: l.description ?? null,
          costCenterId: l.costCenterId ?? null,
          lineOrder: idx,
        })),
      },
    },
    include: { lines: { include: { account: { select: { code: true, name: true, nature: true } } } }, period: true },
  });
}
```

### Ledger Query (running balance)

```typescript
// Source: chart-of-accounts.service.ts $queryRaw pattern (Phase 35)

export async function getLedger(
  organizationId: string,
  accountId: string,
  startDate: Date,
  endDate: Date,
): Promise<LedgerOutput> {
  const rows = await (prisma as any).$queryRaw`
    SELECT
      je.id AS entry_id,
      je.entry_number,
      je."entryDate" AS entry_date,
      je.description,
      jel.id AS line_id,
      jel.side,
      jel.amount,
      coa.nature,
      SUM(
        CASE coa.nature
          WHEN 'DEVEDORA' THEN CASE jel.side WHEN 'DEBIT' THEN jel.amount ELSE -jel.amount END
          ELSE CASE jel.side WHEN 'CREDIT' THEN jel.amount ELSE -jel.amount END
        END
      ) OVER (ORDER BY je."entryDate", je.entry_number ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        AS running_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalEntryId"
    JOIN chart_of_accounts coa ON coa.id = jel."accountId"
    WHERE je."organizationId" = ${organizationId}
      AND jel."accountId" = ${accountId}
      AND je.status = 'POSTED'
      AND je."entryDate" BETWEEN ${startDate} AND ${endDate}
    ORDER BY je."entryDate", je.entry_number, jel."lineOrder"
  `;
  return mapLedgerRows(rows);
}
```

### Frontend: Multi-Line Debit/Credit Form

```tsx
// Source: pattern from StockEntriesPage/StockEntryModal — dynamic row add/remove

function JournalEntryModal({ isOpen, onClose, onSuccess }: JournalEntryModalProps) {
  const [lines, setLines] = useState<EntryLine[]>([
    { accountId: '', side: 'DEBIT', amount: '', description: '' },
    { accountId: '', side: 'CREDIT', amount: '', description: '' },
  ]);

  const totalDebit  = lines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + parseFloat(l.amount || '0'), 0);
  const totalCredit = lines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + parseFloat(l.amount || '0'), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.005;

  function addLine(side: 'DEBIT' | 'CREDIT') {
    setLines(prev => [...prev, { accountId: '', side, amount: '', description: '' }]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  // Submit disabled until isBalanced && all accountIds filled
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-row `AccountingEntry` (debitAccount string, creditAccount string, amount) | Multi-line `JournalEntry` + `JournalEntryLine` (N debits, M credits) | Phase 36 | Supports N-way entries (rateio), audit trail, templates |
| Hardcoded `ACCOUNT_CODES` constants in `accounting-entries.types.ts` | Dynamic FK references to `ChartOfAccount.id` via `JournalEntryLine.accountId` | Phase 36 | COA-managed accounts; existing `AccountingEntry` remains frozen for payroll |

**Deprecated/outdated:**
- `AccountingEntry` model: frozen for payroll entries only; do NOT extend for new features — use `JournalEntry` going forward
- `ACCOUNT_CODES` constants: remain valid for legacy payroll entries; new manual entries reference `ChartOfAccount` by ID

---

## Open Questions

1. **Unique constraint for OPENING_BALANCE**
   - What we know: only one opening balance entry should exist per org per fiscal year
   - What's unclear: should we use a DB unique constraint `@@unique([organizationId, fiscalYearId, entryType])` (blocks all future OPENING_BALANCE) or a service-level guard (more flexible)?
   - Recommendation: service-level guard with clear error message; `entryType` alone as unique key is too restrictive if org wants to re-run after corrections — implement as "one OPENING_BALANCE per fiscal year" query guard

2. **Template storage for recurring entries (LANC-03)**
   - What we know: LANC-03 requires "templates salvos para lançamentos recorrentes"
   - What's unclear: are templates stored as `JournalEntry` rows with `status = DRAFT` and a `templateName`, or as a separate `JournalEntryTemplate` table?
   - Recommendation: simplest approach — store as `JournalEntry` rows with `entryType = TEMPLATE_INSTANCE` and a non-null `templateName`; list endpoint filters `status = DRAFT AND templateName IS NOT NULL`

3. **CSV import scope (LANC-03)**
   - What we know: requirement mentions "importação de lançamentos via CSV"
   - What's unclear: full CSV validation (column mapping, error rows) vs. simple parse
   - Recommendation: simple parse + validate each row with `assertBalanced()` + validate accounts; return a preview array before posting; follow `employee-bulk-import.service.ts` pattern

4. **Opening balance wizard: which specific COA accounts map to which data sources**
   - What we know: the wizard pre-populates from bank balances, CP/CR, assets, provisions
   - What's unclear: the exact COA account codes to credit/debit vary per organization's specific chart (e.g., bank account might be `1.1.01` or a more specific sub-account)
   - Recommendation: wizard shows the calculated amounts with a suggested account (from COA, filtered by type) but allows user to confirm/override the account mapping before posting

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all tools already installed in project; pdfkit and exceljs verified as existing dependencies)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + supertest |
| Config file | `apps/backend/jest.config.js` |
| Quick run command | `cd apps/backend && npx jest --testPathPattern=journal-entries --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANC-03 | POST /journal-entries creates DRAFT with N lines | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "creates draft"` | Wave 0 |
| LANC-03 | POST .../post rejects unbalanced entry | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "rejects unbalanced"` | Wave 0 |
| LANC-03 | POST .../post assigns sequential entryNumber | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "assigns sequential"` | Wave 0 |
| LANC-03 | Templates: save and list draft templates | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "template"` | Wave 0 |
| LANC-04 | POST .../reverse creates inverse entry linked to original | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "reversal"` | Wave 0 |
| LANC-04 | Reversal blocked on closed period | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "closed period"` | Wave 0 |
| LANC-04 | Reversal requires non-empty reason | integration | `npx jest --testPathPattern=journal-entries.routes.spec -t "reason required"` | Wave 0 |
| LANC-05 | GET opening-balance/preview returns aggregated balances from 4 sources | integration | `npx jest --testPathPattern=opening-balance.routes.spec -t "preview"` | Wave 0 |
| LANC-05 | POST opening-balance/post creates OPENING_BALANCE entry | integration | `npx jest --testPathPattern=opening-balance.routes.spec -t "posts opening balance"` | Wave 0 |
| RAZAO-01 | GET ledger/:accountId returns lines with running balance | integration | `npx jest --testPathPattern=ledger.routes.spec -t "running balance"` | Wave 0 |
| RAZAO-02 | GET trial-balance returns 3-column data with totals | integration | `npx jest --testPathPattern=ledger.routes.spec -t "trial balance"` | Wave 0 |
| RAZAO-02 | Trial balance total debits == total credits | integration | `npx jest --testPathPattern=ledger.routes.spec -t "balanced"` | Wave 0 |
| RAZAO-03 | GET daily-book returns entries in chronological order with entry numbers | integration | `npx jest --testPathPattern=ledger.routes.spec -t "daily book"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern="journal-entries|opening-balance|ledger" --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/journal-entries/journal-entries.routes.spec.ts` — covers LANC-03/04
- [ ] `apps/backend/src/modules/opening-balance/opening-balance.routes.spec.ts` — covers LANC-05
- [ ] `apps/backend/src/modules/ledger/ledger.routes.spec.ts` — covers RAZAO-01/02/03

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `apps/backend/prisma/schema.prisma` (AccountBalance, ChartOfAccount, FiscalYear, AccountingPeriod, Payable, Receivable, BankAccountBalance, DepreciationRun, PayrollProvision models verified)
- `packages/shared/src/utils/accounting/` — `assertBalanced.ts`, `assertPeriodOpen.ts`, `rateio.ts` verified as existing and tested
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts` — `$queryRaw` WITH RECURSIVE pattern confirmed
- `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — `prisma.$transaction()` callback pattern confirmed
- `apps/frontend/src/pages/ChartOfAccountsPage.tsx` — frontend modal + tree component pattern confirmed
- `apps/frontend/src/components/layout/Sidebar.tsx` — CONTABILIDADE sidebar section location confirmed

### Secondary (MEDIUM confidence)
- Brazilian double-entry bookkeeping standards (partidas dobradas) — well-established accounting domain; `assertBalanced()` constraint confirms project alignment
- pdfkit streaming pattern — `modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` confirmed as existing usage
- ExcelJS multi-sheet — `modules/depreciation/depreciation.service.ts` confirmed as existing usage

### Tertiary (LOW confidence)
- PostgreSQL window function `SUM() OVER (ORDER BY ...)` for running balance — standard SQL; project already uses `$queryRaw` for complex queries (HIGH confidence on the pattern, MEDIUM on exact column alias escaping in Prisma)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in project
- Architecture (JournalEntry model): HIGH — follows Phase 35 pattern; schema fields verified
- Architecture (ledger query): MEDIUM — SQL window function pattern is standard; exact Prisma `$queryRaw` template literal escaping requires care
- Opening balance pre-population: MEDIUM — all 4 source models verified in schema; exact field names verified
- Pitfalls: HIGH — all identified from direct codebase patterns and accounting domain knowledge

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable stack)
