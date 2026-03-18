# Architecture Research

**Domain:** Procurement module integration into existing Protos Farm monolith
**Researched:** 2026-03-17
**Confidence:** HIGH — derived from direct analysis of existing codebase (schema, services, module patterns)

---

## Context: What Already Exists

This is a subsequent milestone. The v1.0 financial module is live. Key existing infrastructure that procurement reuses:

| Existing Component                                          | Relevance to Procurement                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `modules/payables/`                                         | Final output of procurement — receiving + NF generates CP automatically           |
| `modules/products/` + `modules/stock-entries/`              | Products catalog and stock write-up on receiving                                  |
| `modules/cost-centers/`                                     | Rateio obrigatório on CP gerado                                                   |
| `withRlsContext` / `RlsContext`                             | All new modules use same multitenancy pattern                                     |
| `Money` factory (decimal.js)                                | All monetary fields use this — no raw floats                                      |
| `generateInstallments` + `validateCostCenterItems` (shared) | CP generation from receiving uses these same helpers                              |
| `Payable.originType` + `Payable.originId` fields            | Already stubbed in schema for exactly this integration — `originType: 'PURCHASE'` |
| `StockEntry.supplierName` (string)                          | Currently a free-text field — procurement replaces this with `supplierId` FK      |
| RBAC `RolePermission` (`module` + `action` columns)         | New permissions follow same pattern                                               |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                          │
│                                                                      │
│  Sidebar group "COMPRAS"                                             │
│  ┌──────────────┐  ┌───────────────────────────────────────────────┐│
│  │ Fornecedores │  │ Pages                  │ Modals               ││
│  │ Requisições  │  │ SuppliersPage          │ SupplierModal        ││
│  │ Cotações     │  │ RequisitionsPage       │ RequisitionModal     ││
│  │ Pedidos      │  │ QuotationsPage         │ QuotationModal       ││
│  │ Recebimentos │  │ PurchaseOrdersPage     │ PurchaseOrderModal   ││
│  │ Devoluções   │  │ GoodsReceiptsPage      │ GoodsReceiptModal    ││
│  │ Orçamento    │  │ ReturnsPage            │ ReturnModal          ││
│  │ Dashboard    │  │ PurchaseBudgetPage     │ ApprovalModal        ││
│  │              │  │ PurchaseDashboardPage  │                      ││
│  └──────────────┘  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                          │ HTTP REST JSON
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express 5)                            │
│                                                                      │
│  NEW MODULES (procurement domain):                                   │
│  suppliers → purchase-requisitions → purchase-quotations             │
│           → purchase-orders → goods-receipts → purchase-returns      │
│           → purchase-budget → purchase-dashboard                     │
│                                                                      │
│  MODIFIED MODULES (integration points):                              │
│  payables (+ from-purchase route)                                    │
│  stock-entries (+ supplierId FK, + purchaseOrderId FK)              │
│                                                                      │
│  UNCHANGED MODULES (read-only consumers):                            │
│  cost-centers, products, measurement-units, farms, producers         │
│                                                                      │
│                    withRlsContext (Prisma 7)                         │
│                                                                      │
│  NEW TABLES:                                                         │
│  suppliers, purchase_requisitions, purchase_requisition_items        │
│  approval_steps, quotation_requests, quotation_responses             │
│  purchase_orders, purchase_order_items                               │
│  goods_receipts, goods_receipt_items, purchase_returns               │
│  purchase_return_items, purchase_budget_lines                        │
│                                                                      │
│  MODIFIED TABLES:                                                    │
│  stock_entries (+supplierId, +purchaseOrderId, +goodsReceiptId)     │
│  payables (+supplierId FK) — originType='PURCHASE' already exists   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Module Inventory

### New Backend Modules (all follow `modules/{domain}/routes+service+types` pattern)

| Module                   | Key Responsibility                                                      | New Prisma Models                                                |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `suppliers/`             | CRUD fornecedores com dados fiscais, avaliação, CNPJ/CPF                | `Supplier`, `SupplierEvaluation`                                 |
| `purchase-requisitions/` | Criação e gestão de RCs, state machine de aprovação                     | `PurchaseRequisition`, `PurchaseRequisitionItem`, `ApprovalStep` |
| `purchase-quotations/`   | Solicitação de cotações, registro de respostas, mapa comparativo        | `QuotationRequest`, `QuotationResponse`, `QuotationResponseItem` |
| `purchase-orders/`       | Emissão de OC, PDF, envio por email, vinculação com cotação             | `PurchaseOrder`, `PurchaseOrderItem`                             |
| `goods-receipts/`        | Recebimento físico + conferência + 6 cenários NF + disparo CP+estoque   | `GoodsReceipt`, `GoodsReceiptItem`                               |
| `purchase-returns/`      | Devolução e troca, estorno de estoque, emissão de CR ou nota de crédito | `PurchaseReturn`, `PurchaseReturnItem`                           |
| `purchase-budget/`       | Orçamento anual por categoria/CC, controle de comprometimento           | `PurchaseBudgetLine`                                             |
| `purchase-dashboard/`    | KPIs agregados: saving, lead time, top fornecedores, orçamento x real   | read-only (no new models)                                        |

### Modified Existing Modules

| Module           | Change                                                                                      | Reason                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `stock-entries/` | Add `supplierId`, `purchaseOrderId`, `goodsReceiptId` FKs to `StockEntry` model and service | Link estoque ao ciclo completo de compras                                                |
| `payables/`      | Add `supplierId` FK to `Payable`; expose `POST /api/payables/from-purchase` route           | Enable automatic CP generation from receiving; `originType='PURCHASE'` already in schema |
| Schema enums     | Add `PayableCategory.COMPRA` or reuse `INPUTS` — verify with spec                           | Categorização automática do CP gerado                                                    |

---

## Key Data Models

### Supplier

```
Supplier
├── id (uuid)
├── organizationId → Organization (RLS)
├── type: 'PF' | 'PJ'
├── document: string (CPF/CNPJ — unique per org)
├── tradeName: string
├── legalName: string?
├── email, phone, address (JSON)
├── bankData: Json? (for payments via CNAB)
├── status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
├── creditLimit: Decimal?
├── paymentTermDays: Int? (prazo padrão)
├── notes: string?
├── evaluations → SupplierEvaluation[]
└── @@index([organizationId, document])
```

### Purchase Requisition (state machine)

```
PurchaseRequisition
├── id, organizationId, farmId
├── requestedBy → User
├── status: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED | CONVERTED
├── requestedDate, neededByDate
├── type: 'INPUTS' | 'SERVICES' | 'ASSETS' | 'MAINTENANCE'
├── totalEstimatedAmount: Decimal
├── approvalThreshold: Decimal (valor que triggera aprovação)
├── costCenterItems → RequisitionCostCenterItem[] (rateio por CC)
├── items → PurchaseRequisitionItem[]
└── approvalSteps → ApprovalStep[]

PurchaseRequisitionItem
├── productId → Product (existing)
├── quantity, unitId → MeasurementUnit (existing)
├── estimatedUnitPrice: Decimal?
└── notes: string?

ApprovalStep
├── requisitionId → PurchaseRequisition
├── approverId → User
├── order: Int (sequência)
├── status: 'PENDING' | 'APPROVED' | 'REJECTED'
├── decidedAt: DateTime?
└── comment: string?
```

### Quotation Request + Response

```
QuotationRequest
├── id, organizationId, farmId
├── requisitionId → PurchaseRequisition
├── supplierId → Supplier
├── status: 'SENT' | 'RESPONDED' | 'DECLINED' | 'EXPIRED'
├── sentAt, responseDeadline, respondedAt
└── responses → QuotationResponse[]

QuotationResponse
├── quotationRequestId → QuotationRequest
├── totalAmount: Decimal
├── paymentTermDays: Int
├── deliveryDays: Int
├── validUntil: DateTime
└── items → QuotationResponseItem[]

QuotationResponseItem
├── productId → Product
├── quantity, unitId
├── unitPrice: Decimal
└── notes: string?
```

### Purchase Order

```
PurchaseOrder
├── id, organizationId, farmId
├── supplierId → Supplier
├── selectedQuotationResponseId → QuotationResponse?
├── status: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
├── orderNumber: String (sequential per org, for PDF)
├── expectedDeliveryDate: DateTime
├── paymentTermDays: Int
├── totalAmount: Decimal
├── pdfUrl: String? (generated PDF stored)
├── notes: string?
└── items → PurchaseOrderItem[]

PurchaseOrderItem
├── purchaseOrderId
├── productId → Product
├── quantity: Decimal, receivedQuantity: Decimal @default(0)
├── unitId → MeasurementUnit
├── unitPrice: Decimal
└── totalPrice: Decimal
```

### Goods Receipt (the integration hub)

```
GoodsReceipt
├── id, organizationId, farmId
├── purchaseOrderId → PurchaseOrder?  (can be null for emergency/spot purchases)
├── supplierId → Supplier
├── scenario: 'STANDARD' | 'ADVANCE_NF' | 'PARTIAL' | 'WITHOUT_NF' | 'EMERGENCY' | 'DEVOLUTION_EXCHANGE'
├── status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
├── receivedAt: DateTime
├── invoiceNumber: String?
├── invoiceDate: DateTime?
├── invoiceAmount: Decimal?
├── storageFarmId → Farm
├── storageLocation: String?
├── notes: String?
├── items → GoodsReceiptItem[]
│
│  — Generated on CONFIRM:
├── stockEntryId → StockEntry?  (created automatically)
└── payableId → Payable?        (created automatically when NF present)
```

### Purchase Return

```
PurchaseReturn
├── id, organizationId, farmId
├── goodsReceiptId → GoodsReceipt
├── supplierId → Supplier
├── reason: 'DEFECT' | 'WRONG_PRODUCT' | 'EXCESS' | 'QUALITY'
├── resolution: 'CREDIT_NOTE' | 'EXCHANGE' | 'REFUND'
├── status: 'PENDING' | 'CONFIRMED' | 'RESOLVED'
├── items → PurchaseReturnItem[]
│
│  — Generated on CONFIRM:
└── stockOutputId → StockOutput?  (reversal output created automatically)
```

---

## Critical Data Flow: GoodsReceipt Confirmation

This is the highest-value integration point — one action triggers writes to three existing systems.

```
POST /api/goods-receipts/:id/confirm
    ↓
goods-receipts.service.confirm(ctx, id)
    ↓
withRlsContext → single Prisma transaction:
    │
    ├── 1. Update GoodsReceipt.status = 'CONFIRMED'
    │
    ├── 2. Update PurchaseOrder.receivedQuantity per item
    │       → if all items fully received: PO.status = 'RECEIVED'
    │       → if partially: PO.status = 'PARTIALLY_RECEIVED'
    │
    ├── 3. Create StockEntry (reuse existing stock-entries logic)
    │       StockEntry.supplierId = receipt.supplierId
    │       StockEntry.purchaseOrderId = receipt.purchaseOrderId
    │       StockEntry.goodsReceiptId = receipt.id
    │       → triggers StockBalance update (existing FEFO logic)
    │
    └── 4. IF invoiceNumber present:
            Create Payable via payables.service.createFromPurchase():
              supplierId = receipt.supplierId
              supplierName = supplier.tradeName
              originType = 'PURCHASE'
              originId = receipt.id
              totalAmount = receipt.invoiceAmount
              category = 'INPUTS' (or new 'COMPRA')
              costCenterItems = copied from PurchaseOrder
              installmentCount derived from paymentTermDays
```

Key constraint: this entire flow runs inside `withRlsContext` as one transaction. If StockEntry creation fails, no CP is generated and no PO update occurs — atomic rollback.

---

## Approval Workflow Architecture

The approval workflow is new to this system. No existing approval pattern exists.

### Design: Threshold-Based Sequential Approval

```
PurchaseRequisition created (DRAFT)
    ↓ submit()
IF totalEstimatedAmount >= approvalThreshold:
    Status → PENDING_APPROVAL
    Generate ApprovalStep rows (one per required approver)
    based on ApprovalPolicy (stored per org in new table)
    ↓
Approver receives notification (in-app badge / email)
    ↓
approvalStep.approve() or .reject()
    ↓
IF all steps APPROVED: Requisition → APPROVED → can become QuotationRequest
IF any step REJECTED: Requisition → REJECTED
ELSE IF amount < threshold: skip approval → APPROVED immediately
```

### ApprovalPolicy model

```
ApprovalPolicy
├── id, organizationId
├── name: String
├── thresholdAmount: Decimal
├── approverIds: String[] (ordered list of User IDs)
└── isActive: Boolean
```

Store one policy per org to start. Future: multiple policies by type/category.

### Notification Strategy: In-App Badge (No External Service)

No email infrastructure exists. Build in-app notifications as a simple database table:

```
Notification
├── id, organizationId
├── userId → User (recipient)
├── type: 'APPROVAL_REQUIRED' | 'REQUISITION_APPROVED' | 'QUOTATION_RECEIVED' | 'ORDER_CONFIRMED' | 'GOODS_RECEIVED'
├── entityType: String (e.g. 'PurchaseRequisition')
├── entityId: String
├── message: String
├── readAt: DateTime?
└── createdAt: DateTime
```

Frontend: badge counter on Sidebar "Aprovações pendentes" via `GET /api/notifications/unread-count`. Deduplicate — same pattern as the sanitary calendar alerts already in the system.

---

## Frontend Architecture

### Page Structure (8 new pages)

```
apps/frontend/src/pages/
├── SuppliersPage.tsx            # CRUD fornecedores (tabbed: lista, avaliações)
├── RequisitionsPage.tsx         # Kanban ou lista RCs por status
├── QuotationsPage.tsx           # Mapa comparativo de cotações
├── PurchaseOrdersPage.tsx       # Lista OCs, PDF preview
├── GoodsReceiptsPage.tsx        # Recebimento por cenário (tabbed por status)
├── ReturnsPage.tsx              # Devoluções e trocas
├── PurchaseBudgetPage.tsx       # Orçamento anual + comprometimento por CC
└── PurchaseDashboardPage.tsx    # KPIs executivos + kanban resumido
```

### Component Structure

```
apps/frontend/src/components/
├── suppliers/
│   ├── SupplierModal.tsx         # Create/edit com abas: Dados / Bancários / Avaliação
│   └── SupplierImportModal.tsx   # Bulk import (reuse BulkImportModal pattern)
├── purchase-requisitions/
│   ├── RequisitionModal.tsx      # Create/edit RC com itens e CC
│   └── ApprovalModal.tsx         # Aprovar/rejeitar com comentário
├── purchase-quotations/
│   ├── QuotationRequestModal.tsx # Selecionar fornecedores e enviar
│   ├── QuotationResponseModal.tsx # Registrar resposta do fornecedor
│   └── QuotationComparisonCard.tsx # Mapa comparativo (tabela side-by-side)
├── purchase-orders/
│   ├── PurchaseOrderModal.tsx    # Create/edit OC
│   └── PurchaseOrderPdfPreview.tsx # Iframe ou link para PDF gerado
├── goods-receipts/
│   ├── GoodsReceiptModal.tsx     # Recebimento com seletor de cenário
│   └── GoodsReceiptScenariosGuide.tsx # Helper inline explicando os 6 cenários
└── purchase-returns/
    └── PurchaseReturnModal.tsx   # Devolução com motivo e resolução
```

### State Management: React Query (existing pattern)

Each page uses dedicated hooks following the established pattern:

```typescript
// hooks/useSuppliers.ts
export function useSuppliers(query: ListSuppliersQuery) {
  return useQuery({ queryKey: ['suppliers', query], queryFn: () => api.getSuppliers(query) });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
```

---

## Prisma Migration Strategy

New migrations follow the existing naming convention `20260{YYMMDDHHmmss}_{name}`:

| Migration                                      | Content                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `20260410100000_add_suppliers`                 | `Supplier`, `SupplierEvaluation`, `ApprovalPolicy`                               |
| `20260410200000_add_purchase_requisitions`     | `PurchaseRequisition`, `PurchaseRequisitionItem`, `ApprovalStep`, `Notification` |
| `20260410300000_add_purchase_quotations`       | `QuotationRequest`, `QuotationResponse`, `QuotationResponseItem`                 |
| `20260410400000_add_purchase_orders`           | `PurchaseOrder`, `PurchaseOrderItem`                                             |
| `20260410500000_add_goods_receipts`            | `GoodsReceipt`, `GoodsReceiptItem`                                               |
| `20260410600000_add_purchase_returns`          | `PurchaseReturn`, `PurchaseReturnItem`                                           |
| `20260410700000_add_purchase_budget`           | `PurchaseBudgetLine`                                                             |
| `20260410800000_modify_stock_entries_supplier` | `ADD COLUMN supplierId`, `purchaseOrderId`, `goodsReceiptId` to `stock_entries`  |
| `20260410900000_modify_payables_supplier`      | `ADD COLUMN supplierId` to `payables`, FK to `suppliers`                         |

Each migration is one logical change. Never combine unrelated models in a single migration file (existing convention confirmed by codebase analysis).

---

## Build Order (Dependency-Driven)

```
Step 1 — Foundation (no cross-domain deps)
  suppliers module
  → Supplier model, CRUD endpoints, evaluation sub-resource
  → No deps on other new modules

Step 2 — Depends on suppliers + products + measurement-units (all existing)
  purchase-requisitions module
  → PurchaseRequisition, ApprovalStep, ApprovalPolicy
  → Notification model (used by all subsequent modules)
  → In-app notification badge in frontend

Step 3 — Depends on purchase-requisitions + suppliers
  purchase-quotations module
  → QuotationRequest, QuotationResponse
  → Mapa comparativo UI

Step 4 — Depends on purchase-quotations + suppliers
  purchase-orders module
  → PurchaseOrder, PDF generation (pdfkit, already used by pesticide-prescriptions)
  → Email send (nodemailer or similar — NEW dependency, must be added)

Step 5 — Depends on purchase-orders + payables + stock-entries (INTEGRATION CORE)
  goods-receipts module
  → GoodsReceipt with 6 scenarios
  → Atomic transaction: StockEntry + Payable creation
  → Modify stock-entries and payables modules (add FKs + routes)

Step 6 — Depends on goods-receipts + stock-outputs (existing)
  purchase-returns module
  → PurchaseReturn triggers StockOutput reversal (existing module)

Step 7 — Depends on purchase-orders + cost-centers (existing)
  purchase-budget module
  → PurchaseBudgetLine tracks committed vs actual per CC

Step 8 — Pure aggregation (read-only, depends on all above)
  purchase-dashboard module
  → KPIs: saving, lead time, top suppliers, budget vs actual
  → Kanban view (reads status from requisitions + orders + receipts)
```

---

## Integration Points with Existing Modules

### Reads (procurement reads existing data, no modification to existing modules)

| Existing Module      | What Procurement Reads                                 |
| -------------------- | ------------------------------------------------------ |
| `products/`          | Product catalog for requisition and order items        |
| `measurement-units/` | Units for quantities on items                          |
| `cost-centers/`      | CC allocation on requisitions → copied to generated CP |
| `farms/`             | Storage farm on goods receipt                          |
| `producers/`         | Producer linked to farm (for CP producerId)            |

### Writes to Existing Modules (the integration boundary)

| Existing Module  | Modification                                                              | Trigger                                 |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `stock-entries/` | GoodsReceipt.confirm() creates a `StockEntry` inside the same transaction | Goods receipt confirmation              |
| `payables/`      | GoodsReceipt.confirm() calls `createFromPurchase()` when NF present       | Goods receipt confirmation with invoice |
| `stock-outputs/` | PurchaseReturn.confirm() creates a `StockOutput` (reversal)               | Return confirmation                     |

### New permissions to add to RBAC

```
module: 'suppliers',    action: 'read' | 'create' | 'update' | 'delete'
module: 'requisitions', action: 'read' | 'create' | 'update' | 'approve'
module: 'quotations',   action: 'read' | 'create' | 'update'
module: 'purchase-orders', action: 'read' | 'create' | 'update' | 'send'
module: 'goods-receipts',  action: 'read' | 'create' | 'confirm'
module: 'purchase-returns', action: 'read' | 'create' | 'confirm'
module: 'purchase-budget',  action: 'read' | 'create' | 'update'
```

---

## Architectural Patterns

### Pattern 1: Atomic Multi-Domain Write (GoodsReceipt Confirmation)

**What:** GoodsReceipt.confirm() atomically writes to three tables owned by different domain modules (GoodsReceipt, StockEntry, Payable) in a single `withRlsContext` transaction.

**When to use:** Any procurement action that must update inventory and finance simultaneously.

**Trade-offs:** Transaction scope is wider than usual. Acceptable given the write volume of an agricultural system (not high-frequency). The alternative — eventual consistency via events — is unnecessary complexity for this scale.

```typescript
// goods-receipts.service.ts (pseudocode)
async function confirmReceipt(ctx: RlsContext, receiptId: string): Promise<GoodsReceiptOutput> {
  return withRlsContext(ctx, async (tx) => {
    const receipt = await tx.goodsReceipt.findUniqueOrThrow({ where: { id: receiptId } });

    // 1. Update receipt status
    await tx.goodsReceipt.update({ where: { id: receiptId }, data: { status: 'CONFIRMED' } });

    // 2. Create StockEntry (calls stock-entries domain logic via shared helper)
    const stockEntry = await createStockEntryFromReceipt(tx, ctx, receipt);

    // 3. Update PurchaseOrder received quantities
    await updatePurchaseOrderProgress(tx, receipt);

    // 4. Generate Payable if NF is present
    if (receipt.invoiceNumber) {
      await createPayableFromReceipt(tx, ctx, receipt);
    }

    return toGoodsReceiptOutput(receipt);
  });
}
```

### Pattern 2: State Machine via Status Column + Guard Functions

**What:** Each procurement entity (Requisition, QuotationRequest, PurchaseOrder, GoodsReceipt) uses a `status` enum column with explicit transition guards at the service layer — no separate state machine library.

**When to use:** All procurement entities with lifecycle transitions.

**Trade-offs:** Simple and consistent with existing modules (StockEntry, Payable, Check all use this pattern). Adds a guard function per transition rather than a state machine library. Acceptable given the bounded complexity.

```typescript
function assertCanSubmit(requisition: PurchaseRequisition) {
  if (requisition.status !== 'DRAFT') {
    throw new RequisitionError('Só é possível submeter requisições em rascunho', 400);
  }
}
```

### Pattern 3: PDF Generation via pdfkit (existing precedent)

**What:** Purchase order PDF generated server-side using `pdfkit`, already used by `pesticide-prescriptions` module. No new dependency — reuse same approach.

**When to use:** Purchase order PDF generation and download endpoint.

**Trade-offs:** Synchronous generation acceptable for single-page PDFs. For bulk export, consider streaming with `res.pipe()`.

### Pattern 4: Supplier as First-Class Entity (not free-text)

**What:** `Supplier` is a proper entity with its own CRUD, not a `supplierName: String` field like in the current `Payable` and `StockEntry` models. Both existing models get a `supplierId` FK added — `supplierName` becomes denormalized cache.

**When to use:** All new procurement documents reference `supplierId`. Legacy data (payables created before procurement module) keeps `supplierName` as-is — `supplierId` nullable.

**Trade-offs:** Migration is additive (nullable FK). No backfill needed. Historical payables without a supplier entity work fine.

---

## Anti-Patterns

### Anti-Pattern 1: Separate Transactions for Stock + Payable Creation

**What people do:** GoodsReceipt confirmation triggers stock entry creation via one HTTP call and payable generation via a second HTTP call.

**Why it's wrong:** If the second call fails, stock has been updated but no CP exists — the company received goods with no financial obligation recorded. Impossible to detect without audit trail inspection.

**Do this instead:** Single `withRlsContext` transaction. Both StockEntry and Payable creation happen atomically or not at all.

### Anti-Pattern 2: Building Approval Workflow as Generic Engine

**What people do:** Build a configurable workflow engine (nodes, edges, conditions) to handle all possible approval scenarios.

**Why it's wrong:** Massive over-engineering for a farm management system. The spec says "alçada por valor e tipo" — a simple ordered list of approvers with a threshold is sufficient.

**Do this instead:** `ApprovalPolicy` with `thresholdAmount` and an ordered `approverIds` array. Generate `ApprovalStep` rows on submission. Sequential approval via step `order`. Covers 95% of real-world farm procurement needs.

### Anti-Pattern 3: Requisition Items Coupled to Physical Catalog

**What people do:** Require every requisition item to reference a `productId` from the products catalog.

**Why it's wrong:** Field workers creating emergency requisitions may not know the exact product SKU. Procurement teams create the supplier relationship and formal order later.

**Do this instead:** `productId` nullable on `PurchaseRequisitionItem`; allow free-text `description` as fallback. Validation: either `productId` OR `description` required, not both. PurchaseOrderItem can reference product directly.

### Anti-Pattern 4: Storing PDF Binary in Database

**What people do:** Save generated PDF bytes as `bytea` in PostgreSQL.

**Why it's wrong:** Bloats the database, makes backups slow, and complicates streaming.

**Do this instead:** Generate PDF on request (synchronous, not pre-generated), stream directly to response. Follow `pesticide-prescriptions` precedent exactly:

```typescript
router.get('/:id/pdf', authenticate, async (req, res) => {
  const pdfBuffer = await purchaseOrdersService.generatePdf(ctx, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="OC-${orderNumber}.pdf"`);
  res.send(pdfBuffer);
});
```

---

## Scaling Considerations

| Scale        | Architecture Adjustments                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-500 farms  | Current monolith architecture handles this with no changes                                                                                     |
| 500-5k farms | `purchase-dashboard` aggregation queries benefit from partial indexes on `status` + `organizationId`; add index on `goods_receipts.receivedAt` |
| 5k+ farms    | Materialized view for purchase KPIs (saving, lead time by supplier) refreshed every 15 minutes                                                 |

### Scaling Priorities

1. **First bottleneck:** `purchase-dashboard` KPI aggregation across all procurement tables — add composite indexes early, particularly `(organizationId, status, createdAt)` on `purchase_orders` and `goods_receipts`.
2. **Second bottleneck:** Quotation comparison query joining multiple `QuotationResponse` + items for large product catalogs — pre-aggregate on `QuotationResponse.confirm()`.

---

## Sources

- Direct codebase analysis: `apps/backend/prisma/schema.prisma` (5500+ lines)
- Existing payables module: `Payable.originType` + `Payable.originId` fields confirm integration interface was designed in advance
- Existing stock-entries module: `StockEntry.supplierName` (string) confirms supplier relationship exists but as denormalized text
- Existing pesticide-prescriptions module: PDF generation pattern with pdfkit
- Existing stock-outputs module: StockOutput pattern reused for purchase returns
- Existing bulk-import component: file import parse → preview → confirm pattern
- `withRlsContext` pattern: `apps/backend/src/database/rls.ts`
- PROJECT.md constraints: multitenancy RLS, CP auto-generation from receiving, web-only scope for v1.1

---

_Architecture research for: Procurement module integration into Protos Farm monolith_
_Researched: 2026-03-17_
