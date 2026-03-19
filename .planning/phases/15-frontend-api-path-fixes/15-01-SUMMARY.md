---
phase: 15-frontend-api-path-fixes
plan: '01'
subsystem: frontend-hooks
tags: [api-paths, kanban, notifications, bug-fix, tdd]
dependency_graph:
  requires: []
  provides: [correct-kanban-dnd-api-paths, orgId-notification-preferences, daily-digest-label]
  affects: [usePurchasingKanban, useNotificationPreferences, useNotifications]
tech_stack:
  added: []
  patterns: [TDD red-green, useAuth orgId injection]
key_files:
  created:
    - apps/frontend/src/hooks/useNotificationPreferences.spec.ts
    - apps/frontend/src/hooks/useNotifications.spec.ts
  modified:
    - apps/frontend/src/hooks/usePurchasingKanban.ts
    - apps/frontend/src/hooks/usePurchasingKanban.spec.ts
    - apps/frontend/src/hooks/useNotificationPreferences.ts
    - apps/frontend/src/hooks/useNotifications.ts
decisions:
  - "RC_PENDENTE->RC_APROVADA transition uses POST /org/purchase-requests/:id/transition with body {action:'APPROVE'} — matches backend TransitionPRInput interface, not the legacy /approve shortcut"
  - 'Notification preferences orgId injected via useAuth().user.organizationId — consistent with authenticated context pattern used elsewhere'
  - "DAILY_DIGEST added to NotificationType union with label 'Resumo diario' — matches digest notification sent by cron job"
metrics:
  duration: 7min
  completed_date: '2026-03-19'
  tasks_completed: 2
  files_changed: 6
---

# Phase 15 Plan 01: Frontend API Path Fixes Summary

**One-liner:** Fixed 5 API path mismatches in Kanban DnD hooks and notification preferences by removing spurious orgId segments from action endpoints and injecting orgId from JWT context where required.

## Tasks Completed

| #   | Task                                   | Commit   | Files                                                                                                 |
| --- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Create/update failing test specs (RED) | 7ffa3547 | usePurchasingKanban.spec.ts, useNotificationPreferences.spec.ts (new), useNotifications.spec.ts (new) |
| 2   | Fix 3 hooks to pass all tests (GREEN)  | 51a3e165 | usePurchasingKanban.ts, useNotificationPreferences.ts, useNotifications.ts                            |

## Changes Made

### usePurchasingKanban.ts — 3 path fixes in moveCard

| Transition                     | Before                                                     | After                                                                          |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| RC_PENDENTE->RC_APROVADA       | `POST /org/${orgId}/purchase-requests/${cardId}/approve`   | `POST /org/purchase-requests/${cardId}/transition` + body `{action:'APPROVE'}` |
| RC_APROVADA->EM_COTACAO        | `POST /org/${orgId}/quotations`                            | `POST /org/quotations` (no orgId)                                              |
| OC_EMITIDA->AGUARDANDO_ENTREGA | `PATCH /org/${orgId}/purchase-orders/${cardId}/transition` | `PATCH /org/purchase-orders/${cardId}/transition` (no orgId)                   |

The fetch board path (`/org/${orgId}/purchasing/kanban`) was intentionally left unchanged — that endpoint does require orgId.

### useNotificationPreferences.ts — orgId injection

- Added `import { useAuth } from '../stores/AuthContext'`
- Added `const { user } = useAuth(); const orgId = user?.organizationId ?? '';` at function start
- Updated GET path: `/org/notification-preferences` → `/org/${orgId}/notification-preferences`
- Updated PUT path: `/org/notification-preferences` → `/org/${orgId}/notification-preferences`
- Added `orgId` to both `useCallback` dependency arrays

### useNotifications.ts — DAILY_DIGEST addition

- Added `| 'DAILY_DIGEST'` to `NotificationType` union
- Added `DAILY_DIGEST: 'Resumo diario'` to `NOTIFICATION_LABELS` Record

## Test Results

- **Targeted specs:** 3 files, all passing (909/909 tests)
- **Full frontend suite:** 94 test files, 909 tests, 0 failures
- **Regressions:** None

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- usePurchasingKanban.ts: FOUND
- useNotificationPreferences.ts: FOUND
- useNotifications.ts: FOUND
- useNotificationPreferences.spec.ts: FOUND
- useNotifications.spec.ts: FOUND
- Commit 7ffa3547 (test RED): FOUND
- Commit 51a3e165 (feat GREEN): FOUND
