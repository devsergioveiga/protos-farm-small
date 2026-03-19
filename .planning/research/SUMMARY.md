# Project Research Summary

**Project:** Protos Farm — v1.2 Gestão de Patrimônio (Asset Lifecycle Management)
**Domain:** Fixed asset management, CMMS, and biological asset valuation integrated into existing agricultural ERP
**Researched:** 2026-03-19
**Confidence:** HIGH for architecture and pitfalls (codebase-derived); HIGH for features (CPC 27/29/06 standards); MEDIUM for new dependency choices

## Executive Summary

This milestone adds a complete Asset Lifecycle Management module (Gestão de Patrimônio) to an already mature agricultural ERP. The domain is well-understood — Brazilian accounting standards CPC 27 (fixed assets), CPC 29 (biological assets), and CPC 06 R2 (leasing) are unambiguous in their requirements for depreciation, fair value measurement, and right-of-use assets. The key challenge is not innovation but integration fidelity: the new asset modules must consume existing `payables`, `receivables`, `cost-centers`, `stock-outputs`, and `installmentGenerator` infrastructure precisely, without duplicating or corrupting existing financial data.

The recommended approach builds in strict dependency order: core asset catalog first (all subsequent work depends on a clean asset entity with correct CPC 27/29 classification), then the depreciation engine (required for write-off gain/loss and financial reporting), then the maintenance CMMS (consumes stock outputs and generates payables), and finally advanced features (biological assets, leasing, and hierarchy). The architecture is additive — 9 new backend modules, 12 new Prisma migrations, a new `PATRIMÔNIO` frontend sidebar group, and targeted FK additions to `payables` and `receivables`. No existing module needs a rewrite.

The primary risk is integration contamination: asset acquisitions must never route through the existing `GoodsReceipt → StockEntry` flow (which would inflate stock balances and double-count payables). A secondary and equally critical risk is decimal precision in the depreciation engine — the project already uses `decimal.js` for all monetary arithmetic, and this discipline is mandatory for the depreciation service or accumulated rounding drift will make the depreciation ledger irreconcilable over years. Both risks have clear preventions and are avoidable with disciplined design and code review.

## Key Findings

### Recommended Stack

The milestone requires only 2 new npm packages. Everything else reuses infrastructure already installed in the monorepo: `pdfkit` for PDF reports, `exceljs` for bulk import, `decimal.js` for all monetary arithmetic, `node-cron` for the monthly depreciation scheduler, `bullmq` for async work order notifications, `recharts` for dashboards, `ioredis`/`nodemailer` for notifications, and `multer` for file uploads.

**Core technologies:**

- `fast-xml-parser@^5.5.7` (backend): NF-e XML parsing for asset acquisition import — preferred over `@xmldom/xmldom` for its object-mapping API that simplifies deep NF-e structure traversal; zero dependencies; actively maintained
- `react-spreadsheet-import@^4.7.1` (frontend): Multi-step column-mapping UI for bulk asset import from varied farmer spreadsheets; last published 2 years ago — MEDIUM confidence, React 19 compatibility must be tested before committing
- Custom `DepreciationEngine` in `packages/shared/src/utils/depreciation.ts`: supports LINEAR, HOURS_BASED, PRODUCTION_BASED, ACCELERATED; no npm library covers all four Brazilian-relevant methods with CPC 27 specifics
- Custom `BiologicalAssetValuation` service: CPC 29/IAS 41 fair value model; no npm library exists for this standard
- Asset hierarchy via Prisma self-relation + `$queryRaw` recursive CTEs: official Prisma recommendation for 3-level tree traversal

### Expected Features

**Must have (Phase 1 — Foundation):**

- Asset catalog with 6 classification types (Máquinas, Veículos, Implementos, Benfeitorias, Terras, Biológicos) — drives accounting treatment routing
- Asset registration with acquisition data, farm/cost-center assignment, status lifecycle (ACTIVE/INACTIVE/MAINTENANCE/DISPOSED/WIP), unique asset tag
- Hourmeter/odometer log — prerequisite for hours-based depreciation and maintenance triggers
- Document control with expiry alerts (CRLV, seguro, CCIR, ITR)
- Linear depreciation with pro-rata die, monthly batch run (idempotent), depreciation ledger per asset
- Cash purchase generating CP automatically via existing `payables` module
- Asset write-off (baixa) with gain/loss calculation
- Patrimônio report (gross value / accumulated depreciation / net book value by asset class)
- Mass import via CSV/Excel with column mapping

**Must have (Phase 2 — CMMS Maintenance):**

- Preventive maintenance plans with calendar and hourmeter triggers
- Work Order (OS) CRUD with state machine (OPEN → IN_PROGRESS → WAITING_PARTS → COMPLETED)
- OS accounting classification at closure (EXPENSE | CAPITALIZATION | DEFERRAL) — mandatory field, 400 if absent
- Parts consumption from existing stock-outputs module
- Maintenance cost attribution to cost centers
- Maintenance dashboard (MTBF, availability, open OS count, upcoming preventive OS)
- Cost-per-hour TCO calculation powered by accumulated data

**Should have (competitive differentiators — Phase 3+):**

- Composite asset hierarchy up to 3 levels (Colheitadeira → Motor → Correia) — rare in generic ERPs
- TCO dashboard per asset and per fleet — "repair vs. replace" decision support
- Asset under construction (Imobilizado em Andamento) with budget tracking
- Financed purchase with installment schedule via existing `installmentGenerator`
- Asset sale with gain/loss generating CR automatically
- Hours-based and production-based depreciation
- Accelerated depreciation dual-track (CPC accounting vs. fiscal RFB)
- QR code asset tags for mobile scan
- Seasonal maintenance calendar (warn if OS overlaps planting/harvest window)

**Must have (Phase 4 — Biological Assets):**

- Biological asset registration (cattle + perennial crops) with explicit CPC 27 vs CPC 29 classification
- Bearer plant classification under CPC 27 (coffee/orange trees — NOT CPC 29 fair value)
- Fair value measurement (manual entry — no live market data feed)
- Fair value gain/loss P&L disclosure per period
- Perennial crop maturity tracking (formação → produção)

**Defer to future milestone:**

- CIAP (ICMS credit recovery) — requires fiscal module as prerequisite
- NF-e XML import via SEFAZ integration — explicitly out of scope per PROJECT.md
- IoT/telematics integration — complexity vs. benefit not justified at current scale
- Predictive maintenance — requires 2-3 years of failure history
- Full project management (Gantt) for construction — out of scope

### Architecture Approach

The architecture is a clean additive extension of the existing monolith. Nine new backend modules form the asset domain organized by responsibility. All follow the established colocated pattern (`controller + service + routes + types`). A new `PATRIMÔNIO` sidebar group is added in the frontend. The existing `FarmMap.tsx` receives an additive asset marker layer via the existing `LayerControlPanel` extensibility point — no rewrite required.

**Major components:**

1. `assets/` — Core entity CRUD, hierarchy (AssetComponent join table), farm/CC/status assignment, bulk import, map layer; root dependency for all other modules
2. `asset-depreciation/` — Pure `calculateDepreciation()` function (shared for frontend preview) + monthly cron batch (Redis NX lock, per-org `withRlsContext`) + DepreciationRun tracking
3. `work-orders/` — OS state machine (`VALID_WO_TRANSITIONS`), atomic completion (StockOutput + Payable in one transaction), mandatory accounting classification at closure
4. `asset-acquisition/` + `asset-disposal/` — Financial integration hubs; consume `createPayable()`, `createReceivable()`, and `generateInstallments()` from existing infrastructure
5. `maintenance-plans/` + `fuel-records/` + `asset-documents/` — Operational records consumed by TCO calculation
6. `asset-dashboard/` — Read-only TCO aggregation; no new models; depends on indexes on `(assetId, periodYear, periodMonth)` on `depreciation_entries`
7. Monthly depreciation cron — `shared/cron/depreciation.cron.ts` following `digest.cron.ts` pattern exactly (Redis NX lock, per-org `withRlsContext`, chunk of 100 assets per transaction)

### Critical Pitfalls

1. **Asset purchase routed through GoodsReceipt/StockEntry** — The single most dangerous integration risk. An asset NF must never create a `StockEntry`. Use a separate `AssetAcquisition` module with `originType = 'ASSET_ACQUISITION'` on the CP. Add a guard in `GoodsReceipt` service to reject asset-category PO lines from the standard stock-entry flow. Recovery is expensive — requires auditing stock balances and financial reports.

2. **Depreciation decimal precision — float arithmetic drift** — All depreciation arithmetic must use `Decimal` from `decimal.js`. Add a "last-period balancing" entry so the final month brings net book value to exactly residual value. Add a unique constraint on `(assetId, periodYear, periodMonth)` in `depreciation_entries` to prevent duplicate entries on cron retry. Using JavaScript `number` types is a regression that will not be caught with clean test fixtures.

3. **CPC 27 vs CPC 29 classification error for biological assets** — Bearer plants (café, laranja) are CPC 27 depreciable assets, not CPC 29 fair-value assets. The `AssetClassification` enum must explicitly encode: `BEARER_PLANT` (CPC 27, depreciable), `BIOLOGICAL_ASSET_ANIMAL` (CPC 29, fair value), `LAND_RURAL_PROPERTY` (CPC 27, non-depreciable). The depreciation batch must guard against processing CPC 29 biological assets. This classification must be correct at schema creation — retrofitting after depreciation records exist requires data migration.

4. **OS accounting treatment not enforced at closure** — `accountingTreatment` on OS closure is a mandatory field, not optional. Missing it defaults all maintenance to OPEX, silently missing capitalizable overhauls that should increase asset book value. The `PATCH /work-orders/:id/close` endpoint must return 400 if `accountingTreatment` is absent. CAPITALIZATION must atomically update asset book value and recalculate depreciation.

5. **Batch depreciation without idempotency guard** — Running the monthly cron twice (crash + retry) must produce identical results. Unique constraint on `(assetId, periodYear, periodMonth)` in `depreciation_entries`. PostgreSQL advisory lock on `(organizationId, period)` prevents concurrent runs. Use `INSERT ... ON CONFLICT DO NOTHING` semantics. A `DepreciationRun` tracking table with status (PENDING/RUNNING/COMPLETED/FAILED) enables safe retry from the first unprocessed asset.

6. **Asset disposal without cancelling pending depreciation entries** — When an asset is sold or written off, all pending `DepreciationEntry` records for that asset must be cancelled atomically in the same transaction that creates the CR/CP and sets the terminal status. Status enum mismatch (e.g., `VENDIDO` vs `BAIXADO`) is a common bug that lets the batch continue depreciating disposed assets. Use a single terminal status concept for all disposal types.

7. **WIP asset depreciates before activation** — `AssetStatus.EM_ANDAMENTO` must be explicitly excluded from the depreciation batch query. CPC 27 requires depreciation to begin only when the asset is available for use. Depreciation begins only after `POST /assets/:id/activate` transitions status to `ATIVO` and sets `activationDate`. Define this status at schema creation, not as a later amendment.

## Implications for Roadmap

The dependency graph is clear and dictates a specific build order. Asset registration is the root node — everything else depends on a clean, classified asset entity. Depreciation must be proven correct before write-off or financial integration builds on it. Maintenance OS is independent of financial integration stories and can be validated faster. Financial integration phases (acquisition, disposal) are ordered acquisition-before-disposal because disposal gain/loss requires acquisition cost to be correctly recorded. Advanced features (hierarchy, biological assets, leasing) are deferred until the core loop is stable.

### Phase 1: Core Asset Entity and Foundation

**Rationale:** Asset registration is the absolute root dependency. No depreciation, no maintenance, no financial integration can be built without a clean asset entity with proper CPC 27/29 classification defined at schema creation.
**Delivers:** Asset catalog with 6 classification types, registration form, farm/CC/status assignment, hourmeter log, document control with expiry alerts, bulk CSV/Excel import with column mapping, asset map layer in FarmMap, asset ficha skeleton with tabs
**Addresses:** Asset catalog, registration, farm assignment, status lifecycle, unique tags, hourmeter/odometer log, document control, mass import, asset search/filtering
**Avoids:** CPC 27 vs CPC 29 classification error (define AssetClassification enum with explicit CPC mapping at schema creation); WIP premature depreciation (define EM_ANDAMENTO status at schema creation)
**Research flag:** Standard patterns — CPC 27 classification taxonomy is unambiguous; no phase research needed

### Phase 2: Depreciation Engine

**Rationale:** The depreciation engine must be built and validated before any write-off or financial integration work. Gain/loss calculations require accurate accumulated depreciation. The monthly batch idempotency guard must be in place before any data accumulates in production.
**Delivers:** DepreciationConfig per asset, `calculateDepreciation()` pure function (in `packages/shared` for frontend preview reuse), monthly cron batch (idempotent, per-org Redis lock, chunks of 100), DepreciationRun tracking table, pro-rata die for first/last months, depreciation ledger, DepreciationPage, depreciation schedule report
**Addresses:** Linear depreciation, monthly depreciation run, depreciation ledger, residual value, useful life, cost-center attribution in entries
**Uses:** `decimal.js` (existing), `node-cron` (existing), `ioredis` for Redis lock (existing), `pdfkit` for schedule PDF (existing)
**Avoids:** Float arithmetic drift (Decimal-only rule), batch idempotency (unique constraint + advisory lock), WIP exclusion (status guard in batch query)
**Research flag:** Standard accounting math — CPC 27 depreciation formulas are unambiguous; no phase research needed

### Phase 3: Maintenance CMMS

**Rationale:** Maintenance is independent of financial integration stories but depends on assets (Phase 1) and the existing stock-outputs module. Building maintenance before complex financial integrations allows the OS state machine and mandatory accounting classification to be validated with real data before the higher-risk asset disposal and leasing phases.
**Delivers:** Preventive maintenance plans with calendar/hourmeter triggers, Work Order CRUD with state machine (`VALID_WO_TRANSITIONS`), OS completion (atomic: StockOutput + Payable in one transaction), mandatory accounting classification at closure (400 if absent), maintenance dashboard (MTBF, availability, upcoming OS), cost-per-hour calculation foundation
**Addresses:** Preventive maintenance plans, trigger types, Work Order CRUD, OS accounting classification, parts consumption from stock, OS cost center attribution, maintenance history per asset, maintenance dashboard
**Uses:** `stock-outputs` module (existing, consumed read-only for parts), `payables` module (existing, for OS expense CP), `bullmq` (existing, for work order notifications), `handlebars`/`nodemailer` (existing, for email)
**Avoids:** OS state machine invalid transitions (`VALID_WO_TRANSITIONS` constant, same pattern as `checks.types.ts`); OS accounting treatment missing (400 at closure); parts mixed with field inputs (StockOutput `originType = WORK_ORDER` tagging)
**Research flag:** Standard CMMS patterns — well-documented; OS accounting classification stories need careful acceptance criteria to avoid the expense vs. capitalize ambiguity reaching production

### Phase 4: Asset Acquisition — Financial Integration

**Rationale:** Establishes the `AssetAcquisition` module as a separate code path from `GoodsReceipt`. Must come after Phase 1 (asset entity exists) and before Phase 5 (disposal requires knowing acquisition cost). This phase also adds the `payables` table migration (assetId FK, ASSET_PURCHASE enum value).
**Delivers:** Cash purchase generating CP (`originType = ASSET_PURCHASE`), financed purchase with installment schedule (reusing `generateInstallments`), NF-e XML file upload parsed by `fast-xml-parser`, multi-asset NF (one asset record per line item), payables table migration
**Addresses:** Cash purchase → auto CP, financed purchase → CP with installment schedule, multiple assets on same NF, NF-e XML pre-fill
**Uses:** `fast-xml-parser@^5.5.7` (new), `multer` (existing), `generateInstallments` in `packages/shared` (existing), `createPayable()` (existing)
**Avoids:** Asset purchase double-counting via GoodsReceipt (AssetAcquisition never calls stockEntryService; GoodsReceipt guard added); CAPEX/OPEX separation (ASSET_PURCHASE distinct from MAINTENANCE in PayableCategory)
**Research flag:** Standard payables integration pattern; NF-e XML tag paths (infNFe.det[n] structure, schema v4.0) should be validated against a real NF-e sample during story planning before committing to field mappings

### Phase 5: Asset Disposal and Write-Off

**Rationale:** Asset disposal requires the depreciation engine (Phase 2) to be correct — final pro-rata depreciation runs atomically at disposal. Build after Phase 4 so the financial integration pattern (`originType` on Receivable) is established consistently.
**Delivers:** Asset write-off (descarte, sinistro, obsolescência), asset sale generating CR with gain/loss, installment sale (reusing `generateInstallments`), receivables table migration (assetId FK, ASSET_SALE enum value), atomic disposal transaction (final depreciation + status update + pending entry cancellation + CR creation)
**Addresses:** Asset write-off (baixa), asset sale → auto CR, partial installment sale, casualty loss (sinistro), financial summary per asset
**Avoids:** Disposal without cancelling pending depreciation entries (atomic `prisma.$transaction()` required); status enum consistency (single DISPOSED terminal status in batch guard)
**Research flag:** Standard patterns — no phase research needed

### Phase 6: Operational Records (Fuel + Documents Enhanced)

**Rationale:** Fuel records and enhanced document features are low complexity and independent. Building after the core operational loop (Phases 1-5) is stable. These feed TCO calculations in the reporting phase.
**Delivers:** Fuel consumption log per asset (cost/liter, cost/hour trend), fuel efficiency benchmarking (flag 20%+ above fleet average), advanced document expiry calendar, document expiry cron alerts (30/15/7 days before), QR code generation per asset, mobile deep-link from QR to asset ficha
**Addresses:** Fuel consumption log, fuel efficiency benchmarking, document control with expiry alerts (enhanced), QR code asset tags, availability for mobile asset identification
**Avoids:** Document expiry alerts for inactive assets (filter WHERE asset.status = ATIVO); fuel cost/hour requiring hourmeter at refueling (horímetroAtRefueling required for hour-metered machinery)
**Research flag:** Standard patterns — no phase research needed

### Phase 7: Advanced Depreciation and Asset Hierarchy

**Rationale:** Hours-based and production-based depreciation require real hourmeter/production data from Phase 1/6. Composite asset hierarchy adds complexity to existing asset queries and must be built after the simple asset model is stable. Accelerated depreciation dual-track is a Brazilian-specific feature requiring careful data model design.
**Delivers:** Hours-based depreciation (with PENDING_HOURS_DATA flag when horímetro missing — not R$0), production-based depreciation, accelerated depreciation dual-track (CPC book value separate from fiscal book value as org-level opt-in), composite asset hierarchy up to 3 levels (AssetComponent join table + recursive CTE + depth guard), asset transfer between farms (mandatory CC allocation review at transfer)
**Addresses:** Hours-of-use depreciation, production-based depreciation, accelerated depreciation, composite asset hierarchy (pai-filho), asset transfer between farms
**Avoids:** Hours-based with missing horímetro (PENDING_HOURS_DATA not R$0); hierarchy depth N+1 queries (recursive CTE, depth column at schema); circular reference prevention (traverse-up guard before AssetComponent insert); asset transfer without CC update (mandatory CC review)
**Research flag:** Accelerated depreciation dual-track scope needs validation — confirm whether farm legal entity type (Simples Nacional vs Lucro Real vs Lucro Presumido) requires the fiscal track before building it; make it an org-level opt-in to avoid unused complexity

### Phase 8: Reporting and TCO Dashboard

**Rationale:** All reporting is read-only aggregation over data produced by Phases 1-7. Building reports last ensures underlying data is correct before exposing it in dashboards. TCO calculation joins assets + depreciation_entries + work_orders + fuel_records — all must exist and be correct first.
**Delivers:** PatrimonialDashboardPage (total patrimônio, depreciation YTD, gain/loss summary), TCO per asset and fleet (cost/hour calculation), repair-vs-replace alert (when cumulative maintenance > 60-70% of replacement cost), Patrimônio report PDF (gross/accumulated/net by asset class), depreciation schedule report (12/36/60 month projection), cost-center depreciation attribution report, asset utilization report, asset inventory reconciliation (physical count vs contábil via QR scan)
**Addresses:** TCO dashboard, repair-vs-replace recommendation, patrimônio report, depreciation schedule report, CC depreciation report, asset utilization report, asset inventory reconciliation
**Uses:** `recharts` (existing), `pdfkit` (existing), `exceljs` (existing)
**Avoids:** AccumulatedDepreciation computed on-the-fly from SUM (use running total column on Asset, updated atomically per entry); PatrimonialDashboard timeout (composite indexes on depreciation_entries and work_orders before this phase)
**Research flag:** Standard patterns — ensure composite indexes `(assetId, periodYear, periodMonth)` on `depreciation_entries` and `(assetId, completedAt)` on `work_orders` are in place before stories are written

### Phase 9: Biological Assets (CPC 29) and Leasing (CPC 06)

**Rationale:** Biological assets and leasing are the most complex features with the most accounting nuance. Building them last allows the team to use established patterns from all prior phases. Leasing (right-of-use asset + liability amortization) is the highest-risk financial feature and benefits from the depreciation engine and financial integration patterns being fully proven.
**Delivers:** Biological asset registration (cattle + perennial crops), bearer plant classification under CPC 27 (coffee/orange trees with their own depreciation schedule), fair value measurement for CPC 29 assets (manual entry), fair value gain/loss P&L entry per period (labeled as non-cash), perennial crop maturity tracking (formação → produção), biological asset dashboard, leasing CPC 06 (ROU asset + lease liability amortization with effective interest method), imobilizado em andamento (partial contributions + activation event)
**Addresses:** Biological asset registration, CPC 29 fair value, transformation gain/loss, harvest product separation, perennial crop maturity, leasing, imobilizado em andamento
**Avoids:** CPC 27 vs CPC 29 confusion (bearer plants under CPC 27 depreciable, cattle under CPC 29 fair value); leasing ROU asset missing (AssetLease must create Asset(RIGHT_OF_USE) and enter depreciation batch); biological fair value unrealized gain misinterpreted (inline non-cash label required); WIP depreciating before activation
**Research flag:** Needs phase research — biological asset valuation inputs (CEPEA price indices, cattle arroba pricing sources), CPC 29 fair value disclosure requirements, leasing effective interest amortization method — validate with an accountant before story writing

### Phase Ordering Rationale

- Asset registration is the root dependency. No other phase can start without a correct asset entity with proper classification. This is non-negotiable.
- Depreciation must be correct before write-off or any financial integration uses net book value. Do not build Phase 4 or 5 before Phase 2 is validated.
- Maintenance (Phase 3) is independent of financial integration and builds faster, providing real TCO data earlier. The OS accounting classification is high-risk but well-understood — handle it explicitly in story acceptance criteria.
- Acquisition before disposal: you cannot calculate disposal gain/loss without the acquisition cost being correctly recorded.
- Advanced features (Phases 7, 9) deferred until the core loop is proven in production. This reduces rework risk if requirements shift.
- Biological assets and leasing are combined into one phase (9) to reduce context switching and because they share the theme of specialized accounting models.

### Research Flags

Phases needing deeper research during planning:

- **Phase 7 (Advanced Depreciation):** Accelerated depreciation dual-track — confirm which farm legal entity types actually need the fiscal track; validate RFB table rates for 2026; consider org-level opt-in flag to avoid building unused complexity.
- **Phase 9 (Biological Assets + Leasing):** CEPEA price index references for fair value, CPC 29 fair value disclosure requirements in financial statements, leasing effective interest method amortization — validate with an accountant before story writing to avoid non-compliant implementation.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Asset Entity):** CPC 27 classification taxonomy is unambiguous; monorepo module patterns are established.
- **Phase 2 (Depreciation Engine):** Linear depreciation formulas are standard accounting math; cron infrastructure already exists in codebase.
- **Phase 3 (Maintenance CMMS):** MaintainX/Fiix CMMS patterns are well-documented; state machine follows established `VALID_TRANSITIONS` project pattern.
- **Phase 4 (Acquisition):** Payables integration pattern established in v1.1 procurement phase; fast-xml-parser integration is straightforward.
- **Phase 5 (Disposal):** Receivables integration pattern established; gain/loss formula is standard CPC 27.
- **Phase 6 (Operational Records):** Simple CRUD with notification hooks; no novel patterns.
- **Phase 8 (Reporting):** Read-only aggregation; recharts and pdfkit patterns are proven in codebase.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                                                                             |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Only 2 new packages; all others already installed and in active use. fast-xml-parser npm-verified. react-spreadsheet-import is MEDIUM due to React 19 compat uncertainty — test in isolation before Phase 1 bulk import story.                    |
| Features     | HIGH       | CPC 27, CPC 29, and CPC 06 R2 are official Brazilian accounting standards with no ambiguity on core requirements. CMMS patterns verified against MaintainX, FTMaintenance, SAP FI-AA, and TOTVS Protheus SIGAATF documentation.                   |
| Architecture | HIGH       | Derived from direct codebase analysis (6500+ line Prisma schema, existing service patterns, cron and state machine infrastructure). All integration points verified against existing code. No guesses.                                            |
| Pitfalls     | HIGH       | Integration pitfalls from direct codebase analysis. Accounting standard pitfalls from CPC 27/29/06 official texts. Batch performance patterns from PostgreSQL docs and ERP community (MEDIUM for scale-specific claims beyond 500 organizations). |

**Overall confidence:** HIGH

### Gaps to Address

- **react-spreadsheet-import React 19 compatibility:** Must be tested in isolation before the bulk import story is started in Phase 1. If incompatible, fall back to custom step wizard + raw `exceljs` on frontend (adds 2-3 days of work, well-understood effort).
- **Accelerated depreciation dual-track scope:** Confirm with the customer whether their farm entities are Simples Nacional (no fiscal track needed) or Lucro Real/Presumido (fiscal track required). Make dual-track an org-level opt-in flag to avoid building complexity that may not be used.
- **Biological asset fair value inputs:** Confirm whether CEPEA price data will be entered manually by the accountant or expected to be fetched automatically. Research recommends manual entry (no API integration), but this must be aligned with customer expectation before Phase 9 planning.
- **Leasing scope in this milestone:** CPC 06 right-of-use asset is the highest-complexity financial feature. Confirm whether any of the customer's current fleet is on finance leases before committing to Phase 9 scope. If no current finance leases exist, consider deferring to a future milestone.
- **NF-e XML tag paths:** The `fast-xml-parser` integration should be tested against a real NF-e v4.0 XML file before Phase 4 story writing to confirm the `infNFe.det[n]` field mappings for emitente, destinatário, and product line items.

## Sources

### Primary (HIGH confidence)

- `apps/backend/prisma/schema.prisma` (6500+ lines) — existing data models, enums, integration points verified directly
- `apps/backend/src/shared/cron/digest.cron.ts` — cron infrastructure pattern for depreciation batch
- `apps/backend/src/modules/checks/checks.types.ts` — VALID_TRANSITIONS state machine pattern
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — atomic multi-domain write pattern
- `apps/backend/src/modules/payables/payables.service.ts` — createPayable() function signature and originType/originId pattern
- `packages/shared/src/utils/installments.ts` — generateInstallments() reuse confirmation
- CPC 27 — Ativo Imobilizado (CVM): depreciation methods, useful life, bearer plants under CPC 27, non-depreciation of land
- CPC 29 — Ativos Biológicos e Produtos Agrícolas (CVM): fair value measurement, biological transformation, harvest product handoff
- CPC 06 R2 — Arrendamentos (IFRS 16): right-of-use asset, lease liability amortization, financial vs operational lease
- IAS 41 Agriculture (IFRS Foundation): fair value less costs to sell requirements, bearer plant amendment 2014
- Prisma official docs — self-relations and `$queryRaw` for recursive CTEs

### Secondary (MEDIUM confidence)

- MaintainX agricultural CMMS documentation — work order patterns, preventive maintenance triggers, ERP integration
- FTMaintenance — CMMS patterns for farm machinery
- TOTVS Protheus SIGAATF — Brazilian ERP asset module with dual-track CPC vs Fiscal
- AfixCode blog — CPC 27 depreciation, imobilizado em andamento, capitalization vs expense decision
- Fleetio — fleet TCO calculation methodology (acquisition + admin + depreciation + downtime)
- npm registry — fast-xml-parser 5.5.7, react-spreadsheet-import 4.7.1 (version-verified)
- KPMG Brasil guide on CPC 06 R2 leasing — ROU asset and lease liability treatment

### Tertiary (LOW confidence)

- WebSearch results on accelerated depreciation RFB rates for rural producers (rates cited; not read directly from RFB official site)
- Community sources on CPC 29 fair value subjectivity for unlisted biological assets (academic literature; specific auditor guidance not verified)
- Aegro blog on custo operacional hora máquina — hours-based depreciation context in Brazilian agro

---

_Research completed: 2026-03-19_
_Ready for roadmap: yes_
