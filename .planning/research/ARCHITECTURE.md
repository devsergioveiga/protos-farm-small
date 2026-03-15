# Architecture Research

**Domain:** Financial management module within existing agricultural Express/Prisma monolith
**Researched:** 2026-03-15
**Confidence:** HIGH — derived from direct analysis of existing codebase patterns

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19)                          │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────────┐ │
│  │ Sidebar      │  │ Pages (lazy)  │  │ Modals (CRUD forms)       │ │
│  │ FINANCEIRO   │  │ BankAccountsP │  │ BankAccountModal          │ │
│  │ group        │  │ PayablesPage  │  │ PayableModal              │ │
│  │              │  │ ReceivablesP  │  │ ReceivableModal           │ │
│  │              │  │ CashFlowPage  │  │ PaymentModal              │ │
│  │              │  │ FinDashboard  │  │ ReconcileModal            │ │
│  └──────────────┘  └───────┬───────┘  └───────────────────────────┘ │
│                            │ hooks (usePayables, useBankAccounts…)   │
│                            │ services (API fetch calls)              │
└────────────────────────────┼─────────────────────────────────────────┘
                             │ HTTP (REST JSON)
┌────────────────────────────┼─────────────────────────────────────────┐
│                     BACKEND (Express 5)                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Middleware chain: auth → authorize → metricsMiddleware         │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                        │
│  ┌──────────────────────────┼──────────────────────────────────────┐ │
│  │                    Financial Modules                            │ │
│  │                                                                 │ │
│  │  bank-accounts   payables    receivables   cash-flow            │ │
│  │  ├─ routes.ts    ├─ routes   ├─ routes     ├─ routes            │ │
│  │  ├─ service.ts   ├─ service  ├─ service    ├─ service           │ │
│  │  └─ types.ts     └─ types    └─ types      └─ types             │ │
│  │                                                                 │ │
│  │  credit-cards    reconciliation   credit-rural  fin-dashboard   │ │
│  │  ├─ routes.ts    ├─ routes        ├─ routes     ├─ routes       │ │
│  │  ├─ service.ts   ├─ service       ├─ service    └─ service      │ │
│  │  └─ types.ts     └─ types         └─ types                      │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │ Prisma 7 (withRlsContext)              │
│  ┌──────────────────────────┼──────────────────────────────────────┐ │
│  │              PostgreSQL 16 — Financial Tables                   │ │
│  │                                                                 │ │
│  │  bank_accounts  credit_cards  payables    receivables           │ │
│  │  bank_transfers fin_txns      payments    receipts              │ │
│  │  reconciliation cash_flow     credit_ops  cheques               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component               | Responsibility                                                                                     | Communicates With                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `bank-accounts` module  | CRUD of bank accounts, balance tracking, CNAB convenio data                                        | `payables` (payment settlement), `receivables` (receipt settlement), `reconciliation`            |
| `credit-cards` module   | Credit card CRUD, statement management, installment tracking                                       | `payables` (invoice becomes payable on closing), `bank-accounts` (payment)                       |
| `payables` module       | AP lifecycle: create → approve → pay → settle. Cost center apportionment, installments, recurrence | `bank-accounts` (debit on payment), `cost-centers` (existing), `producers` (existing)            |
| `receivables` module    | AR lifecycle: create → receive → settle. Rural revenue categories, FUNRURAL, PDD                   | `bank-accounts` (credit on receipt), `producers` (client link)                                   |
| `reconciliation` module | OFX/CSV/PDF import, transaction matching, monthly close                                            | `bank-accounts` (balance update), `payables` (match paid), `receivables` (match received)        |
| `cash-flow` module      | Realized + projected DFC, scenario modeling, negative balance alerts                               | `payables` (future outflows), `receivables` (future inflows), `bank-accounts` (current balances) |
| `credit-rural` module   | PRONAF/PRONAMP/Funcafé/CPR operations, amortization schedules (SAC/Price/Bullet)                   | `payables` (generates installment payables), `bank-accounts` (credit disbursement)               |
| `fin-dashboard` module  | Aggregated KPIs: total balance, AP/AR aging, monthly result, debt ratio, top expenses/income       | All financial modules (read-only aggregation)                                                    |
| `cheques` module        | Pre-dated cheque register, compensation tracking, reconciliation with bank                         | `payables`, `receivables`, `bank-accounts`                                                       |

## Recommended Project Structure

```
apps/backend/src/modules/
├── bank-accounts/              # US-FN01: CRUD contas bancárias, saldo, extrato
│   ├── bank-accounts.routes.ts
│   ├── bank-accounts.service.ts
│   ├── bank-accounts.types.ts
│   └── bank-accounts.routes.spec.ts
│
├── bank-transfers/             # US-FN04: Transferências entre contas
│   ├── bank-transfers.routes.ts
│   ├── bank-transfers.service.ts
│   └── bank-transfers.types.ts
│
├── credit-cards/               # US-FN02: Cartões corporativos
│   ├── credit-cards.routes.ts
│   ├── credit-cards.service.ts
│   └── credit-cards.types.ts
│
├── card-invoices/              # US-FN05: Gestão de fatura de cartão
│   ├── card-invoices.routes.ts
│   ├── card-invoices.service.ts
│   └── card-invoices.types.ts
│
├── bank-reconciliation/        # US-FN06: Conciliação bancária (OFX/CSV/PDF)
│   ├── bank-reconciliation.routes.ts
│   ├── bank-reconciliation.service.ts
│   ├── bank-reconciliation.types.ts
│   └── ofx-parser.ts          # OFX file parser utility
│
├── payables/                   # US-FN07+FN08: Contas a pagar + baixa
│   ├── payables.routes.ts
│   ├── payables.service.ts
│   ├── payables.types.ts
│   └── cnab.ts                # CNAB 240/400 remessa generator
│
├── cheques/                    # US-FN09: Cheques emitidos e recebidos
│   ├── cheques.routes.ts
│   ├── cheques.service.ts
│   └── cheques.types.ts
│
├── payables-aging/             # US-FN10: Aging CP + alertas
│   ├── payables-aging.routes.ts
│   └── payables-aging.service.ts
│
├── receivables/                # US-FN11+FN12: Contas a receber + baixa
│   ├── receivables.routes.ts
│   ├── receivables.service.ts
│   └── receivables.types.ts
│
├── cash-flow/                  # US-FN13: Fluxo de caixa realizado + projetado
│   ├── cash-flow.routes.ts
│   ├── cash-flow.service.ts
│   └── cash-flow.types.ts
│
├── credit-rural/               # US-FN14: Operações de crédito rural
│   ├── credit-rural.routes.ts
│   ├── credit-rural.service.ts
│   └── credit-rural.types.ts
│
└── fin-dashboard/              # US-FN15: Dashboard financeiro consolidado
    ├── fin-dashboard.routes.ts
    └── fin-dashboard.service.ts

apps/frontend/src/
├── pages/
│   ├── BankAccountsPage.tsx    # US-FN01+FN03: Lista + extrato + saldo
│   ├── CreditCardsPage.tsx     # US-FN02+FN05: Cartões + faturas
│   ├── PayablesPage.tsx        # US-FN07+FN08+FN10: CP lista + aging
│   ├── ReceivablesPage.tsx     # US-FN11+FN12: CR lista + inadimplência
│   ├── CashFlowPage.tsx        # US-FN13: Fluxo de caixa com cenários
│   ├── CreditRuralPage.tsx     # US-FN14: Operações crédito rural
│   └── FinDashboardPage.tsx    # US-FN15: Dashboard financeiro
│
└── components/
    ├── bank-accounts/
    │   ├── BankAccountModal.tsx
    │   └── TransferModal.tsx
    ├── payables/
    │   ├── PayableModal.tsx     # Create/edit CP
    │   ├── PaymentModal.tsx     # Baixa de pagamento
    │   └── ChequeModal.tsx
    ├── receivables/
    │   ├── ReceivableModal.tsx
    │   └── ReceiptModal.tsx    # Baixa de recebimento
    ├── reconciliation/
    │   └── ReconcileModal.tsx  # Import OFX + matching UI
    └── credit-cards/
        ├── CreditCardModal.tsx
        └── CardInvoiceModal.tsx
```

### Structure Rationale

- **One module per subdomain:** `payables` and `receivables` are separate despite symmetry — their business rules diverge significantly (FUNRURAL on CR, CNAB remessa on CP)
- **`payables-aging` as separate module:** Aging queries are read-only aggregations; isolating them prevents coupling the write path and allows independent caching
- **`bank-reconciliation` owns OFX parsing:** The `ofx-parser.ts` utility lives inside the module that uses it — consistent with the `cnab.ts` pattern in `payables`
- **`fin-dashboard` is read-only:** Service only reads across modules via direct Prisma queries — no service-to-service calls, no events
- **Split `bank-accounts` / `bank-transfers`:** Transfers are an operation with their own lifecycle (double-entry mirrored records); keeping them separate avoids a god module

## Architectural Patterns

### Pattern 1: Double-Entry Ledger via Prisma Transactions

**What:** Every financial mutation that touches a bank balance (payment, receipt, transfer, reconciliation settlement) runs inside a single Prisma transaction that creates the transaction record AND updates the balance aggregate.

**When to use:** Any time a balance (`BankAccountBalance`) changes.

**Trade-offs:** Ensures consistency at the cost of longer transactions; acceptable for the write volumes of an agricultural management system.

**Example:**

```typescript
// payables.service.ts — settlePayment
export async function settlePayment(
  ctx: RlsContext,
  payableId: string,
  input: SettlePaymentInput,
): Promise<PayableOutput> {
  return withRlsContext(ctx, async (tx) => {
    const payable = await tx.payable.findUniqueOrThrow({ where: { id: payableId } });

    // 1. Mark payable as paid
    const updated = await tx.payable.update({
      where: { id: payableId },
      data: { status: 'PAID', paidAt: new Date(input.paidAt), amountPaid: input.amount },
    });

    // 2. Debit bank account balance atomically
    await tx.bankAccountBalance.update({
      where: { bankAccountId: input.bankAccountId },
      data: { currentBalance: { decrement: input.amount } },
    });

    // 3. Create audit transaction record
    await tx.financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId: input.bankAccountId,
        type: 'DEBIT',
        amount: input.amount,
        description: `Pagamento CP #${payable.documentNumber}`,
        referenceType: 'PAYABLE',
        referenceId: payableId,
        transactionDate: new Date(input.paidAt),
      },
    });

    return toPayableOutput(updated);
  });
}
```

### Pattern 2: Cost Center Apportionment on Payables and Receivables

**What:** Both payables (CP) and receivables (CR) support splitting a single document across multiple cost centers by percentage. This mirrors how `StockEntry` handles expense apportionment across items.

**When to use:** Any CP or CR creation/edit that specifies cost center allocation.

**Trade-offs:** Stored as child rows (`PayableCostCenterItem`), not as a single column — allows reporting by cost center without JSON parsing. Cost center entity (`CostCenter`) already exists in `modules/cost-centers/`.

**Example (schema shape):**

```
Payable (1) ──→ (N) PayableCostCenterItem
                      ├── costCenterId → CostCenter.id
                      ├── farmId       → Farm.id
                      └── percentage   Decimal (sum must = 100)
```

### Pattern 3: Recurrence via cron-generated drafts

**What:** Recurring payables and receivables (monthly rent, PRONAF installments) are handled by storing a `RecurrenceConfig` on the original document. A scheduled job (or on-demand trigger at listing time) generates the next pending document in draft status.

**When to use:** `payable.recurrenceType !== 'NONE'` or `receivable.recurrenceType !== 'NONE'`.

**Trade-offs:** Generating on-demand at list time is simpler to implement than a cron job and avoids infrastructure dependency; acceptable for the small number of recurrences typical in farm operations.

### Pattern 4: File Import as Async Parse + Preview + Confirm

**What:** OFX/CSV import for reconciliation follows a three-step flow matching the existing bulk-import pattern (`BulkImportModal`): (1) upload and parse server-side, (2) return parsed transactions for preview with match confidence scores, (3) user confirms → persist.

**When to use:** `bank-reconciliation` module for OFX/CSV/PDF import. Also card invoice import (US-FN05).

**Trade-offs:** Keeps the happy path within a single request cycle (parse + preview in one POST); confirmation is a second POST. Avoids storing temporary state in the database.

## Data Flow

### Request Flow

```
User Action (e.g., "Baixar pagamento")
    ↓
PaymentModal submits form data
    ↓
useSettlePayment hook → apiClient.settlePayment(payableId, payload)
    ↓
POST /api/payables/:id/settle
    ↓
authenticate middleware (JWT) → authorize('payables:update')
    ↓
payables.routes.ts handler validates input shape
    ↓
payables.service.settlePayment(rlsCtx, id, input)
    ↓
withRlsContext → Prisma transaction:
  - payable.update(status=PAID)
  - bankAccountBalance.update(decrement)
  - financialTransaction.create(DEBIT record)
    ↓
Returns PayableOutput DTO
    ↓
Hook updates React Query cache → page re-renders with updated status
```

### Key Data Flows

1. **Payable settlement flow:** Payable → mark PAID + BankAccountBalance.decrement + FinancialTransaction.create (all in one Prisma tx)

2. **Receivable settlement flow:** Receivable → mark RECEIVED + BankAccountBalance.increment + FinancialTransaction.create (symmetric to payable)

3. **Bank transfer flow:** BankTransfer.create → BankAccountBalance.decrement(source) + BankAccountBalance.increment(destination) + two FinancialTransaction records (one DEBIT, one CREDIT) — single Prisma tx

4. **Reconciliation matching flow:** OFX import → parse transactions → fuzzy-match against open FinancialTransactions → return match candidates with confidence scores → user confirms → matched transactions marked as reconciled, unmatched create pending entries

5. **Cash flow projection flow:** cash-flow.service reads open payables (by dueDate) and open receivables (by expectedDate) + current bank balances → applies scenario multipliers → returns time-series data for charting (no writes)

6. **Card invoice closing flow:** on closingDate, credit-cards.service creates a new Payable with type=CREDIT_CARD_INVOICE, linking to the CreditCard — from that point the invoice is treated as a standard payable

7. **Credit rural installment flow:** CreditRuralOperation.create → generates N Payable records (one per installment) with dueDate and amortization calculated by schedule type (SAC/Price/Bullet)

### State Management (Frontend)

```
FinancialContext (optional) or React Query cache
    ↓ (data)
Page component (BankAccountsPage, PayablesPage…)
    ↓ (props)
List component → uses hook (usePayables / useBankAccounts)
    ↓
Modal opened → form state local to Modal component
    ↓ (on submit)
Mutation hook (useSettlePayment) → POST /api/payables/:id/settle
    ↓ (on success)
Invalidate React Query keys → list refetches → UI updates
```

## Build Order (Component Dependencies)

The following order is driven by data model dependencies — later modules depend on earlier ones being in place:

```
Phase 1 — Foundation (no cross-module deps):
  bank-accounts → BankAccount, BankAccountBalance, FinancialTransaction models

Phase 2 — Depends on bank-accounts:
  credit-cards    (references BankAccount for payment)
  bank-transfers  (moves between BankAccounts)

Phase 3 — Core AP/AR (depends on bank-accounts):
  payables        (settlement debits BankAccount)
  receivables     (receipt credits BankAccount)

Phase 4 — Depends on payables + receivables:
  payables-aging  (reads payables for faixas/alertas)
  cheques         (references payables + receivables)
  card-invoices   (generates payables on closing)

Phase 5 — Depends on all above:
  bank-reconciliation  (matches FinancialTransactions)
  credit-rural         (generates payable installments)
  cash-flow            (reads all balances + open AP/AR)

Phase 6 — Pure aggregation (depends on all):
  fin-dashboard   (reads across all modules, write-free)
```

## Integration Points

### Existing System Boundaries

| Boundary                     | Communication                                            | Notes                                                                                             |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `payables` ↔ `cost-centers`  | Direct Prisma query (costCenterId FK)                    | CostCenter already exists in `modules/cost-centers/`; financial module reads it — does not own it |
| `payables` ↔ `producers`     | Direct Prisma query (producerId FK as supplier/creditor) | Producer entity already exists; financial module references it read-only                          |
| `receivables` ↔ `farms`      | Direct Prisma query (farmId FK for revenue attribution)  | Farm entity already exists                                                                        |
| `credit-rural` → `payables`  | payables.service called from credit-rural.service        | credit-rural creates payable installments via service call at operation creation time             |
| `card-invoices` → `payables` | payables.service called from card-invoices.service       | Closing a card invoice creates one payable; card-invoices owns the invoice lifecycle              |

### Future Integration Interfaces (Prepare Now)

These are **interfaces to expose** so future modules can plug in without modifying financial module internals:

| Interface                                | Purpose                                          | Implementation                                                                                         |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `POST /api/payables/from-purchase`       | Compras module creates CP from NF receipt        | Route + service method accepting `origin: 'PURCHASE'`, `originId` — duplicates manual CP creation path |
| `POST /api/payables/from-payroll`        | Folha module creates CP for salaries             | Route accepting `origin: 'PAYROLL'` — same pattern                                                     |
| `POST /api/receivables/from-asset-sale`  | Patrimônio module creates CR from asset disposal | Route accepting `origin: 'ASSET_SALE'`                                                                 |
| `POST /api/payables/from-asset-purchase` | Patrimônio creates CP from asset acquisition     | Route accepting `origin: 'ASSET_PURCHASE'`                                                             |

Pattern: store `originType` + `originId` on the payable/receivable. The financial module does not call back into the originating module — it only records the reference. Future accounting module reads `originType` to generate journal entries.

### External Integrations

| Service              | Integration Pattern                                                                             | Notes                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| OFX files            | Server-side parse in `bank-reconciliation` module using `ofx-parser` library (or custom parser) | No external API call; user uploads file                                |
| CNAB 240/400         | Generate remessa file in `payables` module; parse retorno file in `bank-reconciliation`         | Standard Brazilian bank batch format; implement as pure string builder |
| PDF statement import | Reconciliation module; PDF parsing is unreliable — treat as LOW priority within US-FN06         | Consider text extraction via `pdfjs-dist`; flag CA for deeper research |

## Anti-Patterns

### Anti-Pattern 1: Service-to-Service Calls for Balance Reads

**What people do:** `cash-flow.service` imports and calls `bank-accounts.service.getBalance()` to aggregate balances.

**Why it's wrong:** Creates tight coupling between modules; the service layer is not designed as an internal API — it assumes RLS context is already set up by the route layer. Cross-service calls bypass this.

**Do this instead:** `cash-flow.service` queries `BankAccountBalance` and open payables/receivables directly via Prisma (with its own `withRlsContext`). Each service owns its queries.

### Anti-Pattern 2: Financial State in Frontend Context

**What people do:** Put current bank balances or AP/AR totals in a React Context that's loaded at app startup and updated manually after mutations.

**Why it's wrong:** Financial data changes frequently; stale context causes incorrect displayed balances. Existing pattern uses React Query (implicit from hooks pattern) — invalidate on mutation instead.

**Do this instead:** Use React Query's `invalidateQueries` on successful mutation. Each page manages its own data freshness via hook.

### Anti-Pattern 3: Single `financial-transactions` God Table

**What people do:** Model all CP, CR, transfers, and reconciliation entries as rows in one generic `financial_transactions` table with a `type` discriminator column.

**Why it's wrong:** AP has installments, cost center apportionment, CNAB export, recurrence. AR has FUNRURAL calculation, PDD, renegotiation. Mixing them into one table creates a column-sparse schema and forces every query to filter by type. Report queries become complex.

**Do this instead:** Separate `payables` and `receivables` tables with their own columns. Use `financial_transactions` as the _ledger_ (audit trail of actual money movements), not as the document store. Documents (payables, receivables) are separate from transactions.

### Anti-Pattern 4: Computing Balance in Real-Time from Transactions

**What people do:** Calculate `BankAccount` current balance by summing all `FinancialTransaction` rows on every request (like a pure event-sourcing read model).

**Why it's wrong:** As transaction history grows, this query degrades. The stock module (reference architecture) already demonstrates the correct pattern: maintain a `StockBalance` aggregate updated transactionally. Apply the same pattern as `BankAccountBalance`.

**Do this instead:** Maintain `bank_account_balances` with `currentBalance` updated atomically in every Prisma transaction that creates a `FinancialTransaction`. Balance reads are O(1); audit trail is still available in `financial_transactions`.

## Scaling Considerations

| Scale        | Architecture Adjustments                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0-500 farms  | Current monolith architecture handles this with no changes                                                                               |
| 500-5k farms | Add read replica for `fin-dashboard` and `cash-flow` aggregation queries; these are the first read-heavy endpoints                       |
| 5k+ farms    | Materialized view for cash flow projection updated periodically; separate the `bank-reconciliation` OFX parsing into a background worker |

### Scaling Priorities

1. **First bottleneck:** `fin-dashboard` KPI aggregation — runs complex GROUP BY across multiple tables. Fix: add partial indexes on `status` + `organizationId` columns; cache dashboard response in Redis with 5-minute TTL.
2. **Second bottleneck:** `bank-reconciliation` OFX matching — large OFX files parsed synchronously in request. Fix: move parse step to background job, return job ID, poll for result.

## Sources

- Direct codebase analysis: `apps/backend/src/modules/` (69 existing modules), `apps/backend/prisma/schema.prisma`
- Reference module for ledger pattern: `modules/stock-entries/` + `modules/stock-outputs/` + `StockBalance` aggregate
- Reference module for cost center apportionment: `modules/stock-entries/stock-entries.service.ts` apportionment logic
- Reference module for file import UX: `components/bulk-import/BulkImportModal.tsx` (parse → preview → confirm pattern)
- Frontend sidebar group pattern: `components/layout/Sidebar.tsx` (NAV_GROUPS with group titles like 'ESTOQUE')
- Existing CostCenter entity: `modules/cost-centers/`, schema line 1654
- PROJECT.md constraints: multitenancy RLS, CNAB 240/400, OFX/CSV import, web-only scope

---

_Architecture research for: Financial module integration into Protos Farm monolith_
_Researched: 2026-03-15_
