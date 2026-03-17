---
phase: 03-dashboard-financeiro
verified: 2026-03-16T17:30:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification: false
human_verification:
  - test: 'Visual layout — KPI cards, charts, and ranked lists'
    expected: '4 KPI cards (Saldo bancário real, A pagar 30d, A receber 30d, Resultado do mês) are visible with correct values, YoY badges, SALDO REAL micro-badge on card 1, bar chart (receitas vs despesas) and pie chart (top 5 categories) render side-by-side on desktop and stack on mobile'
    why_human: 'Chart rendering, responsive layout, and visual hierarchy cannot be verified programmatically'
  - test: 'Farm and period filter interactivity'
    expected: "Selecting a different farm or period triggers a refetch and updates all KPI values; period label on KPI 4 switches between 'Resultado do mês' and 'Resultado do trimestre' when quarter is selected"
    why_human: 'State-driven refetch behaviour requires browser interaction'
  - test: 'Skeleton loading and error state'
    expected: 'Skeleton screens appear briefly while data loads; error state shows retry button; retry button calls refetch and re-renders skeleton'
    why_human: 'Timing-dependent loading states and error recovery require live browser testing'
  - test: 'SALDO REAL label distinguishes bank balance from contábil'
    expected: "User can clearly distinguish 'Saldo bancário real' (BankAccountBalance.currentBalance only) from any accounting-derived balance; micro-badge 'SALDO REAL' is visible and legible"
    why_human: 'UX clarity and visual legibility require human judgment (per VALIDATION.md manual check)'
---

# Phase 3: Dashboard Financeiro — Verification Report

**Phase Goal:** Proprietário e gerente têm uma tela consolidada que mostra posição financeira completa da fazenda — saldo total, CP e CR próximos, resultado do mês e endividamento — assim que Phases 1 e 2 têm dados reais

**Verified:** 2026-03-16T17:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01 (Backend)

| #   | Truth                                                                                                   | Status     | Evidence                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GET /api/org/financial-dashboard returns `totalBankBalance` from BankAccountBalance.currentBalance only | ✓ VERIFIED | service.ts line 62-66: Money accumulator from `acc.balance?.currentBalance` only; `totalBankBalancePrevYear = null` hardcoded (no CP/CR mixing) |
| 2   | Returns `payablesDue30d` for PENDING/OVERDUE installments due within 30 days                            | ✓ VERIFIED | service.ts lines 73-94: `status: { in: ['PENDING', 'OVERDUE'] }`, `dueDate: { gte: todayUtc, lte: in30Days }`                                   |
| 3   | Returns `receivablesDue30d` for PENDING installments due within 30 days                                 | ✓ VERIFIED | service.ts lines 121-138: `status: 'PENDING'`, `dueDate: { gte: todayUtc, lte: in30Days }`                                                      |
| 4   | Returns `monthResult` as settled CR minus settled CP for selected month                                 | ✓ VERIFIED | service.ts line 210: `totalReceivedInMonth.subtract(totalPaidInMonth).toNumber()` using `paidAt`/`receivedAt` boundaries                        |
| 5   | Returns prevYear values as null when no prior-year data exists (never NaN or div-by-zero)               | ✓ VERIFIED | service.ts lines 69 (always null for balance), 109-117 (null if no records), 153-161 (null if no records), 236-255 (null if both sums zero)     |
| 6   | Returns `monthlyTrend` with last 6 months of realized revenues and expenses                             | ✓ VERIFIED | service.ts lines 261-319: loop `for (let i = 5; i >= 0; i--)` using `paidAt`/`receivedAt` settled installments                                  |
| 7   | Returns `topExpenseCategories`, `topPayablesByCategory`, and `topReceivablesByClient`                   | ✓ VERIFIED | service.ts lines 325-418: three distinct groupings, top-5 sort, rank + relativePercent computed                                                 |

### Observable Truths — Plan 02 (Frontend)

| #   | Truth                                                                                               | Status     | Evidence                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | User sees 4 KPI cards: Saldo bancário real, CP 30d, CR 30d, Resultado do mês                        | ✓ VERIFIED | FinancialDashboardPage.tsx lines 272-354: four `<article class="fin-dashboard__kpi-card">` with correct labels                                                 |
| 9   | Each KPI card shows YoY % variation with arrow or em-dash when no prior data                        | ✓ VERIFIED | YoyBadge component (lines 64-120): `prevYear === null` renders em-dash; positive/negative renders arrow + percentage                                           |
| 10  | Bar chart shows receitas vs despesas by month using Recharts                                        | ✓ VERIFIED | RevenueExpenseChart.tsx: imports `BarChart, Bar, ResponsiveContainer` from recharts; lazy-loaded in page                                                       |
| 11  | Pie chart shows top 5 expense categories with percentages                                           | ✓ VERIFIED | TopCategoriesChart.tsx: imports `PieChart, Pie, Cell` from recharts; lazy-loaded in page                                                                       |
| 12  | Top 5 despesas por categoria and top 5 receitas por cliente displayed side-by-side on desktop       | ✓ VERIFIED | Page lines 400+: two side-by-side sections; CSS `.fin-dashboard__top5` uses `grid-template-columns 1fr 1fr` at ≥768px                                          |
| 13  | Farm dropdown defaults to "Todas as fazendas" and uses local state (not FarmContext.selectedFarmId) | ✓ VERIFIED | Page line 172: `useState<string \| null>(null)` for `localFarmId`; comment "NOT using FarmContext.selectedFarmId"                                              |
| 14  | Period dropdown defaults to "Mês atual" with options for prior month and quarter                    | ✓ VERIFIED | `PERIOD_OPTIONS` array with 3 values; `useState('current')`                                                                                                    |
| 15  | Alerts panel shows overdue CP count/total and projected negative balance warning                    | ✓ VERIFIED | Page: `<section aria-label="Alertas financeiros">` renders `alerts.overduePayablesCount` and `alerts.projectedBalanceNegative`                                 |
| 16  | Dashboard is the first item in FINANCEIRO sidebar group at route /financial-dashboard               | ✓ VERIFIED | Sidebar.tsx line 170: `{ to: '/financial-dashboard', icon: LayoutDashboard, label: 'Dashboard' }` as first FINANCEIRO item; App.tsx line 164: route registered |
| 17  | Skeleton loading shown during fetch, error state with retry button on failure                       | ✓ VERIFIED | Page line 241: `{isLoading && <DashboardSkeleton />}`; line 244-253: error state with retry `<button>` calling `refetch()`                                     |

**Score:** 17/17 truths verified

---

## Required Artifacts

| Artifact                                                                          | Status     | Details                                                                                                                      |
| --------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts`       | ✓ VERIFIED | Exports `FinancialDashboardOutput`, `FinancialDashboardQuery`, `FinancialDashboardError`; 62 lines                           |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts`     | ✓ VERIFIED | Exports `getFinancialDashboard`; 465 lines; uses `withRlsContext`, `Money`, `Date.UTC`                                       |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.ts`      | ✓ VERIFIED | Exports `financialDashboardRouter`; `GET /org/financial-dashboard` with `authenticate` + `checkPermission('financial:read')` |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.spec.ts` | ✓ VERIFIED | 321 lines, 13 test cases covering all 8 required behaviors (Tests 1-8) plus auth/permission/error handling                   |
| `apps/frontend/src/hooks/useFinancialDashboard.ts`                                | ✓ VERIFIED | Exports `useFinancialDashboard`; fetches `/org/financial-dashboard` with year/month/farmId params                            |
| `apps/frontend/src/pages/FinancialDashboardPage.tsx`                              | ✓ VERIFIED | 499 lines; all 4 KPI cards, charts, top-5 lists, alerts, skeleton, error, empty states                                       |
| `apps/frontend/src/pages/FinancialDashboardPage.css`                              | ✓ VERIFIED | Contains `fin-dashboard__kpis`, `prefers-reduced-motion`, `var(--color-primary-50)`                                          |
| `apps/frontend/src/components/financial-dashboard/RevenueExpenseChart.tsx`        | ✓ VERIFIED | Default export; imports `BarChart`, `ResponsiveContainer` from recharts                                                      |
| `apps/frontend/src/components/financial-dashboard/TopCategoriesChart.tsx`         | ✓ VERIFIED | Default export; imports `PieChart`, `Pie`, `Cell` from recharts                                                              |

---

## Key Link Verification

### Plan 01 — Backend

| From                            | To                               | Via                                         | Status  | Details                                                                                            |
| ------------------------------- | -------------------------------- | ------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `financial-dashboard.routes.ts` | `financial-dashboard.service.ts` | `import getFinancialDashboard`              | ✓ WIRED | Line 6: `import { getFinancialDashboard } from './financial-dashboard.service'`; called at line 44 |
| `apps/backend/src/app.ts`       | `financial-dashboard.routes.ts`  | `app.use('/api', financialDashboardRouter)` | ✓ WIRED | app.ts line 86: import; line 177: `app.use('/api', financialDashboardRouter)`                      |

### Plan 02 — Frontend

| From                                              | To                             | Via                                | Status  | Details                                                                                                                         |
| ------------------------------------------------- | ------------------------------ | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FinancialDashboardPage.tsx`                      | `/api/org/financial-dashboard` | `useFinancialDashboard` hook fetch | ✓ WIRED | Page line 177: `useFinancialDashboard({ farmId: localFarmId, period })`; hook line 76: `api.get('/org/financial-dashboard...')` |
| `apps/frontend/src/App.tsx`                       | `FinancialDashboardPage`       | lazy import + Route                | ✓ WIRED | App.tsx line 84: `lazy(() => import('@/pages/FinancialDashboardPage'))`; line 164: `<Route path="/financial-dashboard" .../>`   |
| `apps/frontend/src/components/layout/Sidebar.tsx` | `/financial-dashboard`         | sidebar menu item                  | ✓ WIRED | Sidebar.tsx line 170: `{ to: '/financial-dashboard', icon: LayoutDashboard, label: 'Dashboard' }` as first FINANCEIRO item      |

---

## Requirements Coverage

| Requirement | Source Plans           | Description                                                                                                                                                                   | Status      | Evidence                                                                                                                                                                                                |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FN-15       | 03-01-PLAN, 03-02-PLAN | Proprietário pode ver dashboard financeiro consolidado com saldo total, CP vs CR 7/30 dias, resultado do mês, endividamento, top despesas/receitas e comparativo ano anterior | ✓ SATISFIED | All 17 truths verified; backend endpoint aggregates all required KPIs; frontend page renders consolidated view at `/financial-dashboard`; endividamento placeholder present (Fase 6 note per plan spec) |

No orphaned requirements found. REQUIREMENTS.md maps FN-15 to Phase 3 with status "Complete".

---

## Anti-Patterns Found

| File                             | Pattern                                                                                                                                     | Severity  | Impact                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `financial-dashboard.service.ts` | `/* eslint-disable @typescript-eslint/no-explicit-any */` + widespread `any` casts for Prisma calls                                         | ℹ Info    | No functional impact; Prisma 7 typed client would eliminate these; pattern is consistent with other modules in this codebase                                      |
| `FinancialDashboardPage.tsx`     | `isEmpty` condition includes `data.monthlyTrend.length === 0` — empty state triggers even when balance/CP/CR have values but trend is empty | ⚠ Warning | In a fresh database with bank balance but no closed installments, the empty state would render incorrectly. Does not block phase goal but may cause UI confusion. |

No blocker anti-patterns found. No TODO/FIXME/placeholder stubs. No `return null` component stubs.

---

## Human Verification Required

### 1. Visual layout — KPI cards, charts, and ranked lists

**Test:** Start both servers (`pnpm dev` in both `apps/backend` and `apps/frontend`). Navigate to `http://localhost:5173/financial-dashboard`.

**Expected:** 4 KPI cards visible at top with correct labels (Saldo bancário real, A pagar — próximos 30 dias, A receber — próximos 30 dias, Resultado do mês); SALDO REAL badge on card 1; YoY badges show em-dash when no prior-year data; bar chart and pie chart render side-by-side; top-5 ranked lists show below charts.

**Why human:** Chart rendering (Recharts canvas/SVG output), responsive layout, font rendering, and visual spacing cannot be verified programmatically.

### 2. Farm and period filter interactivity

**Test:** With dashboard loaded, change the Fazenda dropdown to a specific farm. Then change Período to "Mês anterior" and then "Último trimestre".

**Expected:** Each selection triggers a refetch (skeleton briefly visible); KPI values update; KPI 4 label changes to "Resultado do trimestre" when quarter is selected.

**Why human:** State-driven refetch behaviour and label updates require browser interaction to observe.

### 3. Skeleton loading and error state

**Test:** Throttle network to Slow 3G in browser devtools, reload page to observe skeleton. Then point the API to an invalid URL (or stop backend) and observe error state.

**Expected:** Skeleton screens (not spinners) appear during load; error state shows "Não foi possível carregar o dashboard" with a "Tentar novamente" button that re-triggers the fetch.

**Why human:** Timing-dependent loading states and error recovery require live browser testing.

### 4. SALDO REAL label distinguishes bank balance from contábil

**Test:** Inspect KPI card 1 label area.

**Expected:** "Saldo bancário real" label and "SALDO REAL" micro-badge are visible and legible; the distinction from any future contábil balance is clear to a non-technical user.

**Why human:** UX clarity and visual legibility require human judgment (explicitly listed as manual-only in `03-VALIDATION.md`).

---

## Summary

All 17 automated truths pass across both plans. The backend aggregation endpoint is substantive (465 lines of real query logic, not stubs), correctly wired to app.ts, and backed by 13 passing spec tests. The frontend page is substantive (499 lines), correctly lazy-loaded and routed, consuming the hook which actually calls the backend endpoint. All key links are wired.

FN-15 is fully satisfied by the implementation. The only outstanding items are 4 human verification tests for visual/interactive behaviour that cannot be verified programmatically.

One minor warning: the `isEmpty` condition in `FinancialDashboardPage.tsx` requires `monthlyTrend.length === 0` in addition to zero monetary values, which could cause the empty state to suppress the data view in edge cases — but this does not block the phase goal.

---

_Verified: 2026-03-16T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
