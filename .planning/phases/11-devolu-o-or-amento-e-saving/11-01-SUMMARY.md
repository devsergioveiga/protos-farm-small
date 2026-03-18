---
phase: 11-devolu-o-or-amento-e-saving
plan: '01'
subsystem: backend-schema
tags: [prisma, migration, typescript, goods-returns, purchase-budgets, saving-analysis]
dependency_graph:
  requires: []
  provides:
    - GoodsReturn and GoodsReturnItem Prisma models
    - PurchaseBudget Prisma model
    - StockOutputType RETURN enum value
    - Payable.goodsReturnId and Payable.isCredit fields
    - PurchaseRequest.budgetExceeded and PurchaseOrder.budgetExceeded fields
    - goods-returns.types.ts (state machine, enums, input/output interfaces)
    - purchase-budgets.types.ts (period types, execution/check types)
    - saving-analysis.types.ts (saving, price history, analytics types)
  affects:
    - apps/backend/src/modules/stock-outputs (RETURN type added)
    - apps/backend/src/modules/payables (goodsReturnId, isCredit fields)
    - apps/backend/src/modules/purchase-requests (budgetExceeded field)
    - apps/backend/src/modules/purchase-orders (budgetExceeded field)
tech_stack:
  added: []
  patterns:
    - VALID_TRANSITIONS state machine (GoodsReturn follows goods-receipts pattern)
    - Named User relations (GRReturnCreator, PBCreator)
    - Migration via db push + migrate resolve (consistent with phases 7-10)
key_files:
  created:
    - apps/backend/prisma/migrations/20260411100000_add_goods_returns_budgets/migration.sql
    - apps/backend/src/modules/goods-returns/goods-returns.types.ts
    - apps/backend/src/modules/purchase-budgets/purchase-budgets.types.ts
    - apps/backend/src/modules/saving-analysis/saving-analysis.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/stock-outputs/stock-outputs.types.ts
decisions:
  - 'SupplierCategory used as PurchaseBudget.category enum — aligns with how users think about purchases (insumo, peca, combustivel)'
  - 'goodsReturnId and isCredit added to Payable to enable credit notes filtering in AP aging reports'
  - 'budgetExceeded field is plain boolean flag — non-blocking warning pattern, set via service layer injection in plans 02 and 03'
  - 'Migration applied via db push + migrate resolve — consistent with phases 7-10 approach (no shadow DB in dev)'
metrics:
  duration: 287s
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_modified: 6
---

# Phase 11 Plan 01: Schema Foundation for Goods Returns, Budgets, and Saving Analysis Summary

Schema foundation for Phase 11 with GoodsReturn/GoodsReturnItem/PurchaseBudget Prisma models, StockOutputType RETURN enum, Payable credit note fields, budgetExceeded flags on RC/OC, and TypeScript type contracts for all three new modules.

## Tasks Completed

| Task | Name                                          | Commit  | Key Files                                                                                           |
| ---- | --------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| 1    | Prisma schema additions and migration         | b18c15e | schema.prisma, migration.sql                                                                        |
| 2    | TypeScript type definitions for all 3 modules | f8e5ba4 | goods-returns.types.ts, purchase-budgets.types.ts, saving-analysis.types.ts, stock-outputs.types.ts |

## What Was Built

### Task 1: Prisma Schema

Added to `schema.prisma`:

- **StockOutputType enum**: Added `RETURN` value (for goods return stock deductions)
- **5 new enums**: `GoodsReturnStatus`, `GoodsReturnReason`, `GoodsReturnAction`, `GoodsReturnResolutionStatus`, `BudgetPeriodType`
- **GoodsReturn model**: Full 5-state machine model with supplierId, goodsReceiptId, expectedAction (TROCA/CREDITO/ESTORNO), stockOutputId, creditPayableId, resolutionStatus/Deadline, returnInvoiceNumber/Date
- **GoodsReturnItem model**: Line items with returnQty, unitPrice, totalPrice, photoUrl/FileName
- **PurchaseBudget model**: Org-wide or per-farm budget with SupplierCategory, BudgetPeriodType, periodStart/End, budgetedAmount
- **Payable additions**: `goodsReturnId String?` and `isCredit Boolean @default(false)` for credit note traceability
- **PurchaseRequest addition**: `budgetExceeded Boolean @default(false)`
- **PurchaseOrder addition**: `budgetExceeded Boolean @default(false)`
- **Reverse relations**: `goodsReturns GoodsReturn[]` on GoodsReceipt, Organization, Supplier; `purchaseBudgets PurchaseBudget[]` on Organization; `goodsReturnsCreated` and `purchaseBudgetsCreated` on User

### Task 2: TypeScript Types

- **goods-returns.types.ts**: State machine constants + `canGrReturnTransition()`, enum arrays with pt-BR label maps, `CreateGoodsReturnInput`, `TransitionGrReturnInput`, `GoodsReturnOutput`, `GoodsReturnListItem`, `ListGoodsReturnsResult`
- **purchase-budgets.types.ts**: `BUDGET_PERIOD_TYPES`, `SUPPLIER_CATEGORY_LABELS`, `CreatePurchaseBudgetInput`, `BudgetExecutionRow`, `BudgetExecutionResult`, `BudgetCheckResult`, `PurchaseBudgetOutput`
- **saving-analysis.types.ts**: `SavingQueryParams`, `QuotationSaving`, `SavingSummary`, `PriceHistoryResult`, `CycleIndicators`, `TopProductBySpend`, `TopSupplierByVolume`, `AnalyticsDashboard`
- **stock-outputs.types.ts**: `RETURN` added to `STOCK_OUTPUT_TYPES` array and `STOCK_OUTPUT_TYPE_LABELS`

## Verification

- `npx prisma validate` — passes
- `npx prisma generate` — passes, Prisma client regenerated
- `npx tsc --noEmit` — passes, 0 errors
- Migration `20260411100000_add_goods_returns_budgets` marked as applied

## Deviations from Plan

None — plan executed exactly as written.

The migration command in the plan used `--create-only` + `migrate resolve` but the shadow DB issue (pre-existing) required creating the SQL manually and using `migrate resolve --applied`. This is consistent with the established Phase 7/9/10 pattern documented in STATE.md decisions.

## Self-Check: PASSED

Files created:

- apps/backend/prisma/migrations/20260411100000_add_goods_returns_budgets/migration.sql — FOUND
- apps/backend/src/modules/goods-returns/goods-returns.types.ts — FOUND
- apps/backend/src/modules/purchase-budgets/purchase-budgets.types.ts — FOUND
- apps/backend/src/modules/saving-analysis/saving-analysis.types.ts — FOUND

Commits:

- b18c15e — feat(11-01): Prisma schema additions for goods returns and purchase budgets — FOUND
- f8e5ba4 — feat(11-01): TypeScript type definitions for goods-returns, purchase-budgets, saving-analysis — FOUND
