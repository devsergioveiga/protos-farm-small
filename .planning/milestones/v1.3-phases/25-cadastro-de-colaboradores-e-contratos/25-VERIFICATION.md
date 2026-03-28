---
phase: 25-cadastro-de-colaboradores-e-contratos
verified: 2026-03-24T06:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: 'Navigate to /employees — verify RH sidebar group appears with Colaboradores, Cargos, Escalas'
    expected: "Sidebar shows RH group; clicking Colaboradores loads EmployeesPage with empty state and 'Cadastrar colaborador' CTA"
    why_human: 'Visual layout and navigation cannot be verified without browser rendering'
  - test: "Click 'Cadastrar colaborador' — complete 4-step CreateEmployeeModal with an invalid CPF (e.g., 111.111.111-11)"
    expected: "Step 1 shows inline error 'CPF invalido' on CPF field blur; form cannot advance until CPF is corrected"
    why_human: 'onBlur CPF validation flow and stepper interaction require browser interaction'
  - test: 'Create an employee, then click the row to open EmployeeDetailPage — verify all 5 tabs: Dados Pessoais, Contrato, Evolução, Documentos, Histórico'
    expected: "Tabbed layout renders with WAI-ARIA (role=tablist/tab/tabpanel), breadcrumb shows 'Colaboradores > [Name]', avatar placeholder shown when no photo"
    why_human: 'Tab keyboard navigation, ARIA live regions, and visual tab indicator (2px underline) require browser verification'
  - test: 'On EmployeeDetailPage Evolução tab — verify SalaryEvolutionChart renders correctly with pt-BR formatting'
    expected: 'If salary history exists: LineChart renders with primary-600 line, BRL y-axis labels, mm/aaaa x-axis; if no data: empty state with TrendingUp icon'
    why_human: 'Recharts rendering and chart interaction require visual verification'
  - test: "Click 'Mudar Status' on an ATIVO employee — change to DESLIGADO"
    expected: "Modal requires typing employee's full name to confirm; after confirmation badge changes to DESLIGADO (gray XCircle) and status cannot be changed further"
    why_human: 'Name-typing confirmation UX and state machine terminal state enforcement require interaction'
  - test: "Navigate to /positions — create a position with CBO '123456', set JUNIOR/PLENO/SENIOR salary bands, verify Quadro de Lotação section"
    expected: 'Positions page shows list; SalaryBandModal validates band ordering (JUNIOR.max <= PLENO.min); staffing view shows position × farm counts'
    why_human: 'CBO masking, salary band client-side ordering validation, and staffing grid visual require browser testing'
  - test: "Navigate to /work-schedules — click 'Gerar Templates', verify 4 rural templates created"
    expected: "Creates '5x2 Padrao', '6x1 Rural', '12x36 Turno', 'Ordenha 2x' templates; each shows correct days and times"
    why_human: 'Template seed response and visual rendering of workDays chip grid require browser verification'
  - test: "Click 'Importar' on EmployeesPage — download template, upload a CSV with one valid and one invalid CPF row"
    expected: 'Step 3 Preview: invalid CPF row highlighted red with AlertCircle icon; invalid PIS row highlighted yellow with AlertTriangle; valid row normal; confirm creates only valid employees'
    why_human: '4-step import modal flow, drag-and-drop, color-coded preview table, and confirm/report flow require browser interaction'
---

# Phase 25: Cadastro de Colaboradores e Contratos — Verification Report

**Phase Goal:** Colaborador pode ser cadastrado com dados pessoais, documentos e dependentes, vinculado a uma ou mais fazendas com cargo e escala, ter seu contrato gerenciado com aditivos e histórico salarial, e o gerente pode importar colaboradores em lote via CSV/XLSX e visualizar a ficha completa com 5 abas
**Verified:** 2026-03-24T06:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                         | Status   | Evidence                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Employee can be created with CPF validated (blocks if invalid), PIS/PASEP with warning only                   | VERIFIED | `employees.service.ts:35` calls `isValidCPF` returning 400 on failure; `isValidPIS` check at line 40 continues with warning in response                                                            |
| 2   | Employee status transitions follow state machine: ATIVO->AFASTADO, ATIVO->FERIAS, ATIVO->DESLIGADO (terminal) | VERIFIED | `VALID_TRANSITIONS` record at line 19 of `employees.service.ts`; `transitionEmployeeStatus` at line 339 enforces the machine                                                                       |
| 3   | Employee can be associated with multiple farms via EmployeeFarm                                               | VERIFIED | `employees.routes.ts` has `POST /org/:orgId/employees/:id/farms` endpoint; `PATCH /org/:orgId/employees/:id/farms/:farmAssocId` for soft close                                                     |
| 4   | Employee documents can be uploaded and retrieved via multer diskStorage                                       | VERIFIED | `multer.diskStorage` at line 81 of `employees.routes.ts`; `POST /org/:orgId/employees/:id/documents` endpoint                                                                                      |
| 5   | Employee dependents stored with CPF required when irrf or salaryFamily is true                                | VERIFIED | Service validates and returns 400 if CPF missing when `irrf=true` or `salaryFamily=true`                                                                                                           |
| 6   | Manager can create contracts with type-conditional endDate validation                                         | VERIFIED | `employee-contracts.service.ts` implements D-05 rules: CLT_INDETERMINATE/INTERMITTENT forbid endDate; TRIAL/SEASONAL/etc require it; TRIAL max 90 days                                             |
| 7   | Contract amendments are tracked with effectiveAt date and JSON changes                                        | VERIFIED | `createAmendment` at line 241 creates `ContractAmendment`; salary amendments atomically update contract + create `EmployeeSalaryHistory` + `EmployeeMovement` in same transaction                  |
| 8   | Expiring contracts (TRIAL/SEASONAL) generate alerts 30 days before endDate                                    | VERIFIED | `contract-expiry-alerts.cron.ts` line 42: `contractType: { in: ['TRIAL', 'SEASONAL'] }`; Redis NX lock at line 26; cron at 07:00 BRT                                                               |
| 9   | Positions have CBO, salary bands with levels (JUNIOR/PLENO/SENIOR), staffing view is live aggregate           | VERIFIED | `positions.service.ts:57` createPosition with CBO regex; `setSalaryBands` at line 195; `getStaffingView` at line 232 queries EmployeeFarm live                                                     |
| 10  | Manager can import employees via CSV/Excel with template, preview validation, confirmation                    | VERIFIED | `employee-file-parser.ts` with `MAX_BULK_EMPLOYEE_ROWS=500`; `previewBulkImport`, `confirmBulkImport`, `generateTemplate` in bulk import service; 4 endpoints on routes                            |
| 11  | Employee detail page shows all data in tabbed layout with 5 tabs                                              | VERIFIED | `EmployeeDetailPage.tsx` has 5 tabs with `role="tablist"`, WAI-ARIA; SalaryEvolutionChart uses Recharts LineChart with pt-BR formatters; all tab components exist and receive live data from hooks |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                                                        | Provided                                               | Status   | Details                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                             | 13 HR models + 7 enums                                 | VERIFIED | Employee, EmployeeContract, Position, WorkSchedule, EmployeeMovement, EmployeeSalaryHistory, EmployeeDocument, EmployeeDependent, EmployeeFarm, EmployeeStatusHistory, SalaryBand, ContractAmendment — all present; 7 enums confirmed |
| `apps/backend/src/modules/employees/employees.service.ts`                       | CRUD + status machine + dependents + farms + documents | VERIFIED | VALID_TRANSITIONS, transitionEmployeeStatus, isValidCPF, isValidPIS all present; 41 tests pass                                                                                                                                        |
| `apps/backend/src/modules/employees/employees.routes.ts`                        | REST endpoints for employees                           | VERIFIED | employeesRouter with 12 endpoints + 4 bulk endpoints; multer for doc upload                                                                                                                                                           |
| `apps/backend/src/shared/utils/document-validator.ts`                           | isValidPIS function                                    | VERIFIED | `export function isValidPIS` at line 65; 18 tests pass including 5 for isValidPIS                                                                                                                                                     |
| `apps/backend/src/modules/employee-contracts/employee-contracts.service.ts`     | Contract CRUD + amendments                             | VERIFIED | createAmendment, generateContractPdf present; CLT_INDETERMINATE endDate validation present                                                                                                                                            |
| `apps/backend/src/modules/positions/positions.service.ts`                       | Position CRUD + salary bands + staffing                | VERIFIED | createPosition, setSalaryBands, getStaffingView — all present                                                                                                                                                                         |
| `apps/backend/src/modules/work-schedules/work-schedules.service.ts`             | Work schedule CRUD + templates                         | VERIFIED | createWorkSchedule, seedTemplates — present; 4 rural templates defined                                                                                                                                                                |
| `apps/backend/src/modules/employee-movements/employee-movements.service.ts`     | Movements + bulk salary adjustment                     | VERIFIED | bulkSalaryAdjustment, getTimeline, tx.employeeSalaryHistory.create in same transaction — all present                                                                                                                                  |
| `apps/backend/src/shared/cron/contract-expiry-alerts.cron.ts`                   | Daily cron for expiry alerts                           | VERIFIED | startContractExpiryAlertsCron; TRIAL/SEASONAL query; Redis NX lock                                                                                                                                                                    |
| `apps/backend/src/modules/employees/employee-file-parser.ts`                    | CSV/Excel parser for bulk import                       | VERIFIED | parseEmployeeFile, MAX_BULK_EMPLOYEE_ROWS=500                                                                                                                                                                                         |
| `apps/backend/src/modules/employees/employee-bulk-import.service.ts`            | Bulk import with preview and confirm                   | VERIFIED | previewBulkImport, confirmBulkImport, generateTemplate; CPF errors/PIS warnings differentiated                                                                                                                                        |
| `apps/frontend/src/pages/EmployeesPage.tsx`                                     | Employee listing (348 lines)                           | VERIFIED | Uses useEmployees hook; empty state with correct copy; skeleton loading; search/filter; pagination                                                                                                                                    |
| `apps/frontend/src/pages/PositionsPage.tsx`                                     | Position listing (277 lines)                           | VERIFIED | Quadro de Lotação section; SalaryBandModal action per row; staffing via useStaffingView                                                                                                                                               |
| `apps/frontend/src/pages/WorkSchedulesPage.tsx`                                 | Work schedule listing (260 lines)                      | VERIFIED | seed-templates call; template badge; empty state                                                                                                                                                                                      |
| `apps/frontend/src/pages/EmployeeDetailPage.tsx`                                | Employee detail with 5 tabs (294 lines)                | VERIFIED | role="tablist"; 5 tabs; breadcrumb "Colaboradores"; useEmployee hook; all tab components wired                                                                                                                                        |
| `apps/frontend/src/components/employees/CreateEmployeeModal.tsx`                | Multi-step form (1253 lines)                           | VERIFIED | aria-current="step"; isValidCPF onBlur; 4 steps; required fields marked with \*                                                                                                                                                       |
| `apps/frontend/src/components/employees/SalaryEvolutionChart.tsx`               | Recharts salary chart                                  | VERIFIED | LineChart, ResponsiveContainer from recharts; pt-BR Intl formatters; loads from /salary-history endpoint                                                                                                                              |
| `apps/frontend/src/components/employee-bulk-import/EmployeeBulkImportModal.tsx` | 4-step import modal (675 lines)                        | VERIFIED | bulk/upload, bulk/preview, bulk/confirm endpoints wired; 4-step flow                                                                                                                                                                  |
| `apps/frontend/src/components/layout/Sidebar.tsx`                               | RH navigation group                                    | VERIFIED | title: 'RH'; items for /employees, /positions, /work-schedules with Lucide icons                                                                                                                                                      |
| `apps/frontend/src/App.tsx`                                                     | Route registration                                     | VERIFIED | lazy imports for EmployeesPage, EmployeeDetailPage, PositionsPage, WorkSchedulesPage; all 4 routes registered                                                                                                                         |

### Key Link Verification

| From                           | To                                         | Via                          | Status   | Details                                                                                            |
| ------------------------------ | ------------------------------------------ | ---------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| employees.service.ts           | prisma.employee                            | withRlsContext               | VERIFIED | `prisma.employee.(create/findMany/update)` calls present                                           |
| employees.routes.ts            | app.ts                                     | router registration          | VERIFIED | `app.use('/api', employeesRouter)` at line 275                                                     |
| employee-movements.service.ts  | prisma.employeeSalaryHistory               | Atomic insert in same tx     | VERIFIED | `tx.employeeSalaryHistory.create` at lines 86 and 277                                              |
| contract-expiry-alerts.cron.ts | prisma.employeeContract                    | findMany with endDate filter | VERIFIED | `contractType: { in: ['TRIAL', 'SEASONAL'] }` at line 42                                           |
| EmployeesPage.tsx              | useEmployees hook                          | import and call              | VERIFIED | `import { useEmployees } from '@/hooks/useEmployees'`; data fetches from `/org/${orgId}/employees` |
| Sidebar.tsx                    | /employees                                 | navigation link              | VERIFIED | `{ to: '/employees', icon: UserRound, label: 'Colaboradores' }` at line 250                        |
| App.tsx                        | EmployeesPage                              | route registration           | VERIFIED | `<Route path="/employees" element={<EmployeesPage />} />` at line 236                              |
| EmployeeDetailPage.tsx         | /api/org/:orgId/employees/:id              | useEmployee hook             | VERIFIED | useEmployee fetches from `/org/${orgId}/employees/${employeeId}`                                   |
| SalaryEvolutionChart.tsx       | recharts                                   | LineChart import             | VERIFIED | `import { LineChart, ... } from 'recharts'`; ResponsiveContainer present                           |
| EmployeeBulkImportModal.tsx    | /bulk/upload, /bulk/preview, /bulk/confirm | api calls                    | VERIFIED | All 3 endpoints wired in component                                                                 |

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable         | Source                                                                                                                           | Produces Real Data                                  | Status  |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------- |
| EmployeesPage.tsx        | employees             | useEmployees → api.get(`/org/${orgId}/employees`) → employeesRouter → employees.service.listEmployees → prisma.employee.findMany | Yes — Prisma query with RLS context                 | FLOWING |
| EmployeeDetailPage.tsx   | employee              | useEmployee → api.get(`/org/${orgId}/employees/${id}`) → getEmployee → prisma.employee.findUniqueOrThrow                         | Yes — Prisma query with relations                   | FLOWING |
| SalaryEvolutionChart.tsx | data (salary history) | api.get(`/org/${orgId}/employees/${employeeId}/salary-history`) → getSalaryHistory → prisma.employeeSalaryHistory.findMany       | Yes — Prisma query ordered by effectiveAt           | FLOWING |
| HistoryTab.tsx           | timeline              | useEmployeeTimeline → api.get(`/org/${orgId}/employee-movements/timeline/${employeeId}`) → getTimeline                           | Yes — merged movements + status history from Prisma | FLOWING |

### Behavioral Spot-Checks

| Behavior                                   | Command                                                                                          | Result                                                                                                                   | Status |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Employee tests (41) pass                   | `npx jest --testPathPattern="employees\|document-validator"`                                     | 41 tests, 2 suites PASS                                                                                                  | PASS   |
| HR module tests (28) pass                  | `npx jest --testPathPattern="employee-contracts\|positions\|work-schedules\|employee-movements"` | 28 tests, 4 suites PASS                                                                                                  | PASS   |
| Frontend TypeScript compiles               | `npx tsc --noEmit`                                                                               | 0 errors                                                                                                                 | PASS   |
| isValidPIS exported                        | Source check document-validator.ts line 65                                                       | `export function isValidPIS` found                                                                                       | PASS   |
| All 5 HR routers registered in app.ts      | grep on app.ts                                                                                   | employeesRouter, employeeContractsRouter, positionsRouter, workSchedulesRouter, employeeMovementsRouter at lines 275-279 | PASS   |
| Contract expiry cron registered in main.ts | grep on main.ts                                                                                  | startContractExpiryAlertsCron imported and called at line 24                                                             | PASS   |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                               | Status                   | Evidence                                                                                                                                                                                                                                      |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COLAB-01    | 25-01, 25-03 | Employee CRUD with CPF/PIS/PASEP/CTPS, bank data, dependents, documents, farm associations, status machine                | SATISFIED                | employees.service.ts, employees.routes.ts, EmployeesPage.tsx, CreateEmployeeModal.tsx                                                                                                                                                         |
| COLAB-02    | 25-02, 25-03 | Contract management by type with endDate validation, amendments, expiry alerts, PDF generation                            | SATISFIED                | employee-contracts.service.ts with CLT_INDETERMINATE/TRIAL/SEASONAL rules; contract-expiry-alerts.cron.ts; CreateContractModal.tsx                                                                                                            |
| COLAB-03    | 25-02, 25-03 | Positions with CBO/salary bands/staffing view; work schedules with rural templates; movements with bulk salary adjustment | SATISFIED                | positions.service.ts, work-schedules.service.ts with seedTemplates, employee-movements.service.ts with bulkSalaryAdjustment                                                                                                                   |
| COLAB-04    | 25-04        | Bulk import via CSV/Excel with template, flexible mapping, CPF/PIS validation, preview, report                            | SATISFIED                | employee-file-parser.ts, employee-bulk-import.service.ts, EmployeeBulkImportModal.tsx                                                                                                                                                         |
| COLAB-05    | 25-04        | Employee detail page with 5 tabs — personal data, contract, salary evolution, documents, history                          | SATISFIED (phase-scoped) | EmployeeDetailPage.tsx with WAI-ARIA tabs; SalaryEvolutionChart with Recharts; 5 tab components. NOTE: holerites, EPIs, treinamentos, operações de campo depend on future phases (28, 30) — intentionally deferred per ROADMAP and plan scope |

**Note on COLAB-05 scope deferral:** REQUIREMENTS.md marks COLAB-05 as `[x]` Complete, but the full description includes "holerites 12 meses, saldo de férias/banco de horas, EPIs entregues, treinamentos e operações de campo vinculadas." These items depend on Phase 28 (folha/holerites), Phase 30 (EPIs/treinamentos), and other modules not yet built. The PLAN 04 must_haves narrowed COLAB-05 to "Employee detail page shows all data in tabbed layout with fixed header" — which is satisfied. The remaining items will be integrated into the detail page as future phases complete. The 5-tab foundation is in place to receive this content.

### Anti-Patterns Found

None found. No TODO/FIXME/placeholder comments in any of the 30+ new files. No return null stubs, no hardcoded empty arrays flowing to rendered output. All data paths verified to query real Prisma models.

### Human Verification Required

#### 1. Employee Listing and Creation Flow

**Test:** Navigate to app, verify "RH" group in sidebar with Colaboradores, Cargos, Escalas; open CreateEmployeeModal with 4 steps; enter invalid CPF on Step 1
**Expected:** Sidebar RH group visible; modal opens; Step 1 shows inline CPF error on blur with `role="alert"`; invalid CPF prevents advancing; PIS/PASEP shows yellow warning but allows continuing
**Why human:** Visual layout, animation of stepper, and onBlur validation interaction require browser

#### 2. Employee Detail Page — Tabs and Chart

**Test:** Create an employee with salary history, navigate to detail page, verify all 5 tabs render correctly
**Expected:** Breadcrumb "Colaboradores > [Name]"; fixed header with avatar placeholder; tab underline indicator (2px green); SalaryEvolutionChart renders with pt-BR formatting; Documents tab shows upload button; History tab shows timeline entries
**Why human:** Recharts rendering, visual tab indicator (not background color), and responsive avatar size cannot be verified without browser

#### 3. Status Transition — DESLIGADO Confirmation

**Test:** Click "Mudar Status" for ATIVO employee, select DESLIGADO
**Expected:** Modal requires typing employee's full name to confirm; after confirmation status badge shows gray XCircle "Desligado"; attempting to change status again shows no valid transitions
**Why human:** Name-typing UX and terminal state enforcement require interaction

#### 4. Bulk Import — CPF/PIS Validation Preview

**Test:** Click "Importar" on EmployeesPage; download XLSX template; upload CSV with 3 rows (1 valid, 1 invalid CPF, 1 invalid PIS); advance to Step 3 Preview
**Expected:** Invalid CPF row highlighted red with AlertCircle icon and "CPF invalido" message; invalid PIS row highlighted yellow with AlertTriangle and warning; valid row appears normal; can confirm with warnings but not with errors
**Why human:** Color-coded preview table and 4-step modal flow require browser interaction

#### 5. Work Schedules — Template Seeding and Day Picker

**Test:** Navigate to /work-schedules; click "Gerar Templates"; verify 4 templates created; create new schedule via modal with day picker
**Expected:** 4 rural templates created (5x2 Padrao, 6x1 Rural, 12x36 Turno, Ordenha 2x); day picker shows 7 day tiles; time inputs accept HH:mm format
**Why human:** Visual day picker interaction and template creation visual confirmation require browser

#### 6. Contract PDF Generation

**Test:** On ContractTab of a detail page, click "Baixar PDF"
**Expected:** Browser downloads a PDF file with employee name, CPF, position, contract type in pt-BR, start/end dates, salary, weekly hours
**Why human:** PDF generation and browser download behavior require interaction

#### 7. Positions — Salary Band Ordering Validation

**Test:** Open SalaryBandModal for a position; set JUNIOR minSalary=1000/maxSalary=2000; PLENO minSalary=1500/maxSalary=2500; verify warning if JUNIOR.max > PLENO.min
**Expected:** Client-side validation shows error on band ordering violation (JUNIOR max 2000 > PLENO min 1500); save blocked until bands are in correct order
**Why human:** Client-side validation trigger and error rendering in the modal require browser interaction

### Gaps Summary

No structural gaps found. All 11 observable truths are VERIFIED through code inspection, import tracing, data-flow tracing, and passing test suites (69 tests, 6 spec files all pass). The phase goal is achieved at the code level.

The COLAB-05 partial scope is a known, planned deferral: the 5-tab skeleton with salary evolution chart, personal data, contract history, documents, and movements timeline is fully implemented. Future phases will populate the remaining items (holerites: Phase 28; EPIs/treinamentos: Phase 30) into existing tab slots.

Human verification covers 7 behavioral flows that cannot be confirmed without browser rendering.

---

_Verified: 2026-03-24T06:00:00Z_
_Verifier: Claude Sonnet 4.6 (gsd-verifier)_
