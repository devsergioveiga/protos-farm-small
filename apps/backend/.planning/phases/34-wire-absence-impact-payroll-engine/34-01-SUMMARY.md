---
phase: 34-wire-absence-impact-payroll-engine
plan: "01"
subsystem: payroll-engine
tags: [payroll, absences, tdd, deductions, inss, fgts, dsr]
dependency_graph:
  requires: [employee-absences module (AbsencePayrollImpact type)]
  provides: [absence/suspension deduction logic in calculateEmployeePayroll, extended EmployeePayrollInput/Result types]
  affects: [payroll-runs service (consumes calculateEmployeePayroll), payroll PDF output]
tech_stack:
  added: []
  patterns: [TDD red-green, proportional deduction arithmetic with Decimal.js, salary floor guard]
key_files:
  created: []
  modified:
    - apps/backend/src/modules/payroll-runs/payroll-runs.types.ts
    - apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts
decisions:
  - "absenceInssDeduction applied to adjustedSalary (post-prorata) to achieve cumulative effect (D-02)"
  - "inssIrrfBase computed from reduced salary for INSS/IRRF — not grossSalary (D-04)"
  - "fgtsBase uses full baseSalary when fgtsFullMonth=true, otherwise grossSalary (D-07)"
  - "DSR reduced proportionally by suspendedDays/workDays when suspension exists (D-10)"
  - "netSalary floored at zero via Decimal.max guard (Pitfall 5)"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-26T23:49:22Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 34 Plan 01: Absence Impact Wiring in Payroll Engine Summary

TDD implementation of FERIAS-02: absences (INSS leave, suspension) now automatically impact payroll calculation with correct salary proration, INSS/IRRF base reduction, FGTS full-month override, and DSR suspension impact — implemented via proportional Decimal arithmetic applied to adjustedSalary (post-prorata) with net salary floor guard.

## What Was Built

### Types Extended (payroll-runs.types.ts)

- Added `import type { AbsencePayrollImpact }` from employee-absences module
- Added `absenceData?: AbsencePayrollImpact | null` to `EmployeePayrollInput` (after `timesheetData`)
- Added three new output fields to `EmployeePayrollResult`:
  - `absenceInssDeduction: Decimal` — deduction for INSS-paid absence days
  - `suspensionDeduction: Decimal` — deduction for disciplinary suspension days
  - `fgtsBase: Decimal` — the actual base used for FGTS calculation (for display in PDF rodapé)

### Calculation Engine (payroll-calculation.service.ts)

Six new computation steps inserted into `calculateEmployeePayroll`:

| Step | Decision | What It Does |
|------|----------|--------------|
| 1b | D-01, D-02 | `absenceInssDeduction = inssPaidDays/totalDays * adjustedSalary` |
| 1c | D-09 | `suspensionDeduction = suspendedDays/totalDays * adjustedSalary` |
| 1d | D-04 | `salaryForInssBase = adjustedSalary - absenceInssDeduction - suspensionDeduction` |
| 4b | D-10 | DSR reduced by `suspendedDays/workDays` when suspension exists |
| 8b | D-04 | `inssIrrfBase` built from `salaryForInssBase + OT + DSR + night + family + provisions` |
| 14 | D-07 | `fgtsBase = absenceData?.fgtsFullMonth ? baseSalary + variable : grossSalary` |

Net salary:
- Subtracts `absenceInssDeduction` and `suspensionDeduction`
- Floored at zero via `Decimal.max(netSalary, new Decimal(0))` (Pitfall 5)

Line items added when deductions > 0:
- Code `0900` "Afastamento INSS" with reference `N/31d`
- Code `0910` "Suspensão Disciplinar" with reference `N/31d`

`calculateThirteenthSalary` returns include the three new fields with defaults (`new Decimal(0)`, `new Decimal(0)`, `grossBase`).

### Tests (payroll-calculation.service.spec.ts)

9 new test cases in `describe('absence impact')` inside `describe('calculateEmployeePayroll')`:

1. INSS absence 10 days — code `0900`, value `967.74` (10/31 * 3000) (D-01)
2. Suspension 3 days — code `0910`, value `290.32` (3/31 * 3000) (D-09)
3. INSS/IRRF base reduction — `inssAmount` less than full-salary result (D-04)
4. `fgtsFullMonth=true` — `fgtsBase = 3000`, `fgtsAmount = 240.00` (D-07)
5. Mid-month admission (day 16) + 5 INSS days — `proRataDays=16`, `absenceInssDeduction=249.74` (D-02)
6. Suspension 2 days reduces DSR below no-suspension baseline (D-10)
7. No `absenceData` — zero deductions, `fgtsBase = 3000` (regression)
8. All-zero `absenceData` — zero deductions, no 0900/0910 line items
9. Net salary floor — `netSalary >= 0` when deductions exceed gross (Pitfall 5)

All 19 tests pass (9 new + 10 pre-existing).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e0c3a180 | test | add failing absence impact tests (RED) — types extended, 9 failing tests |
| 3e4bd820 | feat | implement absence deduction logic (GREEN) — all 19 tests pass |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all absence deduction fields are computed from real `absenceData` input; no hardcoded or placeholder values.

## Self-Check: PASSED

- `apps/backend/src/modules/payroll-runs/payroll-runs.types.ts` — contains `absenceData`, `absenceInssDeduction`, `suspensionDeduction`, `fgtsBase`
- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts` — contains `absenceInssDeduction`, `salaryForInssBase`, `calculateINSS(inssIrrfBase`, `Decimal.max(netSalary`, `absenceData?.fgtsFullMonth`, code `0900`, code `0910`
- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — contains `describe('absence impact'` with 9 test cases
- Commits e0c3a180 and 3e4bd820 exist on feature/EPIC-16-rh-folha
- All 19 tests pass (confirmed by Jest output)
