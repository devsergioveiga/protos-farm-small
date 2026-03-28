---
phase: 27-controle-de-ponto-e-jornada
plan: 01
subsystem: database
tags: [prisma, postgresql, typescript, time-tracking, ponto, jornada, date-holidays]

# Dependency graph
requires:
  - phase: 25-cadastro-de-colaboradores-e-contratos
    provides: Employee, WorkSchedule models used as foreign keys in TimeEntry and Timesheet

provides:
  - '5 Prisma models: TimeEntry, TimeEntryActivity, OvertimeBankEntry, Timesheet, TimesheetCorrection'
  - '3 Prisma enums: TimeEntrySource, OvertimeBankType, TimesheetStatus'
  - 'Migration 20260504100000_add_time_tracking_models applied'
  - 'TypeScript types for time-entries, time-calculations, overtime-bank, timesheets modules'
  - 'date-holidays@^3.26.11 installed in backend'
affects: [27-02, 27-03, 27-04, 27-05, 27-06]

# Tech tracking
tech-stack:
  added: ['date-holidays@^3.26.11']
  patterns:
    - 'Time tracking schema linked to Employee via employeeId FK, to Farm and Organization for multitenancy'
    - 'Timesheet unique constraint on (employeeId, referenceMonth) prevents duplicates'
    - 'payrollRunId as immutable lock field on TimeEntry and Timesheet'

key-files:
  created:
    - apps/backend/prisma/migrations/20260504100000_add_time_tracking_models/migration.sql
    - apps/backend/src/modules/time-entries/time-entries.types.ts
    - apps/backend/src/modules/time-calculations/time-calculations.types.ts
    - apps/backend/src/modules/overtime-bank/overtime-bank.types.ts
    - apps/backend/src/modules/timesheets/timesheets.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/package.json

key-decisions:
  - 'TimeEntry.payrollRunId as immutable lock — set once when payroll run processes the entry, prevents further modification'
  - 'Timesheet unique constraint on (employeeId, referenceMonth) — one timesheet per employee per month'
  - 'OvertimeBankEntry.expiresAt as Date field — 6 months from credit date per CLT rural rules'
  - 'TimeEntrySource enum includes MANAGER for manual/justified entries with managerNote required'

patterns-established:
  - 'Time tracking module pattern: types.ts first, then service.ts and routes.ts in subsequent plans'
  - 'Decimal fields for lat/lon (10,7) and monetary values (10,4 rate, 10,2 amount)'

requirements-completed: [PONTO-01, PONTO-02, PONTO-03, PONTO-04]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 27 Plan 01: Controle de Ponto e Jornada — Schema Foundation Summary

**Prisma schema with 5 time tracking models (TimeEntry, TimeEntryActivity, OvertimeBankEntry, Timesheet, TimesheetCorrection), 3 enums, migration applied, date-holidays installed, and TypeScript type contracts for all 4 backend modules**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-24T14:42:58Z
- **Completed:** 2026-03-24T14:48:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added 5 Prisma models and 3 enums for the complete time tracking data layer
- Applied migration 20260504100000_add_time_tracking_models and regenerated Prisma client
- Installed date-holidays@^3.26.11 for Brazilian holiday calendar support
- Created TypeScript type contracts for all 4 modules (time-entries, time-calculations, overtime-bank, timesheets) — downstream plans can import without compilation errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema — 5 models, 3 enums, migration, install date-holidays** - `8cb620af` (feat)
2. **Task 2: TypeScript types for all 4 backend modules** - `1206e6c0` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` - Added TimeEntry, TimeEntryActivity, OvertimeBankEntry, Timesheet, TimesheetCorrection models + TimeEntrySource, OvertimeBankType, TimesheetStatus enums + reverse relations on Employee/Farm/Organization
- `apps/backend/prisma/migrations/20260504100000_add_time_tracking_models/migration.sql` - Full DDL for all new tables, indexes, and foreign keys
- `apps/backend/package.json` - date-holidays@^3.26.11 added
- `apps/backend/src/modules/time-entries/time-entries.types.ts` - CreateTimeEntryInput, UpdateTimeEntryInput, TimeEntryOutput, TimeEntryListQuery, TimeEntryActivityOutput
- `apps/backend/src/modules/time-calculations/time-calculations.types.ts` - DailyWorkInput, DailyWorkResult, RuralNightResult, Inconsistency, MonthlyCalculationResult, OvertimeConfig
- `apps/backend/src/modules/overtime-bank/overtime-bank.types.ts` - CreateOvertimeBankInput, OvertimeBankOutput, OvertimeBankSummary, OvertimeBankQuery
- `apps/backend/src/modules/timesheets/timesheets.types.ts` - TimesheetOutput, TimesheetApprovalInput, TimesheetCorrectionInput, TimesheetListQuery

## Decisions Made

- TimeEntry.payrollRunId immutable lock field: once a payroll run processes entries, they are locked and cannot be modified — enforced at service layer in subsequent plans
- Timesheet unique constraint on (employeeId, referenceMonth): prevents double timesheet creation
- OvertimeBankEntry.expiresAt: stored as Date field because expiry is calendar-date based (6 months from credit), not time-based

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` ran out of memory on first try (large codebase, ~8K lines schema). Resolved by running with `--max-old-space-size=4096`. No new TypeScript errors introduced by our files.

## Known Stubs

None — this plan only creates schema and type contracts, no data-returning endpoints.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema foundation complete: all 5 models, 3 enums, migration applied, Prisma client regenerated
- Type contracts in place for all 4 backend modules — Plans 27-02 through 27-06 can import types without errors
- date-holidays available for Plan 27-02 (time calculation service)

---

_Phase: 27-controle-de-ponto-e-jornada_
_Completed: 2026-03-24_
