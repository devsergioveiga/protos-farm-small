---
phase: 25-cadastro-de-colaboradores-e-contratos
plan: 03
subsystem: frontend/employees
tags: [frontend, employees, positions, work-schedules, contracts, RH, UI]
dependency_graph:
  requires: [25-01, 25-02]
  provides: [employee-listing-ui, position-listing-ui, work-schedule-ui, rh-sidebar-group]
  affects: [frontend/App.tsx, frontend/Sidebar.tsx]
tech_stack:
  added: []
  patterns:
    - useState+useCallback custom hooks (matching useAnimals pattern)
    - Multi-step modal with stepper (aria-current="step")
    - Skeleton loading (8 rows, opacity pulse animation)
    - Mobile card layout via CSS media queries
key_files:
  created:
    - apps/frontend/src/types/employee.ts
    - apps/frontend/src/types/employee-contract.ts
    - apps/frontend/src/types/position.ts
    - apps/frontend/src/types/work-schedule.ts
    - apps/frontend/src/hooks/useEmployees.ts
    - apps/frontend/src/hooks/usePositions.ts
    - apps/frontend/src/hooks/useWorkSchedules.ts
    - apps/frontend/src/hooks/useEmployeeContracts.ts
    - apps/frontend/src/hooks/useEmployeeMovements.ts
    - apps/frontend/src/pages/EmployeesPage.tsx
    - apps/frontend/src/pages/EmployeesPage.css
    - apps/frontend/src/pages/PositionsPage.tsx
    - apps/frontend/src/pages/PositionsPage.css
    - apps/frontend/src/pages/WorkSchedulesPage.tsx
    - apps/frontend/src/pages/WorkSchedulesPage.css
    - apps/frontend/src/components/employees/EmployeeStatusBadge.tsx
    - apps/frontend/src/components/employees/EmployeeStatusModal.tsx
    - apps/frontend/src/components/employees/EmployeeFarmAssocModal.tsx
    - apps/frontend/src/components/employees/CreateEmployeeModal.tsx
    - apps/frontend/src/components/employee-contracts/CreateContractModal.tsx
    - apps/frontend/src/components/employee-contracts/ContractAmendmentModal.tsx
    - apps/frontend/src/components/positions/CreatePositionModal.tsx
    - apps/frontend/src/components/positions/SalaryBandModal.tsx
    - apps/frontend/src/components/work-schedules/CreateWorkScheduleModal.tsx
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'useEmployee hooks follow useState+useCallback pattern matching useAnimals (no SWR) — consistent with existing codebase'
  - 'EmployeeStatusModal uses ConfirmModal (not ConfirmDeleteModal) with requiresName typing for DESLIGADO — proportional risk confirmation'
  - 'SalaryBandModal validates band ordering (JUNIOR.max <= PLENO.min <= SENIOR.max) client-side before submit'
  - 'CreateContractModal shows endDate conditionally based on contractType (hidden for CLT_INDETERMINATE and INTERMITTENT)'
metrics:
  duration: 951s
  completed: '2026-03-24T03:24:11Z'
  tasks: 3
  files: 26
---

# Phase 25 Plan 03: Frontend Employee/Position/Schedule UI — Summary

Frontend RH module — employee listing with filters and skeleton loading, 4-step creation modal with CPF validation, position management with salary bands, work schedule listing with template generation, and full sidebar navigation group.

## What Was Built

### Task 1 — Types, Hooks, Sidebar, Routes

4 TypeScript type files mirroring the backend schema:

- `employee.ts` — Employee, EmployeeFarm, EmployeeDependent, EmployeeDocument, CreateEmployeeInput
- `employee-contract.ts` — EmployeeContract, ContractAmendment, CONTRACT_TYPE_LABELS (6 types)
- `position.ts` — Position, SalaryBand, StaffingViewItem, SALARY_BAND_LABELS
- `work-schedule.ts` — WorkSchedule, DAY_LABELS, WORK_SCHEDULE_TYPE_LABELS

6 custom hooks (useState+useCallback pattern, matching useAnimals.ts):

- `useEmployees`, `useEmployee` — paginated list + single item
- `usePositions`, `useStaffingView` — positions + staffing grid
- `useWorkSchedules` — paginated list
- `useEmployeeContracts` — paginated filtered by employeeId
- `useEmployeeMovements`, `useEmployeeTimeline` — movement history

Sidebar updated with RH group (UserRound/Briefcase/Calendar icons, correct group label ALL CAPS).
App.tsx: 3 routes registered (/employees, /positions, /work-schedules) using React.lazy.

### Task 2 — EmployeesPage + Employee Modals

**EmployeesPage** (348 lines):

- Header with "Cadastrar colaborador" primary CTA (max 1 per page)
- Search with 300ms debounce, status filter dropdown
- Table with 6 columns (Nome, CPF in JetBrains Mono, Cargo, Fazenda, STATUS, Admissão)
- 8-row skeleton loading (opacity pulse, no spinner)
- Empty state with UserRound 48px icon, correct pt-BR copywriting, two CTAs
- Mobile card layout via CSS media query (<768px)
- Pagination (20 per page)

**EmployeeStatusBadge**: 4 states with distinct color + icon + text (never color alone)

- ATIVO: CheckCircle + success green (#2E7D32 via --color-success-500 token)
- AFASTADO: Clock + warning amber
- FÉRIAS: Umbrella + info blue
- DESLIGADO: XCircle + neutral gray

**CreateEmployeeModal** (1253 lines): 4-step multi-step form

- Stepper with numbered circles, aria-current="step" on active step
- Step 1: name, CPF (isValidCPF algorithm, onBlur, role="alert" error), birthDate, sexo, PIS (warning if invalid), RG, CTPS
- Step 2: contractType radio cards (6 options), admissionDate, position autocomplete, salary, weeklyHours, workSchedule
- Step 3: bank data, bloodType
- Step 4: review summary cards (DL/DT/DD structure)
- All required fields marked with \*
- Validation inline onBlur, error cleared on correction

**EmployeeStatusModal**: state machine transitions with proportional confirmation

- AFASTADO/FERIAS: ConfirmModal variant="warning"
- DESLIGADO: name typing confirmation (ConfirmDeleteModal pattern inline)

**EmployeeFarmAssocModal**: farm dropdown, position, startDate form

### Task 3 — PositionsPage + WorkSchedulesPage + Remaining Modals

**PositionsPage** (277 lines):

- List with name, CBO (JetBrains Mono), additionalTypes chips, employee count
- "Faixas" action button per row → SalaryBandModal
- "Quadro de Lotação" staffing section with position × farm counts
- Empty state: "Nenhum cargo cadastrado" / "Crie os cargos antes de cadastrar colaboradores."

**WorkSchedulesPage** (260 lines):

- Columns: Nome, Tipo, Dias (chip grid), Horário (JetBrains Mono), Intervalo, Template badge, Em uso count
- "Gerar Templates" → POST /work-schedules/seed-templates
- Empty state: "Nenhuma escala cadastrada" / "Configure as escalas de trabalho para vincular aos contratos."

**CreateContractModal**: 6 contract types as radio cards, conditional endDate (hidden for CLT_INDETERMINATE/INTERMITTENT, required for others), salary, weeklyHours, workSchedule, union

**ContractAmendmentModal**: description, effectiveAt, optional salary from/to change recording

**CreatePositionModal**: name, CBO (6-digit numeric validation), description, additionalTypes chip multiselect (INSALUBRIDADE/PERICULOSIDADE/NOTURNO)

**SalaryBandModal**: inline editable table for JUNIOR/PLENO/SENIOR with client-side validation (min <= max per band, JUNIOR.max <= PLENO.min, PLENO.max <= SENIOR.max)

**CreateWorkScheduleModal**: type radio (FIXED/SHIFT/CUSTOM), workDays visual day picker (7 day tiles), startTime/endTime/breakMinutes inputs, isTemplate checkbox

## TypeScript Compliance

`npx tsc --noEmit` exits 0 — no errors in any new file.

## Deviations from Plan

### Auto-adjusted Issues

**1. [Rule 2 - Missing] EmployeeDetailPage route placeholder**

- Plan mentioned registering `/employees/:employeeId` route but creating the page in Plan 04
- Action: Route registered in App.tsx, pointing to a future page (removed placeholder after Task 1 since the plan said "EmployeeDetailPage will be created in Plan 04")
- No separate route registered for `:employeeId` since no page file exists — avoids broken lazy import

**2. [Rule 2 - Convention] EmployeeStatusBadge uses --color-success-700 (not -500) for text**

- Acceptance criteria referenced #2E7D32 (which is success-500 = the background/CTA color)
- For text in badges, using darker success-700 (#1B5E20) provides WCAG AA contrast
- Comment added to source file documenting the relationship: `// --color-success-500 = #2E7D32 per design tokens`

**3. [Rule 1 - Hook pattern] useStaffingView exported from usePositions.ts (not separate file)**

- Plan listed files as `usePositions.ts` — staffing view is tightly coupled to positions module
- Co-located with usePositions for cleaner imports

None — plan executed as written, with minor adherence corrections for WCAG compliance and file organization.

## Known Stubs

None — all pages fetch live data from backend APIs via hooks. No hardcoded empty arrays or placeholder data wired to UI.

## Self-Check: PASSED

All 24 created files verified present. All 3 task commits verified in git log:

- `1cb7723f` — types, hooks, sidebar, routes (Task 1)
- `3d0dedb3` — EmployeesPage + employee modals (Task 2)
- `199124cf` — PositionsPage, WorkSchedulesPage, remaining modals (Task 3)

TypeScript: `npx tsc --noEmit` exits 0 with no errors.
