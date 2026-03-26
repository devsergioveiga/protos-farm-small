---
phase: 28-processamento-da-folha-mensal
plan: "04"
subsystem: frontend-payroll
tags: [frontend, payroll, typescript, react, ui-components]
dependency_graph:
  requires: ["28-02", "28-03"]
  provides: ["payroll-runs-ui", "salary-advances-ui"]
  affects: ["payroll-runs-module", "salary-advances-module"]
tech_stack:
  added: []
  patterns:
    - "useState+useCallback hook pattern (no SWR)"
    - "4-step wizard modal with focus trap and Escape handling"
    - "Skeleton screens for loading state"
    - "Mobile card collapse below 768px"
    - "ConfirmDeleteModal with typing confirmation for destructive actions"
key_files:
  created:
    - apps/frontend/src/types/payroll-runs.ts
    - apps/frontend/src/hooks/usePayrollRuns.ts
    - apps/frontend/src/hooks/useSalaryAdvances.ts
    - apps/frontend/src/pages/PayrollRunsPage.tsx
    - apps/frontend/src/pages/PayrollRunsPage.css
    - apps/frontend/src/components/payroll/PayrollRunWizard.tsx
    - apps/frontend/src/components/payroll/PayrollRunWizard.css
    - apps/frontend/src/components/payroll/PayrollRunStatusBadge.tsx
    - apps/frontend/src/components/payroll/PayrollRunStatusBadge.css
    - apps/frontend/src/components/payroll/PayrollRunDetailModal.tsx
    - apps/frontend/src/components/payroll/PayrollRunDetailModal.css
    - apps/frontend/src/components/payroll/PayrollRunItemRow.tsx
  modified: []
decisions:
  - "ConfirmDeleteModal reused for estorno typing confirmation — matches high-criticality pattern from CLAUDE.md"
  - "PayrollRunsPage route and Sidebar entry already registered from a prior phase — not re-added"
  - "processRun in wizard returns unknown (backend returns PayrollRun) — typed as unknown to avoid cast"
metrics:
  duration_minutes: 9
  completed_tasks: 2
  total_tasks: 2
  files_created: 12
  files_modified: 0
  completed_date: "2026-03-24"
requirements: [FOLHA-02, FOLHA-05]
---

# Phase 28 Plan 04: Payroll Runs Frontend Summary

Frontend for payroll run management — types, hooks, 4-step wizard, runs listing page with Rodadas/Adiantamentos tabs, detail modal with close/revert actions, and status badge component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Frontend types + hooks for payroll runs | 7e29c8b6 | payroll-runs.ts, usePayrollRuns.ts, useSalaryAdvances.ts |
| 2 | PayrollRunsPage + PayrollRunWizard + PayrollRunDetailModal + StatusBadge | eba8589d | PayrollRunsPage.tsx/css, PayrollRunWizard.tsx/css, PayrollRunDetailModal.tsx/css, PayrollRunStatusBadge.tsx/css, PayrollRunItemRow.tsx |

## What Was Built

### Types (`payroll-runs.ts`)

- `PayrollRun`, `PayrollRunItem`, `SalaryAdvance`, `WizardEmployeePreview` interfaces matching backend models
- `RUN_TYPE_LABELS` and `RUN_STATUS_LABELS` label maps
- `CreateAdvanceInput`, `BatchAdvanceInput` input types

### Hooks

**`usePayrollRuns`** — Full lifecycle:
- `fetchRuns(filters)` — list with month/type/status filters
- `createRun(data)` — initiate new run
- `processRun(runId, employeeIds)` — trigger calculation
- `recalculateEmployee(runId, employeeId)` — individual recalc
- `closeRun(runId)`, `revertRun(runId)` — state transitions
- `getRun(runId)`, `getPreview(runId)` — fetch single + wizard preview
- `downloadPayslips(runId)`, `downloadItemPayslip(runId, itemId)` — PDF/ZIP download

**`useSalaryAdvances`** — CRUD + batch:
- `fetchAdvances(filters)`, `createAdvance(data)`, `createBatchAdvances(data)`
- `downloadReceipt(advanceId)` — PDF download

Both follow `useState+useCallback` pattern matching `useTimesheet` (no SWR).

### `PayrollRunStatusBadge`

7 status configurations with icon + label + CSS variable colors:
- PENDING (Clock, neutral), PROCESSING (Loader2 spinning, info), CALCULATED (Calculator, sun)
- COMPLETED (Lock, success), ERROR (AlertCircle, error), REVERTED (RotateCcw, neutral)
- PENDING_TIMESHEET (AlertTriangle, warning)
- `prefers-reduced-motion` disables spinner animation

### `PayrollRunWizard` (4-step modal)

- **Step 1:** Month/year selects + runType radio group → calls `createRun` + `getPreview` on "Próximo"
- **Step 2:** Read-only employee list with timesheet status chips (APPROVED=green, PENDING=warning)
- **Step 3:** Checkbox list with ineligible employees greyed out + tooltip; counter of selected
- **Step 4:** Non-interactive processing screen with spinner; auto-closes on success
- Focus trap, Escape closes (steps 1-3 only), step indicator dots, 200ms transitions
- Step 4 cannot be cancelled during processing

### `PayrollRunDetailModal`

- Header: title + status badge
- Summary row: Total Bruto, Total Descontos, Total Líquido, Encargos (JetBrains Mono)
- Items table using `PayrollRunItemRow` with recalculate/download/resend actions
- CALCULATED status → "Fechar Folha" primary CTA
- COMPLETED status → "Estornar Folha" danger button → `ConfirmDeleteModal` with typing `"Mês/Ano - Tipo"` per D-03

### `PayrollRunsPage`

- Breadcrumb: RH > Folha de Pagamento
- Header: "Folha de Pagamento" (DM Sans 700) + "Iniciar Folha" primary CTA
- Filter row: month/year + type + status selects
- Tab bar: Rodadas | Adiantamentos with 2px accent underline on active
- **Rodadas table:** 8 columns — COMPETENCIA, TIPO, COLABORADORES, BRUTO, ENCARGOS, LIQUIDO, STATUS, ACOES
  - Column headers ALL CAPS 12px
  - Monetary values in JetBrains Mono
  - Row actions: Eye (detail), Download (ZIP), Mail (resend), RotateCcw (revert — only COMPLETED)
- **Adiantamentos table:** DATA, COLABORADOR, COMPETENCIA, VALOR, STATUS CP, ACOES
- Skeleton rows for loading (5 rows, opacity pulse animation)
- Empty states with FileText/Wallet icons per spec
- **Mobile (<768px):** Table hidden, stacked card list shown with competencia, tipo, status, liquido, expand chevron

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows through hooks to real backend endpoints. Empty states render when API returns empty arrays. No hardcoded placeholder data.

## Self-Check: PASSED

All 8 source files found. Both commits (7e29c8b6, eba8589d) verified in git log. TypeScript check exits 0.
