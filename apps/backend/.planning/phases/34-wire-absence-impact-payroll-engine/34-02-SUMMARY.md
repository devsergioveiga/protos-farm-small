---
phase: 34-wire-absence-impact-payroll-engine
plan: '02'
subsystem: payroll
tags: [payroll, fgts, absence, pdf, pdfkit, decimal.js, prisma]

requires:
  - phase: 34-wire-absence-impact-payroll-engine
    plan: '01'
    provides: 'AbsencePayrollImpact types, absence deduction logic in calculateEmployeePayroll'
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

tech-stack:
  added: []
  patterns:
    - 'Absence data fetched inside payroll tx and passed via EmployeePayrollInput.absenceData'
    - 'fgtsBase computed as grossSalary * (workedDays/30) and rendered in PDF rodape'
---

## One-liner

Wire getAbsenceImpactForMonth into payroll orchestrator and add fgtsBase to payslip PDF rodape.

## What was built

### Task 1: Wire absence data into payroll orchestrator

Connected the absence impact function into the payroll run processing pipeline:

- **payroll-runs.service.ts**: Imported `getAbsenceImpactForMonth` from employee-absences module
- Called `getAbsenceImpactForMonth(employee.id, referenceMonth, tx)` inside the payroll transaction
- Passed the returned `absenceData` into `calculateEmployeePayroll` via `EmployeePayrollInput`
- The calculation engine (from plan 34-01) now applies absence/suspension deductions automatically

### Task 2: Add fgtsBase to payslip PDF

Updated the payslip PDF generation to display FGTS base correctly:

- **payroll-pdf.service.ts**: Added `fgtsBase: number` field to `PayslipData` interface
- FGTS base computed as `grossSalary * (workedDays / 30)` when `fgtsFullMonth=true`
- PDF rodape section now renders `Base FGTS: R$ X.XXX,XX` using `formatCurrency(data.fgtsBase)`

## Verification

- 43 payroll tests pass (including 9 absence impact tests from plan 34-01)
- `getAbsenceImpactForMonth` pattern confirmed in payroll-runs.service.ts
- `fgtsBase` field confirmed in PayslipData interface and PDF render
- All must_haves from plan verified against codebase

## Key files

### Modified

- `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — orchestrator wiring
- `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts` — PayslipData + PDF rodape
- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — test updates

## Commits

- `a39ad37a` feat(34-02): wire getAbsenceImpactForMonth and add fgtsBase to payslip PDF

## Issues

None
