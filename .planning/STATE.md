---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Gestão de Patrimônio
status: in_progress
stopped_at: Completed 16-01-PLAN.md
last_updated: '2026-03-19T22:05:00.000Z'
last_activity: 2026-03-19 — Phase 16 Plan 01 completed (Asset backend foundation)
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 6
  completed_plans: 2
  percent: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** v1.2 Gestão de Patrimônio — Phase 16: Cadastro de Ativos

## Current Position

Phase: 16 - Cadastro de Ativos (in progress)
Plan: 01 complete — next: 16-02
Status: In progress
Last activity: 2026-03-19 — Phase 16 Plan 01 completed

Progress: [█░░░░░░░░░] 3% (2/6 plans in phase 16)

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-19T22:05:00.000Z
Stopped at: Completed 16-01-PLAN.md
Resume file: None
Next action: /gsd:execute-phase 16 plan 02
