---
phase: 18-manutencao-ordens-servico
plan: '06'
subsystem: mobile-maintenance-offline
tags: [mobile, offline, maintenance, push-notification, expo, sqlite]
dependency_graph:
  requires: [18-02]
  provides: [mobile-maintenance-request-screen]
  affects: [work-orders-backend, notifications-backend]
tech_stack:
  added: []
  patterns:
    - expo-image-picker with base64 for offline photo storage
    - createOfflineQueue enqueue pattern for pending operations
    - createMaintenanceRequestRepository SQLite local cache
    - createNotification dispatch inside Prisma transaction
key_files:
  created:
    - apps/mobile/app/(app)/maintenance-request.tsx
    - apps/mobile/services/db/maintenance-request-repository.ts
  modified:
    - apps/mobile/services/db/pending-operations-repository.ts
    - apps/mobile/services/db/index.ts
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/src/modules/work-orders/work-orders.service.ts
decisions:
  - "expo-image-manipulator not available — used expo-image-picker built-in base64 + quality:0.7 instead"
  - "Asset.responsibleUserId does not exist in schema — notify input.assignedTo when present"
  - "Asset list loaded from API /org/assets when online; empty list (free-text fallback) when offline"
metrics:
  duration: 18m
  completed: 2026-03-21
---

# Phase 18 Plan 06: Mobile Maintenance Request Screen Summary

**One-liner:** Mobile screen at /maintenance-request with asset picker, photo capture (base64), geolocation, offline SQLite queue, and push notification dispatch on sync via SOLICITACAO work order type.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Mobile maintenance request screen with offline queue | 34539d19 | 6 files created/modified |

## What Was Built

### Mobile Screen (`maintenance-request.tsx`)
- Expo Router screen at `app/(app)/maintenance-request.tsx`
- Asset picker with search autocomplete (fetches from `/org/assets` API when online)
- Title (required) and description (optional) text inputs
- Photo capture via `expo-image-picker` with quality 0.7 and base64 encoding
- Geolocation auto-captured on mount via `expo-location.getCurrentPositionAsync`
- Displays coordinates as read-only JetBrains Mono text; shows "Localizacao nao disponivel" if permission denied
- Offline-aware: offline banner when disconnected; `createOfflineQueue(db).enqueue()` for async sync
- Calls `flushNow()` for immediate sync when online
- Full accessibility: `accessibilityLabel` on all interactive elements, `SafeAreaView`, `KeyboardAvoidingView`
- WCAG AA compliant design tokens (DM Sans, Source Sans 3, spacing scale)

### SQLite Repository (`maintenance-request-repository.ts`)
- `initTable()` — creates `maintenance_requests` table if not exists
- `saveRequest()` — saves local record with base64 photo, geo coordinates
- `getUnsyncedRequests()` — returns pending/error records ordered by created_at
- `markSynced()` / `markError()` — status update helpers
- `listAll()` — returns all records ordered by created_at DESC

### Offline Queue Integration
- `'maintenance_requests'` added to `OperationEntity` type union in `pending-operations-repository.ts`
- Enqueues `CREATE` operation pointing to `/api/org/work-orders` with `type: 'SOLICITACAO'`
- Repository exported from `db/index.ts`

### Backend Push Notification
- `'MAINTENANCE_REQUEST'` added to `NOTIFICATION_TYPES` in `notifications.types.ts`
- `createWorkOrder` service now imports and calls `createNotification` inside the transaction
- Notification dispatched when `input.type === 'SOLICITACAO'` and `input.assignedTo` is set
- Notification body: `"{asset.name} — {input.title}"`
- `referenceType: 'work_order'` for deep linking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] expo-image-manipulator not installed**
- **Found during:** Task 1 — TypeScript compilation
- **Issue:** Plan specified `expo-image-manipulator` for compression but package is not in mobile package.json or lockfile
- **Fix:** Used `expo-image-picker` built-in `quality: 0.7` + `base64: true` options — same result (JPEG compression + base64 output) without a new dependency
- **Files modified:** `apps/mobile/app/(app)/maintenance-request.tsx`
- **Commit:** 34539d19

**2. [Rule 1 - Bug] Asset.responsibleUserId field does not exist in Prisma schema**
- **Found during:** Task 1 — backend notification dispatch
- **Issue:** Plan mentioned `asset.responsibleUserId` as fallback for notification recipient, but Asset model has no such field
- **Fix:** Notification is dispatched only when `input.assignedTo` is set (the correct field), with no fallback — consistent with schema reality
- **Files modified:** `apps/backend/src/modules/work-orders/work-orders.service.ts`
- **Commit:** 34539d19

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/maintenance-request.tsx` — FOUND
- [x] `apps/mobile/services/db/maintenance-request-repository.ts` — FOUND
- [x] Commit 34539d19 — FOUND (git log --oneline -5 confirmed)
