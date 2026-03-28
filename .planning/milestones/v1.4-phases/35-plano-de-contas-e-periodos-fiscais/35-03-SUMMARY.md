---
phase: 35-plano-de-contas-e-periodos-fiscais
plan: "03"
subsystem: fiscal-periods
tags: [accounting, fiscal-periods, state-machine, audit-trail, coa]
dependency_graph:
  requires: ["35-01"]
  provides: ["fiscal-periods-api", "getPeriodForDate", "period-state-machine"]
  affects: ["accounting-entries", "journal-entries", "chart-of-accounts"]
tech_stack:
  added: []
  patterns: ["collocated-module", "state-machine", "audit-trail", "eachMonthOfInterval-date-fns"]
key_files:
  created:
    - apps/backend/src/modules/fiscal-periods/fiscal-periods.types.ts
    - apps/backend/src/modules/fiscal-periods/fiscal-periods.service.ts
    - apps/backend/src/modules/fiscal-periods/fiscal-periods.routes.ts
    - apps/backend/src/modules/fiscal-periods/fiscal-periods.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - "fiscalPeriodsRouter mounted at /api/org/:orgId with mergeParams:true to avoid param conflicts with top-level route prefix"
  - "blockPeriod accepts both OPEN and CLOSED as valid source states — matches valid transitions table"
  - "getPeriodForDate filters by fiscalYear.isActive:true to avoid returning periods from inactive years"
  - "eachMonthOfInterval from date-fns used for safra year support (spans two calendar years)"
metrics:
  duration: "5m 13s"
  completed_date: "2026-03-27"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 35 Plan 03: Fiscal Periods Backend Module Summary

Fiscal year CRUD with auto-generated monthly periods using date-fns `eachMonthOfInterval`, period state machine (OPEN/CLOSED/BLOCKED), and full audit trail for period lifecycle (closedAt/closedBy, reopenedAt/reopenedBy/reopenReason).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create fiscal periods service, types, and routes | cb1844bc | fiscal-periods.types.ts, fiscal-periods.service.ts, fiscal-periods.routes.ts, app.ts |
| 2 | Write fiscal periods integration tests | e2dd25cb | fiscal-periods.routes.spec.ts |

## What Was Built

### fiscal-periods.types.ts
- `CreateFiscalYearInput`, `ClosePeriodInput`, `ReopenPeriodInput` — input interfaces
- `FiscalYearOutput`, `AccountingPeriodOutput` — output interfaces with proper Prisma PeriodStatus typing
- `FiscalPeriodError` — error class with `code` field (OVERLAPPING_YEAR, INVALID_TRANSITION, REASON_REQUIRED, PERIOD_NOT_FOUND, YEAR_NOT_FOUND) and HTTP `statusCode`

### fiscal-periods.service.ts
Exports: `createFiscalYear`, `getFiscalYears`, `closePeriod`, `reopenPeriod`, `blockPeriod`, `getPeriodForDate`

**State machine transitions:**
- `OPEN -> CLOSED` (closePeriod) — sets closedAt/closedBy
- `CLOSED -> OPEN` (reopenPeriod) — requires non-empty reopenReason, sets reopenedAt/reopenedBy/reopenReason
- `OPEN -> BLOCKED` (blockPeriod)
- `CLOSED -> BLOCKED` (blockPeriod)
- All other transitions throw `INVALID_TRANSITION`

**Auto period generation:** `createFiscalYear` uses `eachMonthOfInterval({ start, end })` from date-fns to generate all monthly periods — supports both calendar years (Jan-Dec) and safra years (Jul-Jun spanning two calendar years).

### fiscal-periods.routes.ts
7 endpoints mounted at `/api/org/:orgId`:
- `GET /fiscal-years` — list all fiscal years with periods
- `POST /fiscal-years` — create fiscal year (returns 201)
- `GET /fiscal-years/:yearId/periods` — periods for a specific year
- `GET /accounting-periods/for-date?date=YYYY-MM-DD` — find period by date (registered BEFORE /:periodId routes)
- `POST /accounting-periods/:periodId/close` — close period
- `POST /accounting-periods/:periodId/reopen` — reopen period with reason
- `POST /accounting-periods/:periodId/block` — block period

### integration tests (16 cases)
All pass. Coverage: createFiscalYear (4), getFiscalYears (1), closePeriod (3), reopenPeriod (3), blockPeriod (3), getPeriodForDate (2).

## Decisions Made

1. **fiscalPeriodsRouter with mergeParams:true** — Router is mounted at `/api/org/:orgId` in app.ts. Using `mergeParams: true` ensures `req.params.orgId` is accessible within the router's handlers.
2. **blockPeriod accepts OPEN and CLOSED** — Both source states are valid for blocking per the spec's valid transitions table.
3. **getPeriodForDate filters isActive fiscal years** — Prevents returning periods from archived/inactive fiscal years.
4. **eachMonthOfInterval covers safra edge case** — date-fns handles month iteration across calendar year boundaries (Jul 2025 → Jun 2026 = 12 periods with years 2025 and 2026).
5. **for-date route registered before /:periodId** — Express 5 would otherwise treat "for-date" as a periodId param value.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `apps/backend/src/modules/fiscal-periods/fiscal-periods.types.ts` — FOUND
- [x] `apps/backend/src/modules/fiscal-periods/fiscal-periods.service.ts` — FOUND
- [x] `apps/backend/src/modules/fiscal-periods/fiscal-periods.routes.ts` — FOUND
- [x] `apps/backend/src/modules/fiscal-periods/fiscal-periods.routes.spec.ts` — FOUND
- [x] commit cb1844bc — FOUND
- [x] commit e2dd25cb — FOUND
- [x] `fiscalPeriodsRouter` in app.ts — FOUND
- [x] `eachMonthOfInterval` in service — FOUND
- [x] 16 tests pass — VERIFIED
