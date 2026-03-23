---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Gestão de Patrimônio
status: Executing Phase 24
stopped_at: "Completed 23-03-PLAN.md — Task 4 checkpoint: awaiting human visual verification"
last_updated: "2026-03-23T17:34:51.167Z"
progress:
  total_phases: 18
  completed_phases: 17
  total_plans: 78
  completed_plans: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 24 — ativos-biol-gicos-leasing-e-features-avan-adas

## Current Position

Phase: 24 (ativos-biol-gicos-leasing-e-features-avan-adas) — EXECUTING
Plan: 1 of 3

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
| Phase 18-manutencao-ordens-servico P05 | 120 | 2 tasks | 23 files |
| Phase 18 P06 | 18 | 1 tasks | 6 files |
| Phase 18-manutencao-ordens-servico P09 | 89s | 1 tasks | 1 files |
| Phase 18-manutencao-ordens-servico P08 | 8 | 1 tasks | 1 files |
| Phase 18-manutencao-ordens-servico P07 | 3 | 1 tasks | 1 files |
| Phase 19-integrao-financeira-aquisio P01 | 334 | 2 tasks | 11 files |
| Phase 19-integrao-financeira-aquisio P02 | 420 | 2 tasks | 9 files |
| Phase 19-integrao-financeira-aquisio P03 | 603 | 2 tasks | 5 files |
| Phase 20-alienacao-baixa-ativos P00 | 10 | 2 tasks | 6 files |
| Phase 20-alienacao-baixa-ativos P03 | 3 | 1 tasks | 6 files |
| Phase 20-alienacao-baixa-ativos P01 | 229 | 1 tasks | 4 files |
| Phase 20-alienacao-baixa-ativos P02 | 259 | 2 tasks | 7 files |
| Phase 20-alienacao-baixa-ativos P04 | 670 | 2 tasks | 20 files |
| Phase 21 P03 | 130 | 2 tasks | 3 files |
| Phase 21-controle-operacional P01 | 231 | 2 tasks | 8 files |
| Phase 21 P02 | 167 | 2 tasks | 4 files |
| Phase 22-hierarquia-avancada-imobilizado-andamento P02 | 15 | 2 tasks | 9 files |
| Phase 22-hierarquia-avancada-imobilizado-andamento P01 | 7 | 2 tasks | 6 files |
| Phase 22-hierarquia-avancada-imobilizado-andamento P03 | 531 | 2 tasks | 14 files |
| Phase 23-relatorios-dashboard-patrimonial P01 | 803 | 2 tasks | 6 files |
| Phase 23-relatorios-dashboard-patrimonial P02 | 5 | 1 tasks | 3 files |
| Phase 23-relatorios-dashboard-patrimonial P03 | 18 | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.1:

- **GoodsReceipt is integration hub**: CP creation fires only from ReceivingConfirmed event
- **Price snapshot on PO**: PurchaseOrder snapshots unitPrice/quantity/total at issuance
- **BullMQ for async email**: Never await emailService.send() inside Prisma transaction
- **VALID_TRANSITIONS map**: State machines follow checks.types.ts pattern

Key decisions for v1.2:

- **AssetAcquisition never routes through GoodsReceipt**: Asset NF must never create StockEntry. Separate AssetAcquisition module with originType = ASSET_ACQUISITION on CP. Guard in GoodsReceipt service to reject asset-category lines.
- **Decimal-only depreciation**: All depreciation arithmetic uses Decimal from decimal.js. Unique constraint on (assetId, periodYear, periodMonth) in depreciation_entries. DepreciationRun tracking table for safe retry.
- **CPC 27 vs CPC 29 at schema creation**: AssetClassification enum must encode BEARER_PLANT (CPC 27, depreciable), BIOLOGICAL_ASSET_ANIMAL (CPC 29, fair value), LAND_RURAL_PROPERTY (CPC 27, non-depreciable) from the start.
- **OS accounting treatment is mandatory**: PATCH /work-orders/:id/close returns 400 if accountingTreatment absent.
- **WIP exclusion from depreciation batch**: AssetStatus.EM_ANDAMENTO excluded from batch query. Depreciation starts only after activation.
- **Asset disposal cancels pending depreciation atomically**: Disposal transaction atomically cancels all pending DepreciationEntry records for the asset.
- [Phase 18-manutencao-ordens-servico]: Standalone MaintenanceKanban built with @dnd-kit primitives — existing KanbanBoard tightly coupled to purchasing types
- [Phase 18-manutencao-ordens-servico]: WorkOrderCloseWizard uses display:none/block for step transitions per UI-SPEC locked decision (zero animation)
- [Phase 18]: expo-image-manipulator replaced by expo-image-picker built-in base64 quality:0.7 (package not installed)
- [Phase 18]: MAINTENANCE_REQUEST notification dispatched only when assignedTo is set (Asset.responsibleUserId does not exist in schema)
- [Phase 18-manutencao-ordens-servico]: Mocked prisma.maintenanceProvision.findFirst directly for GET /:id route which bypasses service layer
- [Phase 18-manutencao-ordens-servico]: Used CONSULTANT role for 403 test in work-orders spec (OPERATOR has work-orders:create by default)
- [Phase 19-integrao-financeira-aquisio]: tx.payable.create used directly in asset-acquisitions transactions (NOT payables.service.createPayable) to avoid nested withRlsContext deadlocks
- [Phase 19-integrao-financeira-aquisio]: ASSET_ACQUISITION maps to DFC INVESTIMENTO — correct cash flow statement classification for capital expenditure
- [Phase 19-integrao-financeira-aquisio]: Payment type radio cards use label-wrapping-hidden-input pattern for accessible card UI without custom JS
- [Phase 19-integrao-financeira-aquisio]: ASSET_ACQUISITION excluded from PayableModal manual dropdown — generated-only via asset-acquisitions endpoint
- [Phase 19-integrao-financeira-aquisio]: AssetNfeImportModal uses React Fragment wrapper to render alongside main modal overlay — avoids portal complexity at correct z-index
- [Phase 20-alienacao-baixa-ativos]: AssetDisposal.assetId has @unique constraint enforcing one-disposal-per-asset at DB level
- [Phase 20-alienacao-baixa-ativos]: Depreciation batch uses notIn: ['EM_ANDAMENTO', 'ALIENADO'] to exclude disposed assets
- [Phase 20-alienacao-baixa-ativos]: Patrimony route registered before main dashboard route to avoid path segment capture
- [Phase 20-alienacao-baixa-ativos]: assets:read permission used for patrimony endpoint (consistent with asset module RBAC boundary)
- [Phase 20-alienacao-baixa-ativos]: prisma.$transaction used directly (NOT withRlsContext) in createDisposal to avoid nested RLS deadlocks
- [Phase 20-alienacao-baixa-ativos]: Receivable created with category ASSET_SALE + originType ASSET_DISPOSAL only for VENDA type
- [Phase 20-alienacao-baixa-ativos]: prisma.$transaction used directly in asset-farm-transfers and asset-inventory (consistent with asset-acquisitions pattern to avoid nested withRlsContext deadlocks)
- [Phase 20-alienacao-baixa-ativos]: Disposal modal uses ConfirmModal wrapper for destructive action guard per CLAUDE.md requirements
- [Phase 20-alienacao-baixa-ativos]: AssetInventoryPage uses inline detail (not separate route) for simpler navigation
- [Phase 21]: organizationId sourced from useAuth().user instead of FarmContext for meter-readings API calls
- [Phase 21]: meter_readings added to OperationEntity union type for offline queue type safety
- [Phase 21-controle-operacional]: insuranceCost always null — insurance field not modeled in schema, surfaced in notes array
- [Phase 21-controle-operacional]: Depreciation aggregation cumulative (not period-filtered) — correct for TCO book value calculation
- [Phase 21-controle-operacional]: AlertsView returns null when all bucket counts are 0 — avoids visual noise on pages with clean document state
- [Phase 21-controle-operacional]: AssetCostTab uses dl semantic HTML for cost breakdown (dt=label, dd=value)
- [Phase 22]: depreciationConfigMissing returned as boolean flag (not 400 error) — activation succeeds, frontend warns user to configure depreciation
- [Phase 22]: Budget alert threshold defaults to 90% when wipBudgetAlertPct is null — avoids null-check errors in calculation
- [Phase 22]: CAPITALIZAR uses Prisma increment operator for acquisitionValue — atomic with transaction, avoids race conditions
- [Phase 22-hierarquia-avancada-imobilizado-andamento]: Hierarchy depth traverses upward from proposedParent (O(depth) not O(tree))
- [Phase 22-hierarquia-avancada-imobilizado-andamento]: Migration applied via psql directly due to broken shadow database (pre-existing cultivars issue)
- [Phase 22-hierarquia-avancada-imobilizado-andamento]: asset-wip.routes.ts stub created to unblock tests (full implementation in Plan 22-03)
- [Phase 22-03]: AssetHierarchyTab shows current asset highlighted, parent above (level 0), children indented (level 1/2)
- [Phase 22-03]: AssetDrawer.TabId exported so AssetsPage can use it directly — fixes pre-existing TS type mismatch
- [Phase 22-03]: WIP activation uses ConfirmModal variant=warning — medium criticality, irreversible status change
- [Phase 23-relatorios-dashboard-patrimonial]: groupBy + in-memory join used for inventory roll-up; HOURS_OF_USE/UNITS_OF_PRODUCTION fall back to STRAIGHT_LINE for projection
- [Phase 23-relatorios-dashboard-patrimonial]: Routes registered under /orgs/:orgId (plural) matching plan spec; authenticate+checkPermission('assets:read') per asset RBAC boundary decision
- [Phase 23-relatorios-dashboard-patrimonial]: useFarmContext (not useFarm) is the correct export from FarmContext.tsx — useFarm does not exist
- [Phase 23-relatorios-dashboard-patrimonial]: CC_TEMPLATES defined as constant inside CostCenterWizardModal.tsx per plan spec (not separate file)
- [Phase 23-relatorios-dashboard-patrimonial]: Tab panels use display:none/block (no animation) per UI-SPEC for asset reports tabs
- [Phase 23-relatorios-dashboard-patrimonial]: Alert badges always combine color + icon + aria-label (never color alone) for WCAG compliance

### Pending Todos

- Test react-spreadsheet-import React 19 compatibility before committing to Phase 16 bulk import story
- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido before Phase 22 (accelerated depreciation dual-track)
- Confirm biological asset fair value input method (manual vs automatic) before Phase 24 planning
- Validate NF-e v4.0 XML tag paths against real sample before Phase 19 story writing
- Confirm whether any customer fleet has active finance leases before committing to Phase 24 leasing scope

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-23T15:24:34.233Z
Stopped at: Completed 23-03-PLAN.md — Task 4 checkpoint: awaiting human visual verification
Resume file: None
Next action: `/gsd:plan-phase 16`
