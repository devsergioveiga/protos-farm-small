---
phase: 20-alienacao-baixa-ativos
plan: "03"
subsystem: api
tags: [express, prisma, financial-dashboard, assets, receivables]

# Dependency graph
requires:
  - phase: 20-00
    provides: asset disposal types (AssetDisposal, DepreciationEntry) and depreciation batch fix

provides:
  - GET /org/financial-dashboard/patrimony endpoint with aggregate asset metrics
  - PatrimonyDashboardOutput type (totalActiveValue, accumulatedDepreciation, netBookValue, acquisitions, disposals, breakdowns)
  - ASSET_SALE added to ReceivableCategory union in receivables.types.ts

affects:
  - frontend patrimony dashboard widget
  - any code consuming ReceivableCategory type (now includes ASSET_SALE)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate /patrimony route registered BEFORE base /financial-dashboard to avoid route capture"
    - "Asset aggregate queries use status: { not: 'ALIENADO' } filter for active-only metrics"
    - "DepreciationEntry aggregate filters reversedAt: null to exclude reversed entries"
    - "farmId filter on DepreciationEntry passed through asset relation: { asset: { farmId } }"

key-files:
  created:
    - apps/backend/src/modules/asset-inventory/asset-inventory.service.ts
  modified:
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.spec.ts
    - apps/backend/src/modules/receivables/receivables.types.ts

key-decisions:
  - "Patrimony route registered before main dashboard route to avoid /financial-dashboard matching /financial-dashboard/patrimony as :id"
  - "assets:read permission used for patrimony endpoint (consistent with asset module RBAC)"
  - "netBookValue computed in service as totalActiveValue - accumulatedDepreciation (not in DB)"

patterns-established:
  - "Pattern 1: groupBy returns _count field directly, mapped as row._count (not row._count._all)"

requirements-completed:
  - DISP-06

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 20 Plan 03: Patrimony Dashboard Summary

**GET /org/financial-dashboard/patrimony endpoint returning total asset value, accumulated depreciation, net book value, period acquisitions/disposals, and asset breakdowns by type/status**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T14:46:31Z
- **Completed:** 2026-03-22T14:49:24Z
- **Tasks:** 1
- **Files modified:** 5 + 1 created

## Accomplishments

- Patrimony dashboard endpoint with 8 aggregate metrics (DISP-06)
- TDD implementation: 10 new tests (8 behavior + 2 auth), all passing alongside 13 existing tests
- ReceivableCategory union extended with ASSET_SALE for asset disposal receivables

## Task Commits

1. **Test (RED): patrimony tests** - `a798b96b` (test)
2. **Task 1: Patrimony dashboard endpoint + receivables types** - `9a60abfe` (feat)

## Files Created/Modified

- `apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts` - Added PatrimonyDashboardQuery and PatrimonyDashboardOutput interfaces
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` - Added getPatrimonyDashboard with aggregate queries for assets, depreciation entries, and disposals
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.ts` - Added GET /org/financial-dashboard/patrimony with assets:read permission
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.spec.ts` - 10 new tests for patrimony endpoint
- `apps/backend/src/modules/receivables/receivables.types.ts` - Added ASSET_SALE to ReceivableCategory union
- `apps/backend/src/modules/asset-inventory/asset-inventory.service.ts` - Created stub service (pre-existing missing file unblocked tests)

## Decisions Made

- Route registered before the main `/org/financial-dashboard` route to prevent path segment capture
- Used `assets:read` permission (not `financial:read`) — consistent with asset module RBAC boundary
- `netBookValue` computed in service layer as arithmetic difference (not a stored DB field)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing asset-inventory.service.ts stub**
- **Found during:** Task 1 (test run)
- **Issue:** `app.ts` imports `assetInventoryRouter` from `asset-inventory.routes.ts`, which imports `asset-inventory.service.ts` that did not exist. This caused all financial-dashboard tests to fail at module load time.
- **Fix:** Created minimal stub service with `throw new AssetInventoryError('Not implemented', 501)` for all functions — allows app to load without implementing full inventory service
- **Files modified:** `apps/backend/src/modules/asset-inventory/asset-inventory.service.ts` (created)
- **Verification:** All 23 financial-dashboard tests pass after stub creation
- **Committed in:** `9a60abfe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing stub service)
**Impact on plan:** Stub creation is a minimal unblocking fix. Full implementation is for a future asset-inventory plan. No scope creep.

## Issues Encountered

None beyond the blocking deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Patrimony dashboard API is ready for frontend integration
- ASSET_SALE category available for receivable creation from disposal flows
- asset-inventory.service.ts stub needs full implementation in the asset-inventory plan

---
*Phase: 20-alienacao-baixa-ativos*
*Completed: 2026-03-22*
