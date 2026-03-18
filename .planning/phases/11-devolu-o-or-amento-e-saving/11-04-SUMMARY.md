---
phase: 11-devolu-o-or-amento-e-saving
plan: 04
subsystem: api
tags: [analytics, saving, procurement, purchase-orders, quotations, prisma]

# Dependency graph
requires:
  - phase: 11-devolu-o-or-amento-e-saving/11-01
    provides: saving-analysis.types.ts (SavingQueryParams, SavingSummary, PriceHistoryResult, CycleIndicators, TopProductBySpend, TopSupplierByVolume, AnalyticsDashboard)
  - phase: 09-cota-o-e-pedido-de-compra
    provides: Quotation/QuotationSupplier/QuotationProposal/QuotationProposalItem/QuotationItemSelection models
  - phase: 09-cota-o-e-pedido-de-compra
    provides: PurchaseOrder/PurchaseOrderItem models with isEmergency and quotationId fields
provides:
  - Read-only analytics module: saving per quotation, price history, cycle indicators
  - GET /org/saving-analysis/dashboard — combined analytics in single call
  - GET /org/saving-analysis/saving — saving from competitive bidding (FECHADA quotations with 2+ proposals)
  - GET /org/saving-analysis/price-history/:productId — price evolution from PurchaseOrderItems
  - GET /org/saving-analysis/indicators — % formal, % emergency, avg cycle days RC->GR
  - GET /org/saving-analysis/top-products — top 10 products by totalSpent
  - GET /org/saving-analysis/top-suppliers — top 5 suppliers by volume
affects: [frontend-analytics, phase-12-if-any]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Saving calculation: maxPrice (highest proposal) - winnerPrice (QuotationItemSelection winner) per item
    - avgSavingPercent = totalSaving / totalMaxValue * 100 (not simple avg of per-quotation percents)
    - Emergency POs (no quotationId) excluded from saving but included in cycle indicators as % emergency
    - Price history queries via purchaseRequestItem.productId join (PurchaseOrderItem has no direct productId)
    - Mock-based integration tests for analytics endpoints (no DB seeding needed)

key-files:
  created:
    - apps/backend/src/modules/saving-analysis/saving-analysis.service.ts
    - apps/backend/src/modules/saving-analysis/saving-analysis.routes.ts
    - apps/backend/src/modules/saving-analysis/saving-analysis.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'Saving excludes quotations with < 2 proposals (no competitive bidding, no saving calculable)'
  - 'Winner determination uses QuotationItemSelection per item — not per-supplier selection'
  - 'getPriceHistory queries via purchaseRequestItem.productId since PurchaseOrderItem has no direct productId field'
  - 'getCycleIndicators avg cycle days = RC.createdAt -> GoodsReceipt.createdAt (CONFIRMADO) for complete chains only'
  - 'getAnalyticsDashboard uses Promise.all for all 4 analytics queries in parallel'
  - 'savingAnalysisRouter registered after purchaseBudgetsRouter in app.ts'

patterns-established:
  - 'Analytics route: GET-only, date params required, purchases:read permission'
  - 'Saving calc: winnerMap from QuotationItemSelection, fallback to min price if no selection recorded'

requirements-completed: [FINC-03]

# Metrics
duration: 9min
completed: 2026-03-18
---

# Phase 11 Plan 04: Saving Analysis Backend Summary

**Read-only procurement analytics module: saving from competitive bidding, price history per product, cycle indicators (% formal/emergency, avg days RC->GR), top 10 products and top 5 suppliers, combined dashboard endpoint**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T08:49:46Z
- **Completed:** 2026-03-18T08:58:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 6 analytics functions in saving-analysis.service.ts (all read-only, no writes)
- 6 GET endpoints under /org/saving-analysis with purchases:read permission
- /dashboard endpoint resolves all 4 analytics in parallel via Promise.all
- 23 integration tests passing covering all endpoints, date filtering, auth, and shape validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Saving Analysis service and routes** - `6ec6136` (feat)
2. **Task 2: Saving Analysis integration tests** - `d2fca23` (test)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `apps/backend/src/modules/saving-analysis/saving-analysis.service.ts` — 6 analytics functions: getSavingByQuotation, getPriceHistory, getCycleIndicators, getTopProducts, getTopSuppliers, getAnalyticsDashboard
- `apps/backend/src/modules/saving-analysis/saving-analysis.routes.ts` — Express router with 6 GET endpoints under /org/saving-analysis
- `apps/backend/src/modules/saving-analysis/saving-analysis.routes.spec.ts` — 23 integration tests (mock-based)
- `apps/backend/src/app.ts` — savingAnalysisRouter import and registration

## Decisions Made

- Saving calculation uses QuotationItemSelection to determine the winning price per item — if no selection recorded, falls back to minimum price across proposals
- Price history endpoint queries via `purchaseRequestItem.productId` join because `PurchaseOrderItem` has no direct `productId` field in the schema
- Cycle indicators avg cycle days only count POs with complete RC -> OC -> GR chain (confirmed receipts only)
- Dashboard endpoint calls each service function independently and combines via Promise.all — no new aggregation query

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript errors in `purchase-budgets.routes.ts` (different plan) were observed but out of scope per deviation rules.

## Issues Encountered

- TypeScript error: `buildRlsContext` returning `organizationId: string | null` — fixed inline by adding null guard (Rule 1, auto-fix)
- TypeScript error: `req.params.productId` typed as `string | string[]` — fixed by casting via `req.params['productId'] as string`

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Saving analysis backend complete; frontend analytics pages can now consume these endpoints
- All 6 analytics endpoints ready for plan 11-05 (frontend) if one is planned
- FINC-03 requirement fully satisfied

---

_Phase: 11-devolu-o-or-amento-e-saving_
_Completed: 2026-03-18_
