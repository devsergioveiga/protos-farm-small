---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
plan: "05"
subsystem: frontend
tags: [hr-dashboard, payroll, kpi, recharts, rh, integr-03]
dependency_graph:
  requires:
    - GET /org/hr-dashboard (Plan 03 backend endpoint)
    - useFarmContext (farm list for filter)
    - Recharts v3.7.0 (already installed)
  provides:
    - HrDashboardPage at /hr-dashboard
    - useHrDashboard hook
    - PayrollCostTrendChart (lazy)
    - PayrollCompositionChart (lazy)
  affects:
    - apps/frontend/src/App.tsx (new route)
    - apps/frontend/src/components/layout/Sidebar.tsx (new RH group)
tech_stack:
  added: []
  patterns:
    - useState+useCallback hook pattern (matching useFinancialDashboard)
    - React.lazy + Suspense for chart components
    - BEM CSS with CSS custom property tokens
    - Mobile-first responsive grid (2x2 → 4x1 KPI cards)
key_files:
  created:
    - apps/frontend/src/types/hr-dashboard.ts
    - apps/frontend/src/hooks/useHrDashboard.ts
    - apps/frontend/src/components/hr-dashboard/PayrollCostTrendChart.tsx
    - apps/frontend/src/components/hr-dashboard/PayrollCompositionChart.tsx
    - apps/frontend/src/pages/HrDashboardPage.tsx
    - apps/frontend/src/pages/HrDashboardPage.css
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - "Used inline year/month selects (not period picker) to match hr-dashboard backend API requirement for explicit year+month params"
  - "TrendBadge compares against null previous (no prev month data in response) — shows neutral dash until backend adds previous period to response"
  - "Turnover threshold 10% for green/red color: standard HR benchmark for rural operations"
  - "RH sidebar group added before CONFIGURACAO — only hr-dashboard for now, other HR pages to be wired in future plans"
metrics:
  duration: "~20min"
  completed: "2026-03-26"
  tasks: 2
  files_created: 6
  files_modified: 2
  tests: 0
---

# Phase 32 Plan 05: HR Dashboard Frontend Summary

**One-liner:** Full HR KPI dashboard page (INTEGR-03) with 4 metric cards, 12-month stacked BarChart, PieChart composition, cost-by-activity table, contract expiration buckets, and alerts section — connected to the Plan 03 backend endpoint via a useState+useCallback hook.

## What Was Built

### Task 1: Types + Hook + Chart Components

**`types/hr-dashboard.ts`** — Full TypeScript interface mirroring `GET /org/hr-dashboard` response: `HrDashboardQuery`, `HrDashboardResponse`, and all sub-section types (`HrHeadcount`, `HrCurrentMonthCost`, `HrTrend12MonthItem`, `HrCompositionItem`, `HrCostByActivityItem`, `HrTurnover`, `HrContractExpirationBucket`, `HrAlerts`).

**`hooks/useHrDashboard.ts`** — Fetch hook following the `useFinancialDashboard` pattern: `useState + useCallback`, calls `/org/hr-dashboard?year=&month=&farmId=`, returns `{ data, isLoading, error, refetch }`. `useEffect` triggers refetch when params change.

**`PayrollCostTrendChart.tsx`** — Recharts stacked `BarChart` inside `ResponsiveContainer` (height 320). Three `Bar` series: Bruto (`--color-primary-600`), Líquido (`--color-primary-400`), Encargos (`--color-sky-500`). X-axis shows abbreviated pt-BR month labels ("Jan", "Fev", ...). Y-axis formatted as "R$ Xk". Default-exported for `React.lazy` compatibility.

**`PayrollCompositionChart.tsx`** — Recharts `PieChart` inside `ResponsiveContainer` (height 280). Color palette matches UI-SPEC: primary-500, sun-500, sky-500, earth-500, neutral-400. Legend shows percentage alongside each label. Default-exported for `React.lazy` compatibility.

### Task 2: HrDashboardPage + Route + Sidebar

**`HrDashboardPage.tsx`** — Full INTEGR-03 dashboard page:
- Breadcrumb: Início > RH > Dashboard RH
- Filter bar: fazenda select + year number input + month select (auto-apply on change)
- 4 KPI cards (2x2 mobile → 4x1 desktop): Total Colaboradores, Custo Bruto da Folha, Custo por Hectare (or "—" if null), Turnover 12 meses (green ≤10%, red >10%)
- Charts lazy-loaded with skeleton fallback: PayrollCostTrendChart (left) + PayrollCompositionChart (right)
- Cost-by-activity table: ATIVIDADE / CUSTO TOTAL / % DO TOTAL (ALL CAPS headers), sorted by cost descending, max 8 rows + "Ver mais" expand button
- Contract expirations: 3 cards (30d warning, 60d sun, 90d neutral top-border accent) with employee list
- Alerts: 3 rows (overdue payables → /payables?filter=overdue, pending timesheets → /timesheets, expired contracts)
- Skeleton loading state (4 KPI rectangles + 2 chart rectangles)
- Error state with retry button
- Empty state: "Sem dados de folha para o período" + CTA "Processar Folha" → /payroll-runs
- Full WCAG AA: semantic HTML, aria-labels, focus visible, role="alert"/role="status", sr-only caption on table

**`HrDashboardPage.css`** — Mobile-first BEM CSS using CSS custom properties. Skeleton pulse animation with `prefers-reduced-motion` disable. Touch targets ≥48px. 4px spacing scale throughout.

**`App.tsx`** — Added lazy import + `<Route path="/hr-dashboard" element={<HrDashboardPage />} />` inside ProtectedRoute/AppLayout.

**`Sidebar.tsx`** — Added new "RH" nav group with `{ to: '/hr-dashboard', icon: BarChart3, label: 'Dashboard RH' }`, positioned before CONFIGURAÇÃO.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 82e0de84 | feat(32-05): add HR dashboard types, hook, and chart components |
| 2 | c927c603 | feat(32-05): add HrDashboardPage with KPIs, charts, table, expirations, alerts |

## Test Results

- TypeScript: 0 errors (npx tsc --noEmit)
- Vitest: 917/917 tests pass (no regressions)

## Deviations from Plan

**[Rule 1 - Bug] Fixed Recharts Tooltip/Legend TypeScript signatures**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Recharts Tooltip `formatter` typed `value` as `number | string | (string | number)[] | undefined`, and Legend `formatter` entry typed as `LegendPayload` — both differed from narrower types used in initial implementation
- **Fix:** Used same cast pattern as existing `TopCategoriesChart.tsx` for Tooltip; imported `LegendPayload` type and cast `entry.payload` for percentage access in Legend formatter
- **Files modified:** `PayrollCostTrendChart.tsx`, `PayrollCompositionChart.tsx`
- **Commit:** 82e0de84

## Known Stubs

None — all data flows from `useHrDashboard` hook connected to the real Plan 03 backend endpoint. Empty/zero values are correct fallbacks when no payroll data exists for the selected period.

## Self-Check

- [x] `apps/frontend/src/types/hr-dashboard.ts` — FOUND
- [x] `apps/frontend/src/hooks/useHrDashboard.ts` — FOUND
- [x] `apps/frontend/src/components/hr-dashboard/PayrollCostTrendChart.tsx` — FOUND
- [x] `apps/frontend/src/components/hr-dashboard/PayrollCompositionChart.tsx` — FOUND
- [x] `apps/frontend/src/pages/HrDashboardPage.tsx` — FOUND
- [x] `apps/frontend/src/pages/HrDashboardPage.css` — FOUND
- [x] commit 82e0de84 — FOUND
- [x] commit c927c603 — FOUND
- [x] 917/917 Vitest tests PASS
- [x] 0 TypeScript errors

## Self-Check: PASSED
