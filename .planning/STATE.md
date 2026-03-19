---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Gestão de Patrimônio
status: executing
stopped_at: Completed 16-05-PLAN.md
last_updated: '2026-03-19T22:31:38.734Z'
last_activity: 2026-03-19 — Phase 16 Plan 03 completed (AssetsPage frontend)
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** v1.2 Gestão de Patrimônio — Phase 16: Cadastro de Ativos

## Current Position

Phase: 16 - Cadastro de Ativos (in progress)
Plan: 03 complete — next: 16-04
Status: In progress
Last activity: 2026-03-19 — Phase 16 Plan 03 completed (AssetsPage frontend)

Progress: [███████░░░] 67% (4/6 plans in phase 16)

## Performance Metrics

**Velocity (v1.0 baseline):**

| Phase                          | Plans | Total Time | Avg/Plan |
| ------------------------------ | ----- | ---------- | -------- |
| 01-funda-o-financeira          | 3     | 42min      | 14min    |
| 02-n-cleo-ap-ar                | 7     | 83min      | 12min    |
| 03-dashboard-financeiro        | 2     | 11min      | 6min     |
| 04-instrumentos-de-pagamento   | 7     | 58min      | 8min     |
| 05-concilia-o-e-fluxo-de-caixa | 6     | 64min      | 11min    |
| 06-cr-dito-rural               | 5     | 62min      | 12min    |

**Total v1.0:** 30 plans in ~320min (~5.3h), avg 10.7min/plan

| Phase 16 P00 | 1 | 1 tasks | 4 files |
| Phase 16 P01 | 30min | 2 tasks | 8 files |
| Phase 16 P02 | 15min | 2 tasks | 15 files |
| Phase 16 P03 | 31 | 3 tasks | 10 files |
| Phase 16-cadastro-de-ativos P05 | 90 | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.1:

- **GoodsReceipt is integration hub**: CP creation fires only from ReceivingConfirmed event
- **Price snapshot on PO**: PurchaseOrder snapshots unitPrice/quantity/total at issuance
- **BullMQ for async email**: Never await emailService.send() inside Prisma transaction
- **VALID_TRANSITIONS map**: State machines follow checks.types.ts pattern

Key decisions for v1.2:

- **Asset purchase must NOT route through GoodsReceipt/StockEntry**: Separate AssetAcquisition module with originType ASSET_PURCHASE
- **All depreciation arithmetic uses decimal.js**: Last-period balancing entry brings book value to exactly residual value
- **CPC 27 vs CPC 29 classification at schema creation**: BEARER_PLANT (CPC 27) vs BIOLOGICAL_ASSET_ANIMAL (CPC 29)
- **OS accounting classification mandatory at closure**: 400 if accountingTreatment absent
- **Batch depreciation idempotent**: Unique constraint on (assetId, periodYear, periodMonth)
- [Phase 16 P00]: Wave 0 stubs use it.todo() only — no beforeAll/afterAll setup until Plans 01/02 fill in test bodies
- [Phase 16 P01]: costCenterMode stored as String @default('FIXED') — existing CostCenterAllocMode enum incompatible (PERCENTAGE/FIXED_VALUE for Payable use)
- [Phase 16 P01]: BENFEITORIA geoPoint written via $executeRawUnsafe after Prisma create() — Unsupported type limitation
- [Phase 16 P02]: getFuelStats avgLitersPerHour = null when no hourmeterAtFuel readings exist — correct behavior, not a bug
- [Phase 16 P02]: exportAssetsPdf uses landscape A4 to accommodate 6-column asset table
- [Phase 16]: AssetModal stub committed first in Task 2 to keep TSC clean; full implementation overwrites it in Task 3
- [Phase 16-cadastro-de-ativos]: Reused createAsset() in confirmAssetImport to keep PAT-NNNNN tag generation atomic
- [Phase 16-cadastro-de-ativos]: Auto-mapping dictionary maps Portuguese CSV headers to system field names; TERRA type auto-classifies to NON_DEPRECIABLE_CPC27 in preview

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-19T22:31:38.731Z
Stopped at: Completed 16-05-PLAN.md
Resume file: None
Next action: /gsd:execute-phase 16 plan 04
