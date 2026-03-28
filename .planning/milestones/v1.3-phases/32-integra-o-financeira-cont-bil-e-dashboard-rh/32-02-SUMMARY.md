---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
plan: '02'
subsystem: accounting-entries
tags: [accounting, payroll, contas-a-pagar, lancamentos-contabeis, integr-02]
dependency_graph:
  requires: [32-01]
  provides: [accounting-entries-module, payroll-accounting-hook, payment-reversal-hook]
  affects: [payroll-runs, payables, schema]
tech_stack:
  added: []
  patterns:
    - AccountingSourceType enum (never plain string) per CLAUDE.md Prisma rule
    - Non-blocking try/catch hooks AFTER transactions (accounting failure never aborts payroll)
    - ACCOUNT_CODES as const object — hardcoded chart-of-accounts per v1.4 scope
    - Explicit PAYROLL_ORIGIN_TYPES array check in settlePayment (not string prefix)
key_files:
  created:
    - apps/backend/src/modules/accounting-entries/accounting-entries.types.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.service.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.routes.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/payables/payables.service.ts
    - apps/backend/src/app.ts
decisions:
  - 'PAYROLL_PROVISION entries use runId as sourceId (not provisionId) for easy revert by run'
  - 'revertPayrollEntries makes 2 deleteMany calls (PAYROLL_RUN + PAYROLL_PROVISION) to cover all 5 entry types'
  - "farmId captured from first employee's active farm assignment (PayrollRun has no direct farmId)"
metrics:
  duration: '~12 minutes'
  completed: '2026-03-26T20:02:19Z'
  tasks_completed: 2
  files_modified: 8
---

# Phase 32 Plan 02: Accounting Entries Module Summary

Created the accounting-entries module (INTEGR-02) with AccountingEntry Prisma model, AccountingSourceType enum, 6 canonical entry types, hooks in closeRun (non-blocking) and settlePayment (reversal), and read-only routes with CSV export.

## Tasks Completed

| #   | Task                                                                         | Commit   | Files                                                                                               |
| --- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| 1   | AccountingEntry model + AccountingSourceType enum + types + service skeleton | 38641309 | schema.prisma, accounting-entries.types.ts, accounting-entries.service.ts                           |
| 2   | Routes + hooks in closeRun/settlePayment + 18 tests                          | 17adc67d | accounting-entries.routes.ts, .routes.spec.ts, payroll-runs.service.ts, payables.service.ts, app.ts |

## What Was Built

### Task 1

- **Schema:** Added `AccountingSourceType` (PAYROLL_RUN, PAYROLL_PROVISION, PAYABLE_SETTLEMENT) and `AccountingEntryType` (PAYROLL_SALARY, PAYROLL_CHARGES, VACATION_PROVISION, THIRTEENTH_PROVISION, TAX_LIABILITY, SALARY_REVERSAL) enums. Added `AccountingEntry` model with two indexes (`[organizationId, referenceMonth]` and `[sourceType, sourceId]`). Added `accountingEntries` relation on Organization, Farm, and CostCenter models. Applied via `prisma db push` + `prisma generate`.
- **accounting-entries.types.ts:** `ACCOUNT_CODES` as const mapping all 6 entry types to debit/credit account codes and labels. `AccountingEntryOutput`, `AccountingEntryListInput`, `PaginatedAccountingEntriesOutput` interfaces.
- **accounting-entries.service.ts:**
  - `createPayrollEntries`: Loads run + items, sums grossSalary/inssPatronal/fgtsAmount/inssAmount/irrfAmount, loads VACATION+THIRTEENTH provisions. Creates up to 5 AccountingEntry records via `createMany`. farmId sourced from first employee's active farm.
  - `createReversalEntry`: Creates SALARY_REVERSAL with PAYABLE_SETTLEMENT sourceType on payment.
  - `revertPayrollEntries`: Two `deleteMany` calls — PAYROLL_RUN + PAYROLL_PROVISION entries for the runId.
  - `list`: Paginated list with optional referenceMonth/farmId/entryType filters.
  - `getById`: Single entry with 404 guard.
  - `exportCsv`: Returns CSV string with 14 columns.

### Task 2

- **accounting-entries.routes.ts:** Three GET endpoints. `/export/csv` registered before `/:id` to prevent Express 5 param shadowing (same pattern as payroll-runs from Plan 01). Permission: `payroll-params:read`.
- **app.ts:** Registered `accountingEntriesRouter` after `hrDashboardRouter`.
- **payroll-runs.service.ts (closeRun):** Non-blocking `try { await createPayrollEntries(...) } catch` added AFTER eSocial block. Accounting failure never aborts payroll close.
- **payroll-runs.service.ts (revertRun):** Non-blocking `try { await revertPayrollEntries(...) } catch` added after run status → REVERTED.
- **payables.service.ts (settlePayment):** PAYROLL_ORIGIN_TYPES explicit array (7 types) with `includes()` check. Non-blocking `try { await createReversalEntry(...) } catch` for matching payables.
- **Tests:** 18 tests across 6 describe blocks. All pass.

## Deviations from Plan

None — plan executed exactly as written, with two minor adaptations:

- **[Rule 1 - Bug] farmId sourcing:** PayrollRun model has no direct `farmId` field. Instead, `farmId` is captured from the first employee's active EmployeeFarm assignment in the PayrollRunItem query (`employee.farms[0].farmId`). This matches the same pattern used in `closeRun` itself (`anyFarmId = items[0]?.employee.farms[0]?.farmId`).

- **[Rule 2 - Missing functionality] PAYROLL_PROVISION revert scope:** The plan specified deleting entries with `sourceType = PAYROLL_RUN AND sourceId = runId`. But VACATION_PROVISION and THIRTEENTH_PROVISION entries use `sourceType = PAYROLL_PROVISION`. Added a second `deleteMany` call for `PAYROLL_PROVISION` entries to ensure complete cleanup — required for correctness.

## Verification

- `npx jest --testPathPattern="accounting-entries" --no-coverage` → **18 tests pass**
- `npx jest --testPathPattern="payroll-runs" --no-coverage` → **34 tests pass** (existing tests unaffected)
- `npx prisma validate` → schema valid

## Known Stubs

None — all service functions are fully wired. ACCOUNT_CODES is intentionally hardcoded per v1.4 scope (no dynamic chart-of-accounts management).

## Self-Check: PASSED
