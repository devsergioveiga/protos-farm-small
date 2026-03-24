---
phase: 28-processamento-da-folha-mensal
plan: "03"
subsystem: payroll
tags: [payroll-runs, orchestrator, pdf, email, state-machine, per-employee-tx]
dependency_graph:
  requires:
    - 28-01 (PayrollRun schema + calculation service)
    - 28-02 (SalaryAdvance module)
  provides:
    - PayrollRun full lifecycle orchestrator
    - Payslip PDF generation (pdfkit A4 tabular)
    - REST API 9 endpoints for payroll processing
  affects:
    - Payables (creates PAYROLL_RUN_ITEM, PAYROLL_EMPLOYER_INSS, PAYROLL_EMPLOYER_FGTS)
    - Timesheets (LOCKED on close, APPROVED on revert)
    - SalaryAdvance (deductedInRunId set/cleared)
tech_stack:
  added:
    - JSZip for payslips ZIP download
    - pdfkit (dynamic import) for PDF generation
  patterns:
    - Per-employee $transaction pattern (mirrors depreciation-batch)
    - VALID_PAYROLL_TRANSITIONS state machine guards
    - originType/originId on Payable for idempotent CP linkage
key_files:
  created:
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.routes.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.routes.spec.ts
    - apps/backend/src/modules/payroll-runs/payroll-pdf.service.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - THIRTEENTH runs skip timesheet gate (no timesheet needed for 13th salary)
  - Individual PDF failures do not abort closeRun (try/catch per employee)
  - preview/:runId registered BEFORE /:id to prevent Express 5 route shadowing
  - cnpj field not selected from Organization (not in Prisma schema) — routes cast to any
metrics:
  duration_minutes: 11
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
  tests_added: 14
  tests_total_suite: 24
---

# Phase 28 Plan 03: PayrollRun Orchestrator + PDF + Routes Summary

One-liner: PayrollRun orchestrator with per-employee transactions, pdfkit payslip PDF, 9 REST endpoints, and 14 new tests (24 total in module).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | PayrollRun orchestrator service (TDD: spec RED then GREEN) | b975fd9a | payroll-runs.service.ts, payroll-pdf.service.ts, payroll-runs.routes.spec.ts |
| 2 | Payslip PDF spec + routes + app registration | 631bdb96 | payroll-pdf.service.spec.ts, payroll-runs.routes.ts, app.ts |

## What Was Built

### payroll-runs.service.ts

Full PayrollRun lifecycle orchestrator:

- **createRun**: Duplicate check (unique org+month+type constraint), creates PENDING run
- **processRun**: PENDING→PROCESSING→CALCULATED; per-employee `$transaction` pattern; timesheet gate (PENDING_TIMESHEET for unapproved); THIRTEENTH runs skip timesheet gate; HE averages computed from year timesheets for SECOND parcel
- **recalculateEmployee**: Delete+recreate item pattern for CALCULATED runs; CALCULATED→PROCESSING→CALCULATED
- **closeRun**: Per-employee Payable (originType=PAYROLL_RUN_ITEM), lock timesheets (status=LOCKED), deduct salary advances; employer INSS patronal (due 20th) and FGTS (due 7th); PDF generation + email sending with try/catch to prevent abort; CALCULATED→COMPLETED
- **revertRun**: Cancel all CPs (PAYROLL_RUN_ITEM + PAYROLL_EMPLOYER_INSS + PAYROLL_EMPLOYER_FGTS), unlock timesheets (APPROVED), reset advance deductedInRunId; COMPLETED→REVERTED
- **listRuns**: Paginated with status/runType/referenceMonth filters
- **getRun**: Includes items with employee name
- **downloadPayslipsZip**: JSZip with one PDF per CALCULATED item, DEFLATE compression
- **getEmployeePayslips**: Last 12 months of holerites for employee ficha tab

Due dates: salary = 5th business day of following month; FGTS = 7th; INSS patronal = 20th.

### payroll-pdf.service.ts

`generatePayslipPdf(data: PayslipData): Promise<Buffer>` using pdfkit dynamic import:
- Header: org name, CNPJ, "RECIBO DE PAGAMENTO" right-aligned, employee info, competência
- Proventos table with CODIGO/DESCRICAO/REF/VALOR columns
- Descontos table (same layout)
- Totais row in green (#2E7D32) with TOTAL PROVENTOS / TOTAL DESCONTOS / LÍQUIDO
- Rodapé bases: Base INSS, Base IRRF, FGTS do Mês
- Signature line at bottom

### payroll-runs.routes.ts (9 endpoints)

```
POST   /org/:orgId/payroll-runs                        — create run
GET    /org/:orgId/payroll-runs                        — list with filters
GET    /org/:orgId/payroll-runs/preview/:runId         — employee+timesheet preview
GET    /org/:orgId/payroll-runs/:id                    — get run + items
POST   /org/:orgId/payroll-runs/:id/process            — start batch processing
POST   /org/:orgId/payroll-runs/:id/recalculate/:eid   — recalculate one employee
POST   /org/:orgId/payroll-runs/:id/close              — finalize + CPs + PDFs + email
POST   /org/:orgId/payroll-runs/:id/revert             — estorno
GET    /org/:orgId/payroll-runs/:id/payslips           — ZIP all PDFs
GET    /org/:orgId/payroll-runs/:id/items/:iid/payslip — individual PDF
```

## Test Results

```
PASS payroll-calculation.service.spec.ts  — 10 tests (from Plan 01)
PASS payroll-pdf.service.spec.ts          —  3 tests
PASS payroll-runs.routes.spec.ts          — 11 tests
─────────────────────────────────────────────────────
Total: 24 tests, 3 suites, 0 failures
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] THIRTEENTH runs were creating PENDING_TIMESHEET items instead of calling calculateThirteenthSalary**
- **Found during:** Task 1 TDD (test failure on THIRTEENTH_FIRST test case)
- **Issue:** The timesheet gate was applied to ALL run types, but THIRTEENTH salary calculation doesn't require a timesheet
- **Fix:** Added `isThirteenth` flag that skips the timesheet findFirst + PENDING_TIMESHEET branch
- **Files modified:** payroll-runs.service.ts
- **Commit:** b975fd9a

**2. [Rule 1 - Bug] TypeScript error: Organization.cnpj not in Prisma select (not in schema)**
- **Found during:** Task 2 TypeScript check
- **Issue:** The individual payslip route tried to select `cnpj` from Organization but it's not in the schema
- **Fix:** Removed cnpj from Organization select, left orgCnpj as empty string in PDF data
- **Files modified:** payroll-runs.routes.ts

## Known Stubs

None — all core functions are implemented. The `orgCnpj` field in `generatePayslipPdf` will be blank until Organization model gains a `cnpj` field (tracked in schema evolution).

## Self-Check: PASSED
