---
phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas
plan: 03
subsystem: api, ui
tags: [prisma, decimal.js, trade-in, asset-disposal, nbv, gain-loss, payable]

requires:
  - phase: 20-alienacao-baixa-ativos
    provides: Asset disposal pattern (status ALIENADO + cancel depreciation entries)
  - phase: 19-integrao-financeira-aquisio
    provides: Payable creation pattern, getNextAssetTag helper
provides:
  - AssetTradeIn Prisma model with atomic dispose-old + create-new + CP generation
  - asset-trade-ins backend module (create, list, get)
  - AssetTradeInModal with 3-section layout and financial summary
  - "Trocar Ativo" button in AssetDrawer
affects: [patrimony-dashboard, asset-reports]

tech-stack:
  added: []
  patterns: [atomic-trade-in-transaction, nbv-based-gain-loss-calculation]

key-files:
  created:
    - apps/backend/src/modules/asset-trade-ins/asset-trade-ins.service.ts
    - apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.ts
    - apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.spec.ts
    - apps/backend/src/modules/asset-trade-ins/asset-trade-ins.types.ts
    - apps/frontend/src/components/assets/AssetTradeInModal.tsx
    - apps/frontend/src/hooks/useAssetTradeIns.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
    - apps/frontend/src/types/asset.ts
    - apps/frontend/src/components/assets/AssetDrawer.tsx

key-decisions:
  - "tradedAssetId and newAssetId both have @unique constraint — one trade-in per asset"
  - "CP generated only when netPayable > 0 (newAssetValue - tradedAssetValue)"
  - "gainLoss = tradedAssetValue - NBV(oldAsset) using decimal.js"
  - "prisma.$transaction used directly to avoid nested RLS deadlocks"

patterns-established:
  - "Atomic trade-in: dispose old (ALIENADO + cancel depreciation) + create new (sequential tag) + generate CP in single tx"

requirements-completed: [AQUI-06]

duration: ~15min
completed: 2026-03-23
---

# Plan 24-03: Asset Trade-In Summary

**Atomic asset trade-in with NBV-based gain/loss calculation, old asset disposal + new asset creation + CP generation for net payable**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 4

## Accomplishments

- AssetTradeIn Prisma model with unique constraints on tradedAssetId/newAssetId
- createTradeIn atomically: validates old asset, computes NBV, disposes old, creates new with sequential tag, generates CP if netPayable > 0
- 15 backend tests covering all scenarios (404, 409, 401, 400, gain/loss calc)
- Frontend modal with 3 sections (traded asset, new asset, financial summary)
- "Trocar Ativo" button integrated into AssetDrawer for ATIVO assets

## Task Commits

1. **Task 1: Backend** - `5fe31b29` (feat: asset trade-ins backend)
2. **Task 2: Frontend** - `4cb15172` (feat: asset trade-in frontend + AssetDrawer integration)

## Decisions Made

- @unique on tradedAssetId and newAssetId — enforces one trade-in per asset at DB level
- CP only generated when net payable is positive (new asset costs more than traded value)
- gainLoss calculation: tradedAssetValue - NBV (positive = gain, negative = loss)

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

None.

## Next Phase Readiness

- Trade-in transactions integrate with existing asset and payable modules

---

_Phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas_
_Completed: 2026-03-23_
