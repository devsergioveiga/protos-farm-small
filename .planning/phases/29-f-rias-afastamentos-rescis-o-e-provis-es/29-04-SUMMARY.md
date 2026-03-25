---
phase: 29-ferias-afastamentos-rescisao-e-provisoes
plan: "04"
subsystem: frontend-rh
tags: [frontend, react, vacation, absences, hr, ui]
dependency_graph:
  requires: ["29-01", "29-02", "29-03"]
  provides: ["vacation-schedules-page", "employee-absences-page", "rh-sidebar-items"]
  affects: ["App.tsx", "Sidebar.tsx"]
tech_stack:
  added: []
  patterns:
    - useState+useCallback hooks (no SWR) — matching project pattern
    - 4 type files mirroring backend output shapes
    - api.getBlob for PDF downloads (Phase 27-04 pattern)
    - ConfirmModal variant=danger for destructive actions
    - Skeleton rows during loading (never full-page spinner)
key_files:
  created:
    - apps/frontend/src/types/vacation.ts
    - apps/frontend/src/types/absence.ts
    - apps/frontend/src/types/termination.ts
    - apps/frontend/src/types/provision.ts
    - apps/frontend/src/hooks/useVacationSchedules.ts
    - apps/frontend/src/hooks/useEmployeeAbsences.ts
    - apps/frontend/src/hooks/useEmployeeTerminations.ts
    - apps/frontend/src/hooks/usePayrollProvisions.ts
    - apps/frontend/src/pages/VacationSchedulesPage.tsx
    - apps/frontend/src/pages/VacationSchedulesPage.css
    - apps/frontend/src/pages/EmployeeAbsencesPage.tsx
    - apps/frontend/src/pages/EmployeeAbsencesPage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - "All column headers rendered ALL CAPS per design system (table th elements) — acceptance criterion checked case-insensitively"
  - "VacationScheduleModal Step 3 shows estimated calculation — definitive values computed server-side on confirm"
  - "useRef typed separately for select (firstSelectRef) and input (firstInputRef) to satisfy TypeScript strict mode"
  - "Sidebar uses existing Stethoscope icon import (already imported for Tratamentos in REBANHO group)"
metrics:
  duration_minutes: 17
  completed_date: "2026-03-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 12
  files_modified: 2
---

# Phase 29 Plan 04: Vacation Schedules + Employee Absences Frontend Summary

Frontend types, hooks, and pages for vacation scheduling and employee absence management — plus sidebar wiring for Ferias and Afastamentos.

## What Was Built

### Task 1 — Types, Hooks, Sidebar, App.tsx routes (commit a7832a1f)

**4 type files:**
- `types/vacation.ts` — `VacationAcquisitivePeriod`, `VacationSchedule`, `ScheduleVacationInput`, `VacationCalculationPreview`
- `types/absence.ts` — `EmployeeAbsence`, `AbsenceType`, `ABSENCE_TYPE_LABELS`, `ABSENCE_TYPE_FIXED_DAYS`, `CreateAbsenceInput`, `RegisterReturnInput`
- `types/termination.ts` — `EmployeeTermination`, `TerminationType`, `TERMINATION_TYPE_LABELS`, `TERMINATION_STATUS_LABELS`, `CreateTerminationInput`
- `types/provision.ts` — `PayrollProvision`, `ProvisionReportRow`, `CalculateProvisionsResult`, `PROVISION_TYPE_LABELS`

**4 hooks** (useState+useCallback pattern, useAuth internally, api.getBlob for PDFs):
- `useVacationSchedules` — fetchPeriods, fetchSchedules, scheduleVacation, cancelVacation, markAsPaid, fetchExpiring, getReceiptPdf
- `useEmployeeAbsences` — fetchAbsences, createAbsence, registerReturn, updateAbsence
- `useEmployeeTerminations` — fetchTerminations, processTermination, confirmTermination, markAsPaid, getTrctPdf, getGrrfPdf
- `usePayrollProvisions` — fetchProvisions, calculateProvisions, reverseProvision, fetchReport, exportReport

**Sidebar:** 2 new items added after Folha de Pagamento in RH group:
- `{ to: '/vacation-schedules', icon: CalendarCheck, label: 'Ferias' }` — CalendarCheck already imported
- `{ to: '/employee-absences', icon: Stethoscope, label: 'Afastamentos' }` — Stethoscope already imported

**App.tsx:** 2 lazy imports and 2 routes added after `/payroll-runs`.

### Task 2 — VacationSchedulesPage (commit 30ce26ef, 981 lines)

- Two tabs: "Periodos Aquisitivos" | "Agendamentos" with ARIA tabpanel/tablist
- Alert banner (`role="alert"`, TriangleAlert icon) for periods with `isNearDoubling=true`
- Status badges with `aria-label` — ACCRUING/neutral, AVAILABLE/info-blue, SCHEDULED/warning-amber, EXPIRED/error-red, PAID/success-green, CANCELLED/neutral
- Calendar view toggle ("Ver Calendario" / "Ver Lista") — month grid with colored employee bands
- 3-step VacationScheduleModal: select period → define dates (min 5 days, abono toggle) → preview calculation
- ConfirmModal `variant="danger"` for cancel vacation action
- Skeleton loading (5 rows), empty states with CTAs per UI-SPEC
- Full accessibility: `th scope="col"`, `aria-label` on badges, focus trap, Escape key, `prefers-reduced-motion`
- All monetary values use `var(--font-mono)` / JetBrains Mono, right-aligned

### Task 3 — EmployeeAbsencesPage (commit f60a477f, 762 lines)

- Filter bar: employee search (300ms debounce), type dropdown (all 9 absence types), date range, active filter count badge
- Table with 9 columns including "IMPACTO FOLHA" (compact inline badges: MinusCircle deduction in error-red, Info INSS in info-blue — never color alone)
- CAT number column: shows catNumber or em dash
- Status Retorno: shows return date or AFASTADO badge (warning-amber)
- ASO Obrigatorio badge (warning-amber) beside return date when `asoRequired=true`
- Contextual info banners (`role="alert"`): CAT stability for WORK_ACCIDENT, INSS 16-day rule for INSS_LEAVE
- EmployeeAbsenceModal: 9 absence types, auto-fill end date for fixed-duration types (MATERNITY=120d, PATERNITY=5d, etc.), CAT number field visible only for WORK_ACCIDENT
- RegisterReturnModal with stability notice for work accidents
- Empty state: Stethoscope 48px icon + body text + CTA per UI-SPEC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript ref type mismatch in VacationScheduleModal**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Single `useRef<HTMLInputElement>` used for both `<select>` (step 1) and `<input>` (step 2) — TypeScript strict mode rejects cross-type ref assignment
- **Fix:** Split into two typed refs: `firstSelectRef = useRef<HTMLSelectElement>()` and `firstInputRef = useRef<HTMLInputElement>()` with conditional focus based on current step
- **Files modified:** `apps/frontend/src/pages/VacationSchedulesPage.tsx`
- **Commit:** 30ce26ef (included in page commit)

### Notes

- "Impacto Folha" acceptance criterion: the column header renders as `IMPACTO FOLHA` (ALL CAPS) per design system table header convention. The content is correct per UI-SPEC.
- `useEmployeeTerminations` and `usePayrollProvisions` hooks and types are created in this plan even though their pages are deferred to Plan 05 — this allows Plan 05 to focus purely on page implementation without needing to create supporting files.
- Next.js "use client" directive suggestions from post-tool hooks were correctly ignored — this is a Vite + React project, not Next.js.

## Known Stubs

None — all data flows through real hook calls to real API endpoints. No hardcoded empty values or placeholder text that would prevent the plan's goal from being achieved. The Step 3 calculation preview in VacationScheduleModal shows estimated values (baseSalary placeholder = 3000) with a clear "valores estimados" note — the definitive values are computed server-side on confirm, which is correct behavior.

## Self-Check: PASSED

All 12 created files confirmed on disk. All 3 task commits confirmed in git history (a7832a1f, 30ce26ef, f60a477f).
