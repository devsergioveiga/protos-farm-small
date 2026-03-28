---
phase: 22-hierarquia-avancada-imobilizado-andamento
plan: '01'
subsystem: database
tags: [prisma, postgresql, assets, hierarchy, wip, renovation]

requires:
  - phase: 20-alienacao-baixa-ativos
    provides: Asset model, AssetDisposal, AssetInventory — base schema this extends
  - phase: 21-controle-operacional
    provides: Asset operational cost queries, meter readings

provides:
  - AssetRenovation model (accounting decision CAPITALIZAR/DESPESA, newUsefulLifeMonths)
  - AssetWipStage model (WIP progress stages with sortOrder/targetDate)
  - AssetWipContribution model (contributions linked to stages and suppliers)
  - wipBudget/wipBudgetAlertPct fields on Asset
  - checkHierarchyDepth: 3-level depth guard in createAsset/updateAsset
  - getDescendantIds: recursive descendant collector for circular reference detection
  - sumChildValues: parent totalization excluding ALIENADO/deleted children
  - getAsset returns totalChildValue field
  - 7 new hierarchy tests in assets.routes.spec.ts

affects:
  - 22-02 (asset-renovations module uses AssetRenovation model)
  - 22-03 (asset-wip module uses AssetWipStage/AssetWipContribution models)

tech-stack:
  added: []
  patterns:
    - checkHierarchyDepth traverses parentAssetId chain with depth counter (max 3 levels)
    - sumChildValues is a recursive accumulator that stops on ALIENADO or deletedAt
    - ASSET_INCLUDE_FULL now includes 3-level nested childAssets with acquisitionValue

key-files:
  created:
    - apps/backend/prisma/migrations/20260428100000_add_asset_hierarchy_renovation_wip/migration.sql
    - apps/backend/src/modules/asset-wip/asset-wip.routes.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/assets/assets.service.ts
    - apps/backend/src/modules/assets/assets.types.ts
    - apps/backend/src/modules/assets/assets.routes.spec.ts

key-decisions:
  - 'Hierarchy depth traverses upward from proposedParent, not downward from root — O(depth) not O(tree)'
  - 'Circular reference detection uses getDescendantIds only on PATCH (not POST) — currentAssetId guard'
  - 'sumChildValues is recursive for 3 levels matching ASSET_INCLUDE_FULL nesting depth'
  - 'Migration applied manually via psql (shadow database broken due to pre-existing migration failure on cultivars)'
  - 'asset-wip.routes.ts stub created to unblock test suite — full implementation is Plan 22-03'

requirements-completed: [HIER-01]

duration: 25min
completed: 2026-03-22
---

# Phase 22 Plan 01: Schema Migration + HIER-01 Hierarchy Depth Guard Summary

**Prisma schema extended with AssetRenovation/AssetWipStage/AssetWipContribution models and a 3-level hierarchy depth guard in assets.service with circular reference detection and parent value totalization**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-22T22:55:29Z
- **Completed:** 2026-03-22T23:20:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Migration adds 3 new tables (asset_renovations, asset_wip_stages, asset_wip_contributions) + 2 new Asset columns
- 3-level hierarchy depth enforced in createAsset and updateAsset via ancestor chain traversal
- Circular parent reference rejected on PATCH via recursive descendant lookup
- getAsset now returns `totalChildValue` summing acquisitionValue of active (non-ALIENADO, non-deleted) children
- 7 new hierarchy tests added to assets.routes.spec.ts — all pass

## Task Commits

1. **Task 1: Prisma schema + migration** - `66146049` (feat)
2. **Task 2: HIER-01 hierarchy depth guard + parent totalization** - `a7f343ea` (feat)

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` - Added AssetRenovationDecision enum, 3 new models, wipBudget fields on Asset, reverse relations on Organization
- `apps/backend/prisma/migrations/20260428100000_add_asset_hierarchy_renovation_wip/migration.sql` - Migration SQL for all new tables and columns
- `apps/backend/src/modules/assets/assets.service.ts` - checkHierarchyDepth, getDescendantIds, sumChildValues helpers; updated createAsset/updateAsset/getAsset; expanded ASSET_INCLUDE_FULL
- `apps/backend/src/modules/assets/assets.types.ts` - wipBudget/wipBudgetAlertPct added to CreateAssetInput
- `apps/backend/src/modules/assets/assets.routes.spec.ts` - 7 new hierarchy tests
- `apps/backend/src/modules/asset-wip/asset-wip.routes.ts` - Stub router (unblocks test suite)

## Decisions Made

- Hierarchy depth traverses upward from proposed parent, not downward from root — O(depth) not O(full tree)
- Circular reference check only on PATCH (not POST) — no currentAssetId on create so getDescendantIds is skipped
- sumChildValues recursive for 3 levels matching ASSET_INCLUDE_FULL nesting depth
- Migration applied via psql directly (shadow database has pre-existing migration failure on cultivars table)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub asset-wip.routes.ts to unblock test suite**

- **Found during:** Task 2 (TDD RED phase)
- **Issue:** app.ts imports `assetWipRouter` from `./modules/asset-wip/asset-wip.routes` which did not exist, causing the assets.routes.spec.ts test suite to fail with "Cannot find module"
- **Fix:** Created a minimal stub router with `export const assetWipRouter = Router()` — full WIP routes implementation is Plan 22-03
- **Files modified:** apps/backend/src/modules/asset-wip/asset-wip.routes.ts
- **Verification:** Test suite runs successfully, 38 tests pass
- **Committed in:** a7f343ea (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Necessary stub to unblock test execution. Full implementation deferred to 22-03 as intended by plan.

## Issues Encountered

- `prisma migrate dev` fails due to broken shadow database (migration 20260311080000_add_grain_harvests can't apply because cultivars table missing). Workaround: created migration SQL manually and applied via psql, then inserted migration record into \_prisma_migrations. This is a pre-existing project issue not introduced by this plan.

## Next Phase Readiness

- All 3 new Prisma models available for Plans 22-02 (renovations) and 22-03 (WIP)
- HIER-01 hierarchy rules enforced at service layer for all asset create/update operations
- Stub asset-wip.routes.ts must be replaced by Plan 22-03

---

_Phase: 22-hierarquia-avancada-imobilizado-andamento_
_Completed: 2026-03-22_

## Self-Check: PASSED

All files and commits verified:

- migration.sql: FOUND
- assets.service.ts: FOUND
- asset-wip.routes.ts: FOUND
- checkHierarchyDepth in service: FOUND
- getDescendantIds in service: FOUND
- sumChildValues in service: FOUND
- acquisitionValue in ASSET_INCLUDE_FULL: FOUND
- totalChildValue in getAsset: FOUND
- wipBudget in CreateAssetInput: FOUND
- commit 66146049: FOUND
- commit a7f343ea: FOUND
