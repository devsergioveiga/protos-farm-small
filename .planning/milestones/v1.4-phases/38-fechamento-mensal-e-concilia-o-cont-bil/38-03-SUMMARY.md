---
phase: 38-fechamento-mensal-e-concilia-o-cont-bil
plan: "03"
subsystem: frontend-accounting
tags: [monthly-closing, stepper, frontend, react, contabilidade]
dependency_graph:
  requires: [38-01]
  provides: [monthly-closing-ui, monthly-closing-hooks, monthly-closing-types]
  affects: [FiscalPeriodsPage, Sidebar, App]
tech_stack:
  added: []
  patterns: [vertical-stepper, lazy-route, hooks-pattern, confirm-modal]
key_files:
  created:
    - apps/frontend/src/types/monthly-closing.ts
    - apps/frontend/src/hooks/useMonthlyClosing.ts
    - apps/frontend/src/pages/MonthlyClosingPage.tsx
    - apps/frontend/src/pages/MonthlyClosingPage.css
  modified:
    - apps/frontend/src/pages/FiscalPeriodsPage.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - FiscalYearCard now shows PeriodPanel for OPEN periods too (removed direct-close-confirm shortcut) to accommodate the Fechamento button alongside Fechar Periodo
  - Reopen dialog implemented inline (not using ConfirmModal) because it requires a textarea for reason input which ConfirmModal does not support
metrics:
  duration: ~10 min
  completed: "2026-03-28T10:58:00Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 38 Plan 03: Monthly Closing Frontend Summary

Monthly closing frontend with 6-step vertical stepper, validate/revalidate/close/reopen actions, ADMIN-gated reopen, module links for failed steps, sidebar integration, and FiscalPeriodsPage Fechamento button.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Types + hooks for monthly closing API | 995719c8 | Done |
| 2 | MonthlyClosingPage + FiscalPeriodsPage + Sidebar + App route | 1ff6041f | Done |

## What Was Built

### types/monthly-closing.ts
- `StepStatus`, `StepResult`, `StepResults`, `MonthlyClosingOutput` — mirrors backend output exactly
- `STEP_LABELS` — human-readable labels for 6 closing steps
- `STEP_MODULE_LINKS` — path + label for navigation links on failed steps

### hooks/useMonthlyClosing.ts
- `useMonthlyClosing(periodId)` — GET /api/org/:orgId/monthly-closing?periodId=xxx, fetches on mount and periodId change
- `useStartClosing()` — POST start
- `useValidateStep()` — POST validate-step/:stepNumber
- `useCompleteClosing()` — POST complete
- `useReopenClosing()` — POST reopen with reason

### MonthlyClosingPage.tsx (593 lines)
- Reads `periodId` from URL search params (`useSearchParams`)
- Shows "Selecione um período" empty state when no periodId
- Shows "Iniciar Fechamento" button when no closing record exists
- Vertical stepper for 6 steps with OK/FAILED/PENDING/BLOCKED visual states
- Each step: circle icon + label + status badge + summary + expand/collapse details
- PENDING steps with previous step OK show "Validar" button
- FAILED steps show module link + "Revalidar" button (D-05)
- BLOCKED steps (previous not OK) show dimmed appearance, no button
- "Fechar Período" enabled only when all 6 steps are OK, uses ConfirmModal (variant=warning)
- "Reabrir Período" only visible for ADMIN/SUPER_ADMIN when status=COMPLETED, inline modal with reason textarea
- Toast notifications for all actions
- Skeleton loading, error state
- Lucide icons: CheckCircle2 (OK), XCircle (FAILED), Circle (PENDING), Lock (BLOCKED), ShieldCheck, Unlock
- WCAG 2.1 AA: semantic HTML, aria-label on icon-only buttons, role=alert for errors, focus-visible
- Mobile-first CSS with 4px grid, CSS custom properties, prefers-reduced-motion

### FiscalPeriodsPage.tsx
- Added `useNavigate` and `ClipboardCheck` imports
- Added "Fechamento" button in PeriodPanel for OPEN periods: navigates to `/monthly-closing?periodId=xxx`
- Refactored `FiscalYearCard` to show PeriodPanel for OPEN periods (previously bypassed to ConfirmModal directly)

### Sidebar.tsx
- Added `{ to: '/monthly-closing', icon: ClipboardCheck, label: 'Fechamento Mensal' }` to CONTABILIDADE group after Balancete

### App.tsx
- Added lazy import: `const MonthlyClosingPage = lazy(() => import('@/pages/MonthlyClosingPage'))`
- Added route: `<Route path="/monthly-closing" element={<MonthlyClosingPage />} />`

## Deviations from Plan

### Auto-adjusted: FiscalYearCard OPEN period behavior

**Found during:** Task 2
**Issue:** Plan requested adding "Fechamento" button near "Fechar" button. Original code skipped PeriodPanel entirely for OPEN periods (direct ConfirmModal). Adding the button to PeriodPanel required OPEN periods to also show the panel.
**Fix:** Removed the `period.status === 'OPEN'` guard from `FiscalYearCard.handlePeriodSelect` and the dedicated `showCloseConfirm` state + `ConfirmModal`. "Fechar Período" now lives in `PeriodPanel` alongside the new "Fechamento" button. The close action in PeriodPanel already used inline form (not ConfirmModal), so no regression.
**Files modified:** apps/frontend/src/pages/FiscalPeriodsPage.tsx

### Auto-adjusted: Reopen dialog inline instead of ConfirmModal

**Found during:** Task 2
**Issue:** ConfirmModal props interface does not support a textarea field for reason input. Plan said "ConfirmModal with textarea for reason".
**Fix:** Inline reopen dialog using the `confirm-modal__overlay` + `confirm-modal__box` CSS classes for consistent look, with dedicated textarea for reason. Behavior is identical to ConfirmModal (Escape closes, backdrop click handled by overlay).

## Known Stubs

None. All 6 step validations call real backend endpoints. Data is fully wired.

## Self-Check

- [x] apps/frontend/src/types/monthly-closing.ts — FOUND
- [x] apps/frontend/src/hooks/useMonthlyClosing.ts — FOUND
- [x] apps/frontend/src/pages/MonthlyClosingPage.tsx — FOUND (593 lines, >200 required)
- [x] apps/frontend/src/pages/MonthlyClosingPage.css — FOUND
- [x] Commit 995719c8 — Task 1 types+hooks
- [x] Commit 1ff6041f — Task 2 pages+sidebar+route
- [x] TypeScript compiles clean: `pnpm --filter @protos-farm/frontend exec tsc --noEmit` — PASSED
