---
phase: 12-kanban-dashboard-e-notifica-es
plan: '02'
subsystem: purchase-dashboard + notifications
tags: [backend, dashboard, notifications, prisma, kpis]
dependency_graph:
  requires: []
  provides:
    - GET /api/org/purchase-dashboard (5 KPIs + 3 charts + comparison period)
    - GET /api/org/purchase-dashboard/alerts (aging RCs, overdue POs, budget overages)
    - GET /api/org/notifications/preferences
    - PATCH /api/org/notifications/preferences
    - createNotificationIfEnabled (preference-aware notification dispatch)
  affects:
    - apps/backend/src/modules/notifications/notifications.routes.ts
    - apps/backend/src/app.ts
tech_stack:
  added: []
  patterns:
    - Promise.all for parallel KPI computation
    - Module-level Map cache with TTL (5-min)
    - Comparison period: same-length period immediately before requested period
    - Upsert pattern for NotificationPreference
    - Dynamic import for circular-dependency avoidance in notification preferences check
key_files:
  created:
    - apps/backend/src/modules/purchase-dashboard/purchase-dashboard.types.ts
    - apps/backend/src/modules/purchase-dashboard/purchase-dashboard.service.ts
    - apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.ts
    - apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.spec.ts
    - apps/backend/src/modules/notifications/notification-preferences.service.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/src/modules/notifications/notifications.service.ts
    - apps/backend/src/modules/notifications/notifications.routes.ts
    - apps/backend/src/app.ts
decisions:
  - 'Dynamic import used in createNotificationIfEnabled to avoid circular dependency between notifications.service.ts and notification-preferences.service.ts'
  - 'GET /org/purchase-dashboard/alerts registered BEFORE base route to prevent Express path ambiguity'
  - "Preference routes (GET/PATCH /preferences) placed BEFORE /:id/read in notifications.routes.ts to prevent Express matching 'preferences' as :id param"
  - 'NotificationPreference uses opt-out model: absence of record = enabled (returns true)'
  - '5-min TTL cache keyed by org+startDate+endDate+farmId+category to prevent stale cross-org data'
metrics:
  duration: '501s (~8min)'
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_created: 5
  files_modified: 5
---

# Phase 12 Plan 02: Purchase Dashboard + Notification Preferences Summary

Backend executive dashboard module with 5 KPIs, comparison period, 3 chart datasets, alerts, and notification preference CRUD backed by a new NotificationPreference Prisma model.

## Tasks Completed

| Task | Name                                                                            | Commit  | Files                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | NotificationPreference model + dashboard types/service + preference CRUD        | d4777c0 | schema.prisma, notifications.types.ts, notifications.service.ts, notification-preferences.service.ts, purchase-dashboard.types.ts, purchase-dashboard.service.ts |
| 2    | Dashboard routes + notification preference routes + app.ts registration + tests | f1e6513 | purchase-dashboard.routes.ts, purchase-dashboard.routes.spec.ts, notifications.routes.ts, app.ts                                                                 |

## What Was Built

### NotificationPreference Prisma Model

New model `NotificationPreference` added to `schema.prisma` with:

- `@@unique([organizationId, userId, eventType, channel])` constraint
- `@@map("notification_preferences")`
- Relations to Organization and User
- Synced via `prisma db push` + `prisma generate`

### Notification Types Extended

Three new event types added to `NOTIFICATION_TYPES`:

- `GR_CONFIRMED` — for financeiro on goods receipt confirmation
- `DELIVERY_CONFIRMED` — for solicitante on delivery
- `DAILY_DIGEST` — for gerente digest

New constants added:

- `NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'DIGEST']`
- `NOTIFICATION_EVENT_GROUPS` — maps roles to relevant event types

### Notification Preferences Service

`notification-preferences.service.ts` provides:

- `getPreferences(ctx)` — returns all saved preferences for user+org
- `updatePreferences(ctx, prefs[])` — batch upsert with unique constraint
- `isNotificationEnabled(tx, orgId, userId, eventType, channel)` — opt-out check (absence = enabled)

### createNotificationIfEnabled Wrapper

Added to `notifications.service.ts` — checks `isNotificationEnabled` before calling `createNotification`. Uses dynamic import to avoid circular dependency.

### Purchase Dashboard Module

`modules/purchase-dashboard/` with 4 files:

**Types** (`purchase-dashboard.types.ts`):

- `DashboardFilters`, `KpiValue`, `DashboardMetrics` (5 KPIs)
- `DashboardCharts` (purchasesByCategory, savingEvolution, budgetVsActual)
- `DashboardAlert` (PENDING_RC_AGING | PO_OVERDUE | BUDGET_OVERAGE)
- `PurchaseDashboardError`

**Service** (`purchase-dashboard.service.ts`):

- `getDashboardMetrics(ctx, filters)` — computes 5 KPIs for current + previous period in parallel, builds 3 chart datasets. 5-min TTL cache.
- `getDashboardAlerts(ctx, { farmId })` — returns aging RC, overdue PO, and budget overage alerts

**Routes** (`purchase-dashboard.routes.ts`):

- `GET /api/org/purchase-dashboard?startDate=X&endDate=Y` — requires dates, returns `{ metrics, charts }`
- `GET /api/org/purchase-dashboard/alerts` — returns alert array

**Tests** (`purchase-dashboard.routes.spec.ts`):

- 12 tests covering: date validation, response shape (5 KPIs, 3 chart arrays), alerts, preferences GET/PATCH, array validation

### Routes Registration

- `purchaseDashboardRouter` registered in `app.ts`
- `GET/PATCH /org/notifications/preferences` added to `notifications.routes.ts` before `/:id/read`

## Test Results

```
Tests: 12 passed, 12 total
Test Suites: 1 passed, 1 total
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.types.ts` — FOUND
- `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.service.ts` — FOUND
- `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.ts` — FOUND
- `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.spec.ts` — FOUND
- `apps/backend/src/modules/notifications/notification-preferences.service.ts` — FOUND
- Commit d4777c0 — FOUND
- Commit f1e6513 — FOUND
