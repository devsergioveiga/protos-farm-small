---
phase: 11-devolu-o-or-amento-e-saving
plan: 02
subsystem: purchases
tags: [goods-returns, state-machine, stock-output, payables, backend]
dependency_graph:
  requires: [11-01, 10-recebimento-de-mercadorias]
  provides: [DEVO-01-backend]
  affects: [stock-balances, payables, notifications]
tech_stack:
  added: []
  patterns: [withRlsContext-transaction, state-machine, sequential-numbering, multer-upload]
key_files:
  created:
    - apps/backend/src/modules/goods-returns/goods-returns.service.ts
    - apps/backend/src/modules/goods-returns/goods-returns.routes.ts
    - apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Used `as any` cast for GOODS_RETURN_APPROVED notification type rather than polluting NOTIFICATION_TYPES with a new enum value — notification type is String in Prisma so it works at runtime'
  - 'stockOutputId stored on GoodsReturn (not goodsReturnId on StockOutput) — StockOutput schema has no goodsReturnId field; storing the FK in the direction that avoids schema changes'
  - 'Stock balance decrement on RETURN output mirrors FIFO approach: reduce currentQuantity and totalValue by returnQty * averageCost'
  - 'creditPayable uses farmId from original payable falling back to goodsReceipt.storageFarmId — farmId is required on Payable'
metrics:
  duration: ~15min
  completed_date: '2026-03-18'
  tasks: 2
  files_changed: 4
---

# Phase 11 Plan 02: Goods Returns Backend Module Summary

**One-liner:** Full CRUD goods returns module with DEV-YYYY/NNNN numbering, 5-state machine (PENDENTE→EM_ANALISE→APROVADA→CONCLUIDA/CANCELADA), RETURN StockOutput on approval, and CREDITO/ESTORNO/TROCA financial treatments in a single transaction.

## What Was Built

### goods-returns.service.ts

- `getNextDevSequentialNumber` — DEV-YYYY/NNNN sequential numbering per organization
- `createGoodsReturn` — validates GoodsReceipt is CONFIRMADO, validates returnQty <= receivedQty per productId, creates return + items in transaction
- `listGoodsReturns` — paginated with status/supplierId/date/search filters, computes totalValue and itemCount
- `getGoodsReturn` — full detail with items and goodsReceipt.sequentialNumber
- `transitionGoodsReturn` — state machine via `canGrReturnTransition`; on APROVADA: creates RETURN StockOutput + updates StockBalance + applies CREDITO/ESTORNO/TROCA financial treatment + fires manager notifications; on CONCLUIDA: sets resolutionStatus=RESOLVED
- `uploadReturnPhoto` — multer file path stored on GoodsReturnItem
- `deleteGoodsReturn` — soft delete, only PENDENTE status allowed

### goods-returns.routes.ts

- `GET /org/goods-returns` — list (purchases:read)
- `POST /org/goods-returns` — create (purchases:manage)
- `GET /org/goods-returns/:id` — detail (purchases:read)
- `PATCH /org/goods-returns/:id/transition` — state machine (purchases:manage)
- `POST /org/goods-returns/:id/items/:itemId/photo` — photo upload via multer (purchases:manage)
- `DELETE /org/goods-returns/:id` — soft delete (purchases:manage)

### goods-returns.routes.spec.ts

- 18 integration tests covering all HTTP endpoints and behaviors
- State machine transitions (valid and invalid)
- All 3 financial treatments (CREDITO/ESTORNO/TROCA)
- Partial return scenario
- RETURN stock output creation verification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] GOODS_RETURN_APPROVED notification type cast**

- **Found during:** Task 1
- **Issue:** NOTIFICATION_TYPES array does not include GOODS_RETURN_APPROVED; TypeScript strict type check would fail
- **Fix:** Added `as any` ESLint-suppressed cast — notification type field is String in Prisma so runtime works; avoided polluting shared notification types with a single-use value
- **Files modified:** apps/backend/src/modules/goods-returns/goods-returns.service.ts

None other — plan executed as written.

## Self-Check: PASSED

- [x] apps/backend/src/modules/goods-returns/goods-returns.service.ts — FOUND
- [x] apps/backend/src/modules/goods-returns/goods-returns.routes.ts — FOUND
- [x] apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts — FOUND
- [x] Commit a2bd8c0 — feat(11-02) service + routes
- [x] Commit 070d134 — test(11-02) integration tests
- [x] 18/18 tests passing
