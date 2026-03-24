---
phase: 27-controle-de-ponto-e-jornada
plan: "03"
subsystem: backend/time-tracking
tags: [time-entries, overtime-bank, timesheets, geofencing, pdf-export, rbac]
dependency_graph:
  requires: ["27-01", "27-02"]
  provides: [time-entries-api, overtime-bank-api, timesheets-api]
  affects: [app.ts, permissions.ts]
tech_stack:
  added: []
  patterns:
    - PostGIS ST_Contains geofence check
    - pdfkit PDF generation (dynamic import)
    - withRlsContext transaction pattern
    - State machine transitions map
key_files:
  created:
    - apps/backend/src/modules/time-entries/time-entries.service.ts
    - apps/backend/src/modules/time-entries/time-entries.routes.ts
    - apps/backend/src/modules/time-entries/time-entries.routes.spec.ts
    - apps/backend/src/modules/overtime-bank/overtime-bank.service.ts
    - apps/backend/src/modules/overtime-bank/overtime-bank.routes.ts
    - apps/backend/src/modules/timesheets/timesheets.service.ts
    - apps/backend/src/modules/timesheets/timesheets.routes.ts
    - apps/backend/src/modules/timesheets/timesheets.routes.spec.ts
  modified:
    - apps/backend/src/modules/time-entries/time-entries.types.ts (TimeEntryError class)
    - apps/backend/src/modules/timesheets/timesheets.types.ts (TimesheetError class)
    - apps/backend/src/shared/rbac/permissions.ts (attendance module)
    - apps/backend/src/app.ts (3 new router registrations)
decisions:
  - TimeEntryError and TimesheetError custom error classes added to types files for consistent error handling in routes
  - Night minutes calculation uses minute-by-minute loop (simple, correct for 8h shifts) — CPU cost acceptable at test/dev scale
  - APPROVE_MANAGER auto-advances to PENDING_RH in state machine (per RESEARCH.md pattern)
  - calcScheduledMinutesFromSchedule derives daily scheduled minutes from WorkSchedule.startTime/endTime/breakMinutes
metrics:
  duration: 480s
  completed: 2026-03-24
  tasks_completed: 2
  tests_added: 14
  files_created: 8
  files_modified: 4
---

# Phase 27 Plan 03: Time Entries, Overtime Bank, Timesheets API Summary

**One-liner:** Complete backend REST API for CLT rural time tracking — punch recording with PostGIS geofencing, overtime bank with expiry alerts, and timesheet lifecycle with pdfkit PDF export.

## What Was Built

### Task 1: Time Entries + Overtime Bank (commit 5d92f665)

**time-entries.service.ts** — 6 exported functions:
- `createTimeEntry`: PostGIS `ST_Contains` geofence against `farms.boundary`, LOCKED month check via `payrollRunId IS NOT NULL`, MANAGER source note validation (10+ chars), night minutes calculation (21h–05h rural window), workedMinutes from clockIn/clockOut/break
- `listTimeEntries`: paginated with farmId/employeeId/dateFrom/dateTo/source filters, max limit 200
- `getTimeEntry`: full detail with activities
- `updateTimeEntry`: recalculates workedMinutes/nightMinutes, checks lock
- `addActivity`: derives hourlyRate from EmployeeContract.salary / monthly hours (WorkSchedule), computes costAmount = hourlyRate × minutes/60
- `addTeamActivity`: fetches FieldTeam members, finds each member's TimeEntry for the date, calls addActivity for each — returns created/skipped counts (PONTO-02 modo rapido)

**time-entries.routes.ts** — 6 endpoints:
- `POST /org/:orgId/employees/:employeeId/time-entries` — attendance:write
- `GET /org/:orgId/time-entries` — attendance:read
- `GET /org/:orgId/time-entries/:id` — attendance:read
- `PUT /org/:orgId/time-entries/:id` — attendance:write
- `POST /org/:orgId/time-entries/:id/activities` — attendance:write
- `POST /org/:orgId/time-entries/team/:teamId/activities` — attendance:write (PONTO-02)

**overtime-bank.service.ts** — 3 exported functions:
- `getOvertimeBankSummary`: aggregates CREDIT/COMPENSATION/EXPIRATION, calculates currentBalance, expiringIn7Days, expiringIn30Days
- `listOvertimeBankEntries`: paginated with employeeId/expiringBefore filters
- `createOvertimeBankEntry`: validates employee, sets expiresAt = referenceMonth + 6 months

**overtime-bank.routes.ts** — 3 endpoints:
- `GET /org/:orgId/overtime-bank` — attendance:read
- `GET /org/:orgId/overtime-bank/summary/:employeeId` — attendance:read
- `POST /org/:orgId/overtime-bank` — attendance:write

**permissions.ts** — Added `attendance` module with MANAGER (read/write/delete) and FINANCIAL (read) grants.

### Task 2: Timesheets + PDF (commit be38c655)

**timesheets.service.ts** — 7 exported functions:
- `createTimesheet`: validates employee, creates with DRAFT status, all totals=0
- `calculateTimesheet`: fetches month's TimeEntries, runs calcDailyWork per day, calcMonthlyTotals, detects 4 inconsistency types, creates OvertimeBankEntry CREDIT if overtime50>0, transitions DRAFT→PENDING_MANAGER
- `approveTimesheet`: state machine with VALID_TRANSITIONS map — APPROVE_MANAGER (→PENDING_RH), APPROVE_RH (→APPROVED), REJECT (→DRAFT, requires 20+ char justification), EMPLOYEE_ACCEPT, EMPLOYEE_DISPUTE
- `correctTimeEntry`: snapshots before/after JSON, recalculates workedMinutes/nightMinutes, creates TimesheetCorrection record
- `getTimesheet`: includes timeEntries for on-the-fly inconsistency calculation
- `listTimesheets`: paginated with farmId/employeeId/referenceMonth/status filters
- `generateTimesheetPdf`: pdfkit A4 portrait — header, date table (data/entrada/intervalos/saída/horas/HE/noturno), totals row, 3-column signature section

**timesheets.routes.ts** — 7 endpoints:
- `POST /org/:orgId/timesheets` — attendance:write
- `GET /org/:orgId/timesheets` — attendance:read
- `GET /org/:orgId/timesheets/:id` — attendance:read
- `POST /org/:orgId/timesheets/:id/calculate` — attendance:write
- `PATCH /org/:orgId/timesheets/:id/approve` — attendance:write
- `POST /org/:orgId/timesheets/:id/corrections` — attendance:write
- `GET /org/:orgId/timesheets/:id/pdf` — attendance:read (streams PDF buffer)

## Tests

| Suite | Tests | Result |
| --- | --- | --- |
| time-entries.routes.spec.ts | 7 | PASS |
| timesheets.routes.spec.ts | 7 | PASS |
| **Total** | **14** | **PASS** |

Test coverage:
- POST create time entry returns 201
- POST MANAGER source without managerNote returns 400
- POST locked month returns 409
- GET list returns paginated data
- POST addActivity returns activity with costAmount
- GET overtime bank summary with expiry alerts
- POST team bulk activity returns created/skipped counts
- POST create timesheet returns DRAFT
- POST calculate populates totals
- PATCH APPROVE_MANAGER transitions correctly
- PATCH REJECT without justification returns 400
- POST correction creates beforeJson/afterJson
- GET timesheet returns inconsistencies
- GET pdf returns application/pdf content-type

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `apps/backend/src/modules/time-entries/time-entries.service.ts` exists
- [x] `apps/backend/src/modules/time-entries/time-entries.routes.ts` exists
- [x] `apps/backend/src/modules/time-entries/time-entries.routes.spec.ts` exists
- [x] `apps/backend/src/modules/overtime-bank/overtime-bank.service.ts` exists
- [x] `apps/backend/src/modules/overtime-bank/overtime-bank.routes.ts` exists
- [x] `apps/backend/src/modules/timesheets/timesheets.service.ts` exists
- [x] `apps/backend/src/modules/timesheets/timesheets.routes.ts` exists
- [x] `apps/backend/src/modules/timesheets/timesheets.routes.spec.ts` exists
- [x] Commits 5d92f665 and be38c655 exist in git log
- [x] 14 tests passing (pnpm test --testPathPattern="time-entries|timesheets|overtime-bank")
- [x] `timeEntriesRouter`, `overtimeBankRouter`, `timesheetsRouter` registered in app.ts
- [x] `attendance` module in permissions.ts
- [x] `ST_Contains` in time-entries.service.ts
- [x] `import.*pdfkit` pattern in timesheets.service.ts
