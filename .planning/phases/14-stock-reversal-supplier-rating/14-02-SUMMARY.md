---
phase: 14-stock-reversal-supplier-rating
plan: 02
subsystem: ui
tags: [react, recharts, supplier-rating, performance-modal, quotation]

# Dependency graph
requires:
  - phase: 14-stock-reversal-supplier-rating
    provides: Supplier performance report endpoint (/org/suppliers/:id/performance), PerformanceReportOutput types, averageRating on Supplier model
provides:
  - Rating alert badges (critical/low) in QuotationModal supplier selection
  - SupplierPerformanceModal with LineChart trend and criteria breakdown bars
  - useSupplierPerformance hook for /org/suppliers/:id/performance with date range
  - Performance icon button (TrendingUp) in SuppliersPage table and mobile cards
affects: [quotations, suppliers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getRatingBadge helper function: pure function returning JSX badge or null based on averageRating thresholds
    - Period preset filter: client-side date range computation from 4 preset keys (month/quarter/year/all)
    - Inner content component pattern: SupplierPerformanceContent (always rendered) wrapped by SupplierPerformanceModal (gated on isOpen)

key-files:
  created:
    - apps/frontend/src/hooks/useSupplierPerformance.ts
    - apps/frontend/src/components/suppliers/SupplierPerformanceModal.tsx
    - apps/frontend/src/components/suppliers/SupplierPerformanceModal.css
  modified:
    - apps/frontend/src/components/quotations/QuotationModal.tsx
    - apps/frontend/src/components/quotations/QuotationModal.css
    - apps/frontend/src/pages/SuppliersPage.tsx

key-decisions:
  - 'getRatingBadge fallback: averageRating ?? supplier.rating — backward compat if API returns rating instead of averageRating'
  - 'Recharts Tooltip formatter typed as (value: number | undefined) to satisfy strict TypeScript generics'
  - 'SupplierCard onPerformance prop added alongside onRate — keeps mobile and desktop behavior symmetric'

patterns-established:
  - 'Rating threshold badges: < 2 = critical (red AlertCircle), 2-3 = low (yellow AlertTriangle), >= 3 = no badge'
  - 'Period preset filter: 4 buttons with aria-pressed, client-side date range computation, passed as query params'

requirements-completed:
  - DEVO-01
  - FORN-03

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 14 Plan 02: Supplier Rating Badges and Performance Modal Summary

**Rating alert badges in QuotationModal (critical/low) and SupplierPerformanceModal with Recharts LineChart + criteria bars wired into SuppliersPage**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T13:12:52Z
- **Completed:** 2026-03-19T13:20:52Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- QuotationModal now shows red "Avaliacao critica" badge for suppliers with averageRating < 2 and yellow "Avaliacao baixa" badge for rating 2-3; no badge for rating >= 3 or no rating
- SupplierPerformanceModal renders Recharts LineChart (domain 1-5) for rating trend history and horizontal bar meters for 4 criteria (deadline, quality, price, service)
- Period filter bar with 4 presets (Ultimo mes, Trimestre, Ano, Todos) drives date range query params via useSupplierPerformance hook
- Empty state has CTA "Avaliar fornecedor" that bridges to SupplierRatingModal via onRateClick prop
- SuppliersPage wired with TrendingUp icon button in desktop table (before Edit) and Performance text button in mobile cards

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rating badge to QuotationModal supplier rows** - `7003fba7` (feat)
2. **Task 2: Create SupplierPerformanceModal and wire into SuppliersPage** - `9b05083d` (feat)

## Files Created/Modified

- `apps/frontend/src/components/quotations/QuotationModal.tsx` - Added averageRating/ratingCount to local Supplier interface, getRatingBadge helper, badge calls in both supplier maps
- `apps/frontend/src/components/quotations/QuotationModal.css` - Added .qm-rating-badge, .qm-rating-badge--critical, .qm-rating-badge--low CSS classes
- `apps/frontend/src/hooks/useSupplierPerformance.ts` - Created hook fetching /org/suppliers/:id/performance with optional startDate/endDate params
- `apps/frontend/src/components/suppliers/SupplierPerformanceModal.tsx` - Created modal with period filter, LineChart, criteria bars, empty/loading/error states
- `apps/frontend/src/components/suppliers/SupplierPerformanceModal.css` - Full CSS with overlay, skeleton, empty state, criteria bars, reduced-motion, mobile responsive
- `apps/frontend/src/pages/SuppliersPage.tsx` - Added TrendingUp import, SupplierPerformanceModal import, supplierToPerformance state, TrendingUp button in table, onPerformance prop on SupplierCard, modal render

## Decisions Made

- getRatingBadge uses fallback `averageRating ?? supplier.rating` for backward compatibility with older API responses that may return `rating` instead of `averageRating`
- Recharts Tooltip formatter typed as `(value: number | undefined)` to satisfy TypeScript strict generics — required auto-fix during Task 2
- SupplierCard received new onPerformance prop to keep desktop table and mobile cards symmetric

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter TypeScript type error**

- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** Formatter typed as `(value: number)` but Recharts generic types allow `number | undefined`; TypeScript strict mode rejected the narrower type
- **Fix:** Changed to `(value: number | undefined)` with null guard before calling `.toFixed(1)`
- **Files modified:** apps/frontend/src/components/suppliers/SupplierPerformanceModal.tsx
- **Verification:** `npx tsc --noEmit` passed with zero errors
- **Committed in:** `9b05083d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor type correction required for TypeScript compliance. No scope creep.

## Issues Encountered

None beyond the Recharts type fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FORN-03 requirement fully closed: quotation flow shows rating alerts, suppliers page has performance report
- DEVO-01 requirement fulfilled: stock reversal (Plan 01) + performance visibility (Plan 02) complete
- Phase 14 all plans complete

---

_Phase: 14-stock-reversal-supplier-rating_
_Completed: 2026-03-19_
