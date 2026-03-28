---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
plan: '01'
subsystem: payroll-runs
tags: [payroll, contas-a-pagar, cost-center, irrf, vt, pension, sindical, preview]
dependency_graph:
  requires: []
  provides: [payroll-cp-7-types, cp-preview-endpoint, cost-center-rateio]
  affects: [payroll-runs, payables, payable-cost-center-items]
tech_stack:
  added: []
  patterns:
    - PayableCategory enum (no string casts per CLAUDE.md)
    - buildCostCenterItems helper (time-entries groupBy → contract fallback → empty)
    - nthBusinessDay extracted to payroll-date-utils.ts (shared utility)
    - PAYROLL_ORIGIN_TYPES const array (no string prefix matching)
key_files:
  created:
    - apps/backend/src/modules/payroll-runs/payroll-date-utils.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.routes.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.types.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.routes.spec.ts
decisions:
  - 'IRRF is aggregated per run (one CP), not per employee — simplifies reconciliation'
  - 'Sindical detected from lineItemsJson by code prefix 9xx or description keyword'
  - 'revertRun uses originId IN [...itemIds, runId] to cover both item-level and run-level CPs'
metrics:
  duration: '~16 minutes'
  completed: '2026-03-26T19:25:00Z'
  tasks_completed: 2
  files_modified: 6
---

# Phase 32 Plan 01: CP Generation at Payroll Close Summary

Extended the payroll-runs module to generate all 7 CP types at closeRun (net salary, INSS patronal, FGTS, IRRF, VT, pensão alimentícia, contribuição sindical) with cost-center rateio via TimeEntryActivity groupBy + EmployeeContract fallback, plus a dry-run cp-preview endpoint returning structured preview with FUNRURAL from tax-guides.

## Tasks Completed

| #   | Task                                                                                   | Commit   | Files                                                               |
| --- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1   | Migration + nthBusinessDay extraction + buildCostCenterItems + closeRun 4 new CP types | e1eaeebf | schema.prisma, payroll-date-utils.ts, payroll-runs.service.ts, spec |
| 2   | cp-preview endpoint + revertRun extension + 10 new tests                               | e7a7aa20 | payroll-runs.types.ts, service, routes, spec                        |

## What Was Built

### Task 1

- **Schema:** Added `alimonyDeduction Decimal? @db.Decimal(14, 2)` to `PayrollRunItem` — applied via `prisma db push`.
- **payroll-date-utils.ts:** Extracted `nthBusinessDay()` from the service into a standalone exported utility. Service now imports from this file.
- **buildCostCenterItems():** New async helper that queries `TimeEntryActivity` for the employee in the reference month, groups minutes by `costCenterId`, computes percentage allocations with Decimal rounding fix (last entry = 100 - sum(others)). Falls back to `EmployeeContract.costCenterId` at 100% if no time-entry data. Returns empty array if no cost center available.
- **closeRun extensions:**
  - `PAYROLL_EMPLOYEE_IRRF`: one CP per run, sum of all `irrfAmount`, due 20th of next month. Only if sum > 0.
  - `PAYROLL_EMPLOYEE_VT`: per employee where `vtDeduction > 0`, due 5th business day of next month.
  - `PAYROLL_EMPLOYEE_PENSION`: per employee where `alimonyDeduction > 0`, due 5th business day of next month.
  - `PAYROLL_EMPLOYEE_SINDICAL`: per employee with sindical line in `lineItemsJson` (type=DESCONTO and code starts with 9 or description contains "sindical").
  - All existing CPs updated to use `PayableCategory.PAYROLL` enum (not `'PAYROLL' as any`).
  - After each `tx.payable.create`, calls `tx.payableCostCenterItem.createMany` if `ccItems.length > 0`.

### Task 2

- **Types:** Added `CpPreviewItem`, `TaxGuidePreviewItem`, `CpPreviewResponse` to `payroll-runs.types.ts`.
- **cpPreview():** Dry-run function that replicates closeRun logic without writing to DB. Queries existing `TaxGuide` records for the same `referenceMonth` to populate `taxGuideItems`. Computes reconciliation: `abs(totalAmount - run.totalNet) < 0.01`.
- **Route:** `GET /org/:orgId/payroll-runs/:id/cp-preview` registered BEFORE `/:id` to prevent Express 5 param shadowing.
- **revertRun:** Updated to use `PAYROLL_ORIGIN_TYPES` constant array of 7 types. Single `OR` filter with `originType: { in: [...] }` and `originId: { in: [...itemIds, runId] }`.
- **Tests:** 10 new tests (cpPreview structure, IRRF entry, VT entry, FUNRURAL in taxGuideItems, reconciliation, closeRun IRRF/VT CPs, cost-center createMany, revertRun 7-type filter).

## Deviations from Plan

None — plan executed exactly as written, with one minor adaptation:

- **[Rule 1 - Bug] revertRun filter:** Instead of using two separate OR conditions (item-level + run-level), used a single `originId: { in: [...itemIds, runId] }` union. This correctly covers both per-employee CPs (originId = itemId) and aggregated CPs (originId = runId) with a single `updateMany` call.

## Verification

- `npx jest --testPathPattern="payroll-runs" --no-coverage` → **34 tests pass** (3 suites)
- `npx prisma validate` → schema valid
- `npx prisma db push` → alimonyDeduction column applied successfully

## Self-Check

Verified files created/modified:

- FOUND: apps/backend/src/modules/payroll-runs/payroll-date-utils.ts
- FOUND: apps/backend/src/modules/payroll-runs/payroll-runs.types.ts
- FOUND commit e1eaeebf (Task 1)
- FOUND commit e7a7aa20 (Task 2)

## Self-Check: PASSED
