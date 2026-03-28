---
phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
plan: '02'
subsystem: backend/accounting
tags: [opening-balance, journal-entries, accounting, wizard, double-entry]
dependency_graph:
  requires:
    - 36-01 (journal-entries service — postJournalEntry function)
    - Phase 35 (ChartOfAccount, AccountingPeriod, AccountBalance models)
    - BankAccountBalance, Payable, Receivable, Asset, PayrollProvision models
  provides:
    - getOpeningBalancePreview (aggregates from 5 source modules)
    - postOpeningBalance (creates OPENING_BALANCE JournalEntry)
    - openingBalanceRouter (REST endpoints)
  affects:
    - app.ts (new router mounted)
    - AccountBalance (updated by postJournalEntry on post)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (test-first with jest.mock service)
    - Parallel Promise.all aggregate queries from 5 sources
    - Direct Prisma JournalEntry.create with entryType OPENING_BALANCE
    - Delegation to postJournalEntry for posting logic and AccountBalance updates
    - Graceful fallback when PayrollProvision or DepreciationRun unavailable
key_files:
  created:
    - apps/backend/src/modules/opening-balance/opening-balance.types.ts
    - apps/backend/src/modules/opening-balance/opening-balance.service.ts
    - apps/backend/src/modules/opening-balance/opening-balance.routes.ts
    - apps/backend/src/modules/opening-balance/opening-balance.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - PayrollProvision uses provisionType VACATION/THIRTEENTH with totalAmount (not vacationProvision/thirteenthProvision fields as stated in plan — adapted to actual schema from EPIC-16)
  - Asset uses status ATIVO (not ACTIVE) to match AssetStatus enum in schema
  - findCoaAccount tries code prefix first, then name keywords as fallback
  - Graceful fallback for parallel queries — if any source model not available, returns empty array
  - DepreciationRun query wrapped in try/catch for resilience across environments
metrics:
  duration_seconds: 207
  completed_date: '2026-03-27'
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  tests: 12
---

# Phase 36 Plan 02: Opening Balance Wizard Backend Summary

**One-liner:** Opening balance wizard with parallel aggregation from 5 source modules and special OPENING_BALANCE journal entry via direct Prisma create + postJournalEntry delegation.

## What Was Built

### Task 1: Opening Balance Service + Types + Tests (TDD)

**Types** (`opening-balance.types.ts`):

- `OpeningBalanceError` — typed error class with `code` and `statusCode`
- `OpeningBalanceLinePreview` — wizard output with source attribution
- `PostOpeningBalanceInput` — user-editable lines + fiscalYearId + periodId

**Service** (`opening-balance.service.ts`):

`getOpeningBalancePreview(organizationId, fiscalYearId)`:

- Runs 5 parallel queries via `Promise.all`: BankAccountBalance, Payable.groupBy, Receivable.groupBy, Asset (NBV), PayrollProvision.groupBy
- Maps each source to DEBIT/CREDIT lines with description
- COA account lookup by code prefix first, then name keywords as fallback
- Returns empty array (not error) when no source data or COA accounts found
- Asset NBV computed as `acquisitionValue - accumulatedDepreciation` (from DepreciationRun)

`postOpeningBalance(organizationId, input, createdBy)`:

- Guards against duplicate OPENING_BALANCE for same fiscal year (409 ALREADY_EXISTS)
- Auto-computes contra-entry to "Lucros e Prejuizos Acumulados" (3.x) if lines unbalanced
- Creates `JournalEntry` directly via Prisma with `entryType: 'OPENING_BALANCE'`
- Delegates to `postJournalEntry` (Plan 01) for sequential entryNumber + AccountBalance update

### Task 2: Routes + app.ts Mount

**Routes** (`opening-balance.routes.ts`):

| Method | Path                                                    | Permission         | Service                    |
| ------ | ------------------------------------------------------- | ------------------ | -------------------------- |
| GET    | `/api/org/:orgId/opening-balance/preview/:fiscalYearId` | `financial:read`   | `getOpeningBalancePreview` |
| POST   | `/api/org/:orgId/opening-balance`                       | `financial:manage` | `postOpeningBalance`       |

- Error handling for `OpeningBalanceError` + any error with `statusCode` property (covers UnbalancedEntryError, PeriodNotOpenError from Plan 01)
- Express 5 pattern: `req.params.orgId as string`

**app.ts**: `openingBalanceRouter` imported and mounted at `/api`.

## Tests

12 tests across preview endpoint, post endpoint, error cases, and OpeningBalanceError class:

- Preview: returns lines, empty array, 401, 500
- Post: creates 201, 409 duplicate, 422 unbalanced, 422 period closed, 401, 500
- OpeningBalanceError: properties, default statusCode

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PayrollProvision schema mismatch**

- **Found during:** Task 1 service implementation
- **Issue:** Plan specified `vacationProvision` + `thirteenthProvision` fields, but actual PayrollProvision model (EPIC-16 schema) has `provisionType: VACATION|THIRTEENTH` + `totalAmount` fields
- **Fix:** Used `prisma.payrollProvision.groupBy({ by: ['provisionType'] })` with `_sum: { totalAmount: true }` instead
- **Files modified:** opening-balance.service.ts

**2. [Rule 1 - Bug] Asset status enum mismatch**

- **Found during:** Task 1 service implementation
- **Issue:** Plan used `status: 'ACTIVE'` but schema has `enum AssetStatus { ATIVO ... }`
- **Fix:** Used `status: 'ATIVO'` to match actual schema enum
- **Files modified:** opening-balance.service.ts

## Known Stubs

None — no UI components in this plan. Service returns live data aggregated from existing models.

## Self-Check: PASSED

All 5 files created/modified: FOUND
All 2 task commits exist: FOUND (4b922f3f, e432975b)
All 12 tests pass: CONFIRMED
