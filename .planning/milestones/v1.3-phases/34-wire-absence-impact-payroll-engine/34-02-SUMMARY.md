---
phase: 34-wire-absence-impact-payroll-engine
plan: '02'
subsystem: payroll
tags: [payroll, fgts, absence, pdf, pdfkit, decimal.js, prisma]

# Dependency graph
requires:
  - phase: 34-wire-absence-impact-payroll-engine
    plan: '01'
    provides: 'AbsencePayrollImpact types, absence deduction logic in calculateEmployeePayroll, getAbsenceImpactForMonth function'
  - phase: 29-ferias-afastamentos-rescisao-e-provisoes
    provides: 'employee-absences module with getAbsenceImpactForMonth'
  - phase: 28-processamento-da-folha-mensal
    provides: 'payroll-runs orchestrator, payroll-pdf.service, PayslipData interface'
provides:
  - 'getAbsenceImpactForMonth wired into processRun orchestrator inside transaction'
  - 'absenceData passed to calculateEmployeePayroll via EmployeePayrollInput'
  - 'PayslipData includes fgtsBase field'
  - 'Payslip PDF rodape shows Base FGTS derived correctly'
affects:
  - payroll-runs
  - payroll-pdf
  - FERIAS-02

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Absence data fetched inside payroll tx and passed via EmployeePayrollInput.absenceData'
    - 'fgtsBase derived from fgtsAmount / 0.08 at PDF re-generation call sites (DB item has no fgtsBase column)'

key-files:
  created: []
  modified:
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts

key-decisions:
  - 'Both PDF call sites use fgtsAmount/0.08 derivation (not result.fgtsBase) because the first call site also reads from stored DB item, not live result — consistent approach at both call sites'
  - 'fgtsBase derivation documents the 8% FGTS rate assumption (Lei 8.036/90) with note about apprentice support needing DB column if ever added'

patterns-established:
  - 'Absence data fetch inside payroll transaction: const absenceData = await getAbsenceImpactForMonth(employee.id, referenceMonth, tx)'
  - 'fgtsBase in PayslipData derived from fgtsAmount for stored item paths'

requirements-completed: [FERIAS-02]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 34 Plan 02: Wire Absence Impact to Payroll Engine Summary

**getAbsenceImpactForMonth wired into payroll orchestrator transaction and payslip PDF now shows Base FGTS in rodape using fgtsAmount/0.08 derivation**

## Performance

- **Duration:** ~5 min (work was already committed in a39ad37a)
- **Started:** 2026-03-27T01:14:00Z
- **Completed:** 2026-03-27T01:19:00Z
- **Tasks:** 2 (verified as complete)
- **Files modified:** 2

## Accomplishments

- `getAbsenceImpactForMonth` imported and called inside the payroll run transaction in `payroll-runs.service.ts`
- `absenceData` wired into `payrollInput` object passed to `calculateEmployeePayroll`
- `PayslipData` interface extended with `fgtsBase: number` field
- PDF rodape updated from `FGTS do Mes` to `Base FGTS: R$X    FGTS do Mês: R$X` for accurate base display
- All 43 payroll-related tests pass (19 calculation + PDF service + route tests)

## Task Commits

Work was committed atomically prior to this SUMMARY run:

1. **Task 1: Wire getAbsenceImpactForMonth + update PDF service** - `a39ad37a` (feat)
2. **Task 2: Fix test mocks and run full suite** - `a39ad37a` (included — tests already passing)

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — Added import of getAbsenceImpactForMonth, fetch call inside calculateAndCreateItem MONTHLY branch, absenceData in payrollInput, fgtsBase in both PayslipData assembly call sites
- `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts` — Added fgtsBase to PayslipData interface, updated rodape text to show "Base FGTS: R$X"

## Decisions Made

- **Both PDF call sites use fgtsAmount/0.08 derivation:** The plan preferred `result.fgtsBase.toNumber()` for the "first" call site, but both call sites in the production code read from stored DB items (`item.fgtsAmount`), not live calculation results. Using the derivation consistently avoids two different code paths and is documented with the 8% rate assumption per Lei 8.036/90.

## Deviations from Plan

None - plan executed as written. The minor deviation on fgtsBase derivation approach (using derivation at both sites rather than `result.fgtsBase` at the first) is functionally equivalent and follows a consistent pattern.

## Issues Encountered

- `npx tsc --noEmit` has pre-existing TypeScript errors in other modules (`PayableCostCenterItemCreateManyInput` type in payroll-runs.service.ts lines 795/818/844/883, and errors in other unrelated modules). These are not introduced by Plan 02 and are out of scope per deviation rules.

## Known Stubs

None — all data fields are wired to real computation values.

## Next Phase Readiness

- Phase 34 (FERIAS-02) integration complete: absence impact flows from employee-absences module through payroll orchestrator into calculation engine and payslip PDF
- No blockers for subsequent phases

---

_Phase: 34-wire-absence-impact-payroll-engine_
_Completed: 2026-03-27_
