---
phase: 12-kanban-dashboard-e-notifica-es
plan: '04'
subsystem: frontend
tags:
  - dashboard
  - recharts
  - purchasing
  - kpi
dependency_graph:
  requires:
    - 12-02 (purchasing dashboard backend endpoint)
    - 12-03 (kanban page for drill-down links)
  provides:
    - PurchasingDashboardPage at /purchasing-dashboard
    - usePurchasingDashboard hook
    - 4 lazy-loaded Recharts chart components
  affects:
    - apps/frontend routing (page added to App.tsx separately)
tech_stack:
  added: []
  patterns:
    - React.lazy + Suspense for chart code splitting
    - YoyBadge inline component with "up = bad" semantics for all purchasing KPIs
    - Period resolution with Mes/Trimestre/Safra/Custom presets
    - Custom Tooltip content prop for VolumeByStageChart (dual-value tooltip)
key_files:
  created:
    - apps/frontend/src/hooks/usePurchasingDashboard.ts
    - apps/frontend/src/pages/PurchasingDashboardPage.tsx
    - apps/frontend/src/pages/PurchasingDashboardPage.css
    - apps/frontend/src/components/purchasing-dashboard/VolumeByStageChart.tsx
    - apps/frontend/src/components/purchasing-dashboard/PurchasesByCategoryChart.tsx
    - apps/frontend/src/components/purchasing-dashboard/MonthlyEvolutionChart.tsx
    - apps/frontend/src/components/purchasing-dashboard/UrgentVsPlannedChart.tsx
  modified: []
decisions:
  - 'labelFormatter + content cannot coexist on Recharts Tooltip — removed redundant props, kept custom content renderer for VolumeByStageChart dual-value tooltip'
  - 'Pre-existing spec TS errors (registrations field renamed) deferred to separate fix — out of scope for this plan'
metrics:
  duration: 5min
  completed: '2026-03-18'
  tasks: 2
  files_created: 7
  files_modified: 0
---

# Phase 12 Plan 04: Purchasing Dashboard Page Summary

**One-liner:** React dashboard page with 4 KPI cards (3 drill-down to kanban), 4 lazy-loaded Recharts charts, and conditional alerts section following FinancialDashboardPage pattern exactly.

## What Was Built

### Task 1: Dashboard hook + KPI cards + period/farm filters

- **`usePurchasingDashboard.ts`** — Custom hook fetching `GET /org/:orgId/purchasing/dashboard` with farmId + periodStart/periodEnd query params. Returns `{ data, isLoading, error, refetch }`.
- **`PurchasingDashboardPage.tsx`** — Full dashboard page with:
  - 4 KPI cards: RCs pendentes (clickable → /purchase-requests?status=PENDENTE), OCs em atraso (clickable → /purchasing-kanban?filter=overdue_po), Prazo medio do ciclo (div role="status"), Entregas atrasadas (clickable → /purchasing-kanban?filter=late_deliveries)
  - YoyBadge with "up = bad" semantics for all 4 KPIs (error color for increase, success for decrease)
  - Period selector: Mes, Trimestre, Safra, Personalizado (custom shows date inputs)
  - Farm filter narrows all data
  - Alerts section: only renders when at least one alert count > 0
  - Skeleton loading (4 KPI + 4 chart skeletons), error with retry, empty state
  - 4 lazy-loaded chart components with Suspense fallback skeletons
- **`PurchasingDashboardPage.css`** — BEM CSS using only CSS custom properties (var(--color-_), var(--space-_))

### Task 2: 4 Recharts chart components

- **`VolumeByStageChart.tsx`** — BarChart with 7 kanban stage labels, count on Y axis, custom tooltip showing count + total value in BRL
- **`PurchasesByCategoryChart.tsx`** — PieChart donut (innerRadius 60%, outerRadius 80%) with 8-color palette, Legend below
- **`MonthlyEvolutionChart.tsx`** — LineChart for 12-month evolution with dot on each point, YYYY-MM → abbreviated month label
- **`UrgentVsPlannedChart.tsx`** — Stacked BarChart: urgent (#C62828 red) + planned (#2E7D32 green) per month

All charts: default export (React.lazy compatible), ResponsiveContainer width="100%" height={300}, figure/figcaption wrapper, BRL formatting via Intl.NumberFormat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed conflicting Tooltip props in VolumeByStageChart**

- **Found during:** Task 2 verification (TypeScript build)
- **Issue:** Recharts Tooltip `labelFormatter` prop type is incompatible with `content` custom renderer — TS2322 error. Having both `formatter`, `labelFormatter`, and `content` is redundant since `content` overrides the others.
- **Fix:** Removed `formatter` and `labelFormatter`, kept only `content` custom renderer which already handled the dual-value tooltip (count + totalValue in BRL).
- **Files modified:** `apps/frontend/src/components/purchasing-dashboard/VolumeByStageChart.tsx`
- **Commit:** d305687

### Deferred Items

**Pre-existing TypeScript spec errors (out of scope):**

- `FarmSelector.spec.tsx`, `FarmsPage.spec.tsx`, `FarmContext.spec.tsx` use `registrations` field that was renamed to `ruralProperties + fieldPlots` in a prior plan. Documented in `deferred-items.md`. Build passes for production (vite build succeeds; tsc fails only on spec files).

## Commits

| Task   | Commit  | Description                                                               |
| ------ | ------- | ------------------------------------------------------------------------- |
| Task 1 | 4ba195d | feat(12-04): add purchasing dashboard page with KPIs, filters, and alerts |
| Task 2 | d305687 | feat(12-04): add 4 Recharts chart components for purchasing dashboard     |

## Self-Check

Files created:

- apps/frontend/src/hooks/usePurchasingDashboard.ts ✓
- apps/frontend/src/pages/PurchasingDashboardPage.tsx ✓
- apps/frontend/src/pages/PurchasingDashboardPage.css ✓
- apps/frontend/src/components/purchasing-dashboard/VolumeByStageChart.tsx ✓
- apps/frontend/src/components/purchasing-dashboard/PurchasesByCategoryChart.tsx ✓
- apps/frontend/src/components/purchasing-dashboard/MonthlyEvolutionChart.tsx ✓
- apps/frontend/src/components/purchasing-dashboard/UrgentVsPlannedChart.tsx ✓

Commits verified: 4ba195d, d305687

## Self-Check: PASSED
