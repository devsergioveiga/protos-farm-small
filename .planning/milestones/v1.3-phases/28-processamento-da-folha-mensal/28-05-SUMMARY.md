---
phase: 28-processamento-da-folha-mensal
plan: 05
subsystem: payroll-frontend-complementary
tags: [payroll, hr, salary-advance, payslip, modal, sidebar, routing]
dependency_graph:
  requires:
    [
      28-02 salary-advances backend,
      28-03 payroll-runs backend,
      useSalaryAdvances hook,
      payroll-runs types,
    ]
  provides: [SalaryAdvanceModal, PayslipTab, Sidebar payroll-runs link, /payroll-runs route]
  affects: [EmployeeDetailPage (new tab), Sidebar.tsx (new nav item), App.tsx (new route)]
tech_stack:
  added: []
  patterns:
    [useState+useCallback hooks, modal with focus trap, skeleton loading, api.getBlob PDF download]
key_files:
  created:
    - apps/frontend/src/components/payroll/SalaryAdvanceModal.tsx
    - apps/frontend/src/components/payroll/SalaryAdvanceModal.css
    - apps/frontend/src/components/employees/tabs/PayslipTab.tsx
    - apps/frontend/src/components/employees/tabs/PayslipTab.css
    - apps/frontend/src/hooks/useSalaryAdvances.ts
    - apps/frontend/src/types/payroll-runs.ts (shared types)
  modified:
    - apps/frontend/src/pages/EmployeeDetailPage.tsx (added Holerites tab)
    - apps/frontend/src/components/layout/Sidebar.tsx (added Folha de Pagamento link)
    - apps/frontend/src/App.tsx (added /payroll-runs route)
    - apps/frontend/src/pages/PayrollRunsPage.tsx (stub page, linter expanded to full impl)
    - apps/frontend/src/pages/PayrollRunsPage.css (linter wrote full styles)
decisions:
  - 'SalaryAdvanceModal does not accept orgId prop — uses useSalaryAdvances() which calls useAuth() internally'
  - 'BatchAdvanceInput.percentOfSalary matches backend (not per-employee advances array from original linter rewrite)'
  - 'Payslip type added to payroll-runs.ts (was missing after linter rewrote the file)'
  - 'PayrollRunsPage stub immediately replaced by linter with full implementation referencing Plan 28-04 files'
metrics:
  duration: 9min
  completed_date: '2026-03-24'
  tasks_completed: 2
  files_created: 7
  files_modified: 5
---

# Phase 28 Plan 05: Salary Advance Modal, Payslip Tab, Sidebar Nav, Route Wiring Summary

SalaryAdvanceModal with individual/batch modes, PayslipTab on employee ficha with download+email actions, Sidebar Folha de Pagamento link, and /payroll-runs route — all frontend complementary pieces for the payroll processing phase.

## What Was Built

### SalaryAdvanceModal.tsx

Modal component with `mode: 'individual' | 'batch'` prop:

**Individual mode:**

- Fields: employee dropdown (active employees from `useEmployees({status: 'ATIVO'})`), competencia (month input), amount (R$ prefix, number input), advance date, optional notes
- Validation onBlur for all required fields; inline error messages with `role="alert"`
- On submit: calls `createAdvance()` from `useSalaryAdvances()` hook
- On LIMIT_EXCEEDED error: maps to Portuguese "Valor excede o limite configurado"

**Batch mode:**

- Fields: competencia (pre-filled to current month), advance date (pre-filled to 15th of month), percentual do salario (default **40**)
- Summary text: "Sera criado adiantamento de [X]% do salario para todos os colaboradores ativos."
- On submit: calls `createBatchAdvances({ referenceMonth, advanceDate, percentOfSalary })`

Both modes: 300ms ease-out open animation, focus trap, Escape key closes, returns focus to trigger.

### useSalaryAdvances.ts

Hook with no-arg signature (uses `useAuth` internally):

- `fetchAdvances(filters?)` — paginated list with month/employeeId filters
- `createAdvance(data)` — POST individual, returns `SalaryAdvance | null`
- `createBatchAdvances(data)` — POST batch, returns `BatchAdvanceResult | null`
- `downloadReceipt(advanceId)` — GET PDF blob and auto-download

### payroll-runs.ts (shared types)

Complete type definitions including:

- `PayrollRun`, `PayrollRunItem`, `SalaryAdvance`, `Payslip`
- `PayrollRunType`, `PayrollRunStatus` enums
- `CreateAdvanceInput`, `BatchAdvanceInput` (percentOfSalary field matching backend)
- `WizardEmployeePreview` for wizard step 2
- `RUN_TYPE_LABELS`, `RUN_STATUS_LABELS` constants

### PayslipTab.tsx

Tab component for employee detail page:

- On mount: fetches `GET /org/${orgId}/employees/${employeeId}/payslips`
- Filters to COMPLETED runs only (REVERTED excluded)
- Table: COMPETENCIA, TIPO, BRUTO, LIQUIDO, STATUS, ACOES columns
- Monetary values: JetBrains Mono, right-aligned
- ACOES: Download button (48x48px) via `api.getBlob`, Mail button (only if employeeEmail)
- Empty state: `FileText` icon + "Nenhum holerite disponivel." + "Os holerites aparecem apos o fechamento da folha mensal."
- Loading: 5 skeleton rows with 1.5s pulse animation

### EmployeeDetailPage.tsx

Added `'payslips'` to `TabId` union and `TABS` array with label `'Holerites'`.
Added `<PayslipTab>` rendering in the tab panels switch.

### Sidebar.tsx

Added to RH group:

```typescript
{ to: '/payroll-runs', icon: Receipt, label: 'Folha de Pagamento' }
```

`Receipt` icon was already imported in the file.

### App.tsx

Added lazy import and route:

```tsx
const PayrollRunsPage = lazy(() => import('@/pages/PayrollRunsPage'));
<Route path="/payroll-runs" element={<PayrollRunsPage />} />;
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useSalaryAdvances hook signature changed by linter**

- **Found during:** Task 1 implementation
- **Issue:** Linter rewrote `useSalaryAdvances.ts` to use no-arg signature (uses `useAuth` internally instead of accepting `orgId`). Also changed `BatchAdvanceResult` to use `{ succeeded, failed }` instead of `{ batchId, count }`.
- **Fix:** Kept no-arg signature (matches project pattern from other hooks). Fixed `BatchAdvanceResult` to match actual backend response `{ batchId, count, advances }`. Updated success message accordingly.
- **Files modified:** useSalaryAdvances.ts
- **Commit:** 522aa7bb

**2. [Rule 3 - Blocking] payroll-runs.ts BatchAdvanceInput incompatible with backend**

- **Found during:** Task 1, after linter rewrote the types file
- **Issue:** Linter changed `BatchAdvanceInput` to use `advances: Array<{employeeId, amount}>` — incompatible with backend which expects `{ percentOfSalary?: number }`.
- **Fix:** Reverted `BatchAdvanceInput` to match backend schema: `{ referenceMonth, advanceDate, percentOfSalary?, notes? }`.
- **Files modified:** types/payroll-runs.ts
- **Commit:** 522aa7bb

**3. [Rule 2 - Missing Critical] Payslip interface missing from payroll-runs.ts**

- **Found during:** Task 2, when creating PayslipTab
- **Issue:** Linter rewrote payroll-runs.ts without a `Payslip` interface (needed by PayslipTab).
- **Fix:** Added `Payslip` interface with all required fields.
- **Files modified:** types/payroll-runs.ts
- **Commit:** a8d75954

**4. [Rule 3 - Blocking] PayrollRunsPage stub replaced by linter with full implementation**

- **Found during:** Task 2 when creating stub page
- **Issue:** After I wrote a minimal stub, linter immediately replaced it with a full implementation referencing `usePayrollRuns`, `PayrollRunWizard`, `PayrollRunDetailModal`, `PayrollRunStatusBadge` — all from Plan 28-04.
- **Fix:** Plan 28-04 had already run (parallel execution), so these files existed. The full implementation compiled without errors. Accepted the linter's expansion as a bonus — the page is more complete.
- **Files modified:** PayrollRunsPage.tsx, PayrollRunsPage.css
- **Commit:** a8d75954

## Known Stubs

None — all components are fully wired to their respective API endpoints.

The `PayrollRunsPage.tsx` has one minor stub: the "Registrar Adiantamento" button in the Adiantamentos tab header has a `{/* TODO: open advance modal */}` comment — opening the `SalaryAdvanceModal` from this page was not in scope for Plan 28-05 (the modal is provided and ready, wiring it to PayrollRunsPage is Plan 28-04 scope). This does not prevent the plan's goal from being achieved.

## Self-Check: PASSED
