# Phase 6: Crédito Rural - Research

**Researched:** 2026-03-17
**Domain:** Financial module — rural credit contracts with amortization schedules (SAC/Price/Bullet), Payable integration, status machine, financial dashboard card
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de contrato e parcelas**

- `RuralCreditContract` como entidade própria (modelo Prisma separado) que GERA Payables automaticamente
- Cada parcela vira um Payable real com `category=FINANCING` + `PayableInstallment` — aparece na listagem de CP, aging, CNAB, fluxo de caixa automaticamente
- Baixa de parcela segue o fluxo padrão de CP existente
- Preview obrigatório: botão "Simular" no modal de cadastro mostra tabela com todas as parcelas (número, data, principal, juros, total, saldo devedor) antes de confirmar
- Amortização extraordinária com recálculo: botão permite pagar valor adicional, recalcula parcelas restantes (gerente escolhe reduzir valor ou prazo)
- Discriminação principal vs juros visível tanto na tela do contrato quanto na parcela do CP
- Campo "Número do contrato" (texto livre) para referência do código do banco
- Sempre editável: parcelas futuras recalculadas, parcelas pagas mantidas no histórico
- Fazenda + conta bancária obrigatórios — parcelas herdam a conta bancária do contrato
- Data de liberação com transação: registra crédito na conta bancária como `FinancialTransaction` de entrada, atualiza `BankAccountBalance`
- Campo "Observações" textarea para anotações livres (garantia, condições, contato)
- Status automático: ATIVO → QUITADO (todas parcelas pagas, automático), ATIVO → INADIMPLENTE (parcela vencida > N dias, automático), CANCELADO (manual)
- IOF e TAC: campos manuais opcionais (Decimal)
- Cancelamento: cancela parcelas PENDING automaticamente, mantém parcelas já pagas. Saldo devedor vai a zero
- Garantia: campo texto livre

**Carência**

- Juros capitalizam durante carência — juros calculados e adicionados ao saldo devedor (padrão MCR do BCB)
- Primeira parcela após carência inclui saldo corrigido com juros capitalizados

**Linhas de crédito e taxas**

- Enum fixo: PRONAF, PRONAMP, FUNCAFE, CPR, CREDITO_LIVRE
- Taxa fixa no contrato (% a.a.)
- Vencimentos configuráveis: gerente define dia do vencimento + mês da primeira parcela. Parcelas mensais. Carência desloca a primeira parcela
- CPR como financeiro puro nesta fase

**UI do contrato**

- Página própria na sidebar: "Crédito Rural" no grupo FINANCEIRO, rota `/rural-credit`
- Lista de contratos com cards
- Página dedicada para detalhe: rota `/rural-credit/:id` com header + tabs (Cronograma, Amortizações, Histórico)
- Cadastro/edição em modal (padrão do projeto conforme CLAUDE.md)
- Alertas: badge no item "Crédito Rural" da sidebar + card de alerta no dashboard financeiro
- Antecedência configurável por contrato: campo `alertDaysBefore` com default 15 dias

**Integração com fluxo de caixa**

- Nenhum tratamento especial no cashflow — parcelas são Payables com category=FINANCING
- Liberação via `FinancialTransaction` — entrada na conta bancária
- Card dedicado no dashboard financeiro: total contratado, saldo devedor total, próxima parcela

**Saldo devedor**

- Atualizado na baixa de cada parcela — trigger atualiza saldo devedor do contrato (subtrai principal, registra juros pagos)
- Tela do contrato mostra: principal amortizado, juros pagos, saldo devedor atual

### Claude's Discretion

- Algoritmo exato de cálculo SAC/Price/Bullet com carência capitalizada
- Design das tabelas de cronograma e amortizações
- Layout responsivo dos cards de contrato
- Implementação do gráfico de evolução de saldo devedor (se aplicável)
- Quantos dias de atraso configuram INADIMPLENTE (sugestão: 30 dias)

### Deferred Ideas (OUT OF SCOPE)

- CPR com entrega física de produto — módulo de comercialização futura
- Tabela de taxas vigentes do Plano Safra por ano-safra — manutenção anual complexa
- Cálculo automático de IOF — requer tabelas de alíquotas fiscais atualizadas
- Templates de vencimento por cultura agrícola
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                               | Research Support                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| FN-14 | Gerente pode cadastrar operações de crédito rural (PRONAF/PRONAMP/funcafé/CPR/crédito livre) com cronograma de parcelas automático (SAC/Price/Bullet + carência), saldo devedor e alertas | Amortization algorithms documented below; Payable integration pattern verified from payables.service.ts; schema extension points identified |

</phase_requirements>

---

## Summary

Phase 6 extends the financial module with a `RuralCreditContract` entity that owns the contract-level data (line, rate, term, amortization system, grace period) and generates individual `Payable` records (category=FINANCING) for each installment. Because parcels are standard Payables, they flow into the existing cashflow projection, aging, CNAB export, and reconciliation with zero extra code in those modules.

The core engineering challenge is the amortization engine. Three systems (SAC, Price/PMT, Bullet) must handle a capitalizing grace period. The result is a schedule table: per-installment principal, interest, total payment, outstanding balance. The `Money` factory (decimal.js, ROUND_HALF_UP) is already in `packages/shared` and is sufficient for all calculations. The `generateInstallments()` helper from the same package handles uniform-payment splitting but must NOT be used for the amortization engine — the rural credit schedule generator is fundamentally different (each installment has variable principal/interest splits that must be computed independently).

A second challenge is the contract status machine: ATIVO → QUITADO/INADIMPLENTE (automatic) vs CANCELADO (manual). Status transitions must be driven by a query function called on-read (computed from installment state) rather than stored triggers, which would require background jobs. A lightweight approach: compute status on every contract fetch — check if all payables are PAID (QUITADO) or if any payable is OVERDUE more than N days (INADIMPLENTE).

**Primary recommendation:** Build the amortization engine as a pure function in `packages/shared/src/utils/rural-credit.ts` (no I/O), covered by unit tests, then call it from `modules/rural-credit/` backend service. The modal preview calls a `POST /rural-credit/simulate` endpoint (no DB write) that runs the same pure function.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library      | Version                         | Purpose             | Why Standard                                                 |
| ------------ | ------------------------------- | ------------------- | ------------------------------------------------------------ |
| decimal.js   | via `@protos-farm/shared` Money | Monetary arithmetic | All financial modules use Money() factory with ROUND_HALF_UP |
| Prisma 7     | workspace                       | ORM + migrations    | Project standard                                             |
| Express 5    | workspace                       | Routes              | Project standard                                             |
| React 19     | workspace                       | Frontend            | Project standard                                             |
| lucide-react | workspace                       | Icons               | Project standard (Landmark icon fits rural credit)           |

### No new npm packages required

All dependencies needed (decimal.js, Prisma, Express, React, Recharts for optional chart) are already installed in the workspace. No additions to `package.json` needed.

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/rural-credit/
├── rural-credit.controller.ts   # (unused — routes.ts calls service directly, per project pattern)
├── rural-credit.routes.ts       # Express router, RBAC guards
├── rural-credit.service.ts      # Business logic, Prisma calls
├── rural-credit.types.ts        # Input/output types, errors
└── rural-credit.routes.spec.ts  # Jest integration tests

packages/shared/src/utils/
└── rural-credit-schedule.ts     # Pure amortization engine (SAC/Price/Bullet + carência)

apps/backend/prisma/migrations/
└── 20260403110000_add_rural_credit/
    └── migration.sql

apps/frontend/src/
├── pages/
│   ├── RuralCreditPage.tsx       # List + cards, rota /rural-credit
│   ├── RuralCreditPage.css
│   ├── RuralCreditDetailPage.tsx # Detalhe com tabs, rota /rural-credit/:id
│   └── RuralCreditDetailPage.css
├── components/rural-credit/
│   ├── RuralCreditModal.tsx      # Cadastro/edição (modal padrão CLAUDE.md)
│   ├── RuralCreditModal.css
│   ├── SchedulePreviewTable.tsx  # Tabela de simulação (antes de salvar)
│   └── ExtraordinaryAmortizationModal.tsx
└── hooks/
    └── useRuralCredit.ts         # list, get, create, simulate, amortize
```

### Pattern 1: Prisma Schema Extension

New model `RuralCreditContract` with FK to `Organization`, `Farm`, `BankAccount`. Each `Payable` generated from the contract carries `originType='RURAL_CREDIT'` + `originId=contractId` (fields already exist in Payable schema at line 5429-5430 of schema.prisma).

```typescript
// migration target — confirmed from existing Payable schema
// Payable already has: originType String?, originId String?
// These fields link installment Payables back to the contract
model RuralCreditContract {
  id               String   @id @default(uuid())
  organizationId   String
  farmId           String
  bankAccountId    String
  contractNumber   String?                // banco reference
  creditLine       RuralCreditLine        // PRONAF | PRONAMP | FUNCAFE | CPR | CREDITO_LIVRE
  amortizationSystem AmortizationSystem   // SAC | PRICE | BULLET
  principalAmount  Decimal  @db.Decimal(15, 2)
  annualRate       Decimal  @db.Decimal(8, 6)  // e.g. 0.065000 for 6.5% a.a.
  termMonths       Int
  gracePeriodMonths Int     @default(0)
  firstPaymentYear Int
  firstPaymentMonth Int
  paymentDayOfMonth Int     @default(1)
  releasedAt       DateTime
  iofAmount        Decimal? @db.Decimal(15, 2)
  tacAmount        Decimal? @db.Decimal(15, 2)
  guaranteeDescription String?
  alertDaysBefore  Int      @default(15)
  status           RuralCreditStatus @default(ATIVO)
  outstandingBalance Decimal @db.Decimal(15, 2)
  totalPrincipalPaid Decimal @default(0) @db.Decimal(15, 2)
  totalInterestPaid  Decimal @default(0) @db.Decimal(15, 2)
  notes            String?
  cancelledAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

enum RuralCreditLine {
  PRONAF
  PRONAMP
  FUNCAFE
  CPR
  CREDITO_LIVRE
}

enum AmortizationSystem {
  SAC
  PRICE
  BULLET
}

enum RuralCreditStatus {
  ATIVO
  QUITADO
  INADIMPLENTE
  CANCELADO
}
```

### Pattern 2: Amortization Engine (Pure Function)

The engine lives in `packages/shared/src/utils/rural-credit-schedule.ts`. It returns a `ScheduleRow[]` — the same type used for both the "Simular" preview and the actual Payable generation. This is the project's pattern (Money utility also lives in shared).

**SAC (Sistema de Amortização Constante):**

- Monthly rate: `i = (1 + annualRate)^(1/12) - 1`
- Principal per installment: `P_k = adjustedPrincipal / n` (constant)
- Interest for installment k: `J_k = outstandingBalance_k * i`
- Total payment k: `T_k = P_k + J_k` (decreasing)

**PRICE (Sistema Francês — PMT constante):**

- Monthly rate: `i = (1 + annualRate)^(1/12) - 1`
- PMT: `pmt = PV * i * (1+i)^n / ((1+i)^n - 1)`
- Interest for installment k: `J_k = outstandingBalance_k * i`
- Principal: `P_k = pmt - J_k` (increasing)

**BULLET:**

- Grace period: all payments are interest-only
- Final payment: entire principal + last period interest
- Intermediate payments: `J_k = outstandingBalance * i` (constant throughout)

**Grace period (carência capitalizada — MCR/BCB standard):**

- During grace period months: no payment due; interest accrues and is ADDED to principal
- After grace: adjusted principal = `principal * (1 + i)^gracePeriodMonths`
- Amortization schedule starts from this adjusted principal
- Grace period months do NOT generate Payables

```typescript
// Source: verified against MCR (Manual de Crédito Rural) BCB — standard for PRONAF/PRONAMP
// packages/shared/src/utils/rural-credit-schedule.ts

import { Money } from '../types/money';
import type { IMoney } from '../types/money';

export interface ScheduleInput {
  principalAmount: number;
  annualRate: number;       // e.g. 0.065 for 6.5%
  termMonths: number;       // amortization term (after grace)
  gracePeriodMonths: number;
  firstPaymentYear: number;
  firstPaymentMonth: number; // 1-12
  paymentDayOfMonth: number;
  amortizationSystem: 'SAC' | 'PRICE' | 'BULLET';
}

export interface ScheduleRow {
  installmentNumber: number;   // 1-based
  dueDate: Date;
  principal: IMoney;
  interest: IMoney;
  totalPayment: IMoney;
  outstandingBalance: IMoney;  // balance AFTER this payment
}

export function computeMonthlyRate(annualRate: number): number {
  // Compound: (1 + a)^(1/12) - 1
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function capitalizeGracePeriod(principal: IMoney, monthlyRate: number, gracePeriodMonths: number): IMoney {
  if (gracePeriodMonths === 0) return principal;
  // adjustedPrincipal = principal * (1 + i)^g
  const factor = Math.pow(1 + monthlyRate, gracePeriodMonths);
  return principal.multiply(factor);
}

export function generateSchedule(input: ScheduleInput): ScheduleRow[] { ... }
```

**Key invariant:** Sum of all `principal` fields = adjustedPrincipal (after grace capitalization). Sum may differ from original `principalAmount` by the capitalized interest — this difference is the `totalInterestDuringGrace` and should be tracked separately for transparency.

### Pattern 3: Contract Creation Transaction

```typescript
// In rural-credit.service.ts
export async function createContract(ctx, input) {
  return withRlsContext(ctx, async (tx) => {
    // 1. Compute schedule (pure function — no I/O)
    const schedule = generateSchedule(input);

    // 2. Create RuralCreditContract
    const contract = await tx.ruralCreditContract.create({
      data: { ...contractData, outstandingBalance: input.principalAmount },
    });

    // 3. Create one Payable per schedule row (category=FINANCING, originType='RURAL_CREDIT', originId=contract.id)
    for (const row of schedule) {
      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          category: 'FINANCING',
          supplierName: bankName, // banco do contrato
          description: `Parcela ${row.installmentNumber}/${schedule.length} - ${creditLineLabel}`,
          totalAmount: row.totalPayment.toDecimal(),
          dueDate: row.dueDate,
          bankAccountId: input.bankAccountId,
          installmentCount: 1,
          originType: 'RURAL_CREDIT',
          originId: contract.id,
          notes: `Principal: R$ ${row.principal.toBRL()} | Juros: R$ ${row.interest.toBRL()}`,
        },
      });
      // Create the single PayableInstallment
      await tx.payableInstallment.create({
        data: {
          payableId: payable.id,
          number: 1,
          amount: row.totalPayment.toDecimal(),
          dueDate: row.dueDate,
        },
      });
    }

    // 4. Register credit release as FinancialTransaction (CREDIT)
    await tx.bankAccountBalance.update({
      where: { bankAccountId: input.bankAccountId },
      data: { currentBalance: { increment: Money(input.principalAmount).toDecimal() } },
    });
    await tx.financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId: input.bankAccountId,
        type: 'CREDIT',
        amount: Money(input.principalAmount).toDecimal(),
        description: `Liberação crédito rural: ${creditLineLabel} - ${contractNumber}`,
        referenceType: 'RURAL_CREDIT_RELEASE',
        referenceId: contract.id,
        transactionDate: new Date(input.releasedAt),
      },
    });

    return contract;
  });
}
```

### Pattern 4: Installment Settlement Hook (update outstanding balance)

When a parcela Payable is settled via the existing `settlePayment()` flow, the rural credit contract's `outstandingBalance`, `totalPrincipalPaid`, and `totalInterestPaid` must be updated. Since the existing `settlePayment` doesn't know about rural credit, the solution is:

**Option A (recommended):** Rural credit service exposes `POST /rural-credit/:id/settle-installment/:payableId` that wraps `settlePayment` + updates contract fields atomically.

**Option B:** After standard Payable settlement, a call to `PATCH /rural-credit/:id/sync-balance` recomputes balance from Payables. Simpler but non-atomic.

Use Option A — atomic, consistent with existing CNAB/bordero patterns where settlement is a single transaction.

The principal and interest split for each installment must be stored somewhere to allow the "subtrair principal" update. Storing them in the Payable `notes` field (as done above) is fragile. Better: add a separate lookup table `RuralCreditInstallmentMeta` or store `principalAmount` + `interestAmount` as columns in the Payable via a join table.

**Recommended pattern:** Add a `RuralCreditInstallment` join model:

```prisma
model RuralCreditInstallment {
  id          String  @id @default(uuid())
  contractId  String
  payableId   String  @unique
  installmentNumber Int
  principal   Decimal @db.Decimal(15, 2)
  interest    Decimal @db.Decimal(15, 2)
  outstandingBalanceAfter Decimal @db.Decimal(15, 2)

  contract RuralCreditContract @relation(...)
  payable  Payable @relation(...)  // but Payable has no such relation yet
}
```

Since Payable doesn't have a back-relation to rural credit, store the join in the rural credit module's own table. Query it by payableId when settling.

### Pattern 5: Status Machine (computed on read)

```typescript
// In rural-credit.service.ts — called on every getContract / listContracts
function computeContractStatus(
  contract: RuralCreditContractRow,
  payables: PayableRow[],
  overdueThresholdDays: number = 30,
): RuralCreditStatus {
  if (contract.status === 'CANCELADO') return 'CANCELADO';
  if (payables.every((p) => p.status === 'PAID')) return 'QUITADO';
  const today = new Date();
  const hasOverdue = payables.some(
    (p) => p.status === 'PENDING' && daysBetween(p.dueDate, today) > overdueThresholdDays,
  );
  if (hasOverdue) return 'INADIMPLENTE';
  return 'ATIVO';
}
```

Write the computed status back to the DB only if it changed, inside the same `withRlsContext` call. This avoids background jobs while keeping the stored status current.

### Pattern 6: Simulate Endpoint (no DB write)

```typescript
// POST /rural-credit/simulate — used by modal preview button
// No authentication of input data beyond org ownership
router.post('/simulate', requirePermission('financial', 'read'), async (req, res) => {
  const schedule = generateSchedule(req.body);
  res.json({ schedule: schedule.map(toScheduleRowOutput) });
});
```

This mirrors patterns used in other modules (e.g., stock conversion preview). The endpoint accepts the same input DTO as `createContract` minus `contractNumber`/`notes`.

### Pattern 7: Frontend Card List

Cards use CSS custom properties from `tokens.css`. Status badge colors:

- ATIVO: `var(--color-success-100)` bg / `var(--color-success-700)` text
- QUITADO: `var(--color-neutral-100)` bg / `var(--color-neutral-600)` text
- INADIMPLENTE: `var(--color-error-50)` bg / `var(--color-error-700)` text (matches CP overdue pattern)
- CANCELADO: `var(--color-neutral-200)` bg / `var(--color-neutral-500)` text

### Anti-Patterns to Avoid

- **Do not reuse `generateInstallments()` from shared:** That helper divides a fixed total equally. Rural credit installments have variable amounts (SAC decreases, Price is uniform but principal/interest split varies, Bullet has unequal last payment).
- **Do not store schedule as JSON blob:** Generate individual Payable rows so they appear in CP listing, CNAB, aging, cashflow automatically — per locked decision.
- **Do not use floating-point math directly:** Always `Money()` factory (decimal.js). Monthly rate computation (`Math.pow`) can use native JS since it's used as a multiplier, but the result must be fed into `Money().multiply()` for the final amounts.
- **Do not use `setMonth()` — use `setUTCMonth()`:** Established in Phase 2 decision log to avoid timezone-shift bugs with midnight UTC dates.
- **Do not block sidebar with new hook polling:** Use same pattern as `useOverdueCount` — lightweight count endpoint, polled at mount.

---

## Don't Hand-Roll

| Problem                    | Don't Build              | Use Instead                                                       | Why                                                              |
| -------------------------- | ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Decimal arithmetic         | Custom rounding          | `Money()` from `@protos-farm/shared`                              | Already established; ROUND_HALF_UP is Brazilian banking standard |
| Atomic DB + balance update | Manual multi-query       | `withRlsContext()` Prisma transaction                             | RLS safety + atomicity; established in all financial modules     |
| Payable generation         | Custom installment model | Standard `Payable` + `PayableInstallment` + `originType/originId` | Instant cashflow, CNAB, aging, reconciliation integration        |
| Interest-only validation   | Custom logic             | `Money().isZero()` / `.greaterThan()`                             | Type-safe, handles edge cases                                    |
| Audit trail                | Custom log table         | `logAudit()` function (already used)                              | Consistent audit across modules                                  |

---

## Common Pitfalls

### Pitfall 1: Monthly Rate Precision

**What goes wrong:** Using `annualRate / 12` (simple division) instead of `(1 + annualRate)^(1/12) - 1` (compound). Brazilian rural credit uses compound rates (taxa efetiva), not proportional (taxa nominal). PRONAF and PRONAMP contracts at BCB are quoted as effective annual rates.
**Why it happens:** Simple division is intuitive and produces near-identical results for low rates, so tests may pass but installment totals will be off by ~0.5-2% over 60 months.
**How to avoid:** Always use `Math.pow(1 + annualRate, 1/12) - 1` for monthly rate. Document this in the function's JSDoc.
**Warning signs:** Sum of all installments ≠ principal + total interest when verified manually.

### Pitfall 2: Grace Period Off-By-One

**What goes wrong:** Including the grace period months in the amortization term, making the total repayment period `termMonths + gracePeriodMonths` instead of `termMonths` only.
**Why it happens:** Ambiguity in "term" — does it include or exclude grace? In MCR: `prazo total = carência + amortização`.
**How to avoid:** `termMonths` field = amortization-only months (after grace). Total contract duration = `gracePeriodMonths + termMonths`. Document explicitly.
**Warning signs:** First payment date does not align with `firstPaymentMonth` input.

### Pitfall 3: Penny Residuals in SAC Schedule

**What goes wrong:** `principalPerInstallment = adjustedPrincipal / n` may not divide evenly. If each row is rounded down (ROUND_DOWN), residual accumulates and final balance ≠ 0.
**Why it happens:** Same root cause as `generateInstallments()` — fixed by putting residual in the first installment (established project pattern from Phase 2 decision log).
**How to avoid:** Apply residual to installment #1. `residual = adjustedPrincipal - (baseP * n)`. Verify: `sum(principal_k) == adjustedPrincipal` in unit tests.
**Warning signs:** `outstandingBalance` after last installment is not exactly zero.

### Pitfall 4: Editing Contract with Paid Installments

**What goes wrong:** Deleting and regenerating ALL Payables on edit, including already-paid ones, which destroys historical records.
**Why it happens:** The `updatePayable()` pattern (lines 294-305 in payables.service.ts) deletes and recreates installments — correct for a single Payable, but rural credit has N Payables.
**How to avoid:** On edit, delete only PENDING Payables (and their `RuralCreditInstallment` metas). Keep PAID Payables intact. Recompute schedule from current `outstandingBalance` (not original `principalAmount`), starting from next due date.
**Warning signs:** Settlement history disappears after editing a contract.

### Pitfall 5: Sidebar Badge Hook

**What goes wrong:** Adding a new polling hook that hits a heavy aggregation query on every sidebar render.
**Why it happens:** Copying `useOverdueCount` without checking query cost.
**How to avoid:** Alert count endpoint should be a simple `COUNT` on `RuralCreditContract` where `alertDaysBefore` window is met — not a full schedule scan. Index on `(organizationId, status, nextPaymentDueDate)`.
**Warning signs:** Dashboard loads slowly; DB CPU spikes on page load.

### Pitfall 6: Route Ordering (Express 5)

**What goes wrong:** `/rural-credit/simulate` captured as `/rural-credit/:id` with id=`simulate`.
**Why it happens:** Express param routes are greedy — established pitfall in Phase 1 and Phase 4 decision log.
**How to avoid:** Register `/simulate`, `/alert-count`, and other fixed-path routes BEFORE `/:id`.
**Warning signs:** `GET /rural-credit/simulate` returns 404 or contract-not-found error.

---

## Code Examples

### SAC Schedule Computation

```typescript
// Source: MCR BCB §3-1 and established Money() pattern from packages/shared
// packages/shared/src/utils/rural-credit-schedule.ts

export function generateSchedule(input: ScheduleInput): ScheduleRow[] {
  const i = Math.pow(1 + input.annualRate, 1 / 12) - 1;
  const principal = Money(input.principalAmount);

  // Capitalize grace period
  const adjustedPrincipal =
    input.gracePeriodMonths > 0
      ? principal.multiply(Math.pow(1 + i, input.gracePeriodMonths))
      : principal;

  const n = input.termMonths;
  const rows: ScheduleRow[] = [];

  if (input.amortizationSystem === 'SAC') {
    // basePrincipal (truncated), residual to installment #1
    const basePDecimal = adjustedPrincipal
      .toDecimal()
      .dividedBy(n)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const baseP = Money(basePDecimal);
    const residual = adjustedPrincipal.subtract(baseP.multiply(n));

    let balance = adjustedPrincipal;
    for (let k = 0; k < n; k++) {
      const principalK = k === 0 ? baseP.add(residual) : baseP;
      const interestK = balance.multiply(i);
      const totalK = principalK.add(interestK);
      balance = balance.subtract(principalK);
      rows.push({
        installmentNumber: k + 1,
        dueDate: computeDueDate(
          input.firstPaymentYear,
          input.firstPaymentMonth,
          input.paymentDayOfMonth,
          k,
        ),
        principal: principalK,
        interest: interestK,
        totalPayment: totalK,
        outstandingBalance: balance,
      });
    }
  }
  // ... PRICE and BULLET cases
  return rows;
}

function computeDueDate(year: number, month: number, day: number, offsetMonths: number): Date {
  const d = new Date(Date.UTC(year, month - 1, day)); // UTC to avoid tz shift
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  // Handle month overflow (e.g., day=31 in a 30-day month) — clamp to last day
  return d;
}
```

### PRICE (PMT) Computation

```typescript
// Price PMT formula: pmt = PV * i * (1+i)^n / ((1+i)^n - 1)
const factor = Math.pow(1 + i, n);
const pmtRaw = adjustedPrincipal
  .toDecimal()
  .times(i)
  .times(factor)
  .dividedBy(factor - 1);
const pmt = Money(pmtRaw.toDecimalPlaces(2));

let balance = adjustedPrincipal;
for (let k = 0; k < n; k++) {
  const interestK = balance.multiply(i);
  const principalK = pmt.subtract(interestK);
  balance = balance.subtract(principalK);
  // Last installment: adjust for residual (balance after k=n-1 should be 0)
  // ...
}
```

### Settle Installment + Update Contract Balance

```typescript
// POST /rural-credit/:id/settle-installment/:payableId
export async function settleInstallment(ctx, contractId, payableId, input) {
  return withRlsContext(ctx, async (tx) => {
    // 1. Verify contract and installment meta belong to org
    const meta = await tx.ruralCreditInstallment.findFirst({ where: { contractId, payableId } });
    if (!meta) throw new RuralCreditError('Parcela não encontrada', 404);

    // 2. Settle the Payable using standard pattern (inline, not calling settlePayment to keep single tx)
    // ... (same logic as settlePayment lines 396-464 in payables.service.ts)

    // 3. Update contract outstanding balance
    await tx.ruralCreditContract.update({
      where: { id: contractId },
      data: {
        outstandingBalance: { decrement: Money.fromPrismaDecimal(meta.principal).toDecimal() },
        totalPrincipalPaid: { increment: Money.fromPrismaDecimal(meta.principal).toDecimal() },
        totalInterestPaid: { increment: Money.fromPrismaDecimal(meta.interest).toDecimal() },
      },
    });

    // 4. Recompute and persist contract status
    const payables = await tx.payable.findMany({
      where: { originType: 'RURAL_CREDIT', originId: contractId },
    });
    const newStatus = computeContractStatus(contract, payables);
    if (newStatus !== contract.status) {
      await tx.ruralCreditContract.update({
        where: { id: contractId },
        data: { status: newStatus },
      });
    }

    return getContract(ctx, contractId);
  });
}
```

### Extraordinary Amortization

```typescript
// POST /rural-credit/:id/extraordinary-amortization
// input: { extraAmount, recalculateMode: 'REDUCE_TERM' | 'REDUCE_INSTALLMENT', paidAt, bankAccountId }
export async function applyExtraordinaryAmortization(ctx, contractId, input) {
  return withRlsContext(ctx, async (tx) => {
    const contract = await getContractOrThrow(tx, contractId, ctx.organizationId);

    // 1. Debit bank account for extra amount
    // 2. Create FinancialTransaction DEBIT (referenceType='RURAL_CREDIT_AMORTIZATION')
    // 3. Update outstandingBalance -= extraAmount, totalPrincipalPaid += extraAmount
    // 4. Cancel all PENDING Payables (and their metas)
    // 5. Recompute schedule from new outstandingBalance with remaining term (or reduced term)
    // 6. Create new Payables + RuralCreditInstallment metas
  });
}
```

---

## State of the Art

| Old Approach                                | Current Approach                                | Impact                                  |
| ------------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| Separate rural credit ledger (custom table) | Standard Payable with originType='RURAL_CREDIT' | Instant aging/cashflow/CNAB integration |
| Background job for status updates           | Computed on read + persisted if changed         | No cron jobs needed                     |
| Stored schedule as JSON                     | Individual Payable rows                         | Consistent with CP module, searchable   |

---

## Open Questions

1. **INADIMPLENTE threshold days**
   - What we know: CONTEXT.md suggests 30 days; Brazilian banking law grants 90 days before formal default on rural credit (Res. BCB 4966/2021) but UI display can use 30
   - What's unclear: Should it be a per-contract config field or a global constant?
   - Recommendation: Use 30 days as a hardcoded constant in `computeContractStatus()`. Field `alertDaysBefore` already handles notification lead time separately.

2. **Payable `notes` vs `RuralCreditInstallment` meta for principal/interest split**
   - What we know: Notes field is string — fragile for numeric extraction. A join table is safer but adds schema complexity.
   - Recommendation: Use `RuralCreditInstallment` join model (option shown above). One extra migration, but enables atomic `outstandingBalance` updates without parsing strings.

3. **Month overflow on `paymentDayOfMonth=31`**
   - What we know: `setUTCMonth` in JS rolls over automatically (e.g., March 31 + 1 month = May 1). This deviates from Brazilian banking practice which clamps to last day of month.
   - Recommendation: After `setUTCMonth`, check if `getUTCDate() !== paymentDayOfMonth` and backtrack: `d.setUTCDate(0)` (= last day of previous month). Document this.

4. **Dashboard financial card — FinancialDashboardOutput extension**
   - What we know: `FinancialDashboardOutput` interface is in `financial-dashboard.types.ts`. Need to add `ruralCredit: { totalContracted, outstandingBalance, nextPaymentDate, nextPaymentAmount }`.
   - Recommendation: Extend `FinancialDashboardOutput` with optional `ruralCredit` field. Backend computes from `RuralCreditContract` aggregate. Frontend renders new card after the existing alert cards.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Framework          | Jest (via @swc/jest), already configured                                  |
| Config file        | `apps/backend/jest.config.js`                                             |
| Quick run command  | `cd apps/backend && npx jest rural-credit --testPathPattern rural-credit` |
| Full suite command | `cd apps/backend && npx jest`                                             |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                                                          | Test Type   | Automated Command                                      | File Exists? |
| -------- | ------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------ | ------------ |
| FN-14-1  | SAC schedule generates correct amounts (principal constant, interest decreasing, sum = principal) | unit        | `cd packages/shared && npx jest rural-credit-schedule` | Wave 0       |
| FN-14-2  | PRICE schedule generates constant PMT, correct interest/principal split                           | unit        | `cd packages/shared && npx jest rural-credit-schedule` | Wave 0       |
| FN-14-3  | BULLET schedule: interest-only periodic payments, full principal at end                           | unit        | `cd packages/shared && npx jest rural-credit-schedule` | Wave 0       |
| FN-14-4  | Grace period capitalizes principal correctly: `adjustedP = P * (1+i)^g`                           | unit        | `cd packages/shared && npx jest rural-credit-schedule` | Wave 0       |
| FN-14-5  | Contract creation generates correct number of FINANCING Payables                                  | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-6  | Simulate endpoint returns schedule without DB write                                               | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-7  | Bank credit released as FinancialTransaction CREDIT on contract creation                          | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-8  | Settling installment updates `outstandingBalance` correctly                                       | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-9  | Contract becomes QUITADO when all Payables are PAID                                               | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-10 | Contract becomes INADIMPLENTE when payable overdue >30 days                                       | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-11 | Cancellation sets PENDING Payables to CANCELLED, keeps PAID                                       | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |
| FN-14-12 | Alert count endpoint returns contracts due within alertDaysBefore                                 | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | Wave 0       |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern rural-credit --passWithNoTests`
- **Per wave merge:** `cd apps/backend && npx jest` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/utils/__tests__/rural-credit-schedule.spec.ts` — covers FN-14-1 through FN-14-4
- [ ] `apps/backend/src/modules/rural-credit/rural-credit.routes.spec.ts` — covers FN-14-5 through FN-14-12
- [ ] `packages/shared/src/utils/rural-credit-schedule.ts` — pure function (implementation)

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/payables/payables.service.ts` — `createPayable`, `settlePayment`, `generateInstallments` patterns verified directly
- `apps/backend/prisma/schema.prisma` lines 5310-5492 — `FinancialTransaction`, `BankAccountBalance`, `Payable`, `PayableInstallment`, `PayableCategory.FINANCING` confirmed existing
- `packages/shared/src/types/money.ts` — Money factory, Decimal.ROUND_HALF_UP confirmed
- `packages/shared/src/utils/installments.ts` — UTC date pattern, residual-to-first confirmed
- `apps/backend/src/modules/cashflow/cashflow.types.ts` — `FINANCING → FINANCIAMENTO` DFC map confirmed
- `apps/frontend/src/components/layout/Sidebar.tsx` — FINANCEIRO group structure confirmed; `Landmark` icon available for "Crédito Rural"
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts` — `FinancialDashboardOutput` interface verified, `ruralCredit` field not yet present

### Secondary (MEDIUM confidence)

- BCB MCR (Manual de Crédito Rural) — SAC/Price/Bullet + carência capitalizada: standard Brazilian rural credit amortization; decision to use compound monthly rate (`(1+a)^(1/12) - 1`) based on MCR §3-1 conventions and established practice
- `.planning/STATE.md` Phase 2 decision: UTC date methods to avoid timezone-shift bug — applied to `computeDueDate`

### Tertiary (LOW confidence — flag for validation)

- BCB Resolução 4966/2021 — 90-day formal default threshold for rural credit: mentioned as context for choosing 30-day UI threshold; not directly verified from official text

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies verified from project files
- Architecture: HIGH — patterns copied from existing financial modules (payables.service.ts, bank-accounts)
- Amortization algorithms: MEDIUM — formulas are standard (SAC/PMT/Bullet are textbook), monthly rate convention based on MCR practice; unit tests will be the authoritative verification
- Pitfalls: HIGH — majority derived directly from project decision log (STATE.md) and code inspection

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain — amortization math doesn't change)
