---
phase: 20-alienacao-baixa-ativos
plan: '01'
subsystem: api
tags: [prisma, transactions, receivables, depreciation, asset-disposal, express]

# Dependency graph
requires:
  - phase: 20-alienacao-baixa-ativos/20-00
    provides: AssetDisposal schema, AssetDisposalType enum, asset-disposals.types.ts
  - phase: 19-integrao-financeira-aquisio
    provides: asset-acquisitions pattern (prisma.$transaction, generateInstallments, tx.payable.create)
provides:
  - createDisposal: atomic service function with status ALIENADO + depreciation cancel + CR generation
  - getDisposal: retrieve disposal record with asset info
  - POST /org/:orgId/asset-disposals/:assetId/dispose endpoint
  - GET /org/:orgId/asset-disposals/:assetId/disposal endpoint
  - 14 integration tests covering all disposal scenarios
affects:
  - 20-02 (asset farm transfers)
  - 20-03 (patrimony dashboard)
  - frontend phase that adds disposal UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      prisma.$transaction for atomic disposal (no withRlsContext),
      tx.receivable.create direct in transaction,
      generateInstallments from @protos-farm/shared for installment CR,
    ]

key-files:
  created:
    - apps/backend/src/modules/asset-disposals/asset-disposals.service.ts
    - apps/backend/src/modules/asset-disposals/asset-disposals.routes.ts
    - apps/backend/src/modules/asset-disposals/asset-disposals.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'prisma.$transaction used directly (NOT withRlsContext) in createDisposal to avoid nested RLS deadlocks — same pattern as asset-acquisitions'
  - 'gainLoss computed from latest DepreciationEntry.closingBookValue with reversedAt null; falls back to asset.acquisitionValue when no entries exist'
  - 'Receivable created with category ASSET_SALE + originType ASSET_DISPOSAL only for VENDA type when saleValue > 0'
  - 'Depreciation entries bulk-cancelled via depreciationEntry.updateMany (sets reversedAt = now) before creating AssetDisposal record'
  - 'installmentCount stored on DisposalOutput reflects actual installments created in Receivable'

patterns-established:
  - 'Asset disposal pattern: guard (find + status check) -> compute netBookValue -> cancel depreciation -> update asset status -> create disposal -> create CR'
  - 'TDD with RED commit (failing spec) before GREEN commit (implementation)'

requirements-completed:
  - DISP-01
  - DISP-02
  - DISP-03

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 20 Plan 01: Asset Disposals Backend Summary

**Atomic disposal transaction cancels depreciation entries, sets ALIENADO status, and generates CR with gain/loss calculation — 14 integration tests green**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T14:46:20Z
- **Completed:** 2026-03-22T14:50:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- `createDisposal` service: atomic `prisma.$transaction` cancels all pending `DepreciationEntry` rows, updates `asset.status = 'ALIENADO'`, creates `AssetDisposal`, generates `Receivable` + `ReceivableInstallment` records for VENDA type
- `getDisposal` service: retrieves disposal record with asset info via `assetId + organizationId`
- Routes: `POST /:assetId/dispose` (assets:update) and `GET /:assetId/disposal` (assets:read) with proper error handling (404/409/400)
- All 14 integration tests pass covering VENDA, DESCARTE, SINISTRO, OBSOLESCENCIA, installment sale, depreciation cancellation, and guard cases

## Task Commits

Each task was committed atomically:

1. **TDD RED: failing spec** - `c8d84bf7` (test)
2. **TDD GREEN: service + routes + app wiring** - `f62df2da` (feat)

## Files Created/Modified

- `apps/backend/src/modules/asset-disposals/asset-disposals.service.ts` - createDisposal + getDisposal with atomic prisma.$transaction
- `apps/backend/src/modules/asset-disposals/asset-disposals.routes.ts` - POST dispose + GET disposal routes with auth + permission checks
- `apps/backend/src/modules/asset-disposals/asset-disposals.routes.spec.ts` - 14 integration tests covering all scenarios
- `apps/backend/src/app.ts` - wired assetDisposalsRouter after assetAcquisitionsRouter

## Decisions Made

- Used `prisma.$transaction` directly (NOT `withRlsContext`) in `createDisposal` — avoids nested RLS transaction deadlocks, consistent with asset-acquisitions pattern
- `gainLoss` computed from latest `DepreciationEntry.closingBookValue` where `reversedAt IS NULL`; falls back to `asset.acquisitionValue` when no depreciation entries exist
- For VENDA: `Receivable` created with `category: 'ASSET_SALE'` and `originType: 'ASSET_DISPOSAL'` — enables receivables module to categorize asset sale CR
- For non-VENDA types (DESCARTE, SINISTRO, OBSOLESCENCIA): no Receivable created, `gainLoss = -netBookValue` (full loss)
- `installmentCount` defaults to 1 for single-payment sales; `firstDueDate ?? dueDate` used for installment generation

## Deviations from Plan

**1. [Rule 3 - Blocking] Pre-existing missing asset-inventory.service.ts**

- **Found during:** Task 1 execution — test suite could not load app.ts because asset-inventory.routes.ts imports from ./asset-inventory.service which didn't exist
- **Issue:** `asset-inventory.service.ts` referenced in `asset-inventory.routes.ts` but file was missing from the module directory
- **Fix:** File was already present (parallel work) — no action needed; tests ran successfully after discovery
- **Files modified:** None
- **Verification:** Tests passed after confirming the file exists
- **Committed in:** n/a (was already resolved)

---

**Total deviations:** 1 (pre-existing blocking module resolved without action)
**Impact on plan:** No scope creep. Service was already created by parallel work on this branch.

## Issues Encountered

None beyond the pre-existing missing module (self-resolved).

## Next Phase Readiness

- Asset disposal backend complete: sale, write-off, installment sale all functional
- Ready for: disposal UI (modal with VENDA/DESCARTE/SINISTRO/OBSOLESCENCIA form)
- Ready for: patrimony dashboard to include ALIENADO assets in totals

---

_Phase: 20-alienacao-baixa-ativos_
_Completed: 2026-03-22_
