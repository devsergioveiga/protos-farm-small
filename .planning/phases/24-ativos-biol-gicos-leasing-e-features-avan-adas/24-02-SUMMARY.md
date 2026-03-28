---
phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas
plan: 02
subsystem: api, ui
tags: [prisma, cpc06, leasing, rou-asset, depreciation, installments, generateInstallments]

requires:
  - phase: 19-integrao-financeira-aquisio
    provides: Payable model, PayableInstallment, generateInstallments from @protos-farm/shared
  - phase: 22-hierarquia-avancada-imobilizado-andamento
    provides: Asset model, DepreciationConfig model
provides:
  - AssetLeasing Prisma model with LeasingStatus enum
  - asset-leasings backend module (create with atomic ROU+Deprec+CP, exercise, return, cancel)
  - AssetLeasingsPage with status badges and lifecycle action buttons
  - Sidebar entry under PATRIMONIO group
affects: [depreciation-batch, patrimony-dashboard, payables]

tech-stack:
  added: []
  patterns: [atomic-rou-creation-with-depreciation-and-installments]

key-files:
  created:
    - apps/backend/src/modules/asset-leasings/asset-leasings.service.ts
    - apps/backend/src/modules/asset-leasings/asset-leasings.routes.ts
    - apps/backend/src/modules/asset-leasings/asset-leasings.routes.spec.ts
    - apps/backend/src/modules/asset-leasings/asset-leasings.types.ts
    - apps/frontend/src/pages/AssetLeasingsPage.tsx
    - apps/frontend/src/components/assets/AssetLeasingModal.tsx
    - apps/frontend/src/hooks/useAssetLeasings.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
    - apps/frontend/src/types/asset.ts
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx

key-decisions:
  - "ROU Asset created with classification DEPRECIABLE_CPC27 and name 'ROU — lessorName — contractNumber'"
  - 'DepreciationConfig STRAIGHT_LINE with usefulLifeMonths = months between startDate and endDate'
  - 'Payable created with category FINANCING and originType ASSET_LEASING'
  - 'prisma.$transaction used directly (not withRlsContext) to avoid nested RLS deadlocks'

patterns-established:
  - 'Atomic ROU creation: asset + depreciationConfig + payable + installments in single transaction'
  - 'Leasing lifecycle: ACTIVE → PURCHASE_OPTION_EXERCISED | RETURNED | CANCELLED'

requirements-completed: [AQUI-05]

duration: ~15min
completed: 2026-03-23
---

# Plan 24-02: Asset Leasings (CPC 06) Summary

**CPC 06 leasing module with atomic ROU Asset + DepreciationConfig + CP installment generation via generateInstallments, full lifecycle (exercise/return/cancel)**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files created:** 10
- **Files modified:** 4

## Accomplishments

- AssetLeasing + LeasingStatus Prisma model with migration
- createLeasing atomically creates ROU Asset + DepreciationConfig + Payable + Installments
- exercisePurchaseOption generates CP for purchase option value
- returnAsset disposes ROU and cancels pending depreciation
- 13 backend tests passing
- Frontend page with status badges, lifecycle action buttons with ConfirmModal

## Task Commits

1. **Task 1: Backend** - `7db1c157` (feat: asset-leasings backend module)
2. **Task 2: Frontend** - `5786c2b1` (feat: asset-leasings frontend)

## Decisions Made

- ROU Asset name format: "ROU — {lessorName} — {contractNumber}"
- Duration months computed as simple date diff: (endYear-startYear)\*12 + (endMonth-startMonth)
- Exercise purchase option creates CP with category ASSET_ACQUISITION
- Return disposes ROU asset (status ALIENADO) and cancels pending depreciation entries

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

None.

## Next Phase Readiness

- Leasing contracts integrate with existing depreciation batch and payables

---

_Phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas_
_Completed: 2026-03-23_
