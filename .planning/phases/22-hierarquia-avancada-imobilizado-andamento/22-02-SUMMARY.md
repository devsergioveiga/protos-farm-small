---
phase: 22-hierarquia-avancada-imobilizado-andamento
plan: '02'
subsystem: api
tags: [prisma, express, assets, depreciation, wip, renovation, backend]

requires:
  - phase: 22-hierarquia-avancada-imobilizado-andamento
    provides: 'Plan 01 - AssetRenovation, AssetWipContribution, AssetWipStage models + wipBudget/wipBudgetAlertPct on Asset'
  - phase: 20-alienacao-baixa-ativos
    provides: 'AssetStatus enum (ATIVO, EM_ANDAMENTO, ALIENADO), prisma.$transaction direct pattern'

provides:
  - 'POST /org/:orgId/assets/:assetId/renovations — CAPITALIZAR increments acquisitionValue, updates DepreciationConfig; DESPESA no asset change'
  - 'GET /org/:orgId/assets/:assetId/renovations — list by renovationDate desc'
  - 'POST /org/:orgId/asset-wip/:assetId/contributions — addContribution with budgetAlert/budgetExceeded flags'
  - 'GET /org/:orgId/asset-wip/:assetId/summary — totalContributed, contributions, stages, budget flags'
  - 'POST /org/:orgId/asset-wip/:assetId/activate — sets status=ATIVO, acquisitionValue=totalContributed, returns depreciationConfigMissing flag'
  - 'POST/GET /org/:orgId/asset-wip/:assetId/stages — create and list WIP stages'
  - 'PATCH /org/:orgId/asset-wip/:assetId/stages/:stageId/complete — mark stage complete'

affects:
  - 22-hierarquia-avancada-imobilizado-andamento (plan 03 — frontend consumes these endpoints)
  - depreciation module (EM_ANDAMENTO assets excluded from batch, activated assets get depreciationConfigMissing warning)

tech-stack:
  added: []
  patterns:
    - 'prisma.$transaction used directly (NOT withRlsContext) — consistent with asset-acquisitions/disposals pattern'
    - 'accountingDecision mandatory field on renovation (CAPITALIZAR|DESPESA) — same OS accounting treatment pattern as work orders'
    - 'Budget alert via wipBudgetAlertPct percentage threshold (default 90%)'
    - 'WipError and RenovationError classes following AssetError pattern'
    - 'depreciationConfigMissing flag on activate response — non-blocking warning for UI to prompt user'

key-files:
  created:
    - apps/backend/src/modules/asset-renovations/asset-renovations.types.ts
    - apps/backend/src/modules/asset-renovations/asset-renovations.service.ts
    - apps/backend/src/modules/asset-renovations/asset-renovations.routes.ts
    - apps/backend/src/modules/asset-renovations/asset-renovations.routes.spec.ts
    - apps/backend/src/modules/asset-wip/asset-wip.types.ts
    - apps/backend/src/modules/asset-wip/asset-wip.service.ts
    - apps/backend/src/modules/asset-wip/asset-wip.routes.ts
    - apps/backend/src/modules/asset-wip/asset-wip.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'RenovationError and WipError classes follow AssetError pattern with statusCode field'
  - 'CAPITALIZAR path uses Prisma increment operator for acquisitionValue — atomic with renovation record creation'
  - 'Budget alert threshold defaults to 90% when wipBudgetAlertPct is null — sensible default'
  - 'activateWipAsset returns depreciationConfigMissing=true as non-blocking flag (not 400) — frontend prompts user to configure depreciation'
  - 'addContribution guard: checks asset.status=EM_ANDAMENTO, throws 400 if not — consistent with renovation EM_ANDAMENTO guard'

patterns-established:
  - 'Asset module sub-routes: nested under /org/:orgId/assets/:assetId/<resource> for asset-scoped operations'
  - 'WIP operations: separate /org/:orgId/asset-wip/:assetId base path to distinguish WIP-specific endpoints'
  - 'Budget flags returned inline in contribution response (not separate endpoint)'

requirements-completed: [HIER-02, HIER-03]

duration: 15min
completed: '2026-03-22'
---

# Phase 22 Plan 02: HIER-02 + HIER-03 Backend Modules Summary

**Asset renovation module with CAPITALIZAR/DESPESA accounting decisions and WIP contribution tracking with budget alerts, activation, and depreciationConfigMissing warning flag**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T21:50:00Z
- **Completed:** 2026-03-22T21:52:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- HIER-02: asset-renovations module — POST creates reformation with CAPITALIZAR (increments acquisitionValue + updates DepreciationConfig.usefulLifeMonths) or DESPESA (no asset change); status guards reject EM_ANDAMENTO and ALIENADO
- HIER-03: asset-wip module — POST contributions with budget alert/exceeded flags (configurable wipBudgetAlertPct, default 90%); GET summary with aggregated totals, stages, contributions; POST activate transitions EM_ANDAMENTO to ATIVO with totalContributed as acquisitionValue and depreciationConfigMissing flag
- Both routers registered in app.ts; 16 tests pass across both modules

## Task Commits

1. **Task 1: HIER-02 asset-renovations module** - `804a1f25` (feat)
2. **Task 2: HIER-03 asset-wip module + app.ts registration** - `e8f6ec7e` (feat)

## Files Created/Modified

- `apps/backend/src/modules/asset-renovations/asset-renovations.types.ts` — RenovationError + CreateRenovationInput
- `apps/backend/src/modules/asset-renovations/asset-renovations.service.ts` — createRenovation (CAPITALIZAR/DESPESA paths), listRenovations
- `apps/backend/src/modules/asset-renovations/asset-renovations.routes.ts` — POST + GET /assets/:assetId/renovations
- `apps/backend/src/modules/asset-renovations/asset-renovations.routes.spec.ts` — 6 tests
- `apps/backend/src/modules/asset-wip/asset-wip.types.ts` — WipError, AddContributionInput, ActivateWipInput, CreateStageInput
- `apps/backend/src/modules/asset-wip/asset-wip.service.ts` — addContribution, getWipSummary, activateWipAsset, createStage, completeStage, listStages
- `apps/backend/src/modules/asset-wip/asset-wip.routes.ts` — 6 endpoints for contributions/summary/activate/stages
- `apps/backend/src/modules/asset-wip/asset-wip.routes.spec.ts` — 10 tests
- `apps/backend/src/app.ts` — assetRenovationsRouter and assetWipRouter registered

## Decisions Made

- `depreciationConfigMissing` returned as boolean flag (not 400 error) — activation succeeds, frontend warns user to configure depreciation
- Budget alert threshold defaults to 90% when `wipBudgetAlertPct` is null — avoids null-check errors in calculation
- `increment` operator used for acquisitionValue on CAPITALIZAR — atomic with Prisma transaction, avoids race conditions

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- HIER-02 and HIER-03 backend complete; plan 03 (frontend) can now implement renovation modal and WIP contribution/activation UI
- Both routers registered in app.ts and tested

---

_Phase: 22-hierarquia-avancada-imobilizado-andamento_
_Completed: 2026-03-22_
