---
phase: 23-relatorios-dashboard-patrimonial
plan: '01'
subsystem: asset-reports
tags: [backend, reports, depreciation, tco, inventory, export]
dependency_graph:
  requires:
    - apps/backend/src/modules/depreciation/depreciation-engine.service.ts
    - apps/backend/src/modules/assets/assets.routes.ts
    - apps/backend/src/middleware/auth.ts
    - apps/backend/src/middleware/check-permission.ts
  provides:
    - GET /api/orgs/:orgId/asset-reports/inventory
    - GET /api/orgs/:orgId/asset-reports/inventory/export
    - GET /api/orgs/:orgId/asset-reports/depreciation-projection
    - GET /api/orgs/:orgId/asset-reports/tco-fleet
  affects:
    - apps/backend/src/app.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED-GREEN) with jest.mock for prisma and computeDepreciation
    - Two-query roll-up pattern for inventory (groupBy + findMany in-memory join)
    - Forward simulation loop using existing computeDepreciation engine
    - Fleet TCO aggregation via groupBy with in-memory map joins
    - Export via pdfkit (PDF) and exceljs (XLSX/CSV) — same pattern as asset-export.service.ts
key_files:
  created:
    - apps/backend/src/modules/asset-reports/asset-reports.types.ts
    - apps/backend/src/modules/asset-reports/asset-reports.service.ts
    - apps/backend/src/modules/asset-reports/asset-reports.service.spec.ts
    - apps/backend/src/modules/asset-reports/asset-reports.routes.ts
    - apps/backend/src/modules/asset-reports/asset-reports.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Used groupBy + in-memory join (not raw SQL) for inventory roll-up — consistent with existing pattern in depreciation.service.ts'
  - 'HOURS_OF_USE and UNITS_OF_PRODUCTION methods fall back to STRAIGHT_LINE for forward projection — these methods require live meter/unit readings not available for future periods; assetsEstimated counter tracks this'
  - 'Decimal.max() is a static method (not instance) — netBookValue clamped with conditional check instead'
  - "authenticate + checkPermission('assets:read') pattern used — consistent with STATE.md decision for asset module RBAC boundary"
  - 'Routes registered under /orgs/:orgId (plural) not /org/:orgId (singular) — plan spec used plural form'
metrics:
  duration: 803s
  completed: '2026-03-23'
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  tests_added: 26
---

# Phase 23 Plan 01: Asset Reports Backend Summary

Backend asset-reports module delivering patrimonial inventory report, depreciation projection, TCO fleet dashboard with repair-vs-replace alerts, and PDF/XLSX/CSV export — consuming computeDepreciation engine for forward simulation.

## What Was Built

### Module: `asset-reports`

New module under `apps/backend/src/modules/asset-reports/` with 5 files:

**Types (`asset-reports.types.ts`):**

- `InventoryReportQuery/Row/Result` — inventory report with classification-level aggregates
- `DepreciationProjectionQuery/Row/Result` — forward projection series for 12/36/60 month horizons
- `TCOFleetQuery/Row/Result` — per-asset TCO with `RepairAlert` enum
- `ExportFormat` union type (`pdf | xlsx | csv`)

**Service (`asset-reports.service.ts`) — 4 exported functions:**

1. `getInventoryReport` — Two-query pattern: `groupBy` for gross values, `findMany` for asset→classification map, `groupBy` on depreciation entries for accumulated amounts. In-memory join computes netBookValue per classification. Optional period filter adds acquisitions/disposals counts.

2. `getDepreciationProjection` — Forward simulation: fetches assets with their `depreciationConfig` and latest `depreciationEntry`. For each active asset, loops `horizonMonths` times calling `computeDepreciation`. HOURS_OF_USE/UNITS_OF_PRODUCTION fall back to STRAIGHT_LINE (projection can't know future meter readings). Accumulates monthly totals into cumulative series.

3. `getTCOFleet` — Three parallel `groupBy` queries (depreciation, work orders, fuel records). Builds maps, computes per-asset TCO row. Repair alert logic: `maintenanceCost / acquisitionValue` >= 0.70 → REPLACE, >= 0.60 → MONITOR, < 0.60 → OK, acquisitionValue=0 → NO_DATA.

4. `exportInventoryReport` — Delegates to `getInventoryReport` then: PDF via pdfkit (landscape A4, table with totals row), XLSX via exceljs (bold header, currency format), CSV via exceljs `csv.writeBuffer()`.

**Routes (`asset-reports.routes.ts`) — 4 endpoints:**

- `GET /orgs/:orgId/asset-reports/inventory` — inventory report with optional filters
- `GET /orgs/:orgId/asset-reports/inventory/export?format=pdf|xlsx|csv` — file download
- `GET /orgs/:orgId/asset-reports/depreciation-projection?horizonMonths=12|36|60` — forward series
- `GET /orgs/:orgId/asset-reports/tco-fleet` — fleet TCO with repair alerts

All endpoints require `authenticate` + `checkPermission('assets:read')`.

**app.ts** — Import and `app.use('/api', assetReportsRouter)` added after `assetWipRouter`.

## Tests

| File                          | Tests | Coverage                                                                                                                                                                                                          |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| asset-reports.service.spec.ts | 14    | inventory roll-up, empty dataset, period filters, projection 12-row series, monotonic cumulative, residual value edge case, HOURS_OF_USE fallback, TCO NO_DATA/REPLACE/MONITOR/OK thresholds, PDF/XLSX/CSV export |
| asset-reports.routes.spec.ts  | 12    | all 4 endpoints, farmId forwarding, format validation, horizonMonths validation, 401/403 auth guards                                                                                                              |

**Total: 26 tests, all passing.**

## Verification Results

```
Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
grep -c "assetReportsRouter" apps/backend/src/app.ts → 2 (import + use)
```

TypeScript: `npx tsc --noEmit` — no errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Decimal.max() is not an instance method**

- **Found during:** Task 1 GREEN phase
- **Issue:** Plan spec used `grossValue.minus(accumulatedDepreciation).max(new Decimal(0))` — but `max()` is a static method on Decimal, not an instance method
- **Fix:** Replaced with conditional `const diff = grossValue.minus(...); const netBookValue = diff.isNegative() ? new Decimal(0) : diff`
- **Files modified:** `asset-reports.service.ts`
- **Commit:** 097564e5 (within same task commit)

**2. Plan spec used `requireAuth`/`requirePermission` but codebase uses `authenticate`/`checkPermission`**

- **Found during:** Task 2 implementation
- **Issue:** Plan's route template used non-existent middleware names
- **Fix:** Used correct `authenticate` + `checkPermission` from actual middleware files
- **Files modified:** `asset-reports.routes.ts`
- **Commit:** 1880def9 (within same task commit)

## Self-Check: PASSED

All 5 created files exist. Both commits (097564e5, 1880def9) verified in git log. 26/26 tests pass.
