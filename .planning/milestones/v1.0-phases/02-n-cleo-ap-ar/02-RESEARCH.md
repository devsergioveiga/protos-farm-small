# Phase 2: Núcleo AP/AR - Research

**Researched:** 2026-03-16
**Domain:** Contas a Pagar / Contas a Receber — parcelamento, rateio, CNAB 240/400, aging, FUNRURAL
**Confidence:** HIGH — Based on direct codebase analysis of Phase 1 deliverables, existing project patterns, and Brazilian financial domain knowledge verified against FEBRABAN/BCB documentation.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**CNAB Remessa/Retorno**

- Suportar BB (001) + Sicoob (756) como bancos iniciais
- Suportar ambos formatos: CNAB 240 e CNAB 400
- Interface de adapter por banco (bank-adapter pattern) para permitir outros bancos no futuro
- Import de retorno: upload + preview — upload do arquivo, preview dos títulos encontrados, confirmar baixa automática
- Campos de convênio CNAB adicionados à BankAccount via migration extra (convenioCode, carteira, variacao — opcionais)

**Rateio por Centro de Custo**

- Suportar ambos modos: percentual e valor fixo — usuário escolhe por lançamento
- Em modo percentual: sistema calcula valores. Em modo valor fixo: soma deve bater com total
- Centro de custo e fazenda obrigatórios em CP e CR

**Parcelamento**

- Geração automática com personalização — gera N parcelas com mesmo valor e vencimentos mensais, mas permite editar valor e data de cada parcela antes de salvar
- Diferença de centavos no arredondamento vai para a PRIMEIRA parcela (não a última)
- Todas as parcelas usam Money type (decimal.js) para aritmética

**Recorrência**

- Template mensal — criar recorrência que gera CP automaticamente todo mês com mesmo valor/fornecedor
- Data de fim opcional (indefinido por padrão)
- Frequências: mensal, quinzenal, semanal

**Aging e Alertas**

- Canais: badge no sidebar (número de títulos vencidos) + lista de alertas na página de CP
- Sem email/push nesta fase
- Visualização aging: tabela com totais por faixa (7/15/30/60/90/>90/vencidas) — clicável para ver títulos da faixa
- Calendário financeiro mensal com dots nos dias com vencimento — click no dia mostra títulos

**Layout CP/CR**

- Páginas separadas: PayablesPage (/payables) e ReceivablesPage (/receivables)
- Baixa de pagamento: modal — seleciona título(s) → botão "Baixar" → modal com data, valor, conta, juros/multa/desconto
- Sidebar FINANCEIRO com 3 itens: Contas bancárias | A Pagar | A Receber (calendário como tab/view dentro de CP)

### Claude's Discretion

- Design exato das tabelas de CP/CR (colunas, ordem, responsividade)
- Implementação do calendário (biblioteca ou custom component)
- Layout do modal de baixa em lote (bordero)
- Formato visual do badge de alertas no sidebar
- Categorias pré-definidas de CP (insumos, manutenção, folha, etc.) e CR (venda grãos, gado, leite, arrendamento)

### Deferred Ideas (OUT OF SCOPE)

- Saldo projetado nas contas bancárias (atualizar UI do Phase 1 com dados reais de CP/CR) — pode ser feito como parte desta phase ou como refinamento posterior
- PDD (Provisão para Devedores Duvidosos) automática — mencionada no FN-12, implementar como cálculo simples por faixa de aging
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                                    | Research Support                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| FN-07 | Gerente pode registrar contas a pagar com fornecedor, categoria, forma de pagamento, conta bancária, centro de custo, rateio por múltiplos CCs, parcelamento e recorrência                     | Prisma schema for Payable + PayableInstallment + PayableCostCenterItem + RecurrenceConfig; Money type for installment arithmetic |
| FN-08 | Gerente pode dar baixa de pagamento individual ou em lote (bordero) com juros/multa/desconto, gerar arquivo CNAB 240/400, importar retorno bancário para baixa automática e estornar pagamento | CnabAdapter interface (BB 001 + Sicoob 756); settlePayment Prisma transaction pattern; multer for retorno file upload            |
| FN-10 | Gerente pode visualizar aging de CP por faixas de vencimento (7/15/30/60/90/>90/vencidas), receber alertas configuráveis de vencimento e ver calendário financeiro                             | Aging SQL pattern (composite index on organizationId+status+dueDate); stock-alerts module as reference for badge/alert pattern   |
| FN-11 | Gerente pode registrar contas a receber com cliente, categoria (venda grãos/gado/leite/arrendamento), vinculação a NF-e, parcelamento, recorrência e produtor rural emitente                   | Symmetric to FN-07 with rural-specific fields (funruralRate, nfeKey); ReceivableInstallment + ReceivableCostCenterItem           |
| FN-12 | Gerente pode dar baixa de recebimento com juros/multa/glosa, registrar inadimplência com PDD automática por faixa de aging, renegociar títulos vencidos e visualizar aging de recebíveis       | settleReceivable transaction pattern; FUNRURAL deduction on settlement; aging view shared with AR                                |

</phase_requirements>

---

## Summary

Phase 2 builds the full AP/AR cycle on top of the bank-accounts foundation delivered in Phase 1. The existing codebase provides the exact integration points needed: `BankAccount`, `BankAccountBalance`, and `FinancialTransaction` models are in place with the correct Prisma transaction pattern (atomic balance update + ledger record). The `Money` type with ROUND_HALF_UP is established in `@protos-farm/shared`. The `CostCenter` model exists (owned by `modules/cost-centers/`). No new libraries are required beyond what Phase 1 installed.

The two most complex technical domains are CNAB generation and installment rounding. CNAB must be implemented as a custom internal module (`modules/cnab/`) with a `CnabAdapter` interface per bank code — the Phase 1 decision log already records this requirement, and the FEBRABAN format is fixed-width positional text parseable in 300-500 lines without any npm package. Installment rounding must put the cent residual on the **first** installment (not last), which is the project decision — this is the inverse of the most common Brazilian banking practice (last installment) but is locked by CONTEXT.md.

FUNRURAL on CR is a mandatory field, not a calculated deduction: the buyer retains 1.5% (rural producer, SENAR included) or 2.5% (agribusiness) at source. The system records the gross CR amount and the FUNRURAL rate; the expected net receipt for reconciliation is `gross × (1 - funruralRate)`.

**Primary recommendation:** Implement in the sequence: (1) schema migration, (2) payables backend, (3) receivables backend, (4) CNAB module, (5) aging/alert endpoints, (6) PayablesPage + ReceivablesPage frontend. Keep the CNAB module isolated from payables — the adapter pattern enables future banks without touching the payables service.

---

## Standard Stack

### Core (No New Dependencies Required)

All required libraries are already installed in the project. Phase 2 reuses them without adding packages.

| Library          | Version    | Purpose                                                          | Why Standard                                                                                                                                                          |
| ---------------- | ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decimal.js`     | ^10.6.0    | Installment arithmetic, rateio calculation, juros/multa/desconto | Already direct dep in backend. `Money` wrapper enforces ROUND_HALF_UP globally. NEVER use native JS `number` for monetary arithmetic.                                 |
| `Money` (shared) | local      | Type-safe monetary operations                                    | `packages/shared/src/types/money.ts` — factory pattern, `Money(100)` without `new`. Use `fromPrismaDecimal()` at DB boundary, `toNumber()` only at API serialization. |
| `multer`         | ^2.1.0     | CNAB retorno file upload                                         | Already installed. Use for `POST /org/payables/cnab/retorno` upload endpoint.                                                                                         |
| `pdfkit`         | ^0.17.2    | Borderô PDF export                                               | Already installed. Extend `pesticide-prescriptions` pattern.                                                                                                          |
| `exceljs`        | ^4.4.0     | CP/CR list export (Excel)                                        | Already installed. Extend `stock-outputs` export pattern.                                                                                                             |
| `iconv-lite`     | transitive | CNAB file encoding (ISO-8859-1)                                  | Already transitive. CNAB retorno files from BB/Sicoob may be non-UTF-8.                                                                                               |

### Custom Implementation Required

| Component              | Approach                                                                                    | Location                                         |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| CNAB 240/400 generator | Custom fixed-width string builder with `CnabAdapter` interface                              | `modules/cnab/`                                  |
| CNAB retorno parser    | Tolerant fixed-width positional parser                                                      | `modules/cnab/`                                  |
| Aging calculation      | Pure SQL `WHERE dueDate < NOW() AND status IN ('PENDING','OVERDUE')` grouped by date bucket | `payables.service.ts` / `receivables.service.ts` |
| Installment generator  | Pure TypeScript function in service layer using `Money`                                     | `payables.service.ts`                            |
| Calendar data endpoint | Returns `{ date, count, totalAmount }[]` for a month — no library needed                    | `payables.service.ts`                            |

### Installation

No new packages required. `decimal.js` is already a direct backend dependency. `multer`, `pdfkit`, `exceljs` are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
├── cnab/                          # NEW — CNAB 240/400 generator/parser
│   ├── cnab.adapter.ts            # CnabAdapter interface
│   ├── cnab.generator.ts          # Builds fixed-width text from typed records
│   ├── cnab.parser.ts             # Parses retorno file → typed records
│   └── adapters/
│       ├── bb-001.adapter.ts      # Banco do Brasil (001) — CNAB 240 + 400
│       └── sicoob-756.adapter.ts  # Sicoob (756) — CNAB 240 + 400
│
├── payables/                      # NEW — FN-07 + FN-08
│   ├── payables.routes.ts
│   ├── payables.service.ts
│   ├── payables.types.ts
│   └── payables.routes.spec.ts
│
├── payables-aging/                # NEW — FN-10
│   ├── payables-aging.routes.ts
│   └── payables-aging.service.ts
│
└── receivables/                   # NEW — FN-11 + FN-12
    ├── receivables.routes.ts
    ├── receivables.service.ts
    ├── receivables.types.ts
    └── receivables.routes.spec.ts

apps/frontend/src/
├── pages/
│   ├── PayablesPage.tsx           # FN-07+FN-08+FN-10: CP lista + aging + calendário
│   └── ReceivablesPage.tsx        # FN-11+FN-12: CR lista + inadimplência
│
├── components/
│   ├── payables/
│   │   ├── PayableModal.tsx       # Create/edit CP (parcelamento + rateio)
│   │   ├── PaymentModal.tsx       # Baixa individual com juros/multa/desconto
│   │   ├── BatchPaymentModal.tsx  # Bordero (baixa em lote)
│   │   └── CnabRetornoModal.tsx   # Upload retorno + preview + confirmar
│   └── receivables/
│       ├── ReceivableModal.tsx    # Create/edit CR (FUNRURAL + rateio)
│       └── ReceiptModal.tsx       # Baixa recebimento com juros/glosa
│
└── hooks/
    ├── usePayables.ts
    └── useReceivables.ts
```

### Prisma Schema Additions

```prisma
// Enums
enum PayableStatus {
  PENDING        // aguardando pagamento
  PAID           // pago
  PARTIAL        // parcialmente pago (bordero parcial)
  OVERDUE        // vencido sem pagamento
  CANCELLED      // cancelado
}

enum ReceivableStatus {
  PENDING
  RECEIVED
  PARTIAL
  OVERDUE
  CANCELLED
  RENEGOTIATED   // renegociado para novo título
}

enum RecurrenceFrequency {
  WEEKLY
  BIWEEKLY
  MONTHLY
}

enum PayableCategory {
  INPUTS         // insumos
  MAINTENANCE    // manutenção
  PAYROLL        // folha de pagamento
  RENT           // arrendamento
  SERVICES       // serviços
  TAXES          // impostos
  FINANCING      // financiamentos
  OTHER
}

enum ReceivableCategory {
  GRAIN_SALE     // venda de grãos
  CATTLE_SALE    // venda de gado
  MILK_SALE      // venda de leite
  LEASE          // arrendamento recebido
  SERVICES       // prestação de serviços
  OTHER
}

enum CostCenterAllocMode {
  PERCENTAGE
  FIXED_VALUE
}

// BankAccount extension (migration extra)
// Add to BankAccount model:
//   convenioCode  String?
//   carteira      String?
//   variacao      String?

// Payable document
model Payable {
  id               String         @id @default(uuid())
  organizationId   String
  farmId           String
  producerId       String?        // optional: org-level payables
  supplierId       String?        // future: Supplier entity
  supplierName     String         // free-text until Supplier entity exists
  category         PayableCategory
  description      String
  totalAmount      Decimal        @db.Decimal(15, 2)
  dueDate          DateTime
  status           PayableStatus  @default(PENDING)
  documentNumber   String?
  originType       String?        // 'MANUAL'|'PURCHASE'|'PAYROLL'|'ASSET_PURCHASE'
  originId         String?
  // Recurrence
  recurrenceFrequency RecurrenceFrequency?
  recurrenceEndDate   DateTime?
  recurrenceParentId  String?     // FK to source Payable (template)
  // Installments
  installmentCount    Int         @default(1)
  // Settlement fields (filled on baixa)
  paidAt           DateTime?
  amountPaid       Decimal?       @db.Decimal(15, 2)
  bankAccountId    String?        // account used for payment
  interestAmount   Decimal?       @db.Decimal(15, 2)
  fineAmount       Decimal?       @db.Decimal(15, 2)
  discountAmount   Decimal?       @db.Decimal(15, 2)
  notes            String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  organization   Organization   @relation(...)
  farm           Farm           @relation(...)
  producer       Producer?      @relation(...)
  bankAccount    BankAccount?   @relation(...)
  installments   PayableInstallment[]
  costCenterItems PayableCostCenterItem[]
  recurrenceChildren Payable[]  @relation("PayableRecurrence")
  recurrenceParent   Payable?   @relation("PayableRecurrence", fields: [recurrenceParentId], references: [id])

  @@index([organizationId, status, dueDate])  // CRITICAL for aging queries
  @@index([organizationId, farmId])
  @@map("payables")
}

model PayableInstallment {
  id          String        @id @default(uuid())
  payableId   String
  number      Int           // 1-based
  amount      Decimal       @db.Decimal(15, 2)
  dueDate     DateTime
  status      PayableStatus @default(PENDING)
  paidAt      DateTime?
  amountPaid  Decimal?      @db.Decimal(15, 2)

  payable     Payable       @relation(...)

  @@index([payableId])
  @@map("payable_installments")
}

model PayableCostCenterItem {
  id           String              @id @default(uuid())
  payableId    String
  costCenterId String
  farmId       String
  allocMode    CostCenterAllocMode
  percentage   Decimal?            @db.Decimal(5, 2)   // null if FIXED_VALUE
  fixedAmount  Decimal?            @db.Decimal(15, 2)  // null if PERCENTAGE

  payable     Payable     @relation(...)
  costCenter  CostCenter  @relation(...)
  farm        Farm        @relation(...)

  @@map("payable_cost_center_items")
}

// Receivable — symmetric to Payable with rural-specific additions
model Receivable {
  id              String            @id @default(uuid())
  organizationId  String
  farmId          String
  producerId      String?
  clientName      String
  category        ReceivableCategory
  description     String
  totalAmount     Decimal           @db.Decimal(15, 2)
  dueDate         DateTime
  status          ReceivableStatus  @default(PENDING)
  documentNumber  String?
  nfeKey          String?           // chave de acesso NF-e (44 chars)
  funruralRate    Decimal?          @db.Decimal(5, 4)  // e.g. 0.0150 = 1.5%
  funruralAmount  Decimal?          @db.Decimal(15, 2)
  originType      String?
  originId        String?
  // Recurrence
  recurrenceFrequency RecurrenceFrequency?
  recurrenceEndDate   DateTime?
  recurrenceParentId  String?
  // Installments
  installmentCount    Int           @default(1)
  // Settlement
  receivedAt      DateTime?
  amountReceived  Decimal?          @db.Decimal(15, 2)
  bankAccountId   String?
  interestAmount  Decimal?          @db.Decimal(15, 2)
  fineAmount      Decimal?          @db.Decimal(15, 2)
  discountAmount  Decimal?          @db.Decimal(15, 2)
  notes           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([organizationId, status, dueDate])  // CRITICAL
  @@index([organizationId, farmId])
  @@map("receivables")
}

model ReceivableInstallment {
  id          String           @id @default(uuid())
  receivableId String
  number      Int
  amount      Decimal          @db.Decimal(15, 2)
  dueDate     DateTime
  status      ReceivableStatus @default(PENDING)
  receivedAt  DateTime?
  amountReceived Decimal?      @db.Decimal(15, 2)

  @@map("receivable_installments")
}

model ReceivableCostCenterItem {
  id           String              @id @default(uuid())
  receivableId String
  costCenterId String
  farmId       String
  allocMode    CostCenterAllocMode
  percentage   Decimal?            @db.Decimal(5, 2)
  fixedAmount  Decimal?            @db.Decimal(15, 2)

  @@map("receivable_cost_center_items")
}
```

### Pattern 1: Installment Generation with First-Installment Rounding

**What:** Generate N installments from a total amount. Cent residual (from integer division) goes to the FIRST installment.

**When to use:** Every `createPayable` and `createReceivable` with `installmentCount > 1`.

```typescript
// Source: CONTEXT.md decision — residual to first installment
// packages/shared/src/utils/installments.ts  (or inline in service)
export function generateInstallments(
  totalAmount: IMoney,
  count: number,
  firstDueDate: Date,
  frequencyMonths = 1,
): { amount: IMoney; dueDate: Date }[] {
  if (count <= 1) {
    return [{ amount: totalAmount, dueDate: firstDueDate }];
  }

  const base = totalAmount.divide(count); // truncated to 2dp internally
  const baseRounded = Money(base.toDecimal().toDecimalPlaces(2));
  const totalFromBase = baseRounded.multiply(count);
  const residual = totalAmount.subtract(totalFromBase); // cents difference

  return Array.from({ length: count }, (_, i) => {
    const dueDate = addMonths(firstDueDate, i * frequencyMonths);
    const amount = i === 0 ? baseRounded.add(residual) : baseRounded; // FIRST gets residual
    return { amount, dueDate };
  });
}
```

**Verification:** `sum(installments.map(i => i.amount.toNumber())) === totalAmount.toNumber()` — assert in tests.

### Pattern 2: Settlement (Baixa) — Atomic Prisma Transaction

**What:** Every payment/receipt settlement updates the payable status AND the bank account balance AND creates a FinancialTransaction ledger record in a single Prisma transaction.

**When to use:** `POST /org/payables/:id/settle`, `POST /org/receivables/:id/settle`, `POST /org/payables/batch-settle`.

```typescript
// payables.service.ts
export async function settlePayment(
  ctx: RlsContext,
  payableId: string,
  input: SettlePaymentInput,
): Promise<PayableOutput> {
  return withRlsContext(ctx, async (tx) => {
    const payable = await tx.payable.findUniqueOrThrow({
      where: { id: payableId, organizationId: ctx.organizationId },
    });
    if (payable.status === 'PAID') throw new PayableError('Título já baixado', 409);

    // Effective amount = original + interest + fine - discount
    const effectiveAmount = Money(input.amount)
      .add(Money(input.interestAmount ?? 0))
      .add(Money(input.fineAmount ?? 0))
      .subtract(Money(input.discountAmount ?? 0));

    // 1. Mark payable as PAID
    const updated = await tx.payable.update({
      where: { id: payableId },
      data: {
        status: 'PAID',
        paidAt: new Date(input.paidAt),
        amountPaid: effectiveAmount.toDecimal(),
        bankAccountId: input.bankAccountId,
        interestAmount: input.interestAmount ? Money(input.interestAmount).toDecimal() : null,
        fineAmount: input.fineAmount ? Money(input.fineAmount).toDecimal() : null,
        discountAmount: input.discountAmount ? Money(input.discountAmount).toDecimal() : null,
      },
    });

    // 2. Debit bank balance atomically
    await tx.bankAccountBalance.update({
      where: { bankAccountId: input.bankAccountId },
      data: { currentBalance: { decrement: effectiveAmount.toDecimal() } },
    });

    // 3. Create ledger entry
    await tx.financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId: input.bankAccountId,
        type: 'DEBIT',
        amount: effectiveAmount.toDecimal(),
        description: `CP #${payable.documentNumber ?? payable.id.slice(0, 8)} — ${payable.supplierName}`,
        referenceType: 'PAYABLE',
        referenceId: payableId,
        transactionDate: new Date(input.paidAt),
      },
    });

    return toPayableOutput(updated);
  });
}
```

### Pattern 3: CNAB Adapter Interface

**What:** Each bank implements `CnabAdapter` with methods for generating remessa and parsing retorno. The payables service calls the adapter by bank code — never with bank-specific logic in the service itself.

**When to use:** `POST /org/payables/cnab/remessa` and `POST /org/payables/cnab/retorno`.

```typescript
// modules/cnab/cnab.adapter.ts
export interface CnabPaymentRecord {
  payableId: string;
  amount: number; // in BRL (not centavos — adapter converts internally)
  dueDate: Date;
  supplierName: string;
  supplierDocument: string; // CPF or CNPJ
  bankCode: string;
  agency: string;
  accountNumber: string;
}

export interface CnabReturnRecord {
  ourNumber: string; // nosso número — links back to internal payableId
  status: 'LIQUIDATED' | 'RETURNED' | 'REJECTED';
  statusCode: string; // bank-specific code (e.g. '00', '02', '09')
  liquidationDate?: Date;
  amountPaid?: number;
}

export interface CnabAdapter {
  bankCode: string; // FEBRABAN code — '001' for BB, '756' for Sicoob
  bankName: string;
  generateRemessa240(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string;
  generateRemessa400(headerData: CnabHeaderData, payments: CnabPaymentRecord[]): string;
  parseRetorno(fileContent: string): CnabReturnRecord[];
}

// Registry
export const CNAB_ADAPTERS = new Map<string, CnabAdapter>([
  ['001', bb001Adapter],
  ['756', sicoob756Adapter],
]);

export function getCnabAdapter(bankCode: string): CnabAdapter {
  const adapter = CNAB_ADAPTERS.get(bankCode);
  if (!adapter) throw new Error(`CNAB adapter não disponível para banco ${bankCode}`);
  return adapter;
}
```

### Pattern 4: Aging Query

**What:** A single parameterized SQL query (via Prisma `groupBy` or raw) that buckets open payables by days-overdue. Uses the composite index `(organizationId, status, dueDate)` established at migration time.

**When to use:** `GET /org/payables/aging` and `GET /org/receivables/aging`.

```typescript
// payables-aging.service.ts — aging buckets
const AGING_BUCKETS = [
  { label: 'vencidas', minDays: null, maxDays: -1 }, // already overdue
  { label: '7_dias', minDays: 0, maxDays: 7 },
  { label: '15_dias', minDays: 8, maxDays: 15 },
  { label: '30_dias', minDays: 16, maxDays: 30 },
  { label: '60_dias', minDays: 31, maxDays: 60 },
  { label: '90_dias', minDays: 61, maxDays: 90 },
  { label: 'acima_90', minDays: 91, maxDays: null },
];

// Query: find all PENDING payables and bucket by dueDate - today
// Composite index: @@index([organizationId, status, dueDate]) makes this O(log n)
```

### Pattern 5: Cost Center Rateio Validation

**What:** Before saving, validate that cost center items sum correctly according to the chosen mode.

**When to use:** In `createPayable` / `createReceivable` service input validation.

```typescript
function validateCostCenterItems(totalAmount: IMoney, items: CostCenterItemInput[]): void {
  if (items.length === 0) throw new PayableError('Pelo menos um centro de custo é obrigatório');

  const firstMode = items[0].allocMode;
  if (items.some((i) => i.allocMode !== firstMode)) {
    throw new PayableError('Todos os itens de rateio devem usar o mesmo modo');
  }

  if (firstMode === 'PERCENTAGE') {
    const total = items.reduce((acc, i) => acc + (i.percentage ?? 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new PayableError(`Percentuais somam ${total}%, devem somar 100%`);
    }
  } else {
    const totalFixed = items.reduce((acc, i) => acc.add(Money(i.fixedAmount ?? 0)), Money.zero());
    if (!totalFixed.equals(totalAmount)) {
      throw new PayableError(
        `Valores fixos somam ${totalFixed.toBRL()}, deve ser ${totalAmount.toBRL()}`,
      );
    }
  }
}
```

### Pattern 6: CNAB Retorno — Upload + Preview + Confirm (Three-Step Flow)

**What:** Mirrors the existing `BulkImportModal` pattern (parse-preview-confirm) used in mass animal import and stock outputs.

**Steps:**

1. `POST /org/payables/cnab/retorno/preview` — `multipart/form-data`, returns `{ records: CnabPreviewRecord[] }` (no DB writes)
2. User reviews preview in `CnabRetornoModal`
3. `POST /org/payables/cnab/retorno/confirm` — receives selected records, applies baixa automática via `settlePayment` for each

**When to use:** FN-08 retorno import.

### Anti-Patterns to Avoid

- **Float arithmetic for monetary values:** Never `payable.totalAmount / installmentCount` using native JS division. Always `Money(payable.totalAmount).divide(installmentCount)`.
- **Balance read before transaction:** Never read `bankAccountBalance.currentBalance` to validate sufficient funds and then update in a separate operation. Use Prisma transaction; if negative balance is disallowed, check inside the transaction.
- **Generic CNAB generator:** No `if (bankCode === '001') {...} else if (bankCode === '756') {...}` in payables.service.ts. All bank-specific logic lives in the adapter.
- **Cost center FK to farmId on PayableCostCenterItem without explicit farmId:** CostCenter is scoped to a farm (`costCenter.farmId`). Include `farmId` explicitly on `PayableCostCenterItem` for reporting.
- **Computing aging in application layer:** Never load all payables into memory and filter with JS Date arithmetic. Use database-side date arithmetic with the composite index.
- **Single `Payable` model handling both documents and installments:** Separate `Payable` (document) from `PayableInstallment` (rows). The document is the canonical record; installments are child rows. Both share status fields.

---

## Don't Hand-Roll

| Problem                    | Don't Build                           | Use Instead                                                                      | Why                                                                            |
| -------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Monetary arithmetic        | `amount / count` with native `number` | `Money(amount).divide(count)`                                                    | Float errors corrupt CNAB checksums                                            |
| CNAB fixed-width parsing   | Regex parsing in service              | `cnab.parser.ts` with position slice                                             | Positions are well-defined in FEBRABAN layout; reusable across retorno types   |
| Brazilian currency display | Custom formatter                      | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`             | Native, zero bytes, already used in Phase 1                                    |
| File export                | Custom CSV builder                    | `exceljs` (Excel) + `pdfkit` (PDF) + raw string (CSV)                            | Already installed, established pattern in project                              |
| CNAB npm package           | External library                      | Internal `modules/cnab/`                                                         | No maintained TypeScript-native library covers BB+Sicoob CNAB 240/400 variants |
| Date arithmetic for aging  | `new Date() - dueDate` in JS          | PostgreSQL `CURRENT_DATE - due_date::date` in Prisma raw or WHERE clause         | Database-side uses the index; JS-side loads full table                         |
| Sidebar badge counter      | WebSocket or polling                  | Single REST endpoint `GET /org/payables/aging/overdue-count` called on page load | Volume does not justify real-time; badge refreshes on navigation               |

---

## Common Pitfalls

### Pitfall 1: Installment Residual on Wrong Installment

**What goes wrong:** Code puts cent residual on the LAST installment (common Brazilian banking practice), but CONTEXT.md locks it to the FIRST.

**Why it happens:** Developers default to last-installment convention. CONTEXT.md specifically overrides this.

**How to avoid:** In `generateInstallments`, apply residual at index `i === 0`. Add a unit test: `sum(installments) === original_total` AND `installments[0].amount >= installments[1].amount`.

**Warning signs:** Installments generated as `[R$333.33, R$333.33, R$333.34]` (residual last) instead of `[R$333.34, R$333.33, R$333.33]` (residual first).

### Pitfall 2: CNAB Layout Variance Between BB (001) and Sicoob (756)

**What goes wrong:** The Sicoob CNAB 240 header uses a "Banco Cooperado" identification field in positions 53-72 of the File Header record that does not exist in the BB layout. Treating them as identical produces a file the Sicoob rejects silently.

**Why it happens:** Developers read the FEBRABAN base spec without reading the bank-specific manual.

**How to avoid:** Each adapter handles its own header layout. The `CnabAdapter` interface exposes `generateRemessa240()` — each bank's implementation fills the fixed-width record from its own layout definition. Test with the bank's official layout validator if available, or against the manual's record examples.

**Warning signs:** A single `buildHeader(bankCode, ...)` function with conditional branches inside `payables.service.ts` instead of adapter-delegated calls.

### Pitfall 3: FUNRURAL Not Stored on Receivable

**What goes wrong:** FUNRURAL rate is calculated at display time from a global config value instead of being stored on the individual receivable at creation time.

**Why it happens:** Developers treat FUNRURAL as a static rate (1.5% for individual rural producers). In reality the rate varies by seller type (PF = 1.5%, PJ agropecuária = 2.5%) and NF type.

**How to avoid:** Store `funruralRate` (Decimal, e.g., `0.0150`) and `funruralAmount` (computed at save time as `totalAmount × funruralRate`) directly on the `Receivable` record. The expected net receipt shown in aging is `totalAmount - funruralAmount`. Both fields nullable — not all CR entries have FUNRURAL.

**Warning signs:** FUNRURAL missing from `Receivable` schema. Rate applied at API response time.

### Pitfall 4: Missing Composite Index Causes Slow Aging

**What goes wrong:** Aging query scans the full `payables` table because there is no index on `(organizationId, status, dueDate)`.

**Why it happens:** Index is easy to forget when writing the migration.

**How to avoid:** In the Prisma schema: `@@index([organizationId, status, dueDate])`. Verify with `EXPLAIN ANALYZE` if the table grows past 2,000 rows.

**Warning signs:** Aging endpoint takes >500ms in development. `EXPLAIN` shows `Seq Scan` on payables.

### Pitfall 5: Rateio Percentage Rounding Creates Ghost Centavos

**What goes wrong:** A CP of R$1,000.00 rateado 33%/33%/34% across three cost centers computes R$330.00 + R$330.00 + R$340.00 = R$1,000.00 correctly. But 33.3%/33.3%/33.4% produces R$333.00 + R$333.00 + R$334.00 = R$1,000.00 only if rounding is consistent. Inconsistent `toFixed(2)` calls create a 1-cent gap.

**How to avoid:** In percentage mode, calculate items 1 to N-1 with `Money(total).multiply(pct / 100).toDecimal()`, then set item N as `total - sum(items[0..N-2])`. This guarantees exact sum regardless of percentage distribution.

### Pitfall 6: Batch Settlement (Bordero) Partial Failure

**What goes wrong:** Batch settlement of 10 payables iterates and settles each in sequence. If payable #7 fails (e.g., insufficient bank balance), payables 1-6 are already settled.

**How to avoid:** Wrap the entire batch in a single Prisma transaction. Either all succeed or none do. Return the full result set with status per payable only after the transaction commits.

```typescript
// Correct batch pattern
return withRlsContext(ctx, async (tx) => {
  const results = [];
  for (const item of batchItems) {
    results.push(await settleOne(tx, item)); // all within same tx
  }
  return results;
});
```

### Pitfall 7: BankAccount CNAB Fields Not Added in Separate Migration

**What goes wrong:** `convenioCode`, `carteira`, `variacao` added directly to the existing `BankAccount` migration or hard-coded into the Phase 2 payables migration.

**How to avoid:** Create a standalone migration (e.g., `20260401200000_bank_account_cnab_fields.ts`) that `ALTER TABLE bank_accounts ADD COLUMN` the three optional fields. This keeps Phase 1 and Phase 2 migrations separate and reversible.

---

## Code Examples

### CNAB 240 Fixed-Width Record — BB Pattern

```typescript
// Source: FEBRABAN CNAB 240 base spec + Banco do Brasil layout manual
// modules/cnab/adapters/bb-001.adapter.ts

function padLeft(value: string | number, length: number, char = '0'): string {
  return String(value).padStart(length, char);
}

function padRight(value: string, length: number): string {
  return value.padEnd(length, ' ').slice(0, length);
}

// CNAB 240 File Header — positions 1-240
function buildBB240FileHeader(data: CnabHeaderData): string {
  return [
    padLeft('001', 3), // pos 1-3: bank code
    padLeft('0000', 4), // pos 4-7: lot (0000 for header)
    '0', // pos 8: record type (0=header)
    ' '.repeat(9), // pos 9-17: reserved
    '2', // pos 18: CNAB file layout (2=240)
    padRight(data.companyName, 30), // pos 19-48: company name
    padLeft(data.convenioCode, 20), // pos 49-68: convenio/agreement code
    padLeft(data.agency, 5), // pos 69-73: agency
    ' ', // pos 74: agency digit
    padLeft(data.accountNumber, 12), // pos 75-86: account number
    ' ', // pos 87: account digit
    ' ', // pos 88: agency-account digit
    padRight(data.companyName, 30), // pos 89-118: company name (again)
    padRight('BANCO DO BRASIL S.A.', 30), // pos 119-148: bank name
    ' '.repeat(10), // pos 149-158: reserved
    '1', // pos 159: file type (1=remessa)
    data.fileDate.toISOString().slice(0, 10).replace(/-/g, ''), // pos 160-167: date DDMMYYYY
    // ... remaining fields per BB layout manual
  ].join('');
}
```

### Aging Endpoint Response Shape

```typescript
// payables-aging.types.ts
export interface AgingBucket {
  label: string; // 'vencidas' | '7_dias' | '15_dias' | '30_dias' | '60_dias' | '90_dias' | 'acima_90'
  displayLabel: string; // 'Vencidas' | 'Até 7 dias' | '8–15 dias' | etc.
  count: number;
  totalAmount: number; // BRL
  items?: PayableAgingItem[]; // populated only when clicked (separate endpoint)
}

export interface AgingResponse {
  buckets: AgingBucket[];
  grandTotal: { count: number; totalAmount: number };
  overdueCount: number; // for sidebar badge — sum of bucket 'vencidas'
}
```

### Calendar Data Endpoint Response Shape

```typescript
// GET /org/payables/calendar?year=2026&month=3
export interface CalendarDayData {
  date: string; // 'YYYY-MM-DD'
  payableCount: number;
  totalAmount: number; // BRL
  hasOverdue: boolean; // any of these payables are already overdue
}

export type CalendarResponse = CalendarDayData[];
```

### FUNRURAL Field on Receivable Creation

```typescript
// receivables.types.ts
export interface CreateReceivableInput {
  farmId: string;
  producerId?: string;
  clientName: string;
  category: ReceivableCategory;
  description: string;
  totalAmount: number;
  dueDate: string; // ISO date
  funruralRate?: number; // 0.015 for PF, 0.025 for PJ — null if not applicable
  nfeKey?: string; // 44-char NF-e access key
  installmentCount?: number;
  firstDueDate?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  costCenterItems: CostCenterItemInput[];
  bankAccountId?: string;
}

// Service computes funruralAmount at save time:
const funruralAmount = input.funruralRate
  ? Money(input.totalAmount).multiply(input.funruralRate)
  : null;
```

### Recurrence Pattern — On-demand Draft Generation

```typescript
// On listing receivables, generate next draft if due
// This avoids a cron job dependency
async function maybeGenerateNextRecurrence(
  tx: PrismaTransaction,
  ctx: RlsContext,
  source: Receivable,
): Promise<void> {
  if (!source.recurrenceFrequency) return;
  if (source.recurrenceEndDate && source.recurrenceEndDate < new Date()) return;

  const existingNext = await tx.receivable.count({
    where: {
      organizationId: ctx.organizationId,
      recurrenceParentId: source.id,
      dueDate: { gt: source.dueDate },
    },
  });
  if (existingNext > 0) return; // already generated

  await tx.receivable.create({
    data: {
      ...stripSettlementFields(source),
      dueDate: addMonthsByFrequency(source.dueDate, source.recurrenceFrequency),
      status: 'PENDING',
      recurrenceParentId: source.id,
    },
  });
}
```

---

## State of the Art

| Old Approach                                              | Current Approach                                                                | Notes                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| CNAB via npm package (cnab240, node-cnab)                 | Custom internal `modules/cnab/` with adapter pattern                            | No maintained TS-native package covers BB + Sicoob 240/400 variants         |
| Monetary arithmetic with `Math.round(amount * 100) / 100` | `decimal.js` via `Money` factory in shared package                              | `Math.round` causes IEEE 754 accumulation errors in multi-step calculations |
| Real-time balance from `SUM(transactions)`                | Pre-computed `BankAccountBalance.currentBalance` aggregate updated in Prisma tx | O(1) reads, established in Phase 1                                          |
| FUNRURAL as static rate applied at display                | Stored `funruralRate` + `funruralAmount` on each CR record                      | Rates vary by seller type; historical records must be immutable             |
| Aging computed in application layer                       | Database-side date arithmetic with composite index                              | Prevents full table scan as CP/CR volume grows                              |

---

## Open Questions

1. **Sicoob 756 CNAB 240 layout manual**
   - What we know: Sicoob uses CNAB 240 with non-standard "Banco Cooperado" fields in the File Header (positions 53-72).
   - What's unclear: The exact byte positions for Sicoob's cooperative identification — not available without the official Sicoob layout PDF.
   - Recommendation: During Wave 0 of the CNAB plan, obtain the official Sicoob CNAB 240 layout manual from sicoob.com.br/desenvolvedores or request from a Sicoob API contact. Implement BB first (well-documented); Sicoob adapter can follow. Both are locked in scope by CONTEXT.md.

2. **Saldo projetado na BankAccountsPage**
   - What we know: Phase 1 left `--` placeholder for projected balance. Phase 2 now has CP/CR data.
   - What's unclear: Whether updating the Phase 1 `BankAccountsPage` projected balance is in this phase's scope or deferred. CONTEXT.md marks it as deferred but "pode ser feito como parte desta phase."
   - Recommendation: Implement a lightweight `GET /org/bank-accounts/:id/projected-balance?days=30` endpoint in the payables/receivables service that sums open CP dues and expected CR receipts within a date window. Wire it to the Phase 1 UI placeholder as a bonus task — zero schema changes needed.

3. **Recurrence generation trigger**
   - What we know: CONTEXT.md locks recurrence to "template mensal" with on-demand generation preferred (no cron job).
   - What's unclear: Whether generation should happen on every `listPayables` call or only on explicit trigger.
   - Recommendation: Generate next draft when the current recurrence parent is settled (on `settlePayment` success). This is the most natural trigger: marking a recurring expense as paid naturally creates the next one.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Framework          | Jest 29 + supertest 7                                                                 |
| Config file        | `apps/backend/jest.config.js` (existing)                                              |
| Quick run command  | `cd apps/backend && pnpm test --testPathPattern="payables\|receivables\|cnab\|aging"` |
| Full suite command | `cd apps/backend && pnpm test`                                                        |

### Phase Requirements → Test Map

| Req ID | Behavior                                                      | Test Type | Automated Command                                       | File Exists? |
| ------ | ------------------------------------------------------------- | --------- | ------------------------------------------------------- | ------------ |
| FN-07  | Create payable with installments — sum equals total           | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-07  | Installment residual on FIRST installment                     | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-07  | Cost center items sum to 100% (percentage mode)               | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-07  | Cost center items sum equals total (fixed mode)               | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-08  | settlePayment updates balance and creates ledger record       | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-08  | Estorno reverses balance and restores PENDING status          | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |
| FN-08  | CNAB remessa generation returns valid fixed-width text        | unit      | `pnpm test --testPathPattern="cnab"`                    | ❌ Wave 0    |
| FN-08  | CNAB retorno parser extracts LIQUIDATED records               | unit      | `pnpm test --testPathPattern="cnab"`                    | ❌ Wave 0    |
| FN-10  | Aging endpoint returns 7 buckets with correct counts          | unit      | `pnpm test --testPathPattern="payables-aging"`          | ❌ Wave 0    |
| FN-10  | Overdue count used by sidebar badge is accurate               | unit      | `pnpm test --testPathPattern="payables-aging"`          | ❌ Wave 0    |
| FN-11  | Create receivable stores funruralAmount = total × rate        | unit      | `pnpm test --testPathPattern="receivables.routes.spec"` | ❌ Wave 0    |
| FN-12  | settleReceivable updates balance with credit                  | unit      | `pnpm test --testPathPattern="receivables.routes.spec"` | ❌ Wave 0    |
| FN-12  | Batch settlement (bordero) fails atomically if one item fails | unit      | `pnpm test --testPathPattern="payables.routes.spec"`    | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test --testPathPattern="payables\|receivables\|cnab\|aging" --passWithNoTests`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/payables/payables.routes.spec.ts` — covers FN-07, FN-08
- [ ] `apps/backend/src/modules/receivables/receivables.routes.spec.ts` — covers FN-11, FN-12
- [ ] `apps/backend/src/modules/cnab/cnab.spec.ts` — covers CNAB generator and parser
- [ ] `apps/backend/src/modules/payables-aging/payables-aging.routes.spec.ts` — covers FN-10

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `apps/backend/src/modules/bank-accounts/` — Phase 1 implementation of BankAccount, BankAccountBalance, FinancialTransaction models and `withRlsContext` transaction pattern
- Direct codebase analysis: `apps/backend/prisma/schema.prisma` lines 5091–5170 — confirmed BankAccount, BankAccountBalance, FinancialTransaction schema shapes
- Direct codebase analysis: `packages/shared/src/types/money.ts` — Money factory implementation with `decimal.js`, `ROUND_HALF_UP`, `fromPrismaDecimal()` confirmed
- Direct codebase analysis: `apps/backend/prisma/schema.prisma` lines 1659–1675 — CostCenter model confirmed, scoped to `farmId`
- Direct codebase analysis: `apps/backend/src/modules/bank-accounts/bank-accounts.routes.spec.ts` — confirmed Jest + supertest + service mock pattern for all spec files
- Phase 2 CONTEXT.md: locked decisions for CNAB banks, installment residual placement, aging faixas, UI layout
- `.planning/research/STACK.md`: library recommendations and CNAB custom implementation rationale
- `.planning/research/ARCHITECTURE.md`: double-entry ledger pattern, module structure
- `.planning/research/PITFALLS.md`: monetary arithmetic, CNAB variance, FUNRURAL, batch settlement

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` accumulated decisions: CnabAdapter decision, Money type factory pattern confirmed in Phase 1
- Training data: FEBRABAN CNAB 240/400 base specification structure — widely documented, HIGH confidence on format; bank-specific layouts (BB 001, Sicoob 756) require official manuals for exact positions

### Tertiary (LOW confidence)

- Sicoob 756 CNAB 240 exact field positions — cannot verify without official Sicoob layout manual; flagged as Open Question

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies confirmed installed in project; no new packages required
- Architecture: HIGH — extends directly from Phase 1 patterns with confirmed existing models
- CNAB module: MEDIUM — custom implementation approach verified correct; bank-specific layouts require official PDFs
- Pitfalls: HIGH — drawn from Phase 1 patterns + Brazilian financial domain knowledge + CONTEXT.md decisions
- Sicoob layout: LOW — requires official manual

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain; FEBRABAN layout specs change rarely)
