---
phase: 12-kanban-dashboard-e-notifica-es
plan: '02'
subsystem: purchasing-dashboard, notification-preferences, digest-cron
tags:
  - backend
  - purchasing
  - dashboard
  - notifications
  - cron
dependency_graph:
  requires:
    - '12-01 (NotificationPreference schema + NOTIFICATION_TYPES)'
  provides:
    - 'GET /org/:orgId/purchasing/dashboard with 4 KPIs + 4 charts + alerts'
    - 'GET /org/:orgId/notification-preferences matrix'
    - 'PUT /org/:orgId/notification-preferences toggle'
    - 'shouldNotify integrated into createNotification'
    - 'Daily digest cron at 07:00 BRT with Redis lock'
  affects:
    - 'notifications.service.ts (shouldNotify check on BADGE + email dispatch)'
    - 'main.ts (startDigestCron call)'
    - 'app.ts (2 new routers)'
tech_stack:
  added:
    - 'node-cron ^4.2.1 (digest scheduling)'
  patterns:
    - 'withRlsContext for all service queries'
    - 'withRlsBypass for cross-org digest email queries'
    - 'fire-and-forget void pattern for email dispatch'
    - 'opt-out model for notification preferences (default true)'
    - 'Redis NX lock for single-instance cron execution'
key_files:
  created:
    - apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.types.ts
    - apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.service.ts
    - apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.routes.ts
    - apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.routes.spec.ts
    - apps/backend/src/modules/notification-preferences/notification-preferences.types.ts
    - apps/backend/src/modules/notification-preferences/notification-preferences.service.ts
    - apps/backend/src/modules/notification-preferences/notification-preferences.routes.ts
    - apps/backend/src/modules/notification-preferences/notification-preferences.routes.spec.ts
    - apps/backend/src/shared/cron/digest.cron.ts
    - apps/backend/src/shared/mail/digest-mail.service.ts
  modified:
    - apps/backend/src/modules/notifications/notifications.service.ts
    - apps/backend/src/app.ts
    - apps/backend/src/main.ts
decisions:
  - 'ADMIN role used instead of OWNER for digest recipients (UserRole has no OWNER value)'
  - 'PurchaseRequestItem has no direct product relation — productId fetched then joined with Product for category'
  - 'shouldNotify called inside existing tx for BADGE check; EMAIL dispatch uses withRlsBypass fire-and-forget'
  - 'Digest sends only when at least one item is pending (no empty digests)'
metrics:
  duration: '18min'
  completed_date: '2026-03-18'
  tasks: 2
  files_created: 10
  files_modified: 3
  tests_added: 22
---

# Phase 12 Plan 02: Backend Dashboard, Notification Preferences, and Digest Cron Summary

Backend modules implementing DASH-02 (purchasing dashboard KPI endpoint) and DASH-03 (notification preferences opt-out + daily digest cron with Redis lock).

## Tasks Completed

### Task 1: Dashboard backend module (commit 664dba1)

- `purchasing-dashboard.types.ts` — `PurchasingDashboardData` with 4 KPI pairs (current+prev), 4 chart arrays (`volumeByStage`, `purchasesByCategory`, `monthlyEvolution`, `urgentVsPlanned`), and `alerts` object
- `purchasing-dashboard.service.ts` — `getDashboardData` using `withRlsContext`, parallel KPI + chart queries with farmId + period filters
- `purchasing-dashboard.routes.ts` — GET `/org/:orgId/purchasing/dashboard` with default-to-current-month period
- 9 route tests covering KPIs, charts, filters, auth/permission checks

### Task 2: Notification preferences + shouldNotify + digest cron (commit 64c561c)

- `notification-preferences.service.ts` — `getPreferences` (opt-out model returning all 15 types defaulting true), `upsertPreference` (compound unique upsert), `shouldNotify` (returns true if no record)
- `notification-preferences.routes.ts` — GET (matrix) and PUT (toggle) with `purchases:read` guard
- `notifications.service.ts` expanded — BADGE `shouldNotify` check sets `readAt = now()` when disabled; EMAIL dispatch via `withRlsBypass` fire-and-forget
- `digest.cron.ts` — `startDigestCron` using node-cron at `0 7 * * *` in `America/Sao_Paulo`, Redis NX lock (120s TTL)
- `digest-mail.service.ts` — `sendDigestEmails` queries MANAGER/ADMIN users, checks `DAILY_DIGEST:EMAIL` preference, builds HTML digest with 4 categories, only sends when items > 0
- `main.ts` — `startDigestCron()` called after server listen, guarded by `NODE_ENV !== 'test'`
- 13 route tests covering GET matrix, PUT toggle, auth, validation, and shouldNotify behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PurchaseRequestItem has no product relation**

- **Found during:** Task 1, TypeScript compilation
- **Issue:** Plan assumed `product: { select: { category: true } }` on PurchaseRequestItem, but schema only has `productId` (string) without a relation
- **Fix:** Fetch unique productIds separately, then join with Product table for category/type
- **Files modified:** `purchasing-dashboard.service.ts`
- **Commit:** 664dba1

**2. [Rule 1 - Bug] UserRole has no OWNER value**

- **Found during:** Task 2, TypeScript compilation
- **Issue:** Plan said "MANAGER or OWNER" for digest recipients, but UserRole enum has MANAGER and ADMIN (not OWNER)
- **Fix:** Used `ADMIN` instead of `OWNER` for the digest recipient query
- **Files modified:** `digest-mail.service.ts`
- **Commit:** 64c561c

**3. [Rule 1 - Bug] Organization model has no deletedAt field**

- **Found during:** Task 2, TypeScript compilation
- **Issue:** Plan assumed `organization: { deletedAt: null }` filter in OrgUser query
- **Fix:** Removed deletedAt filter from Organization relation filter (field doesn't exist in schema)
- **Files modified:** `digest-mail.service.ts`
- **Commit:** 64c561c

**4. [Rule 1 - Bug] No OrgUser/orgUser Prisma model**

- **Found during:** Task 2, TypeScript compilation
- **Issue:** Plan said to query "all users with role MANAGER or OWNER across all active organizations" using an `orgUser` join, but no such model exists
- **Fix:** Queried `User` model directly (User has `organizationId` and `role` fields)
- **Files modified:** `digest-mail.service.ts`
- **Commit:** 64c561c

## Self-Check

Files created/exist:

- `apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.service.ts` — FOUND
- `apps/backend/src/modules/notification-preferences/notification-preferences.service.ts` — FOUND
- `apps/backend/src/shared/cron/digest.cron.ts` — FOUND
- `apps/backend/src/shared/mail/digest-mail.service.ts` — FOUND

Commits:

- `664dba1` (Task 1 — dashboard module) — FOUND
- `64c561c` (Task 2 — notification preferences + digest) — FOUND

Tests: 22 passed (9 dashboard + 13 notification preferences)

## Self-Check: PASSED
