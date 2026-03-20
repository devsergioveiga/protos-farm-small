---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Gestão de Patrimônio
status: executing
stopped_at: Completed 17-00-PLAN.md (Wave 0 TDD stubs)
last_updated: '2026-03-20T08:46:34.300Z'
last_activity: 2026-03-19 — Plan 16-04 complete (AssetDrawer + fuel + meter readings)
progress:
  total_phases: 18
  completed_phases: 10
  total_plans: 47
  completed_plans: 44
  percent: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** v1.2 Gestão de Patrimônio — Phase 16: Cadastro de Ativos

## Current Position

Phase: 16 — Cadastro de Ativos (in progress)
Plan: 4/5 complete
Status: Executing Phase 16 — Plan 04 complete
Last activity: 2026-03-19 — Plan 16-04 complete (AssetDrawer + fuel + meter readings)

Progress: [░░░░░░░░░░] 4% (0/9 phases, Phase 16 in progress)

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
| Phase 17-engine-de-deprecia-o P00 | 86s | 1 tasks | 3 files |

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.1:

- **GoodsReceipt is integration hub**: CP creation fires only from ReceivingConfirmed event
- **Price snapshot on PO**: PurchaseOrder snapshots unitPrice/quantity/total at issuance
- **BullMQ for async email**: Never await emailService.send() inside Prisma transaction
- **VALID_TRANSITIONS map**: State machines follow checks.types.ts pattern

Key decisions for v1.2 (Phase 16-04):

- **AssetDrawer activeTab as controlled prop**: AssetsPage owns drawerTab state and passes activeTab/onTabChange to AssetDrawer, enabling future parent-driven navigation (e.g. jump to Documentos from notification).
- **Expiry badge uses Set lookup**: fetchExpiring on page load builds Set of assetIds, O(1) lookup per row — avoids iterating arrays per row.
- **useMeterReadings re-throws on 400**: setSubmitError for inline display AND re-throw so form knows to stop isSubmitting. Prevents silent swallow of anti-regression error.

Key decisions for v1.2:

- **AssetAcquisition never routes through GoodsReceipt**: Asset NF must never create StockEntry. Separate AssetAcquisition module with originType = ASSET_ACQUISITION on CP. Guard in GoodsReceipt service to reject asset-category lines.
- **Decimal-only depreciation**: All depreciation arithmetic uses Decimal from decimal.js. Unique constraint on (assetId, periodYear, periodMonth) in depreciation_entries. DepreciationRun tracking table for safe retry.
- **CPC 27 vs CPC 29 at schema creation**: AssetClassification enum must encode BEARER_PLANT (CPC 27, depreciable), BIOLOGICAL_ASSET_ANIMAL (CPC 29, fair value), LAND_RURAL_PROPERTY (CPC 27, non-depreciable) from the start.
- **OS accounting treatment is mandatory**: PATCH /work-orders/:id/close returns 400 if accountingTreatment absent.
- **WIP exclusion from depreciation batch**: AssetStatus.EM_ANDAMENTO excluded from batch query. Depreciation starts only after activation.
- **Asset disposal cancels pending depreciation atomically**: Disposal transaction atomically cancels all pending DepreciationEntry records for the asset.
- [Phase 17-engine-de-deprecia-o]: it.todo() stubs for Wave 0: clearly communicates behavioral contract without false failing tests; Plans 01-02 will implement against these contracts

### Pending Todos

- Test react-spreadsheet-import React 19 compatibility before committing to Phase 16 bulk import story
- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido before Phase 22 (accelerated depreciation dual-track)
- Confirm biological asset fair value input method (manual vs automatic) before Phase 24 planning
- Validate NF-e v4.0 XML tag paths against real sample before Phase 19 story writing
- Confirm whether any customer fleet has active finance leases before committing to Phase 24 leasing scope

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-20T08:46:34.297Z
Stopped at: Completed 17-00-PLAN.md (Wave 0 TDD stubs)
Resume file: None
Next action: Execute plan 16-05 (bulk import frontend — AssetImportModal)
