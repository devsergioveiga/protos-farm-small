---
phase: 20-alienacao-baixa-ativos
plan: "00"
subsystem: database
tags: [prisma, postgresql, asset-management, depreciation]

# Dependency graph
requires:
  - phase: 19-integrao-financeira-aquisio
    provides: Asset model, ReceivableCategory enum, depreciation batch service
provides:
  - AssetDisposal model (4 fields + relations + unique assetId constraint)
  - AssetFarmTransfer model (bi-directional farm relation with named relations)
  - AssetInventory + AssetInventoryItem models (cascade delete on items)
  - AssetDisposalType enum (VENDA, DESCARTE, SINISTRO, OBSOLESCENCIA)
  - AssetInventoryStatus enum (DRAFT, COUNTING, RECONCILED, CANCELLED)
  - ASSET_SALE value in ReceivableCategory enum
  - disposalDate field on Asset model
  - Type contracts for 3 new modules (error classes, input/output interfaces)
  - Depreciation batch excludes ALIENADO assets via notIn filter
affects:
  - 20-01 (asset-disposals service — depends on AssetDisposal model and types)
  - 20-02 (asset-farm-transfers service — depends on AssetFarmTransfer model and types)
  - 20-03 (asset-inventory service — depends on AssetInventory/Item models and types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module type files follow error-class + input + output pattern (same as asset-acquisitions.types.ts)
    - Named relations for bidirectional Farm references: AssetTransferFrom / AssetTransferTo

key-files:
  created:
    - apps/backend/prisma/migrations/20260427100000_add_asset_disposal_models/migration.sql
    - apps/backend/src/modules/asset-disposals/asset-disposals.types.ts
    - apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.types.ts
    - apps/backend/src/modules/asset-inventory/asset-inventory.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/depreciation/depreciation-batch.service.ts

key-decisions:
  - "ASSET_SALE added to ReceivableCategory enum to enable receivables on asset sales (VENDA disposals)"
  - "AssetDisposal.assetId has @unique constraint — one disposal record per asset, enforces finality"
  - "AssetInventoryItem uses onDelete: Cascade from inventory — items deleted when inventory cancelled"
  - "Depreciation batch uses notIn: ['EM_ANDAMENTO', 'ALIENADO'] to atomically exclude disposed assets"

patterns-established:
  - "Named Prisma relations: use @relation('AssetTransferFrom'/'AssetTransferTo') for same-table bidirectional"
  - "Type files: always export error class + label maps + input/output interfaces from single module file"

requirements-completed: [DISP-01, DISP-02, DISP-03, DISP-04, DISP-05]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 20 Plan 00: Asset Disposal Schema Summary

**Prisma schema foundation for asset alienation — 4 models (AssetDisposal, AssetFarmTransfer, AssetInventory, AssetInventoryItem), 2 enums, ASSET_SALE receivable category, and depreciation batch exclusion for ALIENADO assets**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-22T14:34:00Z
- **Completed:** 2026-03-22T14:44:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended Prisma schema with all 4 new models and 2 new enums required for Phase 20
- Created type contract files for 3 new modules following existing module conventions
- Fixed depreciation batch to atomically exclude ALIENADO (disposed) assets from processing

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + migration for disposal models and enum extensions** - `e6a90761` (feat)
2. **Task 2: Type files for 3 new modules + depreciation batch exclusion fix** - `ef6310ec` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `apps/backend/prisma/schema.prisma` - Added 4 models, 2 enums, ASSET_SALE enum value, disposalDate field, relation arrays
- `apps/backend/prisma/migrations/20260427100000_add_asset_disposal_models/migration.sql` - Migration with all DDL
- `apps/backend/src/modules/asset-disposals/asset-disposals.types.ts` - Error class, DisposalType, CreateDisposalInput, DisposalOutput, DISPOSAL_TYPE_LABELS
- `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.types.ts` - Error class, CreateTransferInput, TransferOutput, ListTransfersQuery
- `apps/backend/src/modules/asset-inventory/asset-inventory.types.ts` - Error class, PHYSICAL_STATUSES, CreateInventoryInput, InventoryOutput, etc.
- `apps/backend/src/modules/depreciation/depreciation-batch.service.ts` - Changed `not: 'EM_ANDAMENTO'` to `notIn: ['EM_ANDAMENTO', 'ALIENADO']`

## Decisions Made
- Used `@unique` on `AssetDisposal.assetId` to enforce one-disposal-per-asset at DB level
- Named Prisma relations `AssetTransferFrom` / `AssetTransferTo` on Farm model for bidirectional farm transfer FK
- `AssetInventoryItem` uses `onDelete: Cascade` so items are cleaned up when inventory is deleted/cancelled
- `ASSET_SALE` placed before `OTHER` in `ReceivableCategory` enum to maintain logical grouping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration must be applied to DB when deploying.

## Next Phase Readiness
- Schema foundation complete for all 3 Phase 20 service modules
- Type contracts exported and ready for service and route implementations
- Depreciation batch safe to run on organizations with disposed assets

## Self-Check: PASSED

---
*Phase: 20-alienacao-baixa-ativos*
*Completed: 2026-03-22*
