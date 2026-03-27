---
phase: 28-processamento-da-folha-mensal
plan: 01
subsystem: database
tags: [prisma, payroll, decimal.js, date-holidays, postgresql, typescript]

# Dependency graph
requires:
  - phase: 26-parametros-folha-motor-calculo
    provides: payroll engine functions (calculateINSS, calculateIRRF, calculateFGTS, calculateSalaryFamily, calculateRuralNightPremium, calculateRuralUtilityDeductions)
  - phase: 27-controle-de-ponto-e-jornada
    provides: Timesheet model with approval state and HE/noturno totals

provides:
  - PayrollRun, PayrollRunItem, SalaryAdvance Prisma models with enums and constraints
  - calculateEmployeePayroll function: pro-rata, overtime, DSR, night premium, INSS/IRRF/FGTS, deductions, lineItems
  - calculateThirteenthSalary function: first parcel (no deductions) and second parcel (with INSS/IRRF)
  - EngineParams interface for passing legal tables to calculation functions
  - VALID_PAYROLL_TRANSITIONS state machine map

affects:
  - 28-02 (payroll run service will use PayrollRun model and calculateEmployeePayroll)
  - 28-03 (payroll routes and wizard will import from payroll-runs module)
  - 28-04 (payslip PDF service uses PayrollRunItem.lineItemsJson)
  - 28-05 (salary advances service uses SalaryAdvance model)
  - 28-06 (thirteenth salary will use calculateThirteenthSalary)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with RED→GREEN cycle for calculation services"
    - "UTC date methods for timezone-safe month comparisons"
    - "date-holidays lazy cache keyed by BR-state for DSR counting"
    - "prisma db push + migrate resolve pattern (shadow DB out of sync)"

key-files:
  created:
    - apps/backend/prisma/migrations/20260505100000_add_payroll_run_models/migration.sql
    - apps/backend/src/modules/payroll-runs/payroll-runs.types.ts
    - apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma

key-decisions:
  - "UTC date methods (getUTCFullYear, getUTCMonth, getUTCDate) used in pro-rata calculation to avoid timezone-induced off-by-one on ISO date strings"
  - "EngineParams interface encapsulates all legal table values passed to calculation — callers load from payrollTablesService then pass in"
  - "DSR counts actual Sundays + holidays from date-holidays for the reference month, not fixed 4.33 factor"
  - "SalaryAdvance.payableId has @unique (one payable per advance) — no DB unique needed on nullable (originType, originId)"

patterns-established:
  - "calculateEmployeePayroll: pure function receiving input + referenceMonth + engineParams, returns EmployeePayrollResult with all breakdown fields"
  - "lineItems array: each monetary component is a line item with code, description, reference, type (PROVENTO/DESCONTO), value"

requirements-completed: [FOLHA-02, FOLHA-05]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 28 Plan 01: Payroll Schema + Calculation Service Summary

**PayrollRun/PayrollRunItem/SalaryAdvance Prisma models + calculateEmployeePayroll with pro-rata, DSR via date-holidays, and calculateThirteenthSalary with 10 unit tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T21:08:43Z
- **Completed:** 2026-03-24T21:14:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three Prisma models (PayrollRun, PayrollRunItem, SalaryAdvance) with enums, constraints, and relations applied via migration 20260505100000
- calculateEmployeePayroll: full monthly salary calculation with pro-rata, overtime 50%/100%, DSR on overtime using actual Sundays+holidays from date-holidays, night premium, salary family, INSS progressive, IRRF with 2026 redutor, utility deductions (housing/food capped per Lei 5.889/73), VT, advances, employer charges (FGTS + INSS patronal), and complete lineItems array
- calculateThirteenthSalary: first parcel (no deductions, half of proportional) and second parcel (full proportional minus INSS/IRRF/firstParcel)
- 10 unit tests passing covering all plan behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + types** - `6db18c42` (feat)
2. **Task 2: Payroll calculation service + 10 tests** - `68661752` (feat)

## Files Created/Modified
- `apps/backend/prisma/schema.prisma` - PayrollRun, PayrollRunItem, SalaryAdvance models + enums, relation fields on Employee and Organization
- `apps/backend/prisma/migrations/20260505100000_add_payroll_run_models/migration.sql` - DDL for new tables, indexes, foreign keys
- `apps/backend/src/modules/payroll-runs/payroll-runs.types.ts` - PayrollRunError, VALID_PAYROLL_TRANSITIONS, EmployeePayrollInput/Result, ThirteenthSalaryInput, EngineParams
- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts` - calculateEmployeePayroll + calculateThirteenthSalary pure functions
- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` - 10 Jest unit tests

## Decisions Made
- UTC date methods used in pro-rata comparison to prevent timezone-induced off-by-one bug when admissionDate is an ISO date string parsed as UTC midnight
- EngineParams interface introduced so callers load legal tables from DB once and pass to pure calculation functions — avoids DB calls inside calculation logic
- Existing `salary-advances.types.ts` was already complete from prior work; no changes needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pro-rata test initially failed: `new Date('2026-03-15')` creates UTC midnight which getMonth() returns previous day in negative-offset timezones. Fixed by using getUTCFullYear/getUTCMonth/getUTCDate consistently in the service.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PayrollRun/PayrollRunItem/SalaryAdvance models available in Prisma client
- calculateEmployeePayroll and calculateThirteenthSalary ready for use by payroll-runs.service in plan 28-02
- EngineParams interface defines the contract for loading legal tables before starting a run

---
*Phase: 28-processamento-da-folha-mensal*
*Completed: 2026-03-24*
