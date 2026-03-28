---
phase: 30-seguranca-trabalho-nr31
plan: '05'
subsystem: frontend
tags: [epi, safety, nr31, frontend, react, typescript]
dependency_graph:
  requires: ['30-02']
  provides:
    [
      'epi-products-page',
      'epi-deliveries-page',
      'compliance-status-badge',
      'sidebar-seguranca-group',
    ]
  affects: ['30-06', '30-07']
tech_stack:
  added: []
  patterns:
    [
      'tab-strip',
      'skeleton-loading',
      'modal-form',
      'compliance-badge',
      'debounced-search',
      'pagination',
    ]
key_files:
  created:
    - apps/frontend/src/types/epi.ts
    - apps/frontend/src/types/training.ts
    - apps/frontend/src/types/medical-exam.ts
    - apps/frontend/src/types/safety.ts
    - apps/frontend/src/hooks/useEpiProducts.ts
    - apps/frontend/src/hooks/useEpiDeliveries.ts
    - apps/frontend/src/components/shared/ComplianceStatusBadge.tsx
    - apps/frontend/src/pages/EpiProductsPage.tsx
    - apps/frontend/src/pages/EpiProductsPage.css
    - apps/frontend/src/components/epi-products/EpiProductModal.tsx
    - apps/frontend/src/components/epi-products/EpiProductModal.css
    - apps/frontend/src/components/epi-products/PositionEpiRequirementsModal.tsx
    - apps/frontend/src/components/epi-products/PositionEpiRequirementsModal.css
    - apps/frontend/src/pages/EpiDeliveriesPage.tsx
    - apps/frontend/src/pages/EpiDeliveriesPage.css
    - apps/frontend/src/components/epi-deliveries/EpiDeliveryModal.tsx
    - apps/frontend/src/components/epi-deliveries/EpiDeliveryModal.css
    - apps/frontend/src/pages/TrainingTypesPage.tsx
    - apps/frontend/src/pages/TrainingRecordsPage.tsx
    - apps/frontend/src/pages/MedicalExamsPage.tsx
    - apps/frontend/src/pages/SafetyDashboardPage.tsx
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'Placeholder pages (TrainingTypesPage, TrainingRecordsPage, MedicalExamsPage, SafetyDashboardPage) created as minimal stubs for route compilation — plans 06/07 will implement the full pages'
  - 'ComplianceStatusBadge placed in components/shared/ (not domain-specific) because it is used across EPI, training, and ASO contexts'
  - 'getCaExpiryStatus helper logic in EpiProductsPage.tsx: <0d=EXPIRED, <=15d=RED, <=30d=YELLOW, else OK'
  - 'EpiDeliveryModal uses employees hook with limit:200 — sufficient for typical farm workforce'
metrics:
  duration_seconds: 709
  completed_date: '2026-03-26T11:18:54Z'
  tasks_completed: 2
  files_created: 21
  files_modified: 2
---

# Phase 30 Plan 05: Frontend EPI Foundation — Types, Hooks, Pages, Sidebar Summary

EPI and delivery management frontend with ComplianceStatusBadge shared component, SEGURANÇA sidebar group with 6 routes, and full EpiProductsPage + EpiDeliveriesPage implementations per NR-31 UI-SPEC contract.

## What Was Built

### Task 1: Frontend Foundation

**Type files (4):**

- `types/epi.ts` — EpiProduct, EpiDelivery, PositionEpiRequirement, PositionWithEpiCount, input types, EPI_TYPES/EPI_TYPE_LABELS/DELIVERY_REASON_LABELS constants
- `types/training.ts` — TrainingType, TrainingRecord, EmployeeTrainingRecord, PositionTrainingRequirement, input types, INSTRUCTOR_TYPE_LABELS
- `types/medical-exam.ts` — MedicalExam, AsoType, AsoResult, input types, ASO_TYPE_LABELS/ASO_RESULT_LABELS
- `types/safety.ts` — ComplianceAlertLevel, ComplianceSummary, EmployeeCompliance, EpiPendingItem, TrainingPendingItem

**Hooks (2):**

- `useEpiProducts.ts` — fetchEpiProducts, createEpiProduct, updateEpiProduct, deleteEpiProduct + position requirement CRUD
- `useEpiDeliveries.ts` — fetchEpiDeliveries, fetchEmployeeDeliveries, createEpiDelivery, deleteEpiDelivery, downloadEpiFichaPdf (uses api.getBlob pattern)

**Shared component:**

- `ComplianceStatusBadge.tsx` — OK/YELLOW/RED/EXPIRED states with CheckCircle/AlertTriangle/AlertCircle/Clock icons + semantic color tokens + text label (never color alone)

**Navigation:**

- Sidebar.tsx: SEGURANÇA group added after RH group — HardHat (EPIs), Package (Entregas EPI), GraduationCap (Treinamentos), ClipboardList (Registros de Treinamento), Stethoscope (ASOs), Shield (Dashboard NR-31)
- App.tsx: 6 lazy-loaded routes registered — /epi-products, /epi-deliveries, /training-types, /training-records, /medical-exams, /safety-dashboard

### Task 2: EPI Pages and Modals

**EpiProductsPage:**

- Tab 1 — Produtos EPI: search (debounce 300ms), EPI type filter, table with ComplianceStatusBadge in CA Validade column, JetBrains Mono for CA numbers, skeleton loading, empty state (Shield 48px + copy), pagination, row actions (edit/deliver)
- Tab 2 — Requisitos por Cargo: position list with count chips, italic "Nenhum EPI definido" for zero-requirement positions, Configurar button

**EpiProductModal:** CA number validation (5–6 digits, onBlur), EPI type select, CA expiry date picker, required fields marked with \*, role="alert" errors

**PositionEpiRequirementsModal:** current requirements list, add row (EPI picker + qty + button), delete with ConfirmModal variant="warning"

**EpiDeliveriesPage:**

- Always-visible filter bar: employee search + EPI type + date from/to
- Tab 1 — Entregas: table with FileText icon for signature presence, Trash2 delete with ConfirmModal warning
- Tab 2 — Ficha por Colaborador: employee picker, employee card, deliveries table, "Imprimir Ficha EPI" PDF download button

**EpiDeliveryModal:** employee picker (uses useEmployees hook), EPI picker, date (cannot be future), quantity (min 1), reason select, signature upload (JPEG/PNG/WebP max 5MB with 80x60 thumbnail preview), observations textarea, INSUFFICIENT_STOCK error handling

## Verification

- `npx tsc --noEmit` exits 0 (clean compilation)
- All 13 Task 1 acceptance criteria: PASS
- All 11 Task 2 acceptance criteria: PASS

## Deviations from Plan

### Auto-added missing functionality

**1. [Rule 2 - Missing field] Added employeePosition to EpiDelivery type**

- **Found during:** Task 1 type definition
- **Issue:** UI-SPEC page 2 table shows "Função" column, requiring employeePosition on EpiDelivery
- **Fix:** Added `employeePosition: string | null` field to EpiDelivery interface
- **Files modified:** apps/frontend/src/types/epi.ts

**2. [Rule 1 - Bug] Used `emp.name` not `emp.fullName` in EpiDeliveryModal**

- **Found during:** Task 2 implementation
- **Issue:** Employee interface uses `name`, not `fullName`
- **Fix:** Corrected field reference in employee picker option labels
- **Files modified:** apps/frontend/src/components/epi-deliveries/EpiDeliveryModal.tsx

**3. [Rule 2 - Missing] Added PositionWithEpiCount interface**

- **Found during:** Task 2 — EpiProductsPage Requisitos tab needed position data with epiCount
- **Issue:** Plan spec only referenced PositionEpiRequirement, but the Cargo tab needs the aggregate count
- **Fix:** Added PositionWithEpiCount to types/epi.ts, used in fetchPositionRequirements return type
- **Files modified:** apps/frontend/src/types/epi.ts, apps/frontend/src/hooks/useEpiProducts.ts

## Known Stubs

The following 4 pages are placeholder stubs (title only, no data) — full implementation scheduled in plans 06 and 07:

- `apps/frontend/src/pages/TrainingTypesPage.tsx` — placeholder, plan 06 will implement
- `apps/frontend/src/pages/TrainingRecordsPage.tsx` — placeholder, plan 06 will implement
- `apps/frontend/src/pages/MedicalExamsPage.tsx` — placeholder, plan 06 will implement
- `apps/frontend/src/pages/SafetyDashboardPage.tsx` — placeholder, plan 07 will implement

These stubs do not affect the goals of plan 05 (EPI pages) — they exist only to satisfy route compilation.

## Commits

- `f5057a09` — feat(30-05): frontend types + hooks + ComplianceStatusBadge + sidebar SEGURANÇA + 6 routes
- `ef86ca9f` — feat(30-05): EpiProductsPage + EpiDeliveriesPage with modals per UI-SPEC

## Self-Check: PASSED
