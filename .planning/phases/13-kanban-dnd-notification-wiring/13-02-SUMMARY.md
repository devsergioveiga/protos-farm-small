---
phase: 13-kanban-dnd-notification-wiring
plan: 02
subsystem: api
tags: [notifications, purchase-requests, purchase-orders, goods-receipts, goods-returns, budget]

# Dependency graph
requires:
  - phase: 12-kanban-dashboard-e-notifica-es
    provides: notifications infrastructure (createNotification, dispatchPushNotification, NOTIFICATION_TYPES)
  - phase: 08-requisi-o-e-aprova-o
    provides: purchase-requests, purchase-orders, goods-receipts, goods-returns modules
provides:
  - BUDGET_EXCEEDED notification fires at RC approval (approver + FINANCIAL) and OC emission (issuer + FINANCIAL)
  - PO_GOODS_RECEIVED notification fires at GR confirmation (RC creator + OC buyer, deduped via Set)
  - RETURN_REGISTERED notification fires at goods return creation (OC buyer)
  - RETURN_RESOLVED notification fires at CONCLUIDA transition (FINANCIAL users), GOODS_RETURN_APPROVED bug removed
affects: purchasing-flow-notifications, DASH-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fire-and-forget notification dispatch: void createNotification(tx, orgId, input).catch(() => {})
    - Set<string> deduplication for multi-recipient notifications where buyer = RC creator possible

key-files:
  created: []
  modified:
    - apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
    - apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
    - apps/backend/src/modules/goods-receipts/goods-receipts.service.ts
    - apps/backend/src/modules/goods-returns/goods-returns.service.ts

key-decisions:
  - 'transitionPO signature updated from RlsContext to RlsContext & { userId: string } — required for issuer notification dispatch (routes already pass userId, function declaration was under-typed)'
  - 'RETURN_RESOLVED placed in CONCLUIDA branch (not APROVADA) — APROVADA triggers financial side effects; CONCLUIDA is the settled state that warrants FINANCIAL user alert'
  - 'RETURN_RESOLVED targets FINANCIAL users (not MANAGER) — financial processing responsibility belongs to FINANCIAL role'
  - 'PO_GOODS_RECEIVED uses Set<string> deduplication — OC buyer and RC creator may be same person in small orgs'

patterns-established:
  - 'Multi-recipient budget notification: notify acting user + FINANCIAL role users (take: 5 limit)'
  - 'Goods receipt notification: deduplicate recipients via Set<string> before iterating'

requirements-completed: [DASH-03]

# Metrics
duration: 18min
completed: 2026-03-19
---

# Phase 13 Plan 02: Notification Wiring (BUDGET_EXCEEDED, PO_GOODS_RECEIVED, RETURN_REGISTERED, RETURN_RESOLVED) Summary

**Wired 4 missing notification types across purchase-requests, purchase-orders, goods-receipts, and goods-returns services, fixing the GOODS_RETURN_APPROVED invalid type bug and completing the purchasing flow notification pipeline (DASH-03)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-19T06:20:00Z
- **Completed:** 2026-03-19T06:38:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- BUDGET_EXCEEDED fires at RC approval (notifies approver + FINANCIAL users) and OC EMITIDA (notifies issuer + FINANCIAL users) when budget is exceeded
- PO_GOODS_RECEIVED fires when a goods receipt is confirmed, notifying both the OC buyer and RC creator (deduplicated with Set to avoid double-notify when they are the same person)
- RETURN_REGISTERED fires when a goods return is created, notifying the OC buyer who must contact the supplier
- RETURN_RESOLVED fires at CONCLUIDA transition (not APROVADA), notifying FINANCIAL users — the invalid GOODS_RETURN_APPROVED type (with `as any` cast) is removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire BUDGET_EXCEEDED in purchase-requests and purchase-orders** - `dc75dffb` (feat)
2. **Task 2: Wire PO_GOODS_RECEIVED, RETURN_REGISTERED, and fix RETURN_RESOLVED** - `e4a9d33e` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` - Added BUDGET_EXCEEDED dispatch after RC approval inside `if (budgetCheck.exceeded)` block
- `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` - Added BUDGET_EXCEEDED dispatch inside EMITIDA branch; updated `transitionPO` signature to `RlsContext & { userId: string }`
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` - Added `createNotification` import; added PO_GOODS_RECEIVED dispatch using Set deduplication before `return formatGoodsReceipt`
- `apps/backend/src/modules/goods-returns/goods-returns.service.ts` - Added RETURN_REGISTERED in `createGoodsReturn`; replaced GOODS_RETURN_APPROVED block with RETURN_RESOLVED at CONCLUIDA transition

## Decisions Made

- Updated `transitionPO` signature from `RlsContext` to `RlsContext & { userId: string }` — the route `buildRlsContext` already returns this supertype; the function declaration was under-typed. This is the cleanest fix (alternative: skip issuer notification, or use `as any` cast)
- Placed RETURN_RESOLVED in the `CONCLUIDA` branch rather than the `APROVADA` branch where GOODS_RETURN_APPROVED was incorrectly placed. The plan's must_have truth confirmed: "RETURN_RESOLVED fires when goods return transitions to CONCLUIDA (not GOODS_RETURN_APPROVED)"
- Used `role: 'FINANCIAL'` for RETURN_RESOLVED recipients — financial resolution is the business event FINANCIAL users need to act on

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed under-typed transitionPO function signature**

- **Found during:** Task 1 (Wire BUDGET_EXCEEDED in purchase-orders)
- **Issue:** `transitionPO` declared `ctx: RlsContext` but body needed `ctx.userId` for issuer notification. TypeScript error: `Property 'userId' does not exist on type 'RlsContext'`
- **Fix:** Updated signature to `ctx: RlsContext & { userId: string }`. The route already passes `RlsContext & { userId: string }` from `buildRlsContext`, so this is a declaration fix, not a behavioral change.
- **Files modified:** apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
- **Verification:** `pnpm exec tsc --noEmit` passed, all 75 targeted tests passed
- **Committed in:** dc75dffb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — under-typed function signature)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered

- None beyond the signature fix above.

## Next Phase Readiness

- All 4 notification types for the purchasing flow are now wired
- The notification pipeline for DASH-03 is complete
- Plan 13-03 (if any) can rely on all notification types being dispatched at correct business events

---

_Phase: 13-kanban-dnd-notification-wiring_
_Completed: 2026-03-19_
