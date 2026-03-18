# Phase 10: Recebimento de Mercadorias - Research

**Researched:** 2026-03-17
**Domain:** Goods Receipt — 6-scenario state machine + atomic StockEntry+Payable integration
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Status machine: PENDENTE -> EM_CONFERENCIA -> CONFERIDO -> CONFIRMADO / REJEITADO (same pattern as OC_VALID_TRANSITIONS)
- `receivingType` enum: STANDARD, NF_ANTECIPADA, MERCADORIA_ANTECIPADA, PARCIAL, NF_FRACIONADA, EMERGENCIAL
- Sequential numbering: REC-YYYY/NNNN per organization (consistent with SC-YYYY/NNNN, OC-YYYY/NNNN)
- Partial receiving: track qty received vs qty ordered; PurchaseOrder transitions to ENTREGUE only when 100% received
- NF fields: manual entry only — numero, serie, CFOP, data emissao, valor total, chave de acesso (44 digits, optional) — no XML import
- Item-by-item inspection: qty pedida / qty NF / qty recebida columns; action per item (aceitar, registrar divergencia)
- Quality fields per item: visual OK/NOK, lote, validade, observacoes (all optional)
- Divergence alert >5% between qty pedida and qty recebida: badge + yellow banner (does NOT block confirmation)
- Web-only — mobile financeiro is out of scope
- 5 divergence types: A_MAIS, A_MENOS, SUBSTITUIDO, DANIFICADO, ERRADO
- 3 divergence actions: DEVOLVER (Phase 11 pending), ACEITAR_COM_DESCONTO (adjusts item value), REGISTRAR_PENDENCIA (note only)
- Photo upload per divergence: multer pattern (existing), linked to divergent item
- Atomic integration: CONFERIDO -> CONFIRMADO transition creates StockEntry + Payable in single Prisma transaction
- CP never created on OC approval — only on confirmed receipt (avoids duplicates on partial deliveries)
- StockEntry uses existing `createStockEntry` with mapped items
- Payable uses existing `createPayable` with supplier, NF value, payment terms from OC
- Installments: if OC has 30/60/90 terms, CP is created with installmentCount=3
- Cost center: inherited from original PurchaseRequest (full traceability chain)
- NF antecipada: CP created with status PENDING + provisional flag; receiving stays PENDENTE until goods arrive
- Mercadoria antecipada: StockEntry created in DRAFT status (blocked for consumption); confirmed when NF is registered
- Accessory expenses from different suppliers: separate CPs per expense supplier, all linked to same receipt
- Cross-reference: CP stores goodsReceiptId -> purchaseOrderId -> quotationId -> purchaseRequestId
- Frontend: GoodsReceiptsPage with tabs Recebimentos + Pendencias; GoodsReceiptModal with wizard-like steps
- Wizard steps: (1) select OC or create emergency, (2) NF data, (3) item-by-item inspection, (4) summary + confirmation
- Sidebar: add "Recebimentos" to COMPRAS group after "Pedidos"

### Claude's Discretion

- Design of wizard (visual steps vs scroll sections)
- Inspection table layout (responsiveness, horizontal scroll)
- Skeleton loading and empty states
- Spacing and typography (following design system)
- Photo upload error handling
- Field order and grouping in NF form
- Technical implementation of StockEntry item mapping (unit conversion if applicable)

### Deferred Ideas (OUT OF SCOPE)

- NF-e XML import (SEFAZ schema) — requires separate fiscal module
- Mobile receiving — out of scope per REQUIREMENTS.md
- Equipment/asset registration on receiving — Phase 11 or future
- CTE (Conhecimento de Transporte Eletronico) import — future, fiscal complexity
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                                                                                                              | Research Support                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| RECE-01 | Conferente can register receiving in 6 scenarios: NF+goods simultaneous, NF antecipada, goods antecipada with provisional entry, partial with pending balance, NF fracionada por fornecedor, emergencial sem pedido                                                                                                                      | `receivingType` enum + state machine maps each scenario to a distinct flow path                                          |
| RECE-02 | Item-by-item physical inspection with divergence recording (5 types) + photo + action (3 types), quality fields, divergence alert >5%                                                                                                                                                                                                    | GoodsReceiptItem + GoodsReceiptDivergence models; multer photo upload; threshold alert                                   |
| RECE-03 | On confirmed receiving+NF: automatic stock entry (inputs) or asset registration (equipment); accessory expenses with separate suppliers; separate date tracking; receipt status; pending dashboard                                                                                                                                       | Atomic Prisma transaction calling createStockEntry; StockEntry.goodsReceiptId FK; DRAFT status for mercadoria antecipada |
| FINC-01 | On confirmed receiving+NF: automatic CP with supplier/value/due dates/cost center; accessory expense CPs per supplier; NF antecipada (provisional CP), receiving antecipado (CP only with NF), partial (CP per delivery); installments from OC payment terms; accounting classification suggestion; full cross-reference with drill-down | createPayable inside same Prisma transaction; goodsReceiptId on Payable; installmentCount from OC paymentTerms           |

</phase_requirements>

---

## Summary

Phase 10 implements the goods receiving module as the integration hub of the purchasing cycle. A GoodsReceipt record coordinates six distinct receiving scenarios, advances through a 4-state machine (PENDENTE → EM_CONFERENCIA → CONFERIDO → CONFIRMADO/REJEITADO), and upon confirmation fires a single atomic Prisma transaction that creates both a StockEntry and one or more Payables.

The core technical challenge is the 3-way desynchronization problem: goods may arrive before, with, or after the NF. MERCADORIA_ANTECIPADA creates a DRAFT StockEntry that blocks consumption until the NF arrives; NF_ANTECIPADA creates a provisional Payable that remains flagged until goods arrive. Both flags are cleared in the same transition that fully confirms the receipt. Partial deliveries each produce their own StockEntry and Payable, and the linked PurchaseOrder advances to ENTREGUE only when all ordered quantities have been received across all deliveries.

All integration code (createStockEntry, createPayable, multer photo upload, sequential number generation) is already present in the codebase. Phase 10 adds three new Prisma models (GoodsReceipt, GoodsReceiptItem, GoodsReceiptDivergence), one migration, a new backend module `modules/goods-receipts/`, and two new frontend files (GoodsReceiptsPage, GoodsReceiptModal) plus the standard hook and CSS pair.

**Primary recommendation:** Build goods-receipts as a standalone module that calls existing services inside a Prisma transaction — never duplicate stock or payable logic, never create CP from OC approval.

---

## Standard Stack

### Core

| Library              | Version | Purpose                         | Why Standard                                            |
| -------------------- | ------- | ------------------------------- | ------------------------------------------------------- |
| Prisma (existing)    | 7.x     | ORM, transactions, RLS          | All modules use it; `prisma.$transaction` for atomicity |
| Express 5 (existing) | 5.x     | Router and middleware           | Backend standard                                        |
| multer (existing)    | 1.4.x   | File upload (divergence photos) | Already used in purchase-requests and quotations        |
| pdfkit (existing)    | —       | Not needed Phase 10 — deferred  | Phase 9 pattern; Phase 10 does not require PDF          |

### Supporting

| Library                        | Version | Purpose                                              | When to Use                         |
| ------------------------------ | ------- | ---------------------------------------------------- | ----------------------------------- |
| @protos-farm/shared (existing) | —       | Money, generateInstallments, validateCostCenterItems | Payable creation, installment logic |
| lucide-react (existing)        | —       | Icons (AlertTriangle, Package, CheckCircle2, etc.)   | Standard icon library               |

### Alternatives Considered

| Instead of                | Could Use               | Tradeoff                                                      |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| Prisma.$transaction       | Manual SQL BEGIN/COMMIT | Prisma is already the ORM standard; no reason to bypass it    |
| Existing createStockEntry | Inline stock logic      | Duplication risk — always call the service                    |
| Existing createPayable    | Inline payable logic    | Same reason; Money utility and installment logic is in shared |

**Installation:**

```bash
# No new dependencies — all required packages already present
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/goods-receipts/
├── goods-receipts.types.ts      # GR_VALID_TRANSITIONS, enums, input/output types
├── goods-receipts.service.ts    # createGoodsReceipt, confirmReceipt, getById, list, transition
├── goods-receipts.routes.ts     # Express router + multer for photos
└── goods-receipts.routes.spec.ts

apps/frontend/src/
├── pages/GoodsReceiptsPage.tsx
├── pages/GoodsReceiptsPage.css
├── components/goods-receipts/
│   ├── GoodsReceiptModal.tsx     # 4-step wizard
│   └── GoodsReceiptModal.css
├── hooks/useGoodsReceipts.ts
└── types/goods-receipt.ts
```

### Pattern 1: State Machine (GR_VALID_TRANSITIONS)

**What:** Same VALID_TRANSITIONS map pattern used by OC and PurchaseRequest.
**When to use:** Every status change must go through `canGrTransition()`.

```typescript
// Source: apps/backend/src/modules/purchase-orders/purchase-orders.types.ts (pattern)
export const GR_VALID_TRANSITIONS: Record<string, string[]> = {
  PENDENTE: ['EM_CONFERENCIA', 'REJEITADO'],
  EM_CONFERENCIA: ['CONFERIDO', 'REJEITADO'],
  CONFERIDO: ['CONFIRMADO', 'REJEITADO'],
  CONFIRMADO: [],
  REJEITADO: [],
};

export function canGrTransition(from: string, to: string): boolean {
  return GR_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Pattern 2: Atomic Confirmation Transaction

**What:** On CONFERIDO -> CONFIRMADO, a single `prisma.$transaction` creates StockEntry and Payable(s).
**When to use:** Only on this specific transition — never on any other state change.

```typescript
// Source: createStockEntry signature in stock-entries.service.ts
// Source: createPayable signature in payables.service.ts
// Pattern: prisma.$transaction is the outer container; RLS context is injected into tx

async function confirmGoodsReceipt(ctx: RlsContext & { userId: string }, id: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Load GoodsReceipt with items, PO, cost centers
    // 2. Validate state transition (canGrTransition)
    // 3. Build CreateStockEntryInput from GoodsReceiptItems
    // 4. Call createStockEntry (or inline equivalent accepting tx)
    // 5. Build CreatePayableInput from NF value + OC payment terms
    // 6. Call createPayable (or inline equivalent accepting tx)
    // 7. Update GoodsReceipt status to CONFIRMADO + timestamps
    // 8. Update PurchaseOrder receivedQty; if 100%, transition to ENTREGUE
    // 9. Create notifications (fire-and-forget void, outside tx)
  });
}
```

**Critical:** `createNotification` and `dispatchPushNotification` must be called AFTER the transaction commits (fire-and-forget void pattern, same as Phase 8 decision).

### Pattern 3: Sequential Number Generation

**What:** Same pattern as OC-YYYY/NNNN — query last record, increment, pad to 4 digits.
**When to use:** On every `createGoodsReceipt` call inside the transaction.

```typescript
// Source: apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
async function getNextGrSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.goodsReceipt.findFirst({
    where: { organizationId, sequentialNumber: { startsWith: `REC-${year}/` } },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }
  return `REC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}
```

### Pattern 4: Multer Photo Upload

**What:** disk storage with org/receipt folder scoping, 10MB limit.
**When to use:** POST /org/goods-receipts/:id/divergences/:divergenceId/photo

```typescript
// Source: apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = req.user?.organizationId ?? 'unknown';
    const grId = req.params.id ?? 'unknown';
    const dir = path.join('uploads', 'goods-receipts', orgId, grId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
```

### Pattern 5: 4-Step Wizard Frontend

**What:** Modal with 4 steps controlled by a `step` state variable. Header shows progress indicators, body scrolls, footer has Back/Next/Confirm buttons.
**When to use:** GoodsReceiptModal creation flow.

Steps:

1. Selecionar OC (search + select, or "Criar emergencial" toggle)
2. Dados da NF (manual fields: numero, serie, CFOP, data emissao, valor total, chave acesso)
3. Conferencia (table: qty pedida / qty NF / qty recebida per item + divergence actions)
4. Resumo + confirmacao (readonly summary, ConfirmModal for CONFIRMADO trigger)

**Key decision from Phase 8:** Use key-remount pattern for the wizard form if reset is needed — avoid setState inside useEffect.

### Pattern 6: Partial Delivery Tracking on PurchaseOrder

**What:** Each PurchaseOrderItem needs a `receivedQuantity` field (Decimal). When a GoodsReceipt is confirmed for partial items, update receivedQuantity. If all items reach 100% received, auto-transition PO to ENTREGUE.

```prisma
// Addition to PurchaseOrderItem model (new field via migration)
receivedQuantity Decimal @default(0) @db.Decimal(12, 3)
```

### Anti-Patterns to Avoid

- **Inline stock/payable logic:** Never re-implement createStockEntry or createPayable logic inside goods-receipts.service — always call the existing functions (or pass tx client to equivalent logic).
- **CP on OC approval:** The project decision is firm — CP fires only from ReceivingConfirmed. Never add CP creation to purchase-orders.service.
- **Stock balance update outside transaction:** Balance updates happen inside createStockEntry which is itself inside the confirmation transaction. Never update StockBalance separately.
- **setState inside useEffect:** Use key-remount pattern for wizard form reset (Phase 8 pattern, MEMORY.md).
- **Notification inside transaction:** Create notification after transaction commits, void fire-and-forget to avoid rollback.

---

## Don't Hand-Roll

| Problem                                | Don't Build                  | Use Instead                                                       | Why                                                                      |
| -------------------------------------- | ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Stock balance update on confirm        | Custom balance logic         | `createStockEntry` from stock-entries.service                     | Handles FEFO, weighted avg cost, unit conversion (US-097), apportionment |
| Payable installments                   | Custom installment splitting | `createPayable` + `generateInstallments` from @protos-farm/shared | Handles Decimal precision, cost center validation                        |
| Purchase unit to stock unit conversion | Custom factor lookup         | Existing `convertPurchaseToStock` inside createStockEntry         | Handles 4 conversion paths (product-specific, density, global, 2-hop)    |
| Cost center validation                 | Custom validation            | `validateCostCenterItems` from @protos-farm/shared                | Already handles percentage vs fixed allocation, total coverage check     |
| Photo upload                           | Custom stream handler        | multer disk storage (existing pattern)                            | Same as purchase-requests and quotations                                 |
| Decimal arithmetic                     | JavaScript float             | `Money` from @protos-farm/shared + `toDecimal()`                  | Prisma Decimal fields need proper casting                                |

**Key insight:** This phase is primarily an integration hub — the heavy lifting is already in existing services. The new module wires them together in the right order inside a transaction.

---

## Common Pitfalls

### Pitfall 1: Prisma Transaction + RLS Context Mismatch

**What goes wrong:** `withRlsContext(ctx, tx => ...)` creates its own connection. If you call `prisma.$transaction` and then try to wrap the inner callback in `withRlsContext` again, you get a nested transaction error or the RLS SET is not applied on the outer tx client.

**Why it happens:** `withRlsContext` calls `prisma.$transaction` internally. Nesting it inside another `prisma.$transaction` breaks Prisma's connection management.

**How to avoid:** For the atomic confirmation transaction, use `prisma.$transaction` directly and pass the `tx` client to inner functions as a `TxClient` parameter. Pattern: define `confirmGoodsReceiptTx(tx: TxClient, orgId: string, id: string)` and call it from within a single `withRlsContext` wrapper.

**Warning signs:** `Transaction already started` or `P2034 Transaction failed due to a write conflict` errors.

### Pitfall 2: StockEntry CONFIRMED Status Default

**What goes wrong:** `createStockEntry` creates entries with `status: 'CONFIRMED'` by default (see service line 583: `status: 'CONFIRMED'`). For MERCADORIA_ANTECIPADA scenario, the entry must start as `DRAFT`.

**Why it happens:** The existing service always sets CONFIRMED. The goods-receipts service needs to either (a) pass a status override parameter or (b) inline the StockEntry creation for the antecipada case.

**How to avoid:** Add an optional `initialStatus?: StockEntryStatusType` parameter to `createStockEntry`, defaulting to `'CONFIRMED'`. For MERCADORIA_ANTECIPADA, pass `'DRAFT'`.

**Warning signs:** Antecipada stock appearing in usable balance before NF is registered.

### Pitfall 3: PurchaseOrder receivedQuantity Race Condition

**What goes wrong:** If two partial deliveries arrive simultaneously and both read receivedQuantity before either writes, the total will be undercounted.

**Why it happens:** Non-atomic read-modify-write on PurchaseOrderItem.receivedQuantity.

**How to avoid:** Use Prisma `increment` operation inside the transaction:

```typescript
await tx.purchaseOrderItem.update({
  where: { id: itemId },
  data: { receivedQuantity: { increment: receivedQty } },
});
```

Then reload and check if total receivedQuantity >= orderedQuantity for all items.

**Warning signs:** PurchaseOrder stuck in EM_TRANSITO despite all items physically received.

### Pitfall 4: Divergence >5% Alert Threshold

**What goes wrong:** Alert shows on every item when it should only appear for items where `Math.abs(receivedQty - orderedQty) / orderedQty > 0.05`.

**Why it happens:** Off-by-one in percentage calculation, or using absolute vs relative difference.

**How to avoid:** `const divergencePct = Math.abs(received - ordered) / ordered; if (divergencePct > 0.05) showBadge();` — guard for `ordered === 0` case.

### Pitfall 5: Payable.farmId is Required

**What goes wrong:** `CreatePayableInput` has `farmId: string` as required field. GoodsReceipt does not necessarily have a farmId — the farm comes from the PurchaseRequest's cost center.

**Why it happens:** The Payable model (line 5498) requires `farmId` to FK to Farm table.

**How to avoid:** When building CreatePayableInput from a confirmed receipt, look up farmId from the first CostCenterItem of the PurchaseRequest. If the PurchaseRequest has multiple farms, create one Payable per farmId or use the most significant cost center.

**Warning signs:** `Foreign key constraint failed on farmId` on createPayable.

### Pitfall 6: Import Route Order in Express

**What goes wrong:** Express matches `/org/goods-receipts/pending` as `/:id` with id="pending".

**Why it happens:** Express route matching is first-match. Named sub-routes after `/:id` are shadowed.

**How to avoid:** Register specific routes before parameterized ones (same decision logged in Phase 9 for `purchaseOrdersRouter`):

```
GET /org/goods-receipts/pending        ← register FIRST
GET /org/goods-receipts/:id
```

---

## Code Examples

Verified patterns from project codebase:

### Prisma Transaction with StockEntry + Payable (Integration Pattern)

```typescript
// Pattern derived from: apps/backend/src/modules/stock-entries/stock-entries.service.ts
// and apps/backend/src/modules/payables/payables.service.ts

import { prisma } from '../../database/prisma';
import { createStockEntry } from '../stock-entries/stock-entries.service';
import { createPayable } from '../payables/payables.service';

export async function confirmGoodsReceiptAndIntegrate(
  ctx: RlsContext & { userId: string },
  grId: string,
) {
  return withRlsContext(ctx, async (tx) => {
    // 1. Load GR and validate transition
    const gr = await (tx as any).goodsReceipt.findFirst({
      where: { id: grId, organizationId: ctx.organizationId },
      include: { items: true, divergences: true, purchaseOrder: { include: { items: true } } },
    });
    if (!gr) throw new GoodsReceiptError('Recebimento nao encontrado', 404);
    if (!canGrTransition(gr.status, 'CONFIRMADO'))
      throw new GoodsReceiptError(`Transicao invalida: ${gr.status} -> CONFIRMADO`, 400);

    // 2. Build StockEntry input from confirmed items
    const stockEntryInput: CreateStockEntryInput = {
      entryDate: new Date().toISOString(),
      supplierName: gr.purchaseOrder?.supplier?.name,
      invoiceNumber: gr.invoiceNumber,
      storageFarmId: gr.storageFarmId,
      items: gr.items.map((item: any) => ({
        productId: item.productId,
        quantity: Number(item.receivedQty),
        unitCost: Number(item.unitPrice),
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate?.toISOString(),
      })),
    };

    // 3. Create StockEntry (inside same tx via service or inline)
    // NOTE: createStockEntry uses withRlsContext internally — pass raw tx client
    // to the inner logic to avoid double-transaction.

    // 4. Create Payable with NF value
    const payableInput: CreatePayableInput = {
      farmId: /* from PurchaseRequest cost center */ gr.farmId,
      supplierName: gr.purchaseOrder.supplier.name,
      category: 'INPUTS',
      description: `NF ${gr.invoiceNumber} - ${gr.sequentialNumber}`,
      totalAmount: Number(gr.invoiceTotal),
      dueDate: calculateFirstDueDate(gr.invoiceDate, gr.purchaseOrder.paymentTerms),
      installmentCount: extractInstallmentCount(gr.purchaseOrder.paymentTerms),
      documentNumber: gr.invoiceNumber,
      costCenterItems: [
        {
          costCenterId: gr.costCenterId,
          farmId: gr.farmId,
          allocMode: 'PERCENTAGE',
          percentage: 100,
        },
      ],
    };

    // 5. Update GR status + timestamps
    await (tx as any).goodsReceipt.update({
      where: { id: grId },
      data: { status: 'CONFIRMADO', confirmedAt: new Date() },
    });

    // 6. Update PO receivedQty and check if fully delivered
    for (const item of gr.items) {
      await (tx as any).purchaseOrderItem.update({
        where: { id: item.purchaseOrderItemId },
        data: { receivedQuantity: { increment: Number(item.receivedQty) } },
      });
    }
    // Check 100% and transition PO to ENTREGUE if so

    return gr;
  });
  // 7. After tx: fire-and-forget notifications (void)
}
```

### RLS Context Helper (Standard Pattern)

```typescript
// Source: all existing routes files (e.g., purchase-orders.routes.ts lines 24-30)
function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GoodsReceiptError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}
```

### Frontend Hook Pattern

```typescript
// Source: apps/frontend/src/hooks/ pattern (e.g., usePurchaseOrders)
// hooks/useGoodsReceipts.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export function useGoodsReceipts(filters: { status?: string; search?: string }) {
  const [data, setData] = useState<GoodsReceiptListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/org/goods-receipts', { params: filters });
      setData(result.data.data);
    } catch (e) {
      setError('Erro ao carregar recebimentos');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.search]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

### Wizard Step Pattern (Multi-Step Modal)

```typescript
// Source: Phase 8 pattern documented in STATE.md (key-remount pattern)
// GoodsReceiptModal.tsx — outer manages step, inner form uses key for reset

function GoodsReceiptModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState<Partial<CreateGoodsReceiptInput>>({});

  function handleStepComplete(stepData: Partial<CreateGoodsReceiptInput>) {
    setFormData((prev) => ({ ...prev, ...stepData }));
    setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
  }

  // Step 3: inspection table with divergence rows
  // Rendered as <InspectionTable key={formData.purchaseOrderId} ... />
  // key-remount ensures clean state when OC changes (Phase 8 pattern)
}
```

---

## Prisma Schema — New Models

Three new models required. Migration number: `20260410100000_add_goods_receipts`.

```prisma
// ─── GoodsReceipt Module (Phase 10) ──────────────────────────────────

enum GoodsReceiptStatus {
  PENDENTE
  EM_CONFERENCIA
  CONFERIDO
  CONFIRMADO
  REJEITADO
}

enum ReceivingType {
  STANDARD
  NF_ANTECIPADA
  MERCADORIA_ANTECIPADA
  PARCIAL
  NF_FRACIONADA
  EMERGENCIAL
}

enum DivergenceType {
  A_MAIS
  A_MENOS
  SUBSTITUIDO
  DANIFICADO
  ERRADO
}

enum DivergenceAction {
  DEVOLVER
  ACEITAR_COM_DESCONTO
  REGISTRAR_PENDENCIA
}

model GoodsReceipt {
  id               String              @id @default(cuid())
  organizationId   String
  sequentialNumber String
  purchaseOrderId  String?             // null for EMERGENCIAL
  supplierId       String
  status           GoodsReceiptStatus  @default(PENDENTE)
  receivingType    ReceivingType       @default(STANDARD)
  // NF fields
  invoiceNumber    String?
  invoiceSerie     String?
  invoiceCfop      String?
  invoiceDate      DateTime?
  invoiceTotal     Decimal?            @db.Decimal(14, 2)
  invoiceKey       String?             // 44 digits, optional
  isProvisional    Boolean             @default(false) // NF_ANTECIPADA flag
  // Integration FKs (set on CONFIRMADO)
  stockEntryId     String?
  payableId        String?
  // Tracking dates
  receivedAt       DateTime?
  conferredAt      DateTime?
  confirmedAt      DateTime?
  rejectedAt       DateTime?
  rejectionReason  String?
  // Location
  storageFarmId    String?
  notes            String?
  emergencyJustification String?
  createdBy        String
  deletedAt        DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  organization  Organization          @relation(fields: [organizationId], references: [id])
  purchaseOrder PurchaseOrder?        @relation(fields: [purchaseOrderId], references: [id])
  supplier      Supplier              @relation(fields: [supplierId], references: [id])
  creator       User                  @relation("GRCreator", fields: [createdBy], references: [id])
  items         GoodsReceiptItem[]
  divergences   GoodsReceiptDivergence[]

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([purchaseOrderId])
  @@map("goods_receipts")
}

model GoodsReceiptItem {
  id                    String   @id @default(cuid())
  goodsReceiptId        String
  purchaseOrderItemId   String?
  productId             String?
  productName           String
  unitName              String
  orderedQty            Decimal  @db.Decimal(12, 3)
  invoiceQty            Decimal? @db.Decimal(12, 3)
  receivedQty           Decimal  @db.Decimal(12, 3)
  unitPrice             Decimal  @db.Decimal(12, 4)
  totalPrice            Decimal  @db.Decimal(14, 2)
  // Quality fields
  qualityVisualOk       Boolean?
  batchNumber           String?
  expirationDate        DateTime?
  qualityNotes          String?
  // Divergence flag
  hasDivergence         Boolean  @default(false)
  divergencePct         Decimal? @db.Decimal(6, 2)
  createdAt             DateTime @default(now())

  goodsReceipt GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)

  @@index([goodsReceiptId])
  @@map("goods_receipt_items")
}

model GoodsReceiptDivergence {
  id             String          @id @default(cuid())
  goodsReceiptId String
  itemId         String
  divergenceType DivergenceType
  action         DivergenceAction
  observation    String?
  photoUrl       String?
  photoFileName  String?
  createdAt      DateTime        @default(now())

  goodsReceipt GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)

  @@index([goodsReceiptId])
  @@map("goods_receipt_divergences")
}
```

**PurchaseOrder schema additions (migration):**

```prisma
// Add to PurchaseOrderItem model:
receivedQuantity Decimal @default(0) @db.Decimal(12, 3)

// Add to PurchaseOrder model:
goodsReceipts GoodsReceipt[]
```

**StockEntry schema additions:**

```prisma
// Add to StockEntry model:
goodsReceiptId String?   // FK for drill-down traceability
```

**Payable schema additions:**

```prisma
// Add to Payable model:
goodsReceiptId String?   // FK for drill-down traceability
```

---

## State of the Art

| Old Approach                     | Current Approach                                    | When Changed                     | Impact                                           |
| -------------------------------- | --------------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| CP created on PO approval        | CP only on ReceivingConfirmed                       | Phase 9/10 architecture decision | Prevents duplicate CPs on partial deliveries     |
| Single stock entry for all items | Per-receipt StockEntry (partial = separate entries) | Phase 10 design                  | Correct FEFO tracking per delivery               |
| Manual cross-reference links     | goodsReceiptId FK on StockEntry and Payable         | Phase 10                         | Navigable drill-down: CP -> GR -> OC -> SC -> RC |

**Deprecated/outdated:**

- None for this phase — all patterns are current project standards.

---

## Open Questions

1. **Payment terms format on PurchaseOrder**
   - What we know: PurchaseOrder has a `quotation.purchaseRequest` relation; payment terms string (e.g., "30/60/90") may be on QuotationProposal.paymentTerms (String?)
   - What's unclear: Is paymentTerms stored on PurchaseOrder itself or must it be fetched from QuotationProposal? The `PurchaseOrder` model does not have a `paymentTerms` field in the current schema.
   - Recommendation: On GoodsReceipt creation, fetch `paymentTerms` from the linked `QuotationProposal` via `quotation.suppliers[0].proposal.paymentTerms`. Parse "30/60/90" to derive installmentCount=3 and first due date = invoiceDate + 30 days. If no terms found, default installmentCount=1.

2. **StockEntry DRAFT support in createStockEntry**
   - What we know: `createStockEntry` hardcodes `status: 'CONFIRMED'` (line 583 of service).
   - What's unclear: Whether to add a parameter to the existing function or create a separate internal helper.
   - Recommendation: Add optional `status?: StockEntryStatusType` parameter with default `'CONFIRMED'`. Only the MERCADORIA_ANTECIPADA scenario passes `'DRAFT'`. This is a backward-compatible change.

3. **farmId derivation for Payable**
   - What we know: `CreatePayableInput.farmId` is required. GoodsReceipt is associated with a PurchaseOrder which traces back to a PurchaseRequest with a `farmId` field.
   - What's unclear: If the RC has multiple farm/cost center allocations, which farm to use as the Payable's primary farmId.
   - Recommendation: Use the `farmId` from the PurchaseRequest's `farmId` field (PurchaseRequest model has `farmId String` per Phase 8 schema). Fall back to the organization's primary farm if null. This is the same farm as the cost center allocation.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Framework          | Jest + supertest (backend)                                                           |
| Config file        | jest.config.js (apps/backend)                                                        |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern=goods-receipts --passWithNoTests` |
| Full suite command | `cd apps/backend && pnpm test`                                                       |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                                            | Test Type | Automated Command                                           | File Exists? |
| ------- | ------------------------------------------------------------------- | --------- | ----------------------------------------------------------- | ------------ |
| RECE-01 | Create GR for each receivingType                                    | unit      | `pnpm test -- --testPathPattern=goods-receipts.routes.spec` | Wave 0       |
| RECE-01 | State machine transitions (PENDENTE -> EM_CONFERENCIA -> CONFERIDO) | unit      | same                                                        | Wave 0       |
| RECE-01 | EMERGENCIAL without PO                                              | unit      | same                                                        | Wave 0       |
| RECE-01 | PARCIAL updates receivedQuantity and PO status                      | unit      | same                                                        | Wave 0       |
| RECE-02 | Register divergence with type, action, photo URL                    | unit      | same                                                        | Wave 0       |
| RECE-02 | Divergence >5% flag on item                                         | unit      | same                                                        | Wave 0       |
| RECE-03 | CONFIRMADO creates StockEntry (mocked)                              | unit      | same                                                        | Wave 0       |
| RECE-03 | MERCADORIA_ANTECIPADA creates DRAFT StockEntry                      | unit      | same                                                        | Wave 0       |
| FINC-01 | CONFIRMADO creates Payable (mocked)                                 | unit      | same                                                        | Wave 0       |
| FINC-01 | Installments derived from OC payment terms                          | unit      | same                                                        | Wave 0       |
| FINC-01 | Accessory expense creates separate Payable per supplier             | unit      | same                                                        | Wave 0       |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern=goods-receipts.routes.spec --passWithNoTests`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts` — covers all RECE/FINC scenarios
- [ ] Migration `20260410100000_add_goods_receipts` — schema prerequisite for all tests

_(Fixture factories will be needed for GoodsReceipt, GoodsReceiptItem, GoodsReceiptDivergence — use existing `fixtures/` pattern)_

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — state machine pattern, OC_VALID_TRANSITIONS
- Direct code inspection: `apps/backend/src/modules/stock-entries/stock-entries.service.ts` — createStockEntry signature, CONFIRMED default status (line 583)
- Direct code inspection: `apps/backend/src/modules/payables/payables.service.ts` — createPayable signature, installment generation
- Direct code inspection: `apps/backend/prisma/schema.prisma` — PurchaseOrder, StockEntry, Payable, Notification models
- Direct code inspection: `apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts` — multer diskStorage pattern
- Direct code inspection: `apps/backend/src/app.ts` — router registration order, last migration is `20260409100000_add_quotations_purchase_orders`

### Secondary (MEDIUM confidence)

- `.planning/phases/10-recebimento-de-mercadorias/10-CONTEXT.md` — all implementation decisions verified against existing codebase
- `.planning/STATE.md` decisions log — confirmed fire-and-forget notification pattern, key-remount pattern, VALID_TRANSITIONS pattern

### Tertiary (LOW confidence)

- None — all findings verified against actual source files.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed in package.json and source files
- Architecture: HIGH — patterns directly observed in Phase 7-9 modules; state machine, transaction, multer all confirmed
- Pitfalls: HIGH — createStockEntry CONFIRMED default confirmed by reading service source; Payable.farmId required confirmed by schema; Express route shadowing confirmed by STATE.md Phase 9 decision
- Open questions: MEDIUM — payment terms field location requires verification during implementation (not blocking)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase, 30-day window)
