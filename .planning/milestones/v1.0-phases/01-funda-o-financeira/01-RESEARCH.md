# Phase 1: Fundação Financeira - Research

**Researched:** 2026-03-15
**Domain:** Bank account management, Money type foundation, balance tracking, statement export
**Confidence:** HIGH — derived from direct codebase analysis and established project patterns

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vinculação Conta × Produtor × Fazenda**

- producerId é **opcional** na conta bancária — contas da organização (ex: conta do escritório) não têm produtor vinculado
- Relação conta × fazenda é **N:N** — uma conta pode atender múltiplas fazendas (tabela intermediária BankAccountFarm)
- Contas de crédito rural são um **tipo de conta** (enum no campo `type`), não entidade separada

**Convênio CNAB**

- Campos de convênio CNAB (código, carteira, variação) **adiados para Phase 2** — migration separada quando CNAB for implementado
- Phase 1 foca apenas no cadastro base da conta

**Saldo e Extrato**

- Phase 1 mostra **apenas saldo atual** (saldo inicial). Sem projeção — projeção virá quando CP/CR existir (Phase 2+)
- **Sem lançamentos manuais** nesta fase — saldo vem apenas do saldo de abertura. Movimentações virão de CP/CR/transferências
- Filtros de extrato **básicos**: período + tipo (entrada/saída). Filtros avançados quando houver CP/CR
- Export em **todos os formatos**: PDF (pdfkit) + Excel (exceljs) + CSV

**Dashboard de Contas**

- Layout: **cards por conta + barra de totalização** (saldo total, total por tipo: corrente/investimento/crédito rural)
- Agrupamento: **lista flat com filtros** laterais por fazenda/tipo/banco. Sem agrupamento fixo por seção

**Lista de Bancos FEBRABAN**

- Incluir **todos os bancos incluindo fintechs** (Nubank, C6, Inter, PagBank, etc.) — produtores rurais usam cada vez mais

### Claude's Discretion

- Implementação da lista de bancos FEBRABAN: JSON hardcoded vs seed no banco — Claude decide a melhor abordagem para o projeto
- Design exato dos cards de conta (quais informações mostrar, layout interno)
- Skeleton loading pattern
- Validação de dados bancários (dígito verificador de agência/conta)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                                 | Research Support                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FN-01 | Gerente pode cadastrar contas bancárias com tipo (corrente, poupança, investimento, crédito rural), dados FEBRABAN, vinculação a fazenda(s) e produtor rural, saldo inicial e convênio CNAB | Schema: BankAccount + BankAccountFarm + BankAccountBalance models; FEBRABAN bank list as JSON constant; enum BankAccountType; producerId optional FK to Producer                                         |
| FN-03 | Gerente pode visualizar saldo atual (real-time) e extrato de cada conta com filtros, saldo projetado (7/15/30/60/90 dias) e dashboard de todas as contas lado a lado                        | Phase 1 scope: saldo atual only (no projection yet); FinancialTransaction for ledger; extrato endpoint with period filter; PDF/Excel/CSV export via pdfkit/exceljs; BankAccountsPage with card dashboard |

</phase_requirements>

---

## Summary

Phase 1 builds the financial data foundation for the entire Financeiro module. The central deliverables are: (1) the `BankAccount` model with N:N farm relationship and optional producer link, (2) the `BankAccountBalance` aggregate pattern (modeled after the existing `StockBalance`), (3) the `FinancialTransaction` ledger table for the statement view, (4) the `Money` type wrapper in `packages/shared` using `decimal.js` to enforce correct monetary arithmetic across all future financial code, and (5) a working FEBRABAN bank list.

The project already has all needed libraries (`pdfkit`, `exceljs`, `decimal.js` as transitive dep). The module architecture follows the established collocated-module pattern (`modules/bank-accounts/`). The frontend follows the Page + Modal pattern used by StockEntriesPage and StockOutputsPage. No new npm packages are required for Phase 1.

The most critical architectural decisions are: (a) Money type must be established in `packages/shared` BEFORE any financial data is written — retrofitting is expensive; (b) FEBRABAN bank list should be a JSON constant (not a database seed) because it is read-only reference data rarely updated; (c) the `BankAccountBalance` aggregate must be initialized atomically at account creation time (set to initialBalance) following the StockBalance upsert-in-transaction pattern.

**Primary recommendation:** Implement in this order — Money type in shared → Migration + schema → Backend module → Frontend page/modal. Each step is a prerequisite for the next.

---

## Standard Stack

### Core (Phase 1 — No New Installs Required)

| Library      | Version            | Purpose                        | Why Standard                                                                                                                                                                                   |
| ------------ | ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decimal.js` | transitive (^10.x) | Money type arithmetic          | Already in node_modules as transitive dep; financial arithmetic MUST avoid IEEE 754 float errors; add as explicit direct dep in `apps/backend/package.json` and `packages/shared/package.json` |
| `pdfkit`     | ^0.17.2            | Extrato PDF export             | Already installed in `apps/backend`; used by `modules/pesticide-prescriptions/`; dynamic import pattern established                                                                            |
| `exceljs`    | ^4.4.0             | Extrato Excel export           | Already installed in `apps/backend`; used in `modules/animals/animals.service.ts` export; dynamic import pattern established                                                                   |
| Prisma 7     | ^7.4.1             | Database ORM with Decimal type | Already installed; `@db.Decimal(15,2)` for monetary fields; `withRlsContext` for multitenancy                                                                                                  |

### Supporting (Already Present)

| Library             | Version        | Purpose              | When to Use                                                                                                           |
| ------------------- | -------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Intl.NumberFormat` | native Node.js | BRL currency display | All monetary formatting in PDF/Excel output; `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` |
| `@/services/api`    | internal       | Frontend API calls   | All frontend HTTP calls via the existing `api` object (`api.get`, `api.post`, etc.)                                   |
| `lucide-react`      | installed      | UI icons             | Established icon library per CLAUDE.md; `Building2`, `CreditCard`, `TrendingUp`, `Download` for financial context     |

### No New Dependencies for Phase 1

Phase 1 requires zero new npm installs. `decimal.js` needs to be **promoted from transitive to direct dep** in `apps/backend/package.json` and `packages/shared/package.json`.

**Installation (promotion only):**

```bash
cd apps/backend
pnpm add decimal.js

cd ../../packages/shared
pnpm add decimal.js
```

### Alternatives Considered for FEBRABAN Bank List

| Approach                              | Verdict              | Reason                                                                                                                                 |
| ------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Database seed (BankFebraban table)    | Rejected for Phase 1 | Adds migration complexity, requires join on every account read; reference data that changes annually is better as a versioned constant |
| JSON constant in `packages/shared`    | **Recommended**      | Zero query overhead; type-safe; updated by code change (PR-controlled); consumed by both backend validation and frontend dropdown      |
| External API (Banco Central OpenData) | Rejected             | Runtime dependency on external service; unnecessary for this use case                                                                  |

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/bank-accounts/
├── bank-accounts.routes.ts       # Express router: GET/POST/PATCH/DELETE endpoints
├── bank-accounts.service.ts      # Business logic, withRlsContext, balance management
├── bank-accounts.types.ts        # Input/Output types, enums, error class
└── bank-accounts.routes.spec.ts  # Jest tests (supertest pattern, mock service)

packages/shared/src/
├── constants/
│   └── febraban-banks.ts         # FEBRABAN bank list JSON (new file)
├── types/
│   └── money.ts                  # Money type wrapper using decimal.js (new file)
└── utils/
    └── money.ts                  # Money arithmetic helpers (new file)

apps/frontend/src/
├── pages/
│   ├── BankAccountsPage.tsx      # List page with dashboard cards + filters
│   └── BankAccountsPage.css
└── components/
    └── bank-accounts/
        ├── BankAccountModal.tsx  # Create/edit modal (CLAUDE.md: CRUD always in modal)
        └── BankAccountModal.css
```

### Pattern 1: BankAccountBalance Aggregate (Mirror of StockBalance)

**What:** When a `BankAccount` is created, a `BankAccountBalance` record is created in the same Prisma transaction, initialized to `initialBalance`. When future CP/CR/transfers post (Phase 2+), they update this aggregate atomically. The balance read is O(1) — never computed from transaction history.

**When to use:** Account creation (Phase 1), any future balance mutation (Phase 2+).

**Example — account creation with balance initialization:**

```typescript
// bank-accounts.service.ts
export async function createBankAccount(
  ctx: RlsContext,
  input: CreateBankAccountInput,
): Promise<BankAccountOutput> {
  return withRlsContext(ctx, async (tx) => {
    // 1. Create the account
    const account = await tx.bankAccount.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        type: input.type,
        bankCode: input.bankCode,
        agency: input.agency,
        accountNumber: input.accountNumber,
        producerId: input.producerId ?? null, // optional
      },
    });

    // 2. Link farms (N:N)
    if (input.farmIds?.length) {
      await tx.bankAccountFarm.createMany({
        data: input.farmIds.map((farmId) => ({
          bankAccountId: account.id,
          farmId,
        })),
      });
    }

    // 3. Initialize balance aggregate atomically (same tx)
    await tx.bankAccountBalance.create({
      data: {
        bankAccountId: account.id,
        organizationId: ctx.organizationId,
        currentBalance: input.initialBalance,
        initialBalance: input.initialBalance,
      },
    });

    return toBankAccountOutput(account);
  });
}
```

**Source:** Direct analysis of `modules/stock-entries/stock-entries.service.ts` lines 329-377 — `updateStockBalances` pattern applied to monetary context.

### Pattern 2: Money Type in packages/shared

**What:** A thin wrapper around `decimal.js` that provides type-safe monetary arithmetic. All financial service code uses `Money` — never native `number` for monetary values. Serialized as `number` only at the API boundary (JSON response).

**When to use:** Every monetary calculation in the backend financial modules. The type is defined once in `packages/shared` and consumed by all backend modules.

**Example:**

```typescript
// packages/shared/src/types/money.ts
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export class Money {
  private readonly value: Decimal;

  constructor(amount: number | string | Decimal) {
    this.value = new Decimal(amount);
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(factor: number | string): Money {
    return new Money(this.value.times(factor));
  }

  /** Round to 2 decimal places using HALF_UP (standard Brazilian banking) */
  toDecimal(): Decimal {
    return this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /** Serialize to number for JSON responses — only call at API boundary */
  toNumber(): number {
    return this.toDecimal().toNumber();
  }

  /** Format as BRL string for PDF/Excel output */
  toBRL(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(this.toNumber());
  }

  static fromPrismaDecimal(value: unknown): Money {
    return new Money(String(value ?? '0'));
  }
}
```

**Critical rule:** `toNumber()` is called ONLY when serializing to JSON response or formatting for PDF/Excel. Never inside arithmetic chains.

### Pattern 3: FEBRABAN Bank List as Shared Constant

**What:** A typed array of FEBRABAN bank objects defined in `packages/shared/src/constants/febraban-banks.ts`. Consumed by the backend service (validation of `bankCode`) and the frontend dropdown (bank selector).

**When to use:** `BankAccountModal` dropdown, backend `createBankAccount` input validation.

**Example (structure):**

```typescript
// packages/shared/src/constants/febraban-banks.ts
export interface FebrabanBank {
  code: string; // e.g., "001" (Banco do Brasil)
  name: string; // e.g., "Banco do Brasil S.A."
  shortName: string; // e.g., "BB"
}

export const FEBRABAN_BANKS: FebrabanBank[] = [
  { code: '001', name: 'Banco do Brasil S.A.', shortName: 'BB' },
  { code: '033', name: 'Banco Santander (Brasil) S.A.', shortName: 'Santander' },
  { code: '041', name: 'Banco do Estado do Rio Grande do Sul S.A.', shortName: 'Banrisul' },
  { code: '077', name: 'Banco Inter S.A.', shortName: 'Inter' },
  { code: '104', name: 'Caixa Econômica Federal', shortName: 'Caixa' },
  { code: '237', name: 'Banco Bradesco S.A.', shortName: 'Bradesco' },
  { code: '341', name: 'Banco Itaú S.A.', shortName: 'Itaú' },
  { code: '422', name: 'Banco Safra S.A.', shortName: 'Safra' },
  { code: '655', name: 'Banco Votorantim S.A.', shortName: 'BV' },
  { code: '745', name: 'Citibank N.A.', shortName: 'Citi' },
  { code: '748', name: 'Sicredi', shortName: 'Sicredi' },
  { code: '756', name: 'Sicoob — Banco Cooperativo do Brasil S.A.', shortName: 'Sicoob' },
  { code: '260', name: 'Nu Pagamentos S.A. (Nubank)', shortName: 'Nubank' },
  { code: '336', name: 'Banco C6 S.A.', shortName: 'C6 Bank' },
  { code: '290', name: 'PagSeguro Internet S.A.', shortName: 'PagBank' },
  // ... (complete list to ~50 most common; include all fintechs used in agro)
];

export const FEBRABAN_BANK_MAP = new Map(FEBRABAN_BANKS.map((b) => [b.code, b]));
```

**Confidence:** The bank codes listed above are HIGH confidence (widely documented); the fintech codes (Nubank 260, C6 336, PagBank 290) are MEDIUM confidence — verify against current BCB/FEBRABAN directory before shipping.

### Pattern 4: PDF Extrato Export (Follows Pesticide Prescription Pattern)

**What:** Dynamic import of `pdfkit`, build PDF in memory as Buffer, stream to response with `Content-Disposition: attachment`.

**Source:** Direct analysis of `modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` lines 370-380.

```typescript
// bank-accounts.service.ts — exportStatement
export async function exportStatementPdf(
  ctx: RlsContext,
  accountId: string,
  query: StatementQuery,
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Build PDF content using doc.text(), doc.moveDown(), etc.
    // Use Money.fromPrismaDecimal(tx.amount).toBRL() for all amounts
    doc.end();
  });
}
```

### Pattern 5: Frontend Data Fetching (Custom Hook + useState)

**What:** The project does NOT use React Query. It uses `useState` + `useEffect` + `useCallback` with a custom hook per resource. The hook calls `api.get()`/`api.post()` from `@/services/api`. This is the established pattern from `useStockEntries.ts`.

**When to use:** All frontend data fetching for `BankAccountsPage`.

```typescript
// hooks/useBankAccounts.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export function useBankAccounts(filters: BankAccountFilters) {
  const [data, setData] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/org/bank-accounts', { params: filters });
      setData(res.data.data);
    } catch (e) {
      setError('Não foi possível carregar as contas bancárias.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
```

### Pattern 6: Sidebar Group Addition

**What:** Add a `FINANCEIRO` group to the `NAV_GROUPS` array in `Sidebar.tsx`. This group appears after `ESTOQUE` (currently last functional group before `CONFIGURAÇÃO`).

**Source:** Direct analysis of `apps/frontend/src/components/layout/Sidebar.tsx` lines 77-172.

```typescript
// In Sidebar.tsx NAV_GROUPS array, add before the CONFIGURAÇÃO group:
{
  title: 'FINANCEIRO',
  items: [
    { to: '/bank-accounts', icon: Building2, label: 'Contas bancárias' },
    // Future phases add: Contas a pagar, Contas a receber, Fluxo de caixa...
  ],
},
```

### Anti-Patterns to Avoid

- **Float arithmetic for monetary values:** The existing stock-entries service uses `toNumber(existing.averageCost)` — acceptable for quantity/cost calculations there, but PROHIBITED for monetary values in the financial module. All bank balance math must go through `Money` class.
- **Storing balance as computed sum:** Never `SELECT SUM(amount) FROM financial_transactions WHERE bank_account_id = ?` for the balance endpoint. Always read from `bank_account_balances.current_balance` directly.
- **producerId as required FK:** The decision is `producerId` is OPTIONAL (nullable FK). Do NOT make it required — org-level accounts (escritório) have no producer. The pitfall doc says "required" but CONTEXT.md overrides with "optional."
- **CNAB fields in Phase 1 schema:** Per CONTEXT.md decisions, no CNAB convenio fields in the initial migration — they go in a separate migration in Phase 2.
- **Separate page for account form:** Per CLAUDE.md, all CRUD forms are in modals. `BankAccountModal.tsx`, never `CreateBankAccountPage.tsx`.

---

## Don't Hand-Roll

| Problem                        | Don't Build                                       | Use Instead                                                          | Why                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arbitrary precision arithmetic | Custom centavos integer math, `Math.round` chains | `decimal.js` via `Money` class                                       | Integer-centavo math has conversion bugs at boundaries; `decimal.js` handles all rounding modes including HALF_UP required by Brazilian banking standards |
| Currency display formatting    | `'R$ ' + value.toFixed(2).replace('.', ',')`      | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | Native API; handles thousands separators, minus signs, and locale-correct formatting automatically                                                        |
| PDF generation                 | HTML-to-PDF or raw PostScript                     | `pdfkit` (already installed)                                         | PDFKit is already working in the project for receituário; same dynamic-import pattern applies                                                             |
| Excel export                   | CSV with .xlsx extension                          | `exceljs` (already installed)                                        | ExcelJS handles cell formatting, bold headers, column widths — needed for financial reports that users open in Excel                                      |
| Bank list                      | Fetching from external API                        | `febraban-banks.ts` constant                                         | No runtime dependency; type-safe; PR-tracked changes; zero latency                                                                                        |

**Key insight:** The financial module gets correctness for free by reusing the project's existing patterns — `StockBalance` for balance tracking, `pdfkit` for PDF, `exceljs` for Excel. The only genuinely new infrastructure is the `Money` type, and even that wraps an already-present transitive dependency.

---

## Common Pitfalls

### Pitfall 1: Float Monetary Arithmetic (Phase 1 Critical)

**What goes wrong:** Using native JS `number` for the `initialBalance` field causes cent-level rounding errors that propagate into all future balance calculations (Phase 2+ CP/CR).

**Why it happens:** The existing `toNumber()` helper in stock-entries service normalizes Prisma Decimal to `number` — fine for quantities, incorrect for money.

**How to avoid:** Define `Money` class in `packages/shared` and establish the rule: Prisma `Decimal` fields are converted with `Money.fromPrismaDecimal()`, never `Number()` or `parseFloat()`. Serialize back only in the final DTO mapping.

**Warning signs:** Any occurrence of `parseFloat(amount)`, `Number(balance)`, or `Math.round(x * 100) / 100` in financial module code.

### Pitfall 2: producerId Optional vs Required Confusion

**What goes wrong:** PITFALLS.md says producerId should be required on BankAccount. CONTEXT.md (locked decision) says it is OPTIONAL. Using the wrong cardinality breaks account creation for org-level accounts.

**Why it happens:** The pitfall document reflects the general principle for fiscal isolation; the CONTEXT.md decision reflects the product decision that org-level accounts exist.

**How to avoid:** Schema: `producerId String?` (nullable). Backend validation: if provided, verify the producer belongs to the same org. Frontend: producer field is optional in the form, clearly labeled "Produtor rural (opcional)".

### Pitfall 3: BankAccountBalance Not Initialized at Account Creation

**What goes wrong:** Account created without a corresponding `BankAccountBalance` row. Balance endpoint crashes with `null` or returns zero incorrectly.

**Why it happens:** Forgetting the atomic pattern — account creation and balance initialization must be in the same Prisma transaction.

**How to avoid:** In `createBankAccount`, always `tx.bankAccountBalance.create()` inside the same `withRlsContext` callback as `tx.bankAccount.create()`. Never in a separate service call.

### Pitfall 4: N:N Farm Relationship Not Reflected in Queries

**What goes wrong:** Dashboard filter "por fazenda" returns no results because `BankAccount` is queried by a direct `farmId` column that doesn't exist (relationship is via `BankAccountFarm` junction table).

**Why it happens:** Developer assumes 1:N (account belongs to one farm) instead of N:N (account can serve multiple farms).

**How to avoid:** All queries filtering by `farmId` must use `some` on the `farms` relation: `where: { farms: { some: { farmId: input.farmId } } }`. The GET /bank-accounts list endpoint must support `farmId` as an optional filter using this pattern.

### Pitfall 5: Extrato Returns All Transactions Without RLS Filter

**What goes wrong:** `FinancialTransaction` query misses `organizationId` filter, leaking data between organizations.

**Why it happens:** `withRlsContext` sets the RLS policy at the PostgreSQL session level, but if queries use raw SQL or bypass Prisma, the filter is not applied.

**How to avoid:** All queries use Prisma within `withRlsContext`. Never use `prisma.$queryRaw` for financial data. Include `organizationId: ctx.organizationId` in every `where` clause as defense-in-depth.

---

## Code Examples

### Prisma Schema for BankAccount Models

```prisma
// Source: direct analysis of existing schema.prisma patterns + CONTEXT.md decisions

enum BankAccountType {
  CHECKING        // Conta corrente
  SAVINGS         // Poupança
  INVESTMENT      // Investimento/Aplicação
  RURAL_CREDIT    // Crédito rural (PRONAF, custeio, etc.)
}

model BankAccount {
  id             String          @id @default(uuid())
  organizationId String
  name           String          // "Conta principal BB"
  type           BankAccountType
  bankCode       String          // FEBRABAN code e.g. "001"
  agency         String
  agencyDigit    String?
  accountNumber  String
  accountDigit   String?
  producerId     String?         // OPTIONAL — null for org-level accounts
  notes          String?
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  organization Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  producer     Producer?      @relation(fields: [producerId], references: [id])
  farms        BankAccountFarm[]
  balance      BankAccountBalance?
  transactions FinancialTransaction[]

  @@index([organizationId])
  @@index([organizationId, type])
  @@map("bank_accounts")
}

model BankAccountFarm {
  id            String @id @default(uuid())
  bankAccountId String
  farmId        String

  bankAccount BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  farm        Farm        @relation(fields: [farmId], references: [id], onDelete: Cascade)

  @@unique([bankAccountId, farmId])
  @@map("bank_account_farms")
}

model BankAccountBalance {
  id             String  @id @default(uuid())
  bankAccountId  String  @unique
  organizationId String
  initialBalance Decimal @default(0) @db.Decimal(15, 2)
  currentBalance Decimal @default(0) @db.Decimal(15, 2)
  updatedAt      DateTime @updatedAt

  bankAccount  BankAccount  @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@map("bank_account_balances")
}

model FinancialTransaction {
  id             String   @id @default(uuid())
  organizationId String
  bankAccountId  String
  type           String   // "CREDIT" | "DEBIT"
  amount         Decimal  @db.Decimal(15, 2)
  description    String
  referenceType  String?  // "OPENING_BALANCE" | "PAYABLE" | "RECEIVABLE" | "TRANSFER" (future)
  referenceId    String?
  transactionDate DateTime
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  bankAccount  BankAccount  @relation(fields: [bankAccountId], references: [id])

  @@index([organizationId, bankAccountId])
  @@index([organizationId, bankAccountId, transactionDate])
  @@map("financial_transactions")
}
```

### Backend Endpoints

```
GET    /org/bank-accounts                    # list with filters (farmId?, type?, bankCode?)
POST   /org/bank-accounts                   # create account + balance + optional farm links
GET    /org/bank-accounts/:id               # get single with balance + farm links
PATCH  /org/bank-accounts/:id              # update (name, notes, farms, producerId)
DELETE /org/bank-accounts/:id              # soft delete (isActive = false)
GET    /org/bank-accounts/:id/statement    # extrato with ?from=&to=&type=
GET    /org/bank-accounts/:id/statement/export  # PDF or Excel via ?format=pdf|xlsx|csv
GET    /org/bank-accounts/dashboard        # aggregated totals by type
```

### app.ts Registration (Reference for Planner)

```typescript
// In apps/backend/src/app.ts — add after existing imports:
import { bankAccountsRouter } from './modules/bank-accounts/bank-accounts.routes';

// In app.use() calls section:
app.use('/api/org', bankAccountsRouter);
```

### Frontend Route Addition (Reference for Planner)

```typescript
// In apps/frontend/src/App.tsx — add lazy-loaded route:
const BankAccountsPage = React.lazy(() => import('./pages/BankAccountsPage'));

// In route definitions:
<Route path="/bank-accounts" element={<BankAccountsPage />} />
```

---

## State of the Art

| Old Approach              | Current Approach                    | When Changed                         | Impact                                                                                                                                                                |
| ------------------------- | ----------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Number/float for money    | Decimal type in Prisma + decimal.js | Standard in this codebase from start | Correct arithmetic at rest (Prisma Decimal) but arithmetic in service layer still uses native number (stock-entries pattern) — financial module must NOT inherit this |
| Spinner full-page loading | Skeleton screens                    | Established in CLAUDE.md             | BankAccountsPage must use `<Skeleton />` components, not spinners                                                                                                     |
| Form in dedicated page    | Form in modal                       | Established in CLAUDE.md             | BankAccountModal.tsx only, never BankAccountCreatePage                                                                                                                |

**Important:** The existing stock-entries service uses `toNumber()` helper for Decimal-to-number conversion during arithmetic. This is acceptable for quantities/costs but is the exact pattern the financial module must NOT copy. The Money class is the replacement.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Framework          | Jest + ts-jest (backend), Vitest + @testing-library/react (frontend)               |
| Config file        | `apps/backend/jest.config.js` — `preset: 'ts-jest'`, `testMatch: ['**/*.spec.ts']` |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=bank-accounts`       |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                          |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                    | Test Type           | Automated Command                                                                   | File Exists? |
| ------ | --------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- | ------------ |
| FN-01  | POST /org/bank-accounts creates account + balance + farm links              | unit (mock service) | `pnpm --filter @protos-farm/backend test -- --testPathPattern=bank-accounts.routes` | ❌ Wave 0    |
| FN-01  | createBankAccount initializes BankAccountBalance atomically                 | unit (mock tx)      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=bank-accounts.routes` | ❌ Wave 0    |
| FN-01  | producerId is truly optional (account with null producerId saves correctly) | unit                | same file                                                                           | ❌ Wave 0    |
| FN-01  | N:N farm link: account linked to multiple farms queries correctly           | unit                | same file                                                                           | ❌ Wave 0    |
| FN-03  | GET /org/bank-accounts/dashboard returns totals by type                     | unit                | same file                                                                           | ❌ Wave 0    |
| FN-03  | GET /org/bank-accounts/:id/statement filters by period                      | unit                | same file                                                                           | ❌ Wave 0    |
| FN-03  | Export PDF returns Buffer with Content-Disposition header                   | unit                | same file                                                                           | ❌ Wave 0    |
| FN-01  | Money class: 0.1 + 0.2 === 0.3 to 2 decimal places                          | unit (pure)         | `pnpm --filter @protos-farm/shared test -- --testPathPattern=money`                 | ❌ Wave 0    |
| FN-01  | Money class: sum of 12 installments equals principal to the cent            | unit (pure)         | same                                                                                | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern=bank-accounts`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/shared test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/bank-accounts/bank-accounts.routes.spec.ts` — covers FN-01, FN-03 backend endpoints (follow `stock-entries.routes.spec.ts` pattern: supertest + mock service)
- [ ] `packages/shared/src/utils/money.spec.ts` — covers Money class arithmetic correctness (pure unit tests, no mocking)
- [ ] `packages/shared/src/constants/febraban-banks.spec.ts` — minimal: verify required banks present (BB, Bradesco, Sicoob, Nubank), map lookup works

---

## Open Questions

1. **Fintech FEBRABAN codes accuracy**
   - What we know: Nubank ~260, C6 ~336, PagBank ~290, Inter ~077 (as bank)
   - What's unclear: Some fintechs have multiple codes or changed codes; BCB updates the directory quarterly
   - Recommendation: Build the list with ~30-40 major banks for Phase 1; document source and date; add a comment `// Verify codes at: https://www.bcb.gov.br/pom/spb/estatistica/port/ASTR003.pdf`

2. **Bank account digit verification (Claude's Discretion)**
   - What we know: Each bank has its own algorithm for verificação de dígito (Módulo 10 or Módulo 11 variants)
   - What's unclear: Whether to validate upfront or trust user input
   - Recommendation: Do NOT validate agency/account check digits in Phase 1. Accept free-text strings. Show a warning if the entered code doesn't match the expected format for the selected bank, but don't block save. Strict validation requires per-bank algorithm implementations (Phase 2+ concern).

3. **Saldo projetado placeholder in UI**
   - What we know: CONTEXT.md says "interface deve ser preparada para receber esse dado"
   - What's unclear: Whether the card should show a grayed-out "Saldo projetado: —" or omit the field entirely
   - Recommendation: Show the field with "–" placeholder and a tooltip "Disponível após cadastrar contas a pagar e receber." This sets expectations and avoids UI rework in Phase 2.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `apps/backend/src/modules/stock-entries/stock-entries.service.ts` — `updateStockBalances` pattern for atomic balance aggregate
- Direct codebase analysis: `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` line 370 — `pdfkit` dynamic import pattern
- Direct codebase analysis: `apps/backend/src/modules/animals/animals.service.ts` line 788 — `exceljs` dynamic import pattern
- Direct codebase analysis: `apps/frontend/src/components/layout/Sidebar.tsx` lines 77-172 — `NAV_GROUPS` array structure
- Direct codebase analysis: `apps/frontend/src/hooks/useStockEntries.ts` — custom hook data fetching pattern (not React Query)
- Direct codebase analysis: `apps/backend/prisma/schema.prisma` line 2798 — `StockBalance` model as template for `BankAccountBalance`
- Direct codebase analysis: `apps/backend/package.json` — confirmed `pdfkit ^0.17.2`, `exceljs ^4.4.0` installed; `decimal.js` NOT a direct dep (transitive only)
- Project planning files: `01-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md` — locked decisions and requirements
- Prior research: `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — domain analysis (researched 2026-03-15)

### Secondary (MEDIUM confidence)

- `decimal.js` API: widely documented; HIGH confidence on ROUND_HALF_UP mode and `toDecimalPlaces()` — confirmed by prior STACK.md research
- FEBRABAN bank codes: widely documented for major banks (BB 001, Bradesco 237, Caixa 104, Itaú 341, Sicoob 756, Sicredi 748); MEDIUM confidence on fintech codes (subject to BCB registry updates)

### Tertiary (LOW confidence — flag for validation)

- Fintech FEBRABAN codes for Nubank (260), C6 (336), PagBank (290): verify at `https://www.bcb.gov.br/pom/spb/estatistica/port/ASTR003.pdf` before shipping

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; all reuse existing project patterns
- Architecture: HIGH — directly derived from existing module structure; BankAccountBalance modeled after StockBalance
- Money type: HIGH — decimal.js is already a transitive dep; API well-established
- FEBRABAN bank list: MEDIUM — major bank codes confirmed, fintech codes need verification
- Pitfalls: HIGH — FN-01/FN-03 scope pitfalls directly verified from codebase patterns

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable domain; no external APIs in Phase 1)
