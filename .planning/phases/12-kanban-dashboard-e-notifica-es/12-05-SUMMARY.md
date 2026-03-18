---
phase: 12-kanban-dashboard-e-notifica-es
plan: '05'
subsystem: frontend/notifications+routing
tags: [notifications, sidebar, routing, preferences, react]
dependency_graph:
  requires: [12-02, 12-03]
  provides:
    [
      notification-preferences-page,
      notification-bell-expansion,
      sidebar-nav-update,
      app-routes-wiring,
    ]
  affects: [App.tsx, Sidebar.tsx, NotificationBell.tsx, useNotifications.ts]
tech_stack:
  added: []
  patterns:
    - 'Optimistic toggle with 1s inline checkmark + revert-on-error in useNotificationPreferences'
    - 'Role=switch ARIA pattern for toggle matrix'
    - 'Type-aware navigation in NotificationBell.handleItemClick'
key_files:
  created:
    - apps/frontend/src/hooks/useNotificationPreferences.ts
    - apps/frontend/src/pages/NotificationPreferencesPage.tsx
    - apps/frontend/src/pages/NotificationPreferencesPage.css
  modified:
    - apps/frontend/src/hooks/useNotifications.ts
    - apps/frontend/src/components/notifications/NotificationBell.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/src/types/farm.ts
    - apps/frontend/src/components/farm-selector/FarmSelector.spec.tsx
    - apps/frontend/src/pages/FarmsPage.spec.tsx
    - apps/frontend/src/stores/FarmContext.spec.tsx
decisions:
  - 'useNotificationPreferences uses /org/notification-preferences (no explicit orgId in URL) — consistent with /org/notifications pattern, org extracted from JWT server-side'
  - 'DAILY_DIGEST badge cell uses aria-disabled=true span (not a disabled button) to avoid interactive element in disabled state confusing screen readers'
  - 'NotificationBell handleItemClick now type-aware — navigates to quotations/goods-receipts/purchase-budgets/goods-returns based on notification type'
  - 'Rule 3 auto-fix: FarmListItem._count.registrations added back (was removed in prior plan from another branch); spec fixtures updated with ruralProperties: 0 to satisfy new required field'
metrics:
  duration: '7min'
  completed: '2026-03-18'
  tasks_completed: 2
  files_created: 3
  files_modified: 8
---

# Phase 12 Plan 05: Frontend Wiring — Notification Preferences, Bell, Sidebar, Routes Summary

**One-liner:** Notification preferences toggle matrix with auto-save + 9 new notification types in bell + Dashboard Compras/Kanban/Preferences in sidebar + 3 lazy routes in App.tsx.

## What Was Built

### Task 1: Notification Preferences Page + Hook

- `useNotificationPreferences` hook: fetches `GET /org/notification-preferences`, optimistic toggle on PUT, 1s inline checkmark after success, revert + error toast on failure
- `NotificationPreferencesPage` renders 5 groups / 15 event types as a toggle matrix table
- Toggle buttons use `role="switch"` + `aria-checked` for accessibility
- DAILY_DIGEST row: email toggle enabled, badge column disabled with `aria-disabled="true"` and dash placeholder
- Responsive: accordion layout below 640px, `prefers-reduced-motion` respected in all transitions
- Loading: skeleton table rows; error: retry button

### Task 2: NotificationBell Expansion + Sidebar + App.tsx

- `useNotifications.ts`: `NotificationType` union extended with 9 new types (QUOTATION_PENDING_APPROVAL, QUOTATION_APPROVED, QUOTATION_RECEIVED, QUOTATION_DEADLINE_NEAR, PO_OVERDUE, PO_GOODS_RECEIVED, BUDGET_EXCEEDED, RETURN_REGISTERED, RETURN_RESOLVED); `NOTIFICATION_LABELS` map added for pt-BR labels
- `NotificationBell.tsx`: switch cases for 5 new in-app types with appropriate icons (FileCheck/PackageCheck/AlertTriangle/Undo2/CheckCircle); `handleItemClick` now type-aware, routes to correct page per notification type
- `Sidebar.tsx`: `Dashboard Compras` (/purchasing-dashboard, BarChart2 icon) and `Kanban` (/purchasing-kanban, Columns3) at top of COMPRAS group; `Preferencias de Notificacao` (/notification-preferences, BellRing) in CONFIGURACAO group
- `App.tsx`: lazy imports + routes for `/purchasing-dashboard`, `/purchasing-kanban` (already registered, now confirmed), `/notification-preferences`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Build Blocker] FarmListItem.\_count.registrations missing from type**

- **Found during:** Task 2 build verification
- **Issue:** Prior plan changes removed `registrations` from `FarmListItem._count`, but spec fixtures still referenced it. Build failed with 8 TS errors.
- **Fix:** Added `registrations: number` back to `_count` interface; updated 8 spec fixture objects to include `ruralProperties: 0` to satisfy all required fields
- **Files modified:** `apps/frontend/src/types/farm.ts`, `FarmSelector.spec.tsx`, `FarmsPage.spec.tsx`, `FarmContext.spec.tsx`
- **Commit:** ed40fb1

## Self-Check

### Files exist

- apps/frontend/src/hooks/useNotificationPreferences.ts: FOUND
- apps/frontend/src/pages/NotificationPreferencesPage.tsx: FOUND
- apps/frontend/src/pages/NotificationPreferencesPage.css: FOUND

### Commits

- a1c9587: feat(12-05): notification preferences page + hook
- ed40fb1: feat(12-05): notification bell expansion, sidebar wiring, App.tsx routes

### Build

- `pnpm --filter @protos-farm/frontend build`: PASSED (7 chunks built, no TypeScript errors)

## Self-Check: PASSED
