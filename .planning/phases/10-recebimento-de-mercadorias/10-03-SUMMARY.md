---
phase: 10-recebimento-de-mercadorias
plan: '03'
subsystem: api
tags: [prisma, transactions, stock-entries, payables, purchase-orders, atomic]

# Dependency graph
requires:
  - phase: 10-recebimento-de-mercadorias
    provides: GoodsReceipt model + service + routes from Plans 01-02
  - phase: estoque-de-insumos
    provides: StockEntry model and createStockEntry service
  - phase: nucleo-ap-ar
    provides: Payable model + generateInstallments utility
provides:
  - confirmGoodsReceipt function in goods-receipts.service.ts — atomic StockEntry+Payable creation
  - PUT /org/goods-receipts/:id/confirm endpoint
  - Extended CreateStockEntryInput with optional initialStatus and goodsReceiptId
  - 29 total tests passing in goods-receipts.routes.spec.ts
affects:
  - 10-04 (frontend confirmation flow)
  - any downstream financial reporting relying on Payable+StockEntry cross-reference

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Inline tx.model.create inside withRlsContext to avoid nested transactions'
    - "parsePaymentTerms: '30/60/90' string -> installmentCount + firstDueDays"
    - 'Skip stock balance update for DRAFT StockEntry (MERCADORIA_ANTECIPADA scenario)'

key-files:
  created: []
  modified:
    - apps/backend/src/modules/goods-receipts/goods-receipts.service.ts
    - apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts
    - apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts
    - apps/backend/src/modules/stock-entries/stock-entries.service.ts
    - apps/backend/src/modules/stock-entries/stock-entries.types.ts

key-decisions:
  - 'Direct tx.stockEntry.create and tx.payable.create inside withRlsContext — never call wrapper functions that start their own transactions'
  - 'MERCADORIA_ANTECIPADA creates DRAFT StockEntry (no balance update) and null payableId'
  - 'NF_ANTECIPADA creates Payable but no StockEntry (goods not yet physically received)'
  - 'PO auto-transitions to ENTREGUE only when ALL items have receivedQuantity >= quantity after increment'
  - 'parsePaymentTerms falls back to 1 installment at 30 days when paymentTerms is null/absent'
  - 'farmId derived from PO->Quotation->PurchaseRequest chain; storageFarmId used as fallback'
  - 'Payable costCenterItem only created when costCenterId is available from PurchaseRequest'

patterns-established:
  - 'Atomic multi-model confirmation: withRlsContext with all inline tx.model.create calls'
  - 'Cross-reference pattern: StockEntry.goodsReceiptId + Payable.goodsReceiptId + Payable.originType/originId'

requirements-completed: [RECE-03, FINC-01]

# Metrics
duration: 20min
completed: 2026-03-18
---

# Phase 10 Plan 03: Atomic CONFERIDO->CONFIRMADO Transition Summary

**Atomic CONFERIDO->CONFIRMADO confirmation that creates StockEntry + Payable via inline tx calls in a single Prisma transaction, with PO delivery tracking, 6 receiving scenarios, and 29 passing tests.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-18T02:08:49Z
- **Completed:** 2026-03-18T02:30:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Implemented `confirmGoodsReceipt` — the integration hub that atomically ties goods-receipts to stock and finance modules
- Extended `CreateStockEntryInput` with `initialStatus` and `goodsReceiptId` (backward compatible, 48 existing tests still pass)
- Added `PUT /org/goods-receipts/:id/confirm` route with `purchases:manage` permission
- All 6 receiving scenarios handled: STANDARD, PARCIAL, NF_FRACIONADA, NF_ANTECIPADA, MERCADORIA_ANTECIPADA, EMERGENCIAL
- PO automatically transitions to ENTREGUE when 100% of items received (via Prisma increment)

## Task Commits

1. **Task 1: Extend createStockEntry with optional initialStatus and goodsReceiptId** - `005ceb5` (feat)
2. **Task 2: confirmGoodsReceipt — atomic StockEntry + Payable + PO tracking + tests** - `ee1e215` (feat)

## Files Created/Modified

- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — Added `confirmGoodsReceipt`, imported `Money` + `generateInstallments` + `canOcTransition`
- `apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts` — Added `PUT /:id/confirm` route before `/:id/transition`
- `apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts` — Added 10 new test cases (tests 18-27), 29 total
- `apps/backend/src/modules/stock-entries/stock-entries.service.ts` — Use `input.initialStatus ?? 'CONFIRMED'`, add `goodsReceiptId`, skip balance update for DRAFT
- `apps/backend/src/modules/stock-entries/stock-entries.types.ts` — Added `initialStatus?` and `goodsReceiptId?` to `CreateStockEntryInput`

## Decisions Made

- **Inline tx calls not wrapper functions:** `createStockEntry` and `createPayable` wrapper functions internally call `withRlsContext`, which starts a new nested transaction. We bypass them and call `tx.stockEntry.create` / `tx.payable.create` directly inside the outer `withRlsContext` for true atomicity.
- **MERCADORIA_ANTECIPADA gets DRAFT StockEntry:** Goods arrived without NF — stock entry is created but not confirmed so it doesn't update balances. When the NF arrives later and a matching GR is confirmed, balance updates then.
- **NF_ANTECIPADA creates Payable only:** NF exists but goods have not physically arrived. Financial obligation is recorded, stock is not touched.
- **PaymentTerms parsing:** `"30/60/90"` splits on `/` to get `[30, 60, 90]` → 3 installments, first due in 30 days. `"A vista"` or null → 1 installment at 30 days default.
- **No costCenterItem if costCenterId unavailable:** For EMERGENCIAL receipts without a PurchaseRequest chain, the Payable is still created but without a cost center item (optional field in the schema).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Skip stock balance update for DRAFT entries in createStockEntry**

- **Found during:** Task 1 (extending createStockEntry)
- **Issue:** The plan specified adding `initialStatus` to control DRAFT vs CONFIRMED, but the existing `updateStockBalances` call needed to be guarded to not execute for DRAFT entries (otherwise MERCADORIA_ANTECIPADA would incorrectly update balances)
- **Fix:** Added `if ((input.initialStatus ?? 'CONFIRMED') !== 'DRAFT')` guard around the `updateStockBalances` call
- **Files modified:** apps/backend/src/modules/stock-entries/stock-entries.service.ts
- **Verification:** 48 stock-entries tests still pass
- **Committed in:** 005ceb5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Fix essential for correctness. No scope creep.

## Issues Encountered

None — implementation proceeded as planned with one auto-fix for balance update guard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend confirmation flow complete (Plans 01-03 done)
- Plan 04 (frontend) can now wire the confirm button to `PUT /org/goods-receipts/:id/confirm`
- RECE-03 and FINC-01 requirements satisfied
- Future: When MERCADORIA_ANTECIPADA NF arrives, a separate flow needs to upgrade the DRAFT StockEntry to CONFIRMED and create the Payable (deferred to v1.2)

---

_Phase: 10-recebimento-de-mercadorias_
_Completed: 2026-03-18_
