---
phase: 05-concilia-o-e-fluxo-de-caixa
plan: '03'
subsystem: cashflow-projection
tags: [cashflow, projection, dfc, scenarios, pdf-export, excel-export, money-arithmetic]
dependency_graph:
  requires:
    - PayableInstallment (open installments with dueDate in next 365 days)
    - ReceivableInstallment (open installments with dueDate in next 365 days)
    - Check model (A_COMPENSAR checks with expectedCompensationDate)
    - BankAccountBalance (current balance as starting point)
    - withRlsContext (RLS isolation)
    - Money from @protos-farm/shared (all monetary arithmetic)
    - pdfkit (PDF export)
    - ExcelJS (Excel export)
  provides:
    - GET /api/org/cashflow/projection (12-month projection with 3 scenarios)
    - GET /api/org/cashflow/projection/export/pdf
    - GET /api/org/cashflow/projection/export/excel
    - GET /api/org/cashflow/negative-balance-alert
    - cashflowRouter registered in app.ts
  affects:
    - app.ts (new router import + registration)
tech_stack:
  added: []
  patterns:
    - Money arithmetic for all balance calculations (no native floats)
    - Dynamic import pdfkit for PDF generation
    - ExcelJS multi-sheet workbook
    - Virtual installment projection without DB writes
    - Monthly bucket aggregation (Map<YYYY-MM, {inflows, outflows}>)
key_files:
  created:
    - apps/backend/src/modules/cashflow/cashflow.types.ts
    - apps/backend/src/modules/cashflow/cashflow.service.ts
    - apps/backend/src/modules/cashflow/cashflow.routes.ts
    - apps/backend/src/modules/cashflow/cashflow.routes.spec.ts
  modified:
    - apps/backend/src/app.ts (cashflowRouter import + registration)
decisions:
  - 'DFC mapping uses only actual PayableCategory/ReceivableCategory enum values from schema (not illustrative names in plan). CARTAO_CREDITO -> OPERACIONAL. No EQUIPMENT/VEHICLES/LAND etc. in schema.'
  - 'Recurring CP/CR projection uses last installment dueDate as anchor, adds interval without DB writes. Handles WEEKLY (7d), BIWEEKLY (14d), MONTHLY (1mo) recurrence.'
  - 'Negative balance detection iterates projection in order, sets negativeBalanceDate on first month where realisticBalance < 0.'
  - 'reconciliation.routes.spec.ts (from plan 05-01) had pre-existing TS error referencing missing reconciliation.service — out of scope for this plan, logged as deferred.'
metrics:
  duration: 7min
  completed_date: '2026-03-17'
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 05 Plan 03: Cashflow Projection Service Summary

**One-liner:** 12-month cashflow projection with Realista/Otimista/Pessimista scenarios using Money arithmetic, DFC classification, recurring CP/CR virtual projection, and PDF/Excel export.

## What Was Built

### Task 1: Cashflow Types + DFC Classification Mapping

Created `cashflow.types.ts` with:

- `DfcCategory` union type (`OPERACIONAL | INVESTIMENTO | FINANCIAMENTO`)
- `PAYABLE_DFC_MAP`: maps all `PayableCategory` enum values (INPUTS, MAINTENANCE, PAYROLL, RENT, SERVICES, TAXES, FINANCING, OTHER, CARTAO_CREDITO) to their DFC class
- `RECEIVABLE_DFC_MAP`: maps all `ReceivableCategory` enum values (GRAIN_SALE, CATTLE_SALE, MILK_SALE, LEASE, SERVICES, OTHER) to their DFC class
- `ProjectionPoint`, `CashflowProjection`, `DfcEntry`, `DfcSummary`, `CashflowQuery` interfaces
- `CashflowError` class with statusCode

### Task 2: Cashflow Projection Service + Routes + Tests (TDD)

**RED phase:** 13 failing test cases for all behaviors.

**GREEN phase:** Full implementation:

**`cashflow.service.ts`** — `getProjection`:

- Aggregates `BankAccountBalance.currentBalance` as starting point
- Queries open `PayableInstallment` (PENDING/OVERDUE, next 365 days) with parent category
- Queries open `ReceivableInstallment` (PENDING/OVERDUE, next 365 days) with parent category
- Queries `Check` A_COMPENSAR (EMITIDO as outflows, RECEBIDO as inflows at expectedCompensationDate)
- Projects recurring CP/CR without DB writes: finds last existing installment, advances by recurrence interval up to recurrenceEndDate or 12 months
- Builds monthly buckets (YYYY-MM keys) aggregating by-category amounts
- Computes running balance across 12 months with Money arithmetic:
  - Realista: raw sum
  - Otimista: inflows _ 1.10, outflows _ 0.95
  - Pessimista: inflows _ 0.90, outflows _ 1.15
- Detects `negativeBalanceDate` on first month where realistic balance < 0
- Builds `DfcSummary` with per-category monthly arrays and OPERACIONAL/INVESTIMENTO/FINANCIAMENTO totals

**`cashflow.routes.ts`** — 4 endpoints:

- `GET /org/cashflow/projection/export/pdf` (registered before /projection — route ordering)
- `GET /org/cashflow/projection/export/excel` (registered before /projection — route ordering)
- `GET /org/cashflow/projection`
- `GET /org/cashflow/negative-balance-alert`

All endpoints require `financial:read` permission.

**Test results:** 15 tests, all passing.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified.

### Out-of-Scope Issues (Deferred)

**1. Pre-existing: reconciliation.routes.spec.ts TS error**

- **Found during:** TypeScript check after Task 2
- **Issue:** `apps/backend/src/modules/reconciliation/reconciliation.routes.spec.ts` imports `./reconciliation.service` which has a TS error (`req.params.id` typed as `string | string[]` where `string` expected). This file is from Plan 05-01/05-02 work that is untracked/incomplete.
- **Action:** Not fixed — out of scope for this plan
- **Status:** Logged to deferred items

## Acceptance Criteria Verification

- [x] `getProjection` exported from `cashflow.service.ts`
- [x] `getNegativeBalanceAlert` exported from `cashflow.service.ts`
- [x] `exportProjectionPdf` exported from `cashflow.service.ts`
- [x] `exportProjectionExcel` exported from `cashflow.service.ts`
- [x] Money arithmetic used throughout
- [x] Scenario multipliers 1.10/0.95/0.90/1.15 applied
- [x] Checks A_COMPENSAR included
- [x] Recurrence projection without DB writes
- [x] `cashflowRouter` exported from `cashflow.routes.ts`
- [x] Router registered in `app.ts`
- [x] `/projection` endpoint present
- [x] `/negative-balance-alert` endpoint present
- [x] 15 cashflow tests passing (exceeds required 13)

## Self-Check: PASSED
