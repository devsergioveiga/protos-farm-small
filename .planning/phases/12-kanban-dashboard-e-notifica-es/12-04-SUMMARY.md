---
phase: 12-kanban-dashboard-e-notifica-es
plan: '04'
subsystem: purchase-dashboard-frontend + notification-preferences-ui
tags: [frontend, dashboard, recharts, notifications, react, kpis]
dependency_graph:
  requires: [12-02]
  provides:
    - PurchaseDashboardPage at /purchase-dashboard
    - usePurchaseDashboard hook (metrics+charts+alerts)
    - PurchaseCategoryChart (BarChart)
    - PurchaseSavingChart (LineChart)
    - BudgetVsActualChart (ComposedChart)
    - useNotificationPreferences hook
    - NotificationPreferencesModal (grouped by role context)
    - NotificationBell updated with preferences gear icon
  affects:
    - apps/frontend/src/App.tsx (new route)
    - apps/frontend/src/components/layout/Sidebar.tsx (new COMPRAS item)
    - apps/frontend/src/components/notifications/NotificationBell.tsx
tech_stack:
  added: []
  patterns:
    - React.lazy + Suspense for chart code splitting
    - Promise.all for parallel API fetch (metrics+charts and alerts)
    - Dirty-tracking pattern for preferences form (originalMap vs current prefMap)
    - Opt-out defaults for notification preferences (absence of record = enabled)
    - CSS-in-JSX scoped styles for NotificationPreferencesModal to avoid global conflicts
    - Period preset buttons with custom date range fallback
key_files:
  created:
    - apps/frontend/src/hooks/usePurchaseDashboard.ts
    - apps/frontend/src/hooks/useNotificationPreferences.ts
    - apps/frontend/src/components/purchase-dashboard/PurchaseCategoryChart.tsx
    - apps/frontend/src/components/purchase-dashboard/PurchaseSavingChart.tsx
    - apps/frontend/src/components/purchase-dashboard/BudgetVsActualChart.tsx
    - apps/frontend/src/components/notifications/NotificationPreferencesModal.tsx
    - apps/frontend/src/pages/PurchaseDashboardPage.tsx
    - apps/frontend/src/pages/PurchaseDashboardPage.css
  modified:
    - apps/frontend/src/components/notifications/NotificationBell.tsx
    - apps/frontend/src/components/notifications/NotificationBell.css
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - 'Chart components are lazy-loaded via React.lazy so Recharts bundle is not included in the initial page load'
  - 'BudgetVsActualChart uses ComposedChart (not two separate BarCharts) to support future Line overlay without refactor'
  - 'useNotificationPreferences uses Map internally for O(1) lookup but exposes flat array in return value to match API shape'
  - 'NotificationPreferencesModal uses CSS-in-JSX <style> block instead of separate .css file to keep the component self-contained'
  - 'ChangeBadge in KpiCard accepts invertColors prop so cycle time (lower = better) shows green for negative change'
  - 'Pre-existing TypeScript errors in KanbanCard/KanbanColumn (@dnd-kit not installed) are out-of-scope and deferred'
metrics:
  duration: '~18min'
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_created: 8
  files_modified: 4
---

# Phase 12 Plan 04: Purchase Dashboard Frontend + Notification Preferences UI Summary

Executive purchase dashboard with 5 KPI cards + comparison badges, 3 lazy-loaded Recharts charts, period filter presets, alerts panel, and a notification preferences modal accessible from the bell dropdown.

## Tasks Completed

| Task | Name                                                                       | Commit  | Files                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Dashboard hook, chart components, preferences hook and modal               | 45b5015 | usePurchaseDashboard.ts, PurchaseCategoryChart.tsx, PurchaseSavingChart.tsx, BudgetVsActualChart.tsx, useNotificationPreferences.ts, NotificationPreferencesModal.tsx |
| 2    | PurchaseDashboardPage, update NotificationBell, register route and sidebar | 9a95721 | PurchaseDashboardPage.tsx, PurchaseDashboardPage.css, NotificationBell.tsx, NotificationBell.css, App.tsx, Sidebar.tsx                                                |

## What Was Built

### usePurchaseDashboard Hook

`hooks/usePurchaseDashboard.ts` — fetches dashboard metrics+charts and alerts in parallel using `Promise.all`. Re-fetches whenever filters change (via `JSON.stringify(filters)` dependency key). Mirrors backend types: `KpiValue`, `DashboardMetrics`, `DashboardCharts`, `DashboardAlert`.

### Chart Components

Three lazy-loadable Recharts chart components in `components/purchase-dashboard/`:

- **PurchaseCategoryChart**: `BarChart` with `#2E7D32` green bars, pt-BR BRL tooltip
- **PurchaseSavingChart**: `LineChart` with `#1565C0` blue line, dot radius 4, pt-BR BRL tooltip
- **BudgetVsActualChart**: `ComposedChart` with dual `Bar` elements (green budget, orange actual), Legend below

All three use `ResponsiveContainer width="100%" height={300}`, compact YAxis formatter (k/M suffixes), and consistent tooltip styling matching the existing PriceHistoryChart pattern.

### useNotificationPreferences Hook

`hooks/useNotificationPreferences.ts` — fetches saved preferences on mount, builds defaults (all event types x IN_APP+PUSH = enabled, DIGEST only for DAILY_DIGEST), merges fetched preferences over defaults. Exposes:

- `updatePreference(eventType, channel, enabled)` — updates local Map, marks dirty
- `savePreferences()` — PATCH `/org/notifications/preferences` with only changed prefs, resets dirty
- `isDirty` — true when any preference differs from fetched state

Exports `NOTIFICATION_EVENT_GROUPS`, `EVENT_TYPE_LABELS` (pt-BR), `ROLE_GROUP_LABELS` (pt-BR) constants.

### NotificationPreferencesModal

Self-contained modal with scoped CSS-in-JSX. Groups notification event types by role context (SOLICITANTE, APROVADOR, COMPRADOR, FINANCEIRO, GERENTE). Each row shows IN_APP and PUSH toggle switches; DIGEST channel is only shown for `DAILY_DIGEST` event. Focus trap with Tab/Shift-Tab cycling and Escape to close. Save button disabled when `!isDirty`.

### PurchaseDashboardPage

Full executive dashboard page at `/purchase-dashboard`:

- **Period filter bar**: 4 preset buttons (Mes atual, Trimestre, Safra, Ano) + custom date range + farm filter + category filter
- **KPI grid**: 5 cards (Volume Total, Requisicoes, Ciclo Medio, Entrega no Prazo, Saving Acumulado) — responsive 5/3/1 column grid
- **Comparison badges**: `ChangeBadge` component with ArrowUp/ArrowDown icon and green/red coloring; `invertColors` prop for Ciclo Medio (lower is better)
- **Charts section**: 3 lazy-loaded chart cards with Suspense skeleton fallback
- **Alerts panel**: clickable alert rows navigating to relevant pages (/purchase-requests, /purchase-orders, /purchase-budgets)
- **Skeleton loading**: 5 KPI skeleton cards + 3 chart skeletons + 3 alert row skeletons

### NotificationBell Update

Added `Settings` gear icon button at bottom of notification dropdown. Clicking opens `NotificationPreferencesModal` and closes the dropdown. Modal rendered outside dropdown for correct stacking context.

### Route and Sidebar

- `App.tsx`: `PurchaseDashboardPage` lazy import + `/purchase-dashboard` route after `/purchase-kanban`
- `Sidebar.tsx`: `{ to: '/purchase-dashboard', icon: LayoutDashboard, label: 'Dashboard' }` added at end of COMPRAS group

## Deviations from Plan

### Deferred Out-of-Scope Issues

Pre-existing TypeScript errors in `KanbanCard.tsx`, `KanbanColumn.tsx`, `PurchaseKanbanPage.tsx` from `@dnd-kit` package not being installed — these were present before this plan and are not caused by our changes. Deferred for Phase 12-03 fix.

All acceptance criteria met. TypeScript compiles without errors in any of the 12 files created or modified.

## Self-Check: PASSED

- `apps/frontend/src/hooks/usePurchaseDashboard.ts` — FOUND
- `apps/frontend/src/hooks/useNotificationPreferences.ts` — FOUND
- `apps/frontend/src/components/purchase-dashboard/PurchaseCategoryChart.tsx` — FOUND
- `apps/frontend/src/components/purchase-dashboard/PurchaseSavingChart.tsx` — FOUND
- `apps/frontend/src/components/purchase-dashboard/BudgetVsActualChart.tsx` — FOUND
- `apps/frontend/src/components/notifications/NotificationPreferencesModal.tsx` — FOUND
- `apps/frontend/src/pages/PurchaseDashboardPage.tsx` — FOUND
- `apps/frontend/src/pages/PurchaseDashboardPage.css` — FOUND
- Commit 45b5015 — FOUND
- Commit 9a95721 — FOUND
