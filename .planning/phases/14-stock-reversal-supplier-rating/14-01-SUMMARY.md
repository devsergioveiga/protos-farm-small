---
phase: 14-stock-reversal-supplier-rating
plan: 01
subsystem: api
tags: [goods-returns, suppliers, stock-output, stock-balance, payable, ratings]

# Dependency graph
requires:
  - phase: 13-kanban-dnd-notification-wiring
    provides: goods-returns module with APROVADA/CONCLUIDA state machine and notification wiring
provides:
  - CONCLUIDA transition in goods-returns creates StockOutput RETURN + decrements StockBalance + handles CREDITO/ESTORNO financial effects
  - APROVADA transition is a pure status-only change with no side-effects
  - GET /org/suppliers/:id/performance endpoint returning history, breakdown, and totalRatings with optional date range filter
affects:
  - frontend supplier performance views
  - goods-returns frontend that relies on when stockOutputId is set

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'State machine side-effects tied to confirmation step (CONCLUIDA), not approval step (APROVADA)'
    - "Performance route registered before /:id CRUD routes to prevent Express matching 'performance' as an ID param"

key-files:
  created: []
  modified:
    - apps/backend/src/modules/goods-returns/goods-returns.service.ts
    - apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts
    - apps/backend/src/modules/suppliers/suppliers.types.ts
    - apps/backend/src/modules/suppliers/suppliers.service.ts
    - apps/backend/src/modules/suppliers/suppliers.routes.ts
    - apps/backend/src/modules/suppliers/suppliers.routes.spec.ts

key-decisions:
  - 'Stock reversal tied to CONCLUIDA (physical confirmation), not APROVADA (management approval) — prevents phantom stock decrements before goods are returned'
  - 'PerformanceReport returns empty breakdown {0,0,0,0} instead of null when supplier has no ratings — cleaner for frontend consumption'

patterns-established:
  - 'Side-effects in state machines belong to the confirmation terminal state, not the approval intermediate state'

requirements-completed:
  - DEVO-01
  - FORN-03

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 14 Plan 01: Stock Reversal + Supplier Performance Summary

**Moved goods-return stock reversal from APROVADA to CONCLUIDA transition, fixing phantom stock decrement, and added GET /org/suppliers/:id/performance endpoint with history+breakdown+date-filter**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T10:08:54Z
- **Completed:** 2026-03-19T10:11:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- APROVADA transition is now a pure status-only change — no StockOutput created, no StockBalance decremented, no Payable touched
- CONCLUIDA transition now creates StockOutput RETURN + decrements StockBalance + handles CREDITO/ESTORNO financial effects, then fires RETURN_RESOLVED notification
- Added `getPerformanceReport` function to suppliers.service.ts with optional startDate/endDate filter
- Registered GET /:id/performance route before /:id CRUD routes (Express routing order critical)
- 18 goods-returns tests pass, 38 suppliers tests pass (79 total across both suites)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move stock reversal side-effects from APROVADA to CONCLUIDA** - `802aef11` (fix)
2. **Task 2: Add supplier performance report endpoint** - `8d091ebc` (feat)

## Files Created/Modified

- `apps/backend/src/modules/goods-returns/goods-returns.service.ts` - APROVADA block removed; CONCLUIDA block gains StockOutput+StockBalance+financial side-effects before RETURN_RESOLVED notification
- `apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts` - APROVADA test updated to assert stockOutputId is null; CONCLUIDA test asserts stockOutputId+resolutionStatus; CREDITO/ESTORNO/TROCA blocks renamed from APROVADA to CONCLUIDA
- `apps/backend/src/modules/suppliers/suppliers.types.ts` - Added PerformanceHistoryPoint, PerformanceCriteriaBreakdown, PerformanceReportOutput interfaces
- `apps/backend/src/modules/suppliers/suppliers.service.ts` - Added getPerformanceReport function with date range filtering and per-criteria breakdown calculation
- `apps/backend/src/modules/suppliers/suppliers.routes.ts` - Added GET /:id/performance route before CRUD routes, imported getPerformanceReport
- `apps/backend/src/modules/suppliers/suppliers.routes.spec.ts` - Added getPerformanceReport to jest.mock factory; added 4 new test cases

## Decisions Made

- Stock reversal tied to CONCLUIDA (physical return confirmation), not APROVADA (management approval) — prevents decrementing stock before goods are physically returned
- PerformanceReport breakdown returns zeros when no ratings exist rather than null values — avoids null-check burden on frontend consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend for DEVO-01 (stock reversal at CONCLUIDA) and FORN-03 (performance endpoint) are complete
- Frontend can now build supplier performance chart using GET /org/suppliers/:id/performance
- Frontend should update goods-returns UI to reflect that stockOutputId is set at CONCLUIDA, not APROVADA

---

_Phase: 14-stock-reversal-supplier-rating_
_Completed: 2026-03-19_
