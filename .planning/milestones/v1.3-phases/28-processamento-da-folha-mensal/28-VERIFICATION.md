---
phase: 28-processamento-da-folha-mensal
verified: 2026-03-24T03:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: true
gaps:
  - truth: 'User can register salary advance (individual or batch) via UI — SalaryAdvanceModal opens from PayrollRunsPage'
    status: resolved
    reason: "Fixed in commit 6dfc2061 — SalaryAdvanceModal imported and wired to 'Registrar Adiantamento' button with showAdvanceModal state."
human_verification:
  - test: 'Run 4-step payroll wizard end-to-end in browser'
    expected: 'Wizard opens, steps navigate correctly, processing animation shows, run appears in table as CALCULATED'
    why_human: 'Multi-step form flow with async processing cannot be verified without running the app'
  - test: 'Close a CALCULATED run and verify CP creation'
    expected: 'Status changes to COMPLETED, Contas a Pagar entries appear for net salary + employer charges'
    why_human: 'Integration between payroll close and Contas a Pagar requires a live DB'
  - test: 'Revert a COMPLETED run by typing the run reference in ConfirmDeleteModal'
    expected: 'Status changes to REVERTED, CPs cancelled, timesheets unlocked'
    why_human: 'Typing confirmation and downstream CP cancellation require a live environment'
  - test: 'Download payslip ZIP and open individual PDF'
    expected: 'ZIP contains one PDF per employee, PDF has tabular layout with proventos/descontos/totais/bases'
    why_human: 'PDF content quality and layout cannot be verified programmatically'
  - test: 'Process 13th salary 1st parcel and verify no INSS/IRRF on receipt'
    expected: 'Gross = salary * monthsWorked / 12 / 2, net = gross, no deductions'
    why_human: 'Two-parcel 13th flow requires end-to-end state across runs'
  - test: 'Employee ficha Holerites tab shows history and download works'
    expected: 'Last 12 payslips listed, download triggers PDF blob from /employees/:id/payslips/:month'
    why_human: 'Tab visibility on employee detail page requires a live browser'
---

# Phase 28: Processamento da Folha Mensal — Verification Report

**Phase Goal:** Contador pode processar folha mensal em lote com cálculo automático completo por colaborador, gerar holerites em PDF para entrega por email e app, registrar e descontar adiantamentos salariais, e processar o 13º salário nas duas parcelas — com fechamento imutável e integração com ficha do colaborador

**Verified:** 2026-03-24T23:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                | Status   | Evidence                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PayrollRun, PayrollRunItem, SalaryAdvance models exist in Prisma schema with correct enums           | VERIFIED | schema.prisma lines 8183-8291: all 3 models + PayrollRunType/PayrollRunStatus enums present with @@unique constraints                                |
| 2   | Payroll calculation service correctly computes gross salary, deductions, and net for a monthly run   | VERIFIED | payroll-calculation.service.ts exports calculateEmployeePayroll; 10 tests pass including INSS/IRRF/FGTS orchestration                                |
| 3   | 13th salary calculation handles both first parcel (no deductions) and second parcel (with INSS/IRRF) | VERIFIED | calculateThirteenthSalary exported; tests verify parcel=FIRST (net=gross) and parcel=SECOND (INSS/IRRF deducted + firstParcelAmount)                 |
| 4   | Pro-rata salary calculated correctly for mid-month admissions                                        | VERIFIED | Test: "mid-month admission (day 15 in March = 31 days) — proRataDays=17" passes                                                                      |
| 5   | DSR on overtime uses actual Sundays+holidays from date-holidays, not a fixed factor                  | VERIFIED | import Holidays from 'date-holidays' at line 6; test "600 minutes overtime50 — dsrValue uses actual rest days" passes (55ms — real computation)      |
| 6   | Salary advance module: individual + batch creation, CP integration, receipt PDF, listing             | VERIFIED | salary-advances.service.ts exports all 4 functions; originType='SALARY_ADVANCE' present; 6 tests pass                                                |
| 7   | PayrollRun state machine works: PENDING->PROCESSING->CALCULATED->COMPLETED->REVERTED                 | VERIFIED | payroll-runs.service.ts: all transitions present; 11 tests pass covering full lifecycle                                                              |
| 8   | Close run creates CPs with correct originTypes; revert cancels them and unlocks timesheets           | VERIFIED | originType 'PAYROLL_RUN_ITEM', 'PAYROLL_EMPLOYER_INSS', 'PAYROLL_EMPLOYER_FGTS' present; status='LOCKED' and status='CANCELLED' confirmed            |
| 9   | Payslip PDF generates tabular layout, ZIP download works, email on close                             | VERIFIED | generatePayslipPdf exports; 'RECIBO DE PAGAMENTO', 'PROVENTO', 'DESCONTO', Intl.NumberFormat present; 3 PDF tests pass; downloadPayslipsZip exported |
| 10  | SalaryAdvanceModal opens from PayrollRunsPage when user clicks "Registrar Adiantamento"              | VERIFIED | Fixed in 6dfc2061 — SalaryAdvanceModal imported, showAdvanceModal state added, button wired, modal rendered with orgId from useAuth                  |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                                                    | Provides                                                 | Status   | Details                                                                                                                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                         | PayrollRun, PayrollRunItem, SalaryAdvance models + enums | VERIFIED | Lines 8183-8291, all models + constraints present                                                                                                                      |
| `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts`      | calculateEmployeePayroll, calculateThirteenthSalary      | VERIFIED | Both exports present, imports from payroll-engine, date-holidays, ROUND_HALF_UP                                                                                        |
| `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` | Unit tests for calculation logic                         | VERIFIED | 10 tests, all passing                                                                                                                                                  |
| `apps/backend/src/modules/salary-advances/salary-advances.service.ts`       | CRUD + batch advance + receipt PDF                       | VERIFIED | All 4 functions exported, originType='SALARY_ADVANCE' present                                                                                                          |
| `apps/backend/src/modules/salary-advances/salary-advances.routes.ts`        | 4 REST endpoints                                         | VERIFIED | POST /, POST /batch, GET /, GET /:id/receipt all registered; /batch before /:id/receipt                                                                                |
| `apps/backend/src/modules/salary-advances/salary-advances.routes.spec.ts`   | Integration tests                                        | VERIFIED | 6 tests passing                                                                                                                                                        |
| `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts`             | Run orchestrator full lifecycle                          | VERIFIED | createRun, processRun, recalculateEmployee, closeRun, revertRun, downloadPayslipsZip all exported                                                                      |
| `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts`              | Payslip PDF generation                                   | VERIFIED | generatePayslipPdf exported, pdfkit dynamic import, classic tabular layout                                                                                             |
| `apps/backend/src/modules/payroll-runs/payroll-runs.routes.ts`              | REST endpoints for payroll runs                          | VERIFIED | POST /, GET /, GET /preview/:runId (before /:id), GET /:id, POST /:id/process, POST /:id/recalculate/:employeeId, POST /:id/close, POST /:id/revert, GET /:id/payslips |
| `apps/backend/src/modules/payroll-runs/payroll-runs.routes.spec.ts`         | Integration tests                                        | VERIFIED | 11 tests, all passing                                                                                                                                                  |
| `apps/frontend/src/types/payroll-runs.ts`                                   | TypeScript types for frontend                            | VERIFIED | PayrollRun, PayrollRunItem, SalaryAdvance, WizardEmployeePreview, RUN_TYPE_LABELS, RUN_STATUS_LABELS all present                                                       |
| `apps/frontend/src/hooks/usePayrollRuns.ts`                                 | Hook with full CRUD + download                           | VERIFIED | createRun, processRun, closeRun, revertRun, downloadPayslips all present; uses useAuth internally                                                                      |
| `apps/frontend/src/hooks/useSalaryAdvances.ts`                              | Hook for salary advances                                 | VERIFIED | createAdvance, createBatchAdvances, downloadReceipt present; uses useAuth internally                                                                                   |
| `apps/frontend/src/pages/PayrollRunsPage.tsx`                               | Main listing page with tabs                              | VERIFIED | Page renders with Rodadas/Adiantamentos tabs, table, filters, usePayrollRuns wired, SalaryAdvanceModal connected (fixed 6dfc2061)                                      |
| `apps/frontend/src/components/payroll/PayrollRunWizard.tsx`                 | 4-step wizard modal                                      | VERIFIED | role="dialog", aria-modal="true", step state, Processar button, Processando text all present                                                                           |
| `apps/frontend/src/components/payroll/PayrollRunDetailModal.tsx`            | Run detail with close/revert                             | VERIFIED | Fechar Folha, Estornar Folha, ConfirmDeleteModal with runReference typing confirmation                                                                                 |
| `apps/frontend/src/components/payroll/PayrollRunStatusBadge.tsx`            | Status chip component                                    | VERIFIED | All 7 statuses (PENDING through PENDING_TIMESHEET) with aria-hidden="true" on icons                                                                                    |
| `apps/frontend/src/components/payroll/PayrollRunItemRow.tsx`                | Row in detail items table                                | VERIFIED | "Recalcular" aria-label present                                                                                                                                        |
| `apps/frontend/src/components/payroll/SalaryAdvanceModal.tsx`               | Individual/batch advance modal                           | VERIFIED | mode prop, createAdvance/createBatchAdvances wired, aria-required, role="alert", 40% default                                                                           |
| `apps/frontend/src/components/employees/tabs/PayslipTab.tsx`                | Payslips tab on employee ficha                           | VERIFIED | api.get call to /employees/:id/payslips, api.getBlob for download, FileText empty state, "Nenhum holerite disponivel"                                                  |
| `apps/frontend/src/components/layout/Sidebar.tsx`                           | Navigation with Folha de Pagamento                       | VERIFIED | /payroll-runs path, "Folha de Pagamento" label at line 259                                                                                                             |
| `apps/frontend/src/App.tsx`                                                 | Route for /payroll-runs                                  | VERIFIED | lazy import PayrollRunsPage, Route path="/payroll-runs" at line 247                                                                                                    |
| `apps/frontend/src/pages/EmployeeDetailPage.tsx`                            | Employee detail with Holerites tab                       | VERIFIED | 'Holerites' tab label, PayslipTab import, PayslipTab rendered                                                                                                          |

### Key Link Verification

| From                                         | To                                     | Via                                                        | Status   | Details                                                                           |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| payroll-calculation.service.ts               | payroll-engine.service.ts              | import calculateINSS, calculateIRRF, etc.                  | VERIFIED | Line 14: `from '../payroll-engine/payroll-engine.service'`                        |
| payroll-runs.service.ts                      | payroll-calculation.service.ts         | import calculateEmployeePayroll, calculateThirteenthSalary | VERIFIED | Line 13: `from './payroll-calculation.service'`                                   |
| payroll-runs.service.ts                      | payables model                         | tx.payable.create with originType='PAYROLL_RUN_ITEM'       | VERIFIED | Lines 698, 745, 762                                                               |
| payroll-runs.service.ts                      | timesheets model                       | tx.timesheet.update status='LOCKED'                        | VERIFIED | Line 711: `data: { status: 'LOCKED', payrollRunId: runId }`                       |
| salary-advances.service.ts                   | payables model                         | tx.payable.create originType='SALARY_ADVANCE'              | VERIFIED | Lines 137-148                                                                     |
| PayrollRunsPage.tsx                          | usePayrollRuns hook                    | const { runs, loading } = usePayrollRuns()                 | VERIFIED | Line 97: usePayrollRuns() called, runs rendered in table                          |
| PayrollRunWizard.tsx                         | usePayrollRuns.createRun + processRun  | createRun then processRun on step 4                        | VERIFIED | Both functions called in wizard step transitions                                  |
| PayslipTab.tsx                               | GET /org/:orgId/employees/:id/payslips | api.get call                                               | VERIFIED | Line 62-63                                                                        |
| Sidebar.tsx                                  | /payroll-runs route                    | navigation link                                            | VERIFIED | Line 259                                                                          |
| PayrollRunsPage.tsx "Registrar Adiantamento" | SalaryAdvanceModal                     | onClick opens modal                                        | VERIFIED | Fixed 6dfc2061 — showAdvanceModal state, SalaryAdvanceModal imported and rendered |

### Data-Flow Trace (Level 4)

| Artifact            | Data Variable | Source                                                    | Produces Real Data                                      | Status  |
| ------------------- | ------------- | --------------------------------------------------------- | ------------------------------------------------------- | ------- |
| PayrollRunsPage.tsx | runs[]        | usePayrollRuns() → api.get /org/:orgId/payroll-runs       | Yes — fetches from backend, renders in table            | FLOWING |
| PayrollRunsPage.tsx | advances[]    | useSalaryAdvances() → api.get /org/:orgId/salary-advances | Yes — fetches from backend, renders in table            | FLOWING |
| PayslipTab.tsx      | payslips[]    | api.get /org/:orgId/employees/:id/payslips on mount       | Yes — fetches from backend, filtered for COMPLETED runs | FLOWING |

### Behavioral Spot-Checks

| Behavior                                           | Command                                                    | Result                          | Status |
| -------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | ------ |
| payroll-calculation.service.spec — all tests pass  | `pnpm jest payroll-calculation.service.spec --no-coverage` | 10 passed, 0 failed             | PASS   |
| salary-advances.routes.spec — all tests pass       | `pnpm jest salary-advances --no-coverage`                  | 6 passed, 0 failed              | PASS   |
| payroll-runs.routes.spec — all tests pass          | `pnpm jest payroll-runs.routes.spec --no-coverage`         | 11 passed, 0 failed             | PASS   |
| payroll-pdf.service.spec — PDF generates correctly | `pnpm jest payroll-pdf.service.spec --no-coverage`         | 3 passed, %PDF buffer confirmed | PASS   |
| Frontend TypeScript compiles cleanly               | `npx tsc --noEmit`                                         | No errors                       | PASS   |

### Requirements Coverage

| Requirement | Source Plans        | Description                                                                                                   | Status    | Evidence                                                                                                                            |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FOLHA-02    | 28-01, 28-03, 28-04 | Processamento folha mensal em lote com cálculo automático, preview, recálculo, fechamento imutável, estorno   | SATISFIED | PayrollRun state machine complete; wizard UI; close/revert with CP integration; 11 backend tests                                    |
| FOLHA-03    | 28-02, 28-05        | Adiantamento salarial com limite, lote dia 15, desconto automático, recibo PDF, integração CP                 | SATISFIED | Backend (6 tests) + SalaryAdvanceModal wired to PayrollRunsPage (fixed 6dfc2061)                                                    |
| FOLHA-04    | 28-03, 28-05        | Holerite PDF individual/lote, email, histórico na ficha do colaborador                                        | SATISFIED | generatePayslipPdf generates valid PDF; ZIP download works; PayslipTab on employee ficha fetches and displays history with download |
| FOLHA-05    | 28-01, 28-03, 28-04 | 13º salário em 2 parcelas (1ª sem descontos, 2ª com INSS/IRRF), proporcional, encargos, integração financeira | SATISFIED | calculateThirteenthSalary verified with both parcels; THIRTEENTH_FIRST/SECOND run types handled in processRun; tests pass           |

### Anti-Patterns Found

None — all anti-patterns resolved. (Previous: SalaryAdvanceModal TODO stub fixed in 6dfc2061)

### Human Verification Required

#### 1. 4-Step Wizard End-to-End

**Test:** Navigate to /payroll-runs, click "Iniciar Folha", step through the wizard selecting a competencia, reviewing employee timesheet status chips, confirming employee selection, and triggering processing.
**Expected:** Wizard opens with role="dialog" (accessible), step indicator shows progress, employees without approved timesheet shown with warning chip, processing animation plays, run appears in table as CALCULATED after completion.
**Why human:** Multi-step form flow with async API calls and progress feedback cannot be verified without running the app.

#### 2. Fechar Folha — CP Creation Integration

**Test:** Click Eye icon on a CALCULATED run, click "Fechar Folha", confirm.
**Expected:** Status changes to COMPLETED, Contas a Pagar entries appear for net salary (per employee), employer INSS patronal (single CP), and FGTS (single CP), with correct due dates (salary 5th business day, FGTS 7th, INSS 20th of following month).
**Why human:** CP creation and due date logic require a live database.

#### 3. Estorno with ConfirmDeleteModal Typing

**Test:** On a COMPLETED run, click "Estornar Folha", verify ConfirmDeleteModal appears, type the run reference (e.g. "2026-03 MENSAL"), confirm.
**Expected:** Status changes to REVERTED, all related CPs set to CANCELLED, timesheets unlocked (status=APPROVED, payrollRunId=null).
**Why human:** Typing confirmation UI and downstream effects require a live browser and DB.

#### 4. Payslip PDF Layout

**Test:** Download ZIP from a COMPLETED run, open individual PDFs.
**Expected:** Classic tabular layout with header (org name, CNPJ, employee info, competencia), Proventos table (code, description, reference, value), Descontos table, totais row (JetBrains Mono values), bases row (INSS/IRRF/FGTS), signature line.
**Why human:** PDF visual layout and readability require human review.

#### 5. 13th Salary Two-Parcel Flow

**Test:** Process THIRTEENTH_FIRST run for a month, verify no INSS/IRRF on items. Then process THIRTEENTH_SECOND run, verify INSS/IRRF deducted and first parcel amount offset.
**Expected:** First parcel: net = proportional / 2. Second parcel: full year gross with HE averages, minus INSS, minus IRRF, minus first parcel amount.
**Why human:** Two-run sequence with HE average calculation from annual timesheets requires a live environment.

#### 6. Employee Ficha Holerites Tab

**Test:** Navigate to an employee detail page, click the "Holerites" tab, verify payslips appear, click download icon.
**Expected:** Table shows competencia, tipo, bruto, liquido columns; download triggers PDF blob; REVERTED run payslips excluded.
**Why human:** Tab rendering on employee detail page and blob download require a live browser.

### Gaps Summary

All gaps resolved. The SalaryAdvanceModal wiring gap was fixed in commit 6dfc2061. All 10/10 truths verified, all 4 requirements (FOLHA-02 through FOLHA-05) satisfied.

---

_Verified: 2026-03-24T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
