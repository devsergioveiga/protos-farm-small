---
phase: 30
plan: "07"
subsystem: frontend
tags: [safety, nr31, dashboard, compliance, kpi, epi, training, aso]
dependency_graph:
  requires: ["30-05", "30-06"]
  provides: ["safety-compliance-dashboard", "safety-kpi-card"]
  affects: ["safety-dashboard-route"]
tech_stack:
  added: []
  patterns:
    - "useSafetyCompliance hook with fetchSummary + fetchNonCompliantEmployees + exportCsv + exportPdf"
    - "SafetyKpiCard reusable KPI display component"
    - "FarmContext integration for dashboard filtering"
    - "Skeleton loaders for KPI row and table"
    - "ComplianceDashboardQuery type for parameterized employee fetch"
key_files:
  created:
    - apps/frontend/src/hooks/useSafetyCompliance.ts
    - apps/frontend/src/components/shared/SafetyKpiCard.tsx
  modified:
    - apps/frontend/src/pages/SafetyDashboardPage.tsx
    - apps/frontend/src/pages/SafetyDashboardPage.css
    - apps/frontend/src/types/medical-exam.ts
    - apps/frontend/src/types/training.ts
decisions:
  - "SafetyKpiCard kept in components/shared/ (not components/payroll/) for reuse across Phase 30 modules"
  - "exportPdf uses window.open(blobUrl) then revokes after 10s — matches pesticide-prescriptions pattern"
  - "Tab badge counts derived from current page of employees (client-side) — sufficient for dashboard overview"
  - "EPI tab uses rowspan for grouped employee rows — aligns with complex data display pattern"
metrics:
  duration_minutes: 35
  completed_date: "2026-03-26"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 4
requirements:
  - SEGUR-01
  - SEGUR-02
  - SEGUR-03
---

# Phase 30 Plan 07: Safety Compliance Dashboard Summary

**One-liner:** SafetyDashboardPage with 4 KPI cards, 4-tab layout (Visao Geral/EPIs/Treinamentos/ASOs), CSV/PDF export via useSafetyCompliance hook, and FarmContext integration completing all Phase 30 NR-31 frontend work.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | useSafetyCompliance hook + SafetyKpiCard component | 9de73dc6 | Done |
| 2 | SafetyDashboardPage with 4 tabs, KPIs, and export | 4eff36fc | Done |
| 3 | Visual verification of complete Phase 30 | — | Awaiting human verify |

## What Was Built

### useSafetyCompliance hook (`apps/frontend/src/hooks/useSafetyCompliance.ts`)

- `fetchSummary(farmId?)` — GET `/org/safety-compliance/summary` → ComplianceSummary
- `fetchNonCompliantEmployees(query)` — GET `/org/safety-compliance/employees` with full filter params
- `fetchEmployeeCompliance(employeeId)` — GET `/org/safety-compliance/employees/:id`
- `exportCsv(farmId?)` — GET `/org/safety-compliance/report/csv` → blob download with filename `conformidade-nr31-YYYY-MM-DD.csv`
- `exportPdf(farmId?)` — GET `/org/safety-compliance/report/pdf` → open in new tab
- `exportingCsv` and `exportingPdf` loading states for spinner display

### SafetyKpiCard (`apps/frontend/src/components/shared/SafetyKpiCard.tsx`)

- Props: `label`, `value`, `icon: LucideIcon`, optional `suffix`, optional `borderColor`
- Value: DM Sans 700, `--text-2xl` (1.875rem), `--color-neutral-800`
- Label: Source Sans 3 600, `--text-sm` (0.875rem), `--color-neutral-500`
- `toLocaleString('pt-BR')` for number formatting
- `borderColor` as inline style for dynamic left-border accent

### SafetyDashboardPage (`apps/frontend/src/pages/SafetyDashboardPage.tsx`)

**KPI Row (4 cards):**
- Total colaboradores (Users icon)
- Conformes with `(%)` suffix, green border (ShieldCheck icon)
- Com pendências (ShieldAlert icon)
- Vencimentos em 30 dias, warning border (Clock icon)

**Tab Strip:**
- 4 tabs: Visao Geral, EPIs, Treinamentos, ASOs
- Tab badges (warning-100/warning-500) showing pending counts

**Tab 1 — Visao Geral:**
- Search debounced 300ms + pending type filter
- Employee table: Nome, Cargo, EPIs pendentes (count badge), Treinamentos vencidos (count badge), Status ASO (ComplianceStatusBadge)
- "Exportar CSV" + "Relatorio PDF" buttons — neutral border, no primary green
- Both buttons show Loader2 spinner (16px) while fetching
- Pagination when totalPages > 1
- Empty state: ShieldCheck (64px, success-500) + "Todos os colaboradores em conformidade" + body text

**Tab 2 — EPIs:** Grouped by employee, EPI items in rows, status filter
**Tab 3 — Treinamentos:** Training items with expiry date + ComplianceStatusBadge
**Tab 4 — ASOs:** Next exam date + expiry status badge

**Loading:** KPI row skeleton (4 cards) + table skeleton (5 rows)
**Error state:** red-tinted error box with retry button

### SafetyDashboardPage.css

- `.safety-dashboard__kpi-row`: `grid-template-columns: repeat(4, 1fr)` → 2 on ≤1024px → 1 on ≤640px
- `.safety-kpi-card`: neutral-100 bg, 8px radius, 20px padding, hover `translateY(-2px)` + shadow-lg, 100ms ease-out
- `@media (prefers-reduced-motion: reduce)`: disables KPI card hover transform and skeleton animation
- Export buttons: transparent bg, neutral border — NOT primary green per UI-SPEC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing type exports from plan 05/06 type files**
- **Found during:** Task 1 — TypeScript check before writing code
- **Issue:** `useMedicalExams.ts` imported `UpdateMedicalExamInput` from `@/types/medical-exam` (didn't exist). `useTrainingTypes.ts` imported `UpdateTrainingTypeInput` and `CreatePositionTrainingRequirementInput` from `@/types/training` (didn't exist).
- **Fix:** Added `UpdateMedicalExamInput = Partial<CreateMedicalExamInput>`, `UpdateTrainingTypeInput = Partial<CreateTrainingTypeInput>`, and `CreatePositionTrainingRequirementInput` interface to the respective type files.
- **Files modified:** `apps/frontend/src/types/medical-exam.ts`, `apps/frontend/src/types/training.ts`
- **Commit:** 9de73dc6

## Known Stubs

None — all dashboard data fetches from live endpoints. Tab counts (EPI, training, ASO badges) are derived from the current page of employees returned by the API.

## Self-Check

Created files:
- [x] `apps/frontend/src/hooks/useSafetyCompliance.ts` — exists (commit 9de73dc6)
- [x] `apps/frontend/src/components/shared/SafetyKpiCard.tsx` — exists (commit 9de73dc6)

Modified files:
- [x] `apps/frontend/src/pages/SafetyDashboardPage.tsx` — 340+ lines (commit 4eff36fc)
- [x] `apps/frontend/src/pages/SafetyDashboardPage.css` — 380+ lines (commit 4eff36fc)

Commits:
- [x] 9de73dc6 — feat(30-07): useSafetyCompliance hook + SafetyKpiCard component
- [x] 4eff36fc — feat(30-07): SafetyDashboardPage — 4 KPI cards, 4 tabs, export, empty state

TypeScript: `npx tsc --noEmit` exits 0

## Self-Check: PASSED
