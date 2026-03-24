---
phase: 25-cadastro-de-colaboradores-e-contratos
plan: 04
subsystem: backend/employees + frontend/employees
tags: [backend, frontend, employees, bulk-import, employee-detail, salary-chart, RH]
dependency_graph:
  requires: [25-01, 25-02, 25-03]
  provides: [employee-bulk-import, employee-detail-page, salary-evolution-chart]
  affects:
    - apps/backend/src/modules/employees/employees.routes.ts
    - apps/frontend/src/App.tsx
tech_stack:
  added:
    - ExcelJS (XLSX template generation — already installed)
    - recharts (salary chart — already installed)
  patterns:
    - File parser reuse (animal-file-parser pattern)
    - Preview/Confirm bulk import pattern
    - WAI-ARIA tabs (role=tablist/tab/tabpanel with keyboard navigation)
    - Recharts LineChart with ResponsiveContainer + custom tooltip
    - 4-step import modal with drag-and-drop
key_files:
  created:
    - apps/backend/src/modules/employees/employee-file-parser.ts
    - apps/backend/src/modules/employees/employee-bulk-import.service.ts
    - apps/frontend/src/components/employees/SalaryEvolutionChart.tsx
    - apps/frontend/src/components/employees/tabs/PersonalDataTab.tsx
    - apps/frontend/src/components/employees/tabs/ContractTab.tsx
    - apps/frontend/src/components/employees/tabs/EvolutionTab.tsx
    - apps/frontend/src/components/employees/tabs/DocumentsTab.tsx
    - apps/frontend/src/components/employees/tabs/HistoryTab.tsx
    - apps/frontend/src/components/employee-bulk-import/EmployeeBulkImportModal.tsx
    - apps/frontend/src/pages/EmployeeDetailPage.tsx
    - apps/frontend/src/pages/EmployeeDetailPage.css
  modified:
    - apps/backend/src/modules/employees/employees.routes.ts
    - apps/backend/src/modules/employees/employees.routes.spec.ts
    - apps/frontend/src/App.tsx
decisions:
  - Bulk preview uses two-level validation: ERROR (CPF invalid/duplicate, missing required) blocks confirm; WARNING (PIS invalid) allows confirm with flag
  - Template generated with ExcelJS XLSX (not CSV) for better UX and compatibility with Brazilian Excel exports
  - EmployeeDetailPage uses useId() for WAI-ARIA tab/panel association to avoid SSR id collisions
  - api.postFormData() used for document/file uploads (existing pattern)
  - HistoryTab consumes useEmployeeTimeline (merged timeline from API) rather than separate status/movement hooks
metrics:
  duration_minutes: 15
  completed_date: "2026-03-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 13
  files_modified: 3
---

# Phase 25 Plan 04: Bulk Employee Import + Employee Detail Page Summary

CSV/XLSX bulk import with CPF error/PIS warning validation plus complete employee detail page with 5 WAI-ARIA tabs, Recharts salary evolution chart, document upload/delete, and 4-step import modal.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Backend bulk import: parser, preview/confirm/template endpoints + 6 new tests | 31723aeb |
| 2 | Frontend: EmployeeDetailPage (5 tabs), SalaryEvolutionChart, EmployeeBulkImportModal | 99b80392 |
| 3 | Human verification | APPROVED — user confirmed complete system |

## Key Deliverables

### Backend (Task 1)

- **`employee-file-parser.ts`**: CSV/XLSX parser with BOM/latin1 support, auto-separator detection, `MAX_BULK_EMPLOYEE_ROWS=500`
- **`employee-bulk-import.service.ts`**: `uploadAndParse`, `previewBulkImport` (CPF errors → ERROR, PIS warnings → WARNING, duplicate detection both in-org and in-batch), `confirmBulkImport` (Prisma transaction), `generateTemplate` (ExcelJS XLSX)
- **4 new endpoints** on `employees.routes.ts` (placed before `/:id` to avoid route conflicts):
  - `GET /bulk/template` → XLSX download
  - `POST /bulk/upload` → parse CSV/XLSX, return headers + sample rows
  - `POST /bulk/preview` → validate all rows, return error/warning/valid split
  - `POST /bulk/confirm` → create employees in batch transaction
- **23 tests pass** (17 existing + 6 new bulk tests)

### Frontend (Task 2)

- **`EmployeeDetailPage.tsx`**: WAI-ARIA tabs (role=tablist/tab/tabpanel), keyboard navigation (ArrowLeft/ArrowRight), fixed header with 80px avatar (56px mobile), breadcrumb "Colaboradores > [Name]", Mudar Status + Editar buttons
- **5 Tabs**: Dados Pessoais, Contrato, Evolução, Documentos, Histórico
- **`PersonalDataTab.tsx`**: 2-column grid for 6 sections (documents, personal, contact, address, bank, dependents), accordion for dependents/farms, IRRF/salaryFamily badges
- **`ContractTab.tsx`**: CONTRACT_TYPE_LABELS, active contract highlighted, salary in JetBrains Mono, amendments collapsible, historical contracts collapsed
- **`EvolutionTab.tsx`**: SalaryEvolutionChart + movements timeline with icons by type
- **`SalaryEvolutionChart.tsx`**: Recharts LineChart, ResponsiveContainer, pt-BR formatters (Intl.DateTimeFormat + Intl.NumberFormat), custom tooltip with JetBrains Mono, loading skeleton, empty state
- **`DocumentsTab.tsx`**: `accept=".pdf,.jpg,.jpeg,.png"`, document type selector, ConfirmModal for delete (variant=warning), download links
- **`HistoryTab.tsx`**: merged timeline from useEmployeeTimeline, icons+colors by event type, empty state
- **`EmployeeBulkImportModal.tsx`**: 4-step flow (Upload → Mapeamento → Preview → Relatório), drag-and-drop zone, template download, CPF errors red/PIS warnings yellow in preview table, CSV export of errors
- **Route added**: `/employees/:employeeId` → `EmployeeDetailPage`
- **TypeScript check**: passes with 0 errors

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Notes

- `api.post()` signature does not accept custom headers; used `api.postFormData()` for file upload (pre-existing method) — consistent with document upload pattern already in codebase
- ConfirmModal uses `onCancel` (not `onClose`) — matched existing component interface
- EmployeeStatusModal uses `onSuccess` (not `onStatusChanged`) — matched existing component interface

## Known Stubs

None — all data flows are wired to real backend hooks (useEmployee, useEmployeeContracts, useEmployeeMovements, useEmployeeTimeline, SalaryEvolutionChart fetches /salary-history directly).

## Self-Check: PASSED

Files exist:
- apps/backend/src/modules/employees/employee-file-parser.ts ✓
- apps/backend/src/modules/employees/employee-bulk-import.service.ts ✓
- apps/frontend/src/pages/EmployeeDetailPage.tsx ✓
- apps/frontend/src/components/employees/SalaryEvolutionChart.tsx ✓
- apps/frontend/src/components/employee-bulk-import/EmployeeBulkImportModal.tsx ✓

Commits exist:
- 31723aeb (feat 25-04: bulk employee import) ✓
- 99b80392 (feat 25-04: EmployeeDetailPage with 5 tabs) ✓

Tests: 23/23 passing ✓
TypeScript: 0 errors ✓
