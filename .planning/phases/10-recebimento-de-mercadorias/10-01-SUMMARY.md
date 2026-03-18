---
phase: 10-recebimento-de-mercadorias
plan: '01'
subsystem: goods-receipts
tags: [prisma, schema, types, state-machine, migration]
dependency_graph:
  requires: []
  provides: [goods-receipts-schema, goods-receipts-types]
  affects: [purchase-orders, stock-entries, payables]
tech_stack:
  added: []
  patterns: [state-machine, prisma-cuid, db-push-migrate-resolve]
key_files:
  created:
    - apps/backend/prisma/migrations/20260410100000_add_goods_receipts/migration.sql
    - apps/backend/src/modules/goods-receipts/goods-receipts.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
key_decisions:
  - GoodsReceipt uses cuid() following Phase 9 PurchaseOrder pattern
  - goodsReceiptId FKs on StockEntry and Payable are plain String? (no Prisma relation) — avoids Prisma requiring reverse relations; service layer handles lookup
  - Migration applied via db push + migrate resolve (no shadow DB available)
metrics:
  duration: 229s
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_changed: 3
---

# Phase 10 Plan 01: Goods Receipts Schema and Types Summary

Prisma schema foundation and type contracts for goods-receipts module — 3 new models, 4 new enums, FK additions to PurchaseOrderItem/StockEntry/Payable, state machine enforcing PENDENTE->EM_CONFERENCIA->CONFERIDO->CONFIRMADO/REJEITADO.

## Tasks Completed

| #   | Name                                                              | Commit  | Files                        |
| --- | ----------------------------------------------------------------- | ------- | ---------------------------- |
| 1   | Prisma schema — 3 new models, 4 enums, FK additions, migration    | b2046d3 | schema.prisma, migration.sql |
| 2   | Type definitions — state machine, error class, input/output types | d4cb3d4 | goods-receipts.types.ts      |

## What Was Built

**Task 1 — Schema:**

- `GoodsReceiptStatus` enum: PENDENTE, EM_CONFERENCIA, CONFERIDO, CONFIRMADO, REJEITADO
- `ReceivingType` enum: STANDARD, NF_ANTECIPADA, MERCADORIA_ANTECIPADA, PARCIAL, NF_FRACIONADA, EMERGENCIAL
- `DivergenceType` enum: A_MAIS, A_MENOS, SUBSTITUIDO, DANIFICADO, ERRADO
- `DivergenceAction` enum: DEVOLVER, ACEITAR_COM_DESCONTO, REGISTRAR_PENDENCIA
- `GoodsReceipt` model with full lifecycle fields (timestamps, stockEntryId, payableId for traceability)
- `GoodsReceiptItem` model for line items with quality inspection fields
- `GoodsReceiptDivergence` model for recording discrepancies
- `receivedQuantity Decimal @default(0)` added to `PurchaseOrderItem`
- `goodsReceiptId String?` added to `StockEntry` and `Payable`
- Reverse relations added to Organization, Supplier, PurchaseOrder, User ("GRCreator")
- Migration 20260410100000_add_goods_receipts applied and marked

**Task 2 — Types:**

- `GR_VALID_TRANSITIONS` state machine map
- `canGrTransition(from, to)` guard function
- `GoodsReceiptError` custom error class with statusCode
- Label maps in pt-BR: `GR_STATUS_LABELS`, `RECEIVING_TYPE_LABELS`, `DIVERGENCE_TYPE_LABELS`, `DIVERGENCE_ACTION_LABELS`
- Input interfaces: `CreateGoodsReceiptInput`, `GoodsReceiptItemInput`, `GoodsReceiptDivergenceInput`, `TransitionGrInput`, `ListGoodsReceiptsQuery`
- Output interfaces: `GoodsReceiptOutput`, `GoodsReceiptItemOutput`, `GoodsReceiptDivergenceOutput`, `GoodsReceiptListItem`, `ListGoodsReceiptsResult`, `PendingDelivery`

## Decisions Made

1. **GoodsReceipt uses cuid()** — follows Phase 9 PurchaseOrder pattern for consistent ID format across the purchase flow
2. **goodsReceiptId FK as plain String? field** — on StockEntry and Payable avoids needing Prisma relation declarations in those models; service layer handles lookups directly
3. **Migration via db push + migrate resolve** — consistent with Phase 7/9 approach (no shadow DB available in dev environment)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/backend/prisma/schema.prisma` — contains all 3 models and 4 enums (verified lines 6346-6462)
- `apps/backend/prisma/migrations/20260410100000_add_goods_receipts/migration.sql` — exists
- `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — exists with all required exports
- Commits b2046d3 and d4cb3d4 verified present
- `npx prisma validate` exits 0
- `npx tsc --noEmit` exits 0
