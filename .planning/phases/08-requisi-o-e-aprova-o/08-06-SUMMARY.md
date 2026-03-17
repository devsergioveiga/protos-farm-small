---
phase: 08-requisi-o-e-aprova-o
plan: 06
subsystem: ui
tags:
  [react-native, expo-router, expo-notifications, expo-sqlite, offline, purchase-requests, mobile]

# Dependency graph
requires:
  - phase: 08-02
    provides: Backend purchase-request endpoints (POST /org/purchase-requests, GET, transition)
  - phase: 08-03
    provides: Approval workflow state machine and notification dispatch

provides:
  - Mobile RC creation form (offline-capable, SQLite-backed) at app/(app)/purchase-request.tsx
  - Mobile "Minhas Requisicoes" list with status/offline badges at app/(app)/my-requests.tsx
  - Mobile "Aprovacoes Pendentes" with approve/reject/return actions at app/(app)/pending-approvals.tsx
  - SQLite offline repository for local RC storage at services/db/purchase-request-repository.ts
  - Push notification registration and handler at services/push-notifications.ts
  - Navigation entry points in "Mais" tab for all 3 RC screens

affects: [push-notification-delivery, approval-workflow-mobile]

# Tech tracking
tech-stack:
  added: [expo-notifications]
  patterns:
    - LocalPurchaseRequest stored to SQLite then enqueued to offline-queue with entity 'purchase_requests'
    - Color tokens validated against ThemeColors — only indices present in design-tokens.ts are valid (error 100/500, warning 100/500, primary 50–900)
    - accessibilityRequired not valid on RN TextInput — use aria-required instead

key-files:
  created:
    - apps/mobile/app/(app)/purchase-request.tsx
    - apps/mobile/app/(app)/my-requests.tsx
    - apps/mobile/app/(app)/pending-approvals.tsx
    - apps/mobile/services/db/purchase-request-repository.ts
    - apps/mobile/services/push-notifications.ts
  modified:
    - apps/mobile/services/db/pending-operations-repository.ts
    - apps/mobile/services/db/index.ts
    - apps/mobile/app/(app)/(tabs)/more.tsx
    - apps/mobile/package.json

key-decisions:
  - 'purchase_requests OperationEntity priority is NORMAL (not critical) — purchase orders are not safety-critical like health/reproductive records'
  - 'Two-step offline sync: enqueue CREATE to /api/org/purchase-requests, server auto-submits or separate SUBMIT transition; mobile does not enqueue transition separately to keep queue simple'
  - 'expo-notifications shouldShowBanner+shouldShowList added alongside shouldShowAlert for newer Expo SDK NotificationBehavior compatibility'

patterns-established:
  - 'Pattern: LocalPurchaseRequest uses localId (uuid-like) as SQLite PK; serverId populated after sync via updateSyncStatus'
  - 'Pattern: Color indices must match design-tokens.ts exactly — e.g. warning only has 100 and 500, error only has 100 and 500'

requirements-completed: [REQC-02, REQC-03]

# Metrics
duration: 18min
completed: 2026-03-17
---

# Phase 08 Plan 06: Mobile RC Creation Summary

**Offline-capable purchase request creation (SQLite + offline-queue), Minhas Requisicoes list, Aprovacoes Pendentes with approve/reject/return, and expo-notifications push registration**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-17T21:10:21Z
- **Completed:** 2026-03-17T21:28:16Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Mobile RC creation form with product autocomplete from SQLite reference-data cache, urgency segmented control, expo-location geolocation capture, expo-image-picker photo, offline-queue integration
- SQLite purchase_requests table with full CRUD: savePurchaseRequest, listPurchaseRequests, updateSyncStatus, getPurchaseRequestByLocalId
- Minhas Requisicoes screen with horizontal filter tabs (Todas/Pendente/Aprovada/Rejeitada), server+local merge, pull-to-refresh, "Pendente envio" offline badge per unsynced item
- Aprovacoes Pendentes with detail modal, 3 action buttons (Aprovar/Devolver/Rejeitar), comment field required for reject/return, SLA countdown for URGENTE/EMERGENCIAL
- Push notification registration with expo-notifications, token upsert to backend, foreground handler, navigation response handler
- Navigation entry points added to "Mais" tab

## Task Commits

1. **Task 1: Mobile RC creation screen + offline repository** - `960d62f` (feat)
2. **Task 2: My Requests + Pending Approvals + push notifications** - `0dadff7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/mobile/app/(app)/purchase-request.tsx` - Full-screen RC creation form with offline-first submit
- `apps/mobile/app/(app)/my-requests.tsx` - User's RC list with filter tabs and offline badges
- `apps/mobile/app/(app)/pending-approvals.tsx` - Approver's pending RC list with action modal
- `apps/mobile/services/db/purchase-request-repository.ts` - SQLite repository for offline RC storage
- `apps/mobile/services/push-notifications.ts` - Expo notifications registration and handler
- `apps/mobile/services/db/pending-operations-repository.ts` - Added 'purchase_requests' to OperationEntity union
- `apps/mobile/services/db/index.ts` - Exported purchase-request-repository
- `apps/mobile/app/(app)/(tabs)/more.tsx` - Added 3 navigation entries for RC screens
- `apps/mobile/package.json` + `pnpm-lock.yaml` - Added expo-notifications

## Decisions Made

- `purchase_requests` OperationEntity priority is NORMAL (not CRITICAL) — purchase orders are not safety-critical like health/reproductive records
- Two-step offline sync uses single CREATE enqueue; the backend auto-transitions or the server handles it — keeping the mobile queue simpler with one operation
- `expo-notifications` NotificationBehavior in newer Expo SDK requires `shouldShowBanner` and `shouldShowList` alongside `shouldShowAlert` to satisfy type constraint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid color token indices**

- **Found during:** Task 1 and 2 (TypeScript compilation)
- **Issue:** Color tokens `warning[600]`, `warning[700]`, `error[600]`, `primary[50]` used but design-tokens.ts only defines `warning: {100, 500}` and `error: {100, 500}`
- **Fix:** Replaced invalid indices with valid ones (600→500, 700→500 for warning/error)
- **Files modified:** purchase-request.tsx, my-requests.tsx, pending-approvals.tsx
- **Verification:** `npx tsc --noEmit` exits with 0 errors in our files
- **Committed in:** 960d62f, 0dadff7

**2. [Rule 1 - Bug] Removed `accessibilityRequired` from TextInput**

- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `accessibilityRequired` prop does not exist on React Native TextInput type
- **Fix:** Removed the prop (uses `accessibilityLabel` instead for screen reader context)
- **Committed in:** 960d62f

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** All auto-fixes required for TypeScript compilation. No scope creep.

## Issues Encountered

None — plan executed as specified with minor TypeScript corrections.

## User Setup Required

None - no external service configuration required. Push notification `projectId` reads from `Constants.expoConfig` at runtime.

## Next Phase Readiness

- Mobile RC flow complete: create → sync → view → approve/reject
- Push notification token registration wired; backend delivery (Phase 08-03 notifications endpoint) is already in place
- Ready for end-to-end testing of the full RC approval workflow

---

_Phase: 08-requisi-o-e-aprova-o_
_Completed: 2026-03-17_
