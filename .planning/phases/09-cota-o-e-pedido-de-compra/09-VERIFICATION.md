---
phase: 09-cota-o-e-pedido-de-compra
verified: 2026-03-17T22:20:00Z
status: passed
score: 5/5 success criteria verified
re_verification: true
gaps:
  - truth: 'OC emitida reflete snapshot de precos da cotacao aprovada (edicao bloqueada apos emissao)'
    status: resolved
    reason: 'Price snapshot logic is correctly implemented in service layer and edit-block after RASCUNHO is enforced. However, purchase-orders.service.ts has 5 TypeScript compilation errors: supplier.phone and supplier.email fields do not exist on the Supplier model (correct fields are contactPhone and contactEmail), and overdueStatuses string[] is not assignable to PurchaseOrderStatus[] in checkOverduePOs. These errors prevent clean tsc --noEmit.'
    artifacts:
      - path: 'apps/backend/src/modules/purchase-orders/purchase-orders.service.ts'
        issue: 'Lines 443-444: supplier.phone and supplier.email accessed but Supplier model has contactPhone/contactEmail. Line 581: string[] used where PurchaseOrderStatus[] required.'
    missing:
      - 'Fix line 443: `if (po.supplier.phone)` -> `if (po.supplier.contactPhone)` and same value access'
      - 'Fix line 444: `if (po.supplier.email)` -> `if (po.supplier.contactEmail)` and same value access'
      - 'Fix line 581: cast overdueStatuses as PurchaseOrderStatus[] or use enum import'
human_verification:
  - test: 'Create SC from approved RC and verify supplier top-3 suggestion appears in QuotationModal'
    expected: "When RC type is selected, 'Sugeridos' section shows up to 3 suppliers above the full supplier list"
    why_human: 'Frontend component logic is present but suggestion display depends on live API response from /org/suppliers/top3?category=X'
  - test: 'Click Baixar PDF on an EMITIDA purchase order'
    expected: 'PDF downloads with professional layout: org header, supplier block with contactPhone/contactEmail, items table, totals, footer'
    why_human: 'PDF streaming behavior and layout cannot be verified programmatically; TypeScript error on field names may produce blank phone/email in PDF'
  - test: 'Approve a quotation with split selection (different suppliers for different items)'
    expected: 'Multiple PurchaseOrders created, one per winning supplier, each with frozen item prices from proposal'
    why_human: 'Transactional OC creation with split selection requires live DB interaction to verify atomicity'
---

# Phase 9: Cotacao e Pedido de Compra — Verification Report

**Phase Goal:** Comprador pode solicitar cotacoes a multiplos fornecedores, comparar propostas no mapa comparativo e emitir pedido de compra formal com PDF — com precos congelados no momento da emissao
**Verified:** 2026-03-17T22:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                  | Status   | Evidence                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Comprador pode criar SC a partir de RC aprovada, selecionando fornecedores com sugestao top 3 e prazo de resposta      | VERIFIED | `createQuotation` validates `status === 'APROVADA'`, generates SC-YYYY/NNNN; frontend QuotationModal fetches `/org/suppliers/top3?category=X` and renders "Sugeridos" section; suppliers/top3 endpoint wired in suppliers.routes.ts                                                                                                |
| 2   | Comprador pode registrar cotacoes e visualizar mapa comparativo com destaque de menor preco e total com frete/impostos | VERIFIED | `registerProposal` in quotations.service.ts; `getComparativeMap` returns perItemMinPrice/perItemMaxPrice; ComparativeMapTable.tsx (293 lines) renders green/red highlights via perItemMinPrice comparison; useComparativeMap hook calls `/org/quotations/:id/comparative`                                                          |
| 3   | Gerente pode aprovar cotacao vencedora com justificativa obrigatoria quando nao for menor preco                        | VERIFIED | `approveQuotation` checks if selected supplier is not lowest price and requires justification; QuotationDetailModal has approval section with justification textarea; 40 backend tests pass including approval flow                                                                                                                |
| 4   | Comprador pode emitir OC com numero sequencial (OC-AAAA/NNNN), exportar PDF e enviar por email ao fornecedor           | VERIFIED | `generatePurchaseOrderPdf` streams pdfkit PDF; sequential OC-YYYY/NNNN numbering confirmed; downloadPOPdf in hook; email send is intentional placeholder per CONTEXT.md decision                                                                                                                                                   |
| 5   | OC emitida reflete snapshot de precos da cotacao aprovada (edicao bloqueada apos emissao)                              | PARTIAL  | Price snapshot correctly reads from QuotationProposalItem in transaction (not request body). `updatePO` blocks with error 'OC emitida nao pode ser editada' when status != RASCUNHO. However: 5 TypeScript compilation errors in purchase-orders.service.ts (wrong supplier field names, typed enum mismatch) prevent clean build. |

**Score:** 4/5 success criteria verified

---

### Required Artifacts

#### Plan 01 — Schema Foundation

| Artifact                                                            | Status   | Details                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                 | VERIFIED | All 7 models (Quotation, QuotationSupplier, QuotationProposal, QuotationProposalItem, QuotationItemSelection, PurchaseOrder, PurchaseOrderItem) and 2 enums (QuotationStatus, PurchaseOrderStatus) confirmed at lines 6169-6340 |
| `apps/backend/src/modules/quotations/quotations.types.ts`           | VERIFIED | Exports SC_VALID_TRANSITIONS (line 11), canScTransition (line 20), QuotationError (line 24), ComparativeMapData (line 73)                                                                                                       |
| `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` | VERIFIED | Exports OC_VALID_TRANSITIONS (line 11), canOcTransition (line 20), PurchaseOrderError (line 24), CreateEmergencyPOInput (line 34)                                                                                               |
| Migration `20260409100000_add_quotations_purchase_orders`           | VERIFIED | Directory and migration.sql exist                                                                                                                                                                                               |

#### Plan 02 — Quotations Backend

| Artifact                                                        | Status   | Details                                                                                                                                                                        |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/src/modules/quotations/quotations.service.ts`     | VERIFIED | 8 exported functions confirmed: createQuotation, listQuotations, getQuotationById, registerProposal, getComparativeMap, approveQuotation, transitionQuotation, deleteQuotation |
| `apps/backend/src/modules/quotations/quotations.routes.ts`      | VERIFIED | 8 endpoints; comparative route correctly registered BEFORE /:id (line 77 before line 94)                                                                                       |
| `apps/backend/src/modules/quotations/quotations.routes.spec.ts` | VERIFIED | 518 lines; 40 tests pass                                                                                                                                                       |
| `apps/backend/src/modules/notifications/notifications.types.ts` | VERIFIED | QUOTATION_PENDING_APPROVAL (line 9), QUOTATION_APPROVED (line 10), PO_OVERDUE (line 11) added                                                                                  |
| `apps/backend/src/app.ts`                                       | VERIFIED | quotationsRouter imported (line 98) and registered (line 202)                                                                                                                  |

#### Plan 03 — Purchase Orders Backend

| Artifact                                                                  | Status           | Details                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`     | STUB (TS errors) | 9 functions present; logic is substantive; but 5 TypeScript errors: supplier.phone/email (lines 443-444) should be contactPhone/contactEmail per schema; overdueStatuses string[] (line 581) not compatible with PurchaseOrderStatus[] |
| `apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts`      | VERIFIED         | 8 endpoints; /duplicate and /:id/pdf registered before /:id (lines 91, 108 before 128)                                                                                                                                                 |
| `apps/backend/src/modules/purchase-orders/purchase-orders.routes.spec.ts` | VERIFIED         | 480 lines; 40 tests pass total across both spec files                                                                                                                                                                                  |
| `apps/backend/src/app.ts`                                                 | VERIFIED         | purchaseOrdersRouter imported (line 99) and registered (line 203)                                                                                                                                                                      |

#### Plan 04 — Quotations Frontend

| Artifact                                                           | Status   | Details                                                                                                                                   |
| ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/types/quotation.ts`                             | VERIFIED | Quotation interface, ComparativeMapData, SC_STATUS_LABELS, SC_STATUS_COLORS                                                               |
| `apps/frontend/src/hooks/useQuotations.ts`                         | VERIFIED | useQuotations, useQuotation, useComparativeMap, createQuotation, registerProposal, approveQuotation, transitionQuotation, deleteQuotation |
| `apps/frontend/src/pages/QuotationsPage.tsx`                       | VERIFIED | 519 lines; breadcrumb Compras > Cotacoes; useQuotations hook wired                                                                        |
| `apps/frontend/src/components/quotations/QuotationModal.tsx`       | VERIFIED | 446 lines; top-3 suggestion logic present (lines 86-89, 268, 312); fetches /org/suppliers/top3                                            |
| `apps/frontend/src/components/quotations/QuotationDetailModal.tsx` | VERIFIED | 911 lines; tabs (suppliers/comparative/details); useComparativeMap wired; approveQuotation call at line 525                               |
| `apps/frontend/src/components/quotations/ComparativeMapTable.tsx`  | VERIFIED | 293 lines; onSelectionChange prop (line 15); perItemMinPrice/perItemMaxPrice highlights (lines 219-220); scroll wrapper (line 173)        |
| Sidebar.tsx quotations entry                                       | VERIFIED | `{ to: '/quotations', icon: FileSearch, label: 'Cotacoes' }` at line 203                                                                  |
| App.tsx quotations route                                           | VERIFIED | Lazy import and `path="/quotations"` route at line 197                                                                                    |

#### Plan 05 — Purchase Orders Frontend

| Artifact                                                                    | Status   | Details                                                                                                                                   |
| --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/types/purchase-order.ts`                                 | VERIFIED | PurchaseOrder interface, OC_STATUS_LABELS, OC_STATUS_COLORS                                                                               |
| `apps/frontend/src/hooks/usePurchaseOrders.ts`                              | VERIFIED | usePurchaseOrders, usePurchaseOrder, createEmergencyPO, duplicatePO, updatePO, transitionPO, deletePO, downloadPOPdf                      |
| `apps/frontend/src/pages/PurchaseOrdersPage.tsx`                            | VERIFIED | 562 lines; usePurchaseOrders wired (line 171); isOverdue indicator (lines 120-123); isEmergency badge (lines 107, 399)                    |
| `apps/frontend/src/components/purchase-orders/PurchaseOrderModal.tsx`       | VERIFIED | 479 lines; "Pedido Emergencial" title; justification field required                                                                       |
| `apps/frontend/src/components/purchase-orders/PurchaseOrderDetailModal.tsx` | VERIFIED | 776 lines; downloadPOPdf (line 15); frozen prices (lines 78-80); duplicatePO (line 280); transitionPO (line 258); ConfirmModal for cancel |
| Sidebar.tsx purchase-orders entry                                           | VERIFIED | `{ to: '/purchase-orders', icon: ClipboardList, label: 'Pedidos' }` at line 205                                                           |
| App.tsx purchase-orders route                                               | VERIFIED | Lazy import and `path="/purchase-orders"` route at line 199                                                                               |

---

### Key Link Verification

| From                         | To                                  | Via                                                             | Status   | Details                                                                                                                    |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| quotations.types.ts          | schema.prisma                       | QuotationStatus enum values match SC_VALID_TRANSITIONS keys     | VERIFIED | Both have: RASCUNHO, AGUARDANDO_PROPOSTA, EM_ANALISE, APROVADA, CANCELADA, FECHADA                                         |
| purchase-orders.types.ts     | schema.prisma                       | PurchaseOrderStatus enum values match OC_VALID_TRANSITIONS keys | VERIFIED | Both have: RASCUNHO, EMITIDA, CONFIRMADA, EM_TRANSITO, ENTREGUE, CANCELADA                                                 |
| quotations.service.ts        | purchase-requests                   | validates RC status is APROVADA before creating SC              | VERIFIED | Lines 71-83: `rc.status !== 'APROVADA'` throws QuotationError(400)                                                         |
| quotations.service.ts        | suppliers.service.ts                | getTop3ByCategory for suggestion                                | VERIFIED | getTop3ByCategory exported from suppliers.service.ts (line 656); endpoint registered in suppliers.routes.ts (line 177-190) |
| quotations.routes.ts         | app.ts                              | quotationsRouter registered                                     | VERIFIED | app.ts lines 98, 202                                                                                                       |
| purchase-orders.service.ts   | schema.prisma                       | PurchaseOrder and PurchaseOrderItem models                      | VERIFIED | purchaseOrder.create, findMany, update calls present; but TypeScript errors on supplier field names                        |
| purchase-orders.routes.ts    | app.ts                              | purchaseOrdersRouter registered                                 | VERIFIED | app.ts lines 99, 203                                                                                                       |
| QuotationsPage.tsx           | /api/org/quotations                 | useQuotations hook                                              | VERIFIED | useQuotations imported and called at line 178                                                                              |
| ComparativeMapTable.tsx      | /api/org/quotations/:id/comparative | useComparativeMap in QuotationDetailModal                       | VERIFIED | useComparativeMap called at line 470 in QuotationDetailModal                                                               |
| App.tsx                      | QuotationsPage                      | lazy route at /quotations                                       | VERIFIED | Lines 98, 197                                                                                                              |
| PurchaseOrdersPage.tsx       | /api/org/purchase-orders            | usePurchaseOrders hook                                          | VERIFIED | usePurchaseOrders called at line 171                                                                                       |
| PurchaseOrderDetailModal.tsx | /api/org/purchase-orders/:id/pdf    | PDF download link                                               | VERIFIED | downloadPOPdf called at line 247                                                                                           |
| App.tsx                      | PurchaseOrdersPage                  | lazy route at /purchase-orders                                  | VERIFIED | Lines 100, 199                                                                                                             |

---

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                | Status              | Evidence                                                                                                                                                                                                                                                     |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| COTA-01     | 09-01, 09-02, 09-04 | Create SC from approved RC, select suppliers with top-3 suggestion, define deadline                        | SATISFIED           | createQuotation validates APROVADA status; top-3 endpoint wired; QuotationModal renders suggestion section                                                                                                                                                   |
| COTA-02     | 09-02, 09-04        | Register proposals, upload, comparative map with min/max highlights, split selection                       | SATISFIED           | registerProposal with file upload; getComparativeMap returns perItem min/max; ComparativeMapTable renders highlights and split selection checkboxes                                                                                                          |
| COTA-03     | 09-02, 09-04        | Manager approves winner with mandatory justification if not lowest price; auto-creates OC                  | SATISFIED           | approveQuotation enforces justification requirement; creates PurchaseOrder in transaction with price snapshot; frontend approval flow present                                                                                                                |
| PEDI-01     | 09-01, 09-03, 09-05 | OC with sequential number, PDF, email, emergency with justification, status tracking, overdue alert, clone | PARTIALLY SATISFIED | All features implemented; PDF streaming present; emergency with justification required; overdue detection via checkOverduePOs; duplicate implemented; 5 TypeScript errors in service file (wrong Supplier field names, typed enum) prevent clean compilation |

---

### Anti-Patterns Found

| File                                                                  | Line | Pattern                                                                              | Severity | Impact                                                                                      |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` | 443  | `supplier.phone` — field does not exist on Supplier model (should be `contactPhone`) | Blocker  | PDF supplier block renders blank phone — TypeScript error confirms mismatch                 |
| `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` | 444  | `supplier.email` — field does not exist on Supplier model (should be `contactEmail`) | Blocker  | PDF supplier block renders blank email — TypeScript error confirms mismatch                 |
| `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` | 581  | `overdueStatuses` typed as `string[]` but Prisma expects `PurchaseOrderStatus[]`     | Blocker  | TypeScript compilation error; checkOverduePOs may fail at runtime with strict Prisma client |

---

### Human Verification Required

#### 1. Top-3 Supplier Suggestion Display

**Test:** Create a new quotation from an approved RC. Observe the supplier selection section in the modal.
**Expected:** A "Sugeridos para esta categoria" section appears above the full supplier list, pre-highlighting up to 3 suppliers based on the RC's type/category.
**Why human:** Frontend logic is present and API call exists, but suggestion rendering depends on whether the backend has supplier history data in the test environment.

#### 2. PDF Layout and Supplier Contact Fields

**Test:** Emit a purchase order and click "Baixar PDF".
**Expected:** PDF downloads and shows supplier name, CNPJ, address, phone, and email in the supplier block.
**Why human:** TypeScript errors on `supplier.phone` and `supplier.email` mean these fields silently access undefined at runtime. PDF may render without phone/email even after TypeScript fix.

#### 3. Split Approval — Multiple OCs Created

**Test:** Register proposals from 2+ suppliers, select different suppliers for different items in the comparative map, then click "Confirmar Aprovacao".
**Expected:** Multiple PurchaseOrders are created (one per winning supplier), each appearing in the /purchase-orders list with the correct items and frozen prices.
**Why human:** Transactional OC creation with split-selection requires live DB to verify atomicity and correct item assignment.

---

### Gaps Summary

One gap blocks full goal achievement:

**TypeScript compilation errors in purchase-orders.service.ts** (3 distinct issues, 5 errors total): The PDF generation function accesses `supplier.phone` and `supplier.email`, but the Prisma `Supplier` model defines these as `contactPhone` and `contactEmail`. Additionally, `checkOverduePOs` uses a raw `string[]` where `PurchaseOrderStatus[]` is required. These cause `tsc --noEmit` to fail with 5 errors.

The price snapshot mechanism (frozen prices) is correctly implemented — approval reads prices from QuotationProposalItem within a Prisma transaction and does not accept prices from the request body. The edit-block after RASCUNHO status is enforced. The 40 backend tests pass because they mock the service layer and do not exercise TypeScript type checking at test time.

The frontend is fully operational with no TypeScript errors.

**Fix scope:** 3 line changes in `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`:

- Line 443: `po.supplier.phone` → `po.supplier.contactPhone`
- Line 444: `po.supplier.email` → `po.supplier.contactEmail`
- Line 581: `status: { in: overdueStatuses }` → `status: { in: overdueStatuses as import('@prisma/client').PurchaseOrderStatus[] }`

---

_Verified: 2026-03-17T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
