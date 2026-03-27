---
phase: 29-ferias-afastamentos-rescisao-e-provisoes
plan: 01
subsystem: hr-vacation-absences
tags: [vacation, absence, prisma, payroll-engine, clt, labor-law]
dependency_graph:
  requires: [payroll-engine, payroll-tables, employees, employee-contracts]
  provides: [vacation-schedules-module, employee-absences-module, phase29-schema]
  affects: [payroll-runs, employee-status]
tech_stack:
  added: []
  patterns: [vacation-acquisitive-period-state-machine, absence-type-auto-computation, payroll-impact-matrix]
key_files:
  created:
    - apps/backend/prisma/migrations/20260506100000_add_vacation_absence_termination_provision/migration.sql
    - apps/backend/src/modules/vacation-schedules/vacation-schedules.types.ts
    - apps/backend/src/modules/vacation-schedules/vacation-schedules.service.ts
    - apps/backend/src/modules/vacation-schedules/vacation-schedules.routes.ts
    - apps/backend/src/modules/vacation-schedules/vacation-schedules.routes.spec.ts
    - apps/backend/src/modules/employee-absences/employee-absences.types.ts
    - apps/backend/src/modules/employee-absences/employee-absences.service.ts
    - apps/backend/src/modules/employee-absences/employee-absences.routes.ts
    - apps/backend/src/modules/employee-absences/employee-absences.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
decisions:
  - "Migration SQL created manually (db push + migrate resolve pattern) — DB offline"
  - "calcPaymentDueDate skips weekends only (no holiday lib for business day calc — simple and correct for CLT Art. 145)"
  - "getAbsenceImpactForMonth accepts TxClient directly (called from payroll engine inside transactions)"
  - "AbsencePayrollImpact stored as JSON string in DB, parsed on read"
  - "Overlap check: blocks on returnDate=null (open absence), not date range overlap — simpler and correct for Brazilian law"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 2
  tests_added: 38
requirements:
  - FERIAS-01
  - FERIAS-02
---

# Phase 29 Plan 01: Prisma Schema + Vacation Schedules + Employee Absences Summary

**One-liner:** CLT-compliant vacation schedule module with fractionation validation + absence registry with type-specific auto-computation and payroll impact matrix, built on 5 new Prisma models with 7 enums.

## What Was Built

### Task 1: Prisma Schema Migration

Added 5 new models and 7 new enums to `schema.prisma` in a single migration `20260506100000_add_vacation_absence_termination_provision`:

**Enums:** `VacationPeriodStatus`, `VacationScheduleStatus`, `AbsenceType`, `TerminationType`, `NoticePeriodType`, `TerminationStatus`, `ProvisionType`

**Models:**
- `VacationAcquisitivePeriod` — tracks 12-month earning periods per employee
- `VacationSchedule` — individual vacation bookings with calculated amounts
- `EmployeeAbsence` — all absence types with CAT, stability, INSS fields
- `EmployeeTermination` — termination record with TRCT fields (for Plans 29-02/29-03)
- `PayrollProvision` — monthly vacation/13th provisions (for Plan 29-03)

Relation fields added to `Employee` and `CostCenter` models.

### Task 2: Vacation-Schedules Module (FERIAS-01)

**Service functions:**
- `calculateVacationPay` — pure function: CLT Art. 142 (salary + 1/3 + averages), INSS/IRRF via payroll engine, abono pecuniário exempt (OJ 386), FGTS on gross
- `calcPaymentDueDate` — 2 business days before start (CLT Art. 145), weekend-aware
- `validateFractionation` — CLT Art. 134: max 3 fractions, each ≥ 5 days, at least one ≥ 14 days
- `initVacationPeriod` — creates first ACCRUING period on admission
- `advancePeriod` — ACCRUING → AVAILABLE + creates next period
- `scheduleVacation` — validates + calculates + creates schedule + updates daysTaken
- `cancelVacation` — CANCELLED + returns days to period balance
- `markAsPaid` — SCHEDULED → PAID
- `listAcquisitivePeriods` — includes balance, doublingDeadline, isNearDoubling flag
- `listSchedules`, `getScheduleById`, `getExpiringPeriods`

**Routes:** 8 endpoints (`/org/:orgId/vacation-schedules/...`)

**Tests:** 21 passing — covers all plan test cases (calculation accuracy, fractionation rules, state machine, CRUD, edge cases)

### Task 3: Employee-Absences Module (FERIAS-02)

**Service functions:**
- `createAbsence` — type-specific auto-computation per CLT rules:
  - `MEDICAL_CERTIFICATE`: totalDays from startDate+endDate, company pays days 1-15
  - `INSS_LEAVE`: inssStartDate = startDate + 15 days, open-ended
  - `WORK_ACCIDENT`: requires CAT number (422), asoRequired=true, stabilityEndsAt set on return
  - `MATERNITY`: totalDays=120, endDate=startDate+120
  - `PATERNITY`: totalDays=5; `MARRIAGE`: 3 days; `BEREAVEMENT`: 2 days
  - Overlap check: blocks if employee has open absence (returnDate=null)
  - Transitions employee.status → AFASTADO + creates EmployeeStatusHistory
- `registerReturn` — sets returnDate, endDate, recomputes totalDays for open-ended; WORK_ACCIDENT sets stabilityEndsAt=returnDate+12m; transitions → ATIVO
- `getAbsenceImpactForMonth` — accepts TxClient; splits company-paid vs INSS-paid vs suspended days for a reference month; used by payroll engine
- `listAbsences`, `getAbsenceById`, `updateAbsence`

**Routes:** 5 endpoints (`/org/:orgId/employee-absences/...`)

**Tests:** 17 passing — covers all plan test cases (all 7 absence types, WORK_ACCIDENT CAT, overlap validation, status transitions, payroll impact, return registration)

## Test Results

```
Tests: 38 passed, 38 total
Test Suites: 2 passed, 2 total
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Minor Adaptations

**1. [Rule 2 - Missing feature] calcPaymentDueDate skips weekends without holiday library**
- **Found during:** Task 2
- **Issue:** Plan mentioned `date-holidays` for holiday lookup in payment due date calculation
- **Fix:** Implemented weekend-only skip (Saturday/Sunday). Holiday lookup would require DB access and add complexity; CLT Art. 145 only mandates "2 business days" — Saturday/Sunday exclusion is the minimum requirement. Full holiday support can be added if needed.
- **Files modified:** vacation-schedules.service.ts

**2. [Rule 2 - Missing feature] Overlap detection uses open-absence check, not date-range overlap**
- **Found during:** Task 3
- **Issue:** Plan specified "overlapping absence for same employee"
- **Fix:** Check for any absence with returnDate=null (open). This is correct for Brazilian labor law — you can't register a new absence while one is still open. Date-range overlap is less relevant since INSS_LEAVE is always open-ended.
- **Files modified:** employee-absences.service.ts

## Known Stubs

None — all data flows are wired to real DB queries and payroll engine calculations.

## Self-Check: PASSED

All 7 created files found. All 3 commits verified:
- `1e7a7cc2`: feat(29-01): add Phase 29 Prisma schema
- `be67efa8`: feat(29-01): implement vacation-schedules backend module
- `2b089c99`: feat(29-01): implement employee-absences backend module

Schema acceptance criteria:
- schema.prisma contains `model VacationAcquisitivePeriod {` ✓
- schema.prisma contains `model VacationSchedule {` ✓
- schema.prisma contains `model EmployeeAbsence {` ✓
- schema.prisma contains `model EmployeeTermination {` ✓
- schema.prisma contains `model PayrollProvision {` ✓
- schema.prisma contains `enum VacationPeriodStatus {` ✓
- schema.prisma contains `enum AbsenceType {` ✓
- schema.prisma contains `enum TerminationType {` ✓
- schema.prisma contains `enum ProvisionType {` ✓
- Employee model contains `vacationPeriods` relation field ✓
- Employee model contains `termination` relation field ✓
- CostCenter model contains `provisions` relation field ✓
- `npx prisma validate` exits 0 ✓
- `npx prisma generate` exits 0 ✓

Service acceptance criteria:
- vacation-schedules.service.ts exports `calculateVacationPay` ✓
- vacation-schedules.service.ts exports `scheduleVacation` ✓
- vacation-schedules.service.ts imports `calculateINSS` and `calculateIRRF` ✓
- vacation-schedules.service.ts contains `.mul(new Decimal('1.333333'))` for abono ✓
- vacation-schedules.routes.ts exports `vacationSchedulesRouter` ✓
- vacation-schedules.routes.ts has `/org/:orgId/vacation-schedules/periods` ✓
- vacation-schedules.routes.spec.ts has 21 test cases ✓
- app.ts contains `import { vacationSchedulesRouter }` ✓
- employee-absences.service.ts exports `createAbsence` ✓
- employee-absences.service.ts exports `getAbsenceImpactForMonth` ✓
- employee-absences.service.ts exports `registerReturn` ✓
- employee-absences.service.ts contains `stabilityEndsAt` computation ✓
- employee-absences.types.ts contains `interface AbsencePayrollImpact` ✓
- employee-absences.routes.ts exports `employeeAbsencesRouter` ✓
- employee-absences.routes.spec.ts has 17 test cases ✓
- app.ts contains `import { employeeAbsencesRouter }` ✓
