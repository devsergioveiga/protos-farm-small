---
phase: 08-requisi-o-e-aprova-o
plan: 03
subsystem: api
tags: [approval-workflow, notifications, state-machine, delegation, sla, prisma]

requires:
  - phase: 08-01
    provides: Types (ApprovalRuleError, CreateApprovalRuleInput, CreateDelegationInput, CreateNotificationInput, TransitionInput, RC_VALID_TRANSITIONS, SLA_HOURS)
  - phase: 08-02
    provides: purchase-requests.service.ts (createPurchaseRequest, CRUD), purchase-requests.routes.ts (base RC endpoints)

provides:
  - Approval rules CRUD with priority ordering and reorder
  - Delegation management (create, list, deactivate) with active-delegation override
  - matchApprovalRule: finds first matching rule by priority, requestType, amount range
  - resolveApprover: checks active delegation, returns delegate or primary approver
  - RC state machine: RASCUNHO->PENDENTE->APROVADA/REJEITADA/DEVOLVIDA, APROVADA->CANCELADA
  - Approval engine: creates ApprovalAction rows per step, supports double-approval
  - SLA deadline computed on SUBMIT based on RC urgency (URGENTE=24h, EMERGENCIAL=4h)
  - processSlaReminders: background function to notify before SLA breach
  - In-app notifications created inside Prisma transaction; push dispatch placeholder
  - 41 integration tests covering both modules

affects: [08-04, 08-05, 08-06]

tech-stack:
  added: []
  patterns:
    - Approval engine injected into purchase-requests.service via cross-module imports
    - createNotification takes TxClient (not RlsContext) to run inside existing transaction
    - dispatchPushNotification is fire-and-forget after transaction commit
    - Static routes (reorder, delegations) placed before /:id to prevent Express ID-matching

key-files:
  created:
    - apps/backend/src/modules/approval-rules/approval-rules.service.ts
    - apps/backend/src/modules/approval-rules/approval-rules.routes.ts
    - apps/backend/src/modules/approval-rules/approval-rules.routes.spec.ts
    - apps/backend/src/modules/notifications/notifications.service.ts
    - apps/backend/src/modules/notifications/notifications.routes.ts
  modified:
    - apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
    - apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts
    - apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts
    - apps/backend/src/app.ts

key-decisions:
  - 'Decimal type for minAmount/maxAmount/quantity/estimatedUnitPrice requires Number() cast before arithmetic comparisons in TypeScript'
  - 'resolveApprover uses tx (not withRlsContext) since it is called inside an existing transaction from transitionPurchaseRequest'
  - 'dispatchPushNotification is fire-and-forget after commit — void pattern with .catch() prevents transaction rollback on push failure'

patterns-established:
  - 'Cross-module service calls: approval-rules.service and notifications.service imported directly into purchase-requests.service'
  - 'Static sub-path routes (reorder, delegations) always placed before /:id to avoid Express matching them as ID parameters'

requirements-completed: [REQC-03]

duration: 21min
completed: 2026-03-17
---

# Phase 08 Plan 03: RC Approval Engine, Notifications, and State Machine Summary

**Approval rules CRUD, delegation routing, in-transaction notifications, and full RC state machine (SUBMIT/APPROVE/REJECT/RETURN/CANCEL) with double-approval and SLA deadline tracking**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-17T20:44:26Z
- **Completed:** 2026-03-17T21:05:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Approval rules CRUD with priority ordering, reorder, and delegation management
- RC transition endpoint implementing full state machine with approval engine, double-approval, and delegation routing
- In-app notifications created inside Prisma transaction, push dispatch placeholder after commit
- 41 tests passing across both modules (13 in approval-rules.routes.spec.ts, 28 in purchase-requests.routes.spec.ts)

## Task Commits

1. **Task 1: Approval rules service+routes, notifications service+routes, app.ts** - `f89f75a` (feat)
2. **Task 2: RC workflow transitions + approval engine + tests** - `9d8123e` (feat)

## Files Created/Modified

- `apps/backend/src/modules/approval-rules/approval-rules.service.ts` - CRUD + delegation + matchApprovalRule + resolveApprover
- `apps/backend/src/modules/approval-rules/approval-rules.routes.ts` - REST endpoints for rules and delegations
- `apps/backend/src/modules/approval-rules/approval-rules.routes.spec.ts` - 13 integration tests
- `apps/backend/src/modules/notifications/notifications.service.ts` - createNotification (in-tx), CRUD, getUnreadCount, dispatchPushNotification
- `apps/backend/src/modules/notifications/notifications.routes.ts` - REST endpoints for notifications
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` - transitionPurchaseRequest + processSlaReminders added
- `apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts` - POST /:id/transition endpoint
- `apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts` - 10 new transition tests (28 total)
- `apps/backend/src/app.ts` - approvalRulesRouter + notificationsRouter registered

## Decisions Made

- Decimal type for Prisma fields (minAmount, quantity, estimatedUnitPrice) requires `Number()` cast before arithmetic in TypeScript
- `resolveApprover` accepts TxClient (not RlsContext) to participate in existing transactions
- `dispatchPushNotification` uses fire-and-forget void pattern to prevent push failures rolling back the transaction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Decimal type casting for amount comparison**

- **Found during:** Task 1 (matchApprovalRule implementation)
- **Issue:** Prisma Decimal type does not support `<=` and `>=` operators directly with number in TypeScript strict mode
- **Fix:** Added `Number()` cast for minAmount, maxAmount, estimatedUnitPrice, and quantity before arithmetic operations
- **Files modified:** approval-rules.service.ts, purchase-requests.service.ts
- **Committed in:** f89f75a, 9d8123e (part of task commits)

**2. [Rule 3 - Blocking] Wrong logger import path**

- **Found during:** Task 1 (notifications.service.ts creation)
- **Issue:** Used `../../shared/logger` but logger lives at `../../shared/utils/logger`
- **Fix:** Corrected import path to `../../shared/utils/logger`
- **Files modified:** notifications.service.ts
- **Committed in:** f89f75a (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep.

## Issues Encountered

- ESLint rejected unused `ADMIN_PAYLOAD` constant in approval-rules.routes.spec.ts — removed before final commit

## Next Phase Readiness

- Approval rules API and RC workflow complete; ready for Plan 04 (purchase-request frontend)
- processSlaReminders function available for cron scheduler integration (Plan 06)
- Push notification dispatch placeholder ready for mobile implementation

## Self-Check: PASSED

- approval-rules.service.ts: FOUND
- approval-rules.routes.ts: FOUND
- notifications.service.ts: FOUND
- notifications.routes.ts: FOUND
- approval-rules.routes.spec.ts: FOUND
- Commit f89f75a: FOUND
- Commit 9d8123e: FOUND

---

_Phase: 08-requisi-o-e-aprova-o_
_Completed: 2026-03-17_
