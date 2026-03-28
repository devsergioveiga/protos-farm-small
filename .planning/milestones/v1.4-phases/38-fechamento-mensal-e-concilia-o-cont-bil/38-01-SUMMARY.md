---
phase: 38
plan: 01
subsystem: monthly-closing
tags: [backend, monthly-closing, checklist, period-lock, middleware]
dependency_graph:
  requires:
    - 36-01 (FiscalYear + AccountingPeriod models + closePeriod/reopenPeriod)
    - 37-01 (auto-posting engine + getPendingCounts)
    - 35-01 (chart-of-accounts + getTrialBalance)
  provides:
    - monthly-closing CRUD API at /org/:orgId/monthly-closing
    - checkPeriodOpen middleware for period-write blocking
    - 6-step validation engine (timesheets, payroll, depreciation, auto-posting, bank reconciliation, trial balance)
  affects:
    - 38-02 (frontend will consume these endpoints)
    - Any module that should gate writes on period status (via checkPeriodOpen middleware)
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) — test-first for all 22 tests
    - service mock pattern (mock service in routes.spec, not prisma directly)
    - SUPER_ADMIN bypass in checkPermission for test isolation
key_files:
  created:
    - apps/backend/prisma/migrations/20260603000000_add_monthly_closing/migration.sql
    - apps/backend/src/modules/monthly-closing/monthly-closing.types.ts
    - apps/backend/src/modules/monthly-closing/monthly-closing.service.ts
    - apps/backend/src/modules/monthly-closing/monthly-closing.routes.ts
    - apps/backend/src/modules/monthly-closing/monthly-closing.routes.spec.ts
    - apps/backend/src/middleware/check-period-open.ts
    - apps/backend/src/middleware/check-period-open.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma (MonthlyClosingStatus enum + MonthlyClosing model + relations on Organization and AccountingPeriod)
    - apps/backend/src/app.ts (import + mount monthlyClosingRouter)
decisions:
  - Routes spec uses service mock pattern (mock the service module, not prisma directly) — matches auto-posting.routes.spec.ts pattern for better isolation
  - getPendingCounts return type has only {error, pending} — no total field, so summary uses generic "Lancamentos processados"
  - authorize(ADMIN, SUPER_ADMIN) placed BEFORE checkPermission on reopen route — role check runs first, returns 403 before touching permission DB
metrics:
  duration_minutes: 36
  completed_date: '2026-03-28'
  tasks_completed: 1
  tasks_total: 1
  files_created: 7
  files_modified: 2
  tests_added: 22
---

# Phase 38 Plan 01: Monthly Closing Backend Module Summary

**One-liner:** MonthlyClosing 6-step checklist module with period-locking middleware using service mocks and TDD pattern.

## What Was Built

Backend module for structured monthly accounting close with:

- **MonthlyClosing Prisma model** with `stepResults` JSON field for storing per-step validation outcomes
- **6-step validation engine**: timesheets (APPROVED/LOCKED), payroll runs (COMPLETED), depreciation run (COMPLETED String), auto-posting counts (0 PENDING/ERROR), bank statement lines (0 PENDING), trial balance (isBalanced=true)
- **checkPeriodOpen middleware**: blocks writes on CLOSED/BLOCKED periods using `assertPeriodOpen` from `@protos-farm/shared`
- **5 REST endpoints**: GET (get closing), POST /start (create), POST /validate-step/:n, POST /complete (locks period), POST /reopen (ADMIN only)

## Tasks Completed

| Task | Description                                                                             | Commit   | Files   |
| ---- | --------------------------------------------------------------------------------------- | -------- | ------- |
| 1    | Prisma migration + MonthlyClosing model + types + service + routes + middleware + tests | 34f8e147 | 9 files |

## Tests

22 tests passing:

- 5 middleware tests (`check-period-open.spec.ts`): OPEN pass, CLOSED 422, BLOCKED 422, no date pass, no period found 422
- 17 route tests (`monthly-closing.routes.spec.ts`): start (3), validate steps 1-6 (9), complete (2), reopen (2), get (1)

## Deviations from Plan

### Auto-fixed Issues

None.

### Implementation Notes

**1. Route test pattern changed from plan**

Plan specified mocking prisma directly in routes spec. During implementation, matched the established project pattern (from `auto-posting.routes.spec.ts`) of mocking the service module and `verifyAccessToken` instead. This provides better isolation and follows existing conventions.

- **Found during:** Task 1 (writing tests)
- **Fix:** Used service mock pattern + auth mock pattern from auto-posting.routes.spec.ts
- **Impact:** Tests are more isolated and maintainable

**2. getPendingCounts total field missing**

The `PendingCountsOutput` interface has only `{error, pending}` — no `total` field as referenced in plan's step 4 summary. Fixed to use generic summary "Lancamentos processados, 0 pendente(s)" instead.

- **Found during:** Task 1 (implementing service)
- **Fix:** Changed step 4 summary to not use total count
- **Commit:** 34f8e147

## Known Stubs

None — all 6 step validation functions are fully implemented with real Prisma queries and external service calls.

## Self-Check: PASSED

All files present:

- FOUND: apps/backend/prisma/migrations/20260603000000_add_monthly_closing/migration.sql
- FOUND: apps/backend/src/modules/monthly-closing/monthly-closing.types.ts
- FOUND: apps/backend/src/modules/monthly-closing/monthly-closing.service.ts
- FOUND: apps/backend/src/modules/monthly-closing/monthly-closing.routes.ts
- FOUND: apps/backend/src/modules/monthly-closing/monthly-closing.routes.spec.ts
- FOUND: apps/backend/src/middleware/check-period-open.ts
- FOUND: apps/backend/src/middleware/check-period-open.spec.ts

All commits present:

- 5aaaa2b7: test(38-01): add failing tests (RED phase)
- 34f8e147: feat(38-01): implement monthly-closing module + checkPeriodOpen middleware (GREEN phase)

Tests: 22/22 passed.
